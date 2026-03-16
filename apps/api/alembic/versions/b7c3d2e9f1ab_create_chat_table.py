"""create chat_message table

Revision ID: b7c3d2e9f1ab
Revises: a1b2c3d4e5f6
Create Date: 2026-03-16 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b7c3d2e9f1ab"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "chatmessage" in inspector.get_table_names():
        return

    op.create_table(
        "chatmessage",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("car_id", sa.Integer(), nullable=False),
        sa.Column("sender_user_id", sa.Integer(), nullable=False),
        sa.Column("message", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["car_id"], ["carlisting.id"], name=op.f("chatmessage_car_id_fkey")),
        sa.ForeignKeyConstraint(["sender_user_id"], ["user.id"], name=op.f("chatmessage_sender_user_id_fkey")),
        sa.PrimaryKeyConstraint("id", name=op.f("chatmessage_pkey")),
    )
    op.create_index(op.f("ix_chatmessage_car_id"), "chatmessage", ["car_id"], unique=False)
    op.create_index(op.f("ix_chatmessage_sender_user_id"), "chatmessage", ["sender_user_id"], unique=False)
    op.create_index(op.f("ix_chatmessage_created_at"), "chatmessage", ["created_at"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "chatmessage" not in inspector.get_table_names():
        return

    op.drop_index(op.f("ix_chatmessage_created_at"), table_name="chatmessage")
    op.drop_index(op.f("ix_chatmessage_sender_user_id"), table_name="chatmessage")
    op.drop_index(op.f("ix_chatmessage_car_id"), table_name="chatmessage")
    op.drop_table("chatmessage")
