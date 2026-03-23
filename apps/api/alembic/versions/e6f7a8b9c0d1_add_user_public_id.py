"""add user public id

Revision ID: e6f7a8b9c0d1
Revises: d1e2f3a4b5c6
Create Date: 2026-03-23 12:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, Sequence[str], None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user", sa.Column("user_id", sa.String(length=32), nullable=True))

    connection = op.get_bind()
    user_table = sa.table(
        "user",
        sa.column("id", sa.Integer()),
        sa.column("user_id", sa.String(length=32)),
    )
    rows = connection.execute(
        sa.select(user_table.c.id).where(user_table.c.user_id.is_(None))
    ).fetchall()
    for (user_pk,) in rows:
        connection.execute(
            user_table.update().where(user_table.c.id == user_pk).values(user_id=f"user-{user_pk}")
        )

    op.create_index(op.f("ix_user_user_id"), "user", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_user_id"), table_name="user")
    op.drop_column("user", "user_id")
