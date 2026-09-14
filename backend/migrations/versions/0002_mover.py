"""三维设计及不可变参数版本。"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "mover_designs",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("workspace_id", sa.String(32), sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
    )
    op.create_index("ix_mover_designs_workspace_id", "mover_designs", ["workspace_id"])
    op.create_table(
        "mover_versions",
        sa.Column("design_id", sa.String(32), sa.ForeignKey("mover_designs.id"), primary_key=True),
        sa.Column("revision", sa.Integer(), primary_key=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("source_asset_id", sa.String(32), sa.ForeignKey("assets.id"), nullable=False),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
    )


def downgrade():
    op.drop_table("mover_versions")
    op.drop_table("mover_designs")
