"""迁移使用与应用相同的连接配置。"""

from alembic import context

from backend.app.db import engine
from backend.app.models import Base

with engine().connect() as connection:
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()
