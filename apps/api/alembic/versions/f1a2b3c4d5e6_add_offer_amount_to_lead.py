"""add offer amount to lead

Revision ID: f1a2b3c4d5e6
Revises: a1b2c3d4e5f6
Create Date: 2026-03-25 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("lead")}
    if "amount_sar" not in columns:
        op.add_column("lead", sa.Column("amount_sar", sa.Integer(), nullable=True))
    indexes = {index["name"] for index in inspector.get_indexes("lead")}
    if op.f("ix_lead_amount_sar") not in indexes:
        op.create_index(op.f("ix_lead_amount_sar"), "lead", ["amount_sar"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {index["name"] for index in inspector.get_indexes("lead")}
    if op.f("ix_lead_amount_sar") in indexes:
        op.drop_index(op.f("ix_lead_amount_sar"), table_name="lead")
    columns = {column["name"] for column in inspector.get_columns("lead")}
    if "amount_sar" in columns:
        op.drop_column("lead", "amount_sar")
