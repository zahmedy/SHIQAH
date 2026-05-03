"""Create notification table

Revision ID: k7l8m9n0o1p2
Revises: j6k7l8m9n0o1
Create Date: 2026-05-02 22:45:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = "k7l8m9n0o1p2"
down_revision: Union[str, Sequence[str], None] = "j6k7l8m9n0o1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "notification" in inspector.get_table_names():
        return

    op.create_table(
        "notification",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("car_id", sa.Integer(), nullable=True),
        sa.Column("type", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("title", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("body", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["car_id"], ["carlisting.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notification_actor_user_id"), "notification", ["actor_user_id"], unique=False)
    op.create_index(op.f("ix_notification_car_id"), "notification", ["car_id"], unique=False)
    op.create_index(op.f("ix_notification_created_at"), "notification", ["created_at"], unique=False)
    op.create_index(op.f("ix_notification_read_at"), "notification", ["read_at"], unique=False)
    op.create_index(op.f("ix_notification_type"), "notification", ["type"], unique=False)
    op.create_index(op.f("ix_notification_user_id"), "notification", ["user_id"], unique=False)


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "notification" not in inspector.get_table_names():
        return

    op.drop_index(op.f("ix_notification_user_id"), table_name="notification")
    op.drop_index(op.f("ix_notification_type"), table_name="notification")
    op.drop_index(op.f("ix_notification_read_at"), table_name="notification")
    op.drop_index(op.f("ix_notification_created_at"), table_name="notification")
    op.drop_index(op.f("ix_notification_car_id"), table_name="notification")
    op.drop_index(op.f("ix_notification_actor_user_id"), table_name="notification")
    op.drop_table("notification")
