"""建立工作空间、标图、分享、资产、目录及任务数据表。"""

from alembic import op

from backend.app.models import Base

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    Base.metadata.create_all(bind=op.get_bind())


def downgrade():
    raise RuntimeError("初始数据迁移不支持破坏性回退；请恢复经过验证的备份。")
