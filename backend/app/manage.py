"""迁移和备份命令显式运行；旧数据只读，恢复要求空数据库。"""

import argparse
import io
import json
import re
import tarfile
from pathlib import Path

from botocore.exceptions import ClientError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import settings
from .db import engine
from .models import Asset, Base, Share, ShareVersion
from .storage import initialize_bucket, s3


def migrate_legacy(directory):
    count = 0
    for folder in sorted(Path(directory).iterdir()):
        if not folder.is_dir() or not re.fullmatch("[a-f0-9]{32}", folder.name):
            continue
        meta = json.loads((folder / "meta.json").read_text())
        if not re.fullmatch("[a-f0-9]{64}", meta["tokenHash"]) or not isinstance(meta["version"], int):
            raise ValueError("旧分享元数据无效：" + folder.name)
        snapshots = [json.loads((folder / f"{v}.json").read_text()) for v in range(1, meta["version"] + 1)]
        with Session(engine()) as db, db.begin():
            old = db.get(Share, folder.name)
            if old:
                if old.token_hash != meta["tokenHash"]:
                    raise ValueError("旧分享标识冲突，未覆盖：" + folder.name)
                for version, data in enumerate(snapshots, 1):
                    saved = db.get(ShareVersion, (folder.name, version))
                    if version <= old.version:
                        if not saved or saved.document != data["document"]:
                            raise ValueError("旧分享历史不一致，未覆盖：" + folder.name)
                    else:
                        # 验收期间旧服务可继续写入，最终切换前只追加共同历史之后的新版本。
                        db.add(
                            ShareVersion(
                                share_id=folder.name,
                                version=version,
                                document=data["document"],
                                created_at=data["updatedAt"],
                            )
                        )
                if meta["version"] > old.version:
                    old.version = meta["version"]
                    count += 1
                continue
            db.add(Share(id=folder.name, token_hash=meta["tokenHash"], version=meta["version"]))
            db.flush()
            for version, data in enumerate(snapshots, 1):
                db.add(
                    ShareVersion(
                        share_id=folder.name,
                        version=version,
                        document=data["document"],
                        created_at=data["updatedAt"],
                    )
                )
            count += 1
    print(f"已迁移 {count} 份旧分享；原始文件保持不变。")


def backup(destination):
    path = Path(destination)
    if path.exists():
        raise ValueError("备份目标已存在，不覆盖")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.touch(mode=0o600, exist_ok=False)
    try:
        with engine().connect().execution_options(isolation_level="REPEATABLE READ") as conn, conn.begin():
            rows = {
                table.name: [dict(r) for r in conn.execute(select(table)).mappings()]
                for table in Base.metadata.sorted_tables
            }
            with tarfile.open(path, "w:gz") as archive:

                def add(name, content):
                    entry = tarfile.TarInfo(name)
                    entry.size, entry.mode = len(content), 0o600
                    archive.addfile(entry, io.BytesIO(content))

                add("database.json", json.dumps({"format": 1, "schema": "0002", "tables": rows}).encode())
                for asset in rows["assets"]:
                    body = s3().get_object(Bucket=settings().s3_bucket, Key=asset["object_key"])["Body"]
                    try:
                        content = body.read()
                    finally:
                        body.close()
                    import hashlib

                    if hashlib.sha256(content).hexdigest() != asset["sha256"]:
                        raise ValueError("对象哈希不匹配")
                    add("objects/" + asset["id"], content)
        path.chmod(0o600)
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    print("备份与对象哈希校验完成：" + str(path))


def restore(source):
    initialize_bucket()
    with Session(engine()) as db, db.begin():
        for table in Base.metadata.sorted_tables:
            if db.scalar(select(func.count()).select_from(table)):
                raise ValueError("恢复只允许空数据库；请创建新的 MySQL 数据库并先执行 Alembic")
        with tarfile.open(source, "r:gz") as archive:
            handle = archive.extractfile("database.json")
            if handle is None:
                raise ValueError("缺少备份索引")
            document = json.load(handle)
            if document.get("format") != 1 or document.get("schema") not in ("0001", "0002"):
                raise ValueError("不支持该备份版本")
            for asset in document["tables"]["assets"]:
                import hashlib

                raw = archive.extractfile("objects/" + asset["id"])
                if raw is None:
                    raise ValueError("缺少对象")
                content = raw.read()
                if hashlib.sha256(content).hexdigest() != asset["sha256"]:
                    raise ValueError("对象校验失败")
                try:
                    existing = s3().get_object(Bucket=settings().s3_bucket, Key=asset["object_key"])["Body"]
                except ClientError as exc:
                    if exc.response["Error"]["Code"] not in ("NoSuchKey", "404"):
                        raise
                    s3().put_object(
                        Bucket=settings().s3_bucket,
                        Key=asset["object_key"],
                        Body=content,
                        ContentType=asset["content_type"],
                        IfNoneMatch="*",
                    )
                else:
                    try:
                        if hashlib.sha256(existing.read()).hexdigest() != asset["sha256"]:
                            raise ValueError("恢复目标 S3 已有不同内容的对象，未覆盖")
                    finally:
                        existing.close()
            for table in Base.metadata.sorted_tables:
                rows = document["tables"].get(table.name, [])
                if rows:
                    db.execute(table.insert(), rows)
    print("数据库与 S3 对象恢复完成。")


def gc(dry_run=True):
    with Session(engine()) as db:
        used = set(db.scalars(select(Asset.object_key)))
    count = 0
    for page in s3().get_paginator("list_objects_v2").paginate(Bucket=settings().s3_bucket):
        for obj in page.get("Contents", []):
            # 保留最近一天的对象，避免清理尚未提交的上传事务。
            import time

            if obj["Key"] not in used and obj["LastModified"].timestamp() < time.time() - 86400:
                count += 1
                if not dry_run:
                    s3().delete_object(Bucket=settings().s3_bucket, Key=obj["Key"])
    print(f"{'可清理' if dry_run else '已清理'} {count} 个未引用对象。")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["migrate-legacy", "backup", "restore", "gc"])
    parser.add_argument("path", nargs="?")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if args.command == "gc":
        gc(not args.apply)
    elif args.command == "migrate-legacy":
        migrate_legacy(args.path or settings().legacy_share_directory)
    elif args.command == "backup":
        backup(args.path)
    else:
        restore(args.path)
