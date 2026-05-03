"""Add rejected_at to lead

Revision ID: j6k7l8m9n0o1
Revises: i5j6k7l8m9n0
Create Date: 2026-05-02 22:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "j6k7l8m9n0o1"
down_revision: Union[str, Sequence[str], None] = "i5j6k7l8m9n0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("lead")}
    indexes = {index["name"] for index in inspector.get_indexes("lead")}

    if "rejected_at" not in columns:
        op.add_column("lead", sa.Column("rejected_at", sa.DateTime(), nullable=True))
    if "ix_lead_rejected_at" not in indexes:
        op.create_index(op.f("ix_lead_rejected_at"), "lead", ["rejected_at"], unique=False)


def downgrade() -> None:
    indexes = {index["name"] for index in sa.inspect(op.get_bind()).get_indexes("lead")}
    if "ix_lead_rejected_at" in indexes:
        op.drop_index(op.f("ix_lead_rejected_at"), table_name="lead")

    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("lead")}
    if "rejected_at" in columns:
        op.drop_column("lead", "rejected_at")
