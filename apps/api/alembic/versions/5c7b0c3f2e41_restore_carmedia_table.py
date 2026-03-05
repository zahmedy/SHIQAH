"""restore carmedia table

Revision ID: 5c7b0c3f2e41
Revises: 3e3a939f2699
Create Date: 2026-03-05 15:25:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "5c7b0c3f2e41"
down_revision: Union[str, Sequence[str], None] = "3e3a939f2699"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "carmedia" in inspector.get_table_names():
        return

    op.create_table(
        "carmedia",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("car_id", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(), nullable=False),
        sa.Column("public_url", sa.String(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_cover", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["car_id"], ["carlisting.id"], name=op.f("carmedia_car_id_fkey")),
        sa.PrimaryKeyConstraint("id", name=op.f("carmedia_pkey")),
    )
    op.create_index(op.f("ix_carmedia_storage_key"), "carmedia", ["storage_key"], unique=False)
    op.create_index(op.f("ix_carmedia_sort_order"), "carmedia", ["sort_order"], unique=False)
    op.create_index(op.f("ix_carmedia_is_cover"), "carmedia", ["is_cover"], unique=False)
    op.create_index(op.f("ix_carmedia_created_at"), "carmedia", ["created_at"], unique=False)
    op.create_index(op.f("ix_carmedia_car_id"), "carmedia", ["car_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "carmedia" not in inspector.get_table_names():
        return

    op.drop_index(op.f("ix_carmedia_car_id"), table_name="carmedia")
    op.drop_index(op.f("ix_carmedia_created_at"), table_name="carmedia")
    op.drop_index(op.f("ix_carmedia_is_cover"), table_name="carmedia")
    op.drop_index(op.f("ix_carmedia_sort_order"), table_name="carmedia")
    op.drop_index(op.f("ix_carmedia_storage_key"), table_name="carmedia")
    op.drop_table("carmedia")
