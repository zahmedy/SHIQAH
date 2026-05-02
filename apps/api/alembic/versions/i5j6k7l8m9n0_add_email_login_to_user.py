"""Add email login to user

Revision ID: i5j6k7l8m9n0
Revises: h4i5j6k7l8m9
Create Date: 2026-05-01 20:40:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = "i5j6k7l8m9n0"
down_revision: Union[str, Sequence[str], None] = "h4i5j6k7l8m9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("user")}
    indexes = {index["name"] for index in inspector.get_indexes("user")}

    with op.batch_alter_table("user") as batch_op:
        if "email" not in columns:
            batch_op.add_column(sa.Column("email", sqlmodel.sql.sqltypes.AutoString(), nullable=True))
        if "phone_e164" in columns:
            batch_op.alter_column("phone_e164", existing_type=sa.String(), nullable=True)

    indexes = {index["name"] for index in sa.inspect(op.get_bind()).get_indexes("user")}
    if "ix_user_email" not in indexes:
        op.create_index(op.f("ix_user_email"), "user", ["email"], unique=True)


def downgrade() -> None:
    indexes = {index["name"] for index in sa.inspect(op.get_bind()).get_indexes("user")}
    if "ix_user_email" in indexes:
        op.drop_index(op.f("ix_user_email"), table_name="user")

    with op.batch_alter_table("user") as batch_op:
        batch_op.drop_column("email")
        batch_op.alter_column("phone_e164", existing_type=sa.String(), nullable=False)
