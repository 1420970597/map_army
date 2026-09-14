"""备份恢复只创建独立随机数据库；从不清空当前应用数据库或持久卷。"""

import os
import secrets
import subprocess
import sys

from backend.app.config import settings
from backend.app.db import engine
from backend.app.manage import backup
from backend.app.models import Asset, Base
from backend.app.storage import s3
from dotenv import dotenv_values
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session


def test_backup_restore_into_new_database(tmp_path):
    cfg = settings()
    archive = tmp_path / "backup.tar.gz"
    backup(archive)
    assert archive.stat().st_mode & 0o777 == 0o600
    root_password = os.environ.get("MYSQL_ROOT_PASSWORD") or dotenv_values(".env")["MYSQL_ROOT_PASSWORD"]
    root_url = make_url(cfg.database_url).set(username="root", password=root_password)
    name = "maparmy_restore_" + secrets.token_hex(6)
    bucket = "maparmy-restore-" + secrets.token_hex(6)
    admin = create_engine(root_url)
    with admin.begin() as connection:
        connection.execute(text(f"CREATE DATABASE `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin"))
    restore_url = root_url.set(database=name)
    environment = {
        **os.environ,
        "DATABASE_URL": restore_url.render_as_string(hide_password=False),
        "S3_BUCKET": bucket,
    }
    target = create_engine(restore_url)
    try:
        subprocess.run(
            [sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", "upgrade", "head"],
            env=environment,
            check=True,
            capture_output=True,
        )
        subprocess.run(
            [sys.executable, "-m", "backend.app.manage", "restore", str(archive)],
            env=environment,
            check=True,
            capture_output=True,
        )
        with engine().connect() as original, target.connect() as restored:
            for table in Base.metadata.sorted_tables:
                before = sorted([dict(row) for row in original.execute(select(table)).mappings()], key=str)
                after = sorted([dict(row) for row in restored.execute(select(table)).mappings()], key=str)
                assert before == after, table.name
        with Session(target) as db:
            for asset in db.scalars(select(Asset)):
                import hashlib

                body = s3().get_object(Bucket=bucket, Key=asset.object_key)["Body"]
                try:
                    assert hashlib.sha256(body.read()).hexdigest() == asset.sha256
                finally:
                    body.close()
        again = subprocess.run(
            [sys.executable, "-m", "backend.app.manage", "restore", str(archive)],
            env=environment,
            capture_output=True,
        )
        assert again.returncode != 0
    finally:
        target.dispose()
        with admin.begin() as connection:
            connection.execute(text(f"DROP DATABASE `{name}`"))
        admin.dispose()
        for page in s3().get_paginator("list_objects_v2").paginate(Bucket=bucket):
            for obj in page.get("Contents", []):
                s3().delete_object(Bucket=bucket, Key=obj["Key"])
        s3().delete_bucket(Bucket=bucket)
