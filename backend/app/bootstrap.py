"""部署启动先迁移结构与旧分享，再加载内置目录；任一步失败都会阻止 API 上线。"""

from alembic import command
from alembic.config import Config

from .config import settings
from .manage import migrate_legacy
from .seed import seed

if __name__ == "__main__":
    command.upgrade(Config("backend/alembic.ini"), "head")
    if settings().legacy_share_directory.is_dir():
        migrate_legacy(settings().legacy_share_directory)
    seed()
