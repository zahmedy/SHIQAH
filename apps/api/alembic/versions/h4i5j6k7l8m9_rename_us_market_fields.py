"""Rename US market listing and offer fields

Revision ID: h4i5j6k7l8m9
Revises: g3h4i5j6k7l8
Create Date: 2026-04-29 12:40:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "h4i5j6k7l8m9"
down_revision: Union[str, Sequence[str], None] = "g3h4i5j6k7l8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("carlisting") as batch_op:
        batch_op.alter_column("title_ar", new_column_name="title", existing_type=sa.String(), nullable=False)
        batch_op.alter_column("description_ar", new_column_name="description", existing_type=sa.String(), nullable=False)

    indexes = {index["name"] for index in sa.inspect(op.get_bind()).get_indexes("lead")}
    with op.batch_alter_table("lead") as batch_op:
        if "ix_lead_amount_sar" in indexes:
            batch_op.drop_index("ix_lead_amount_sar")
        batch_op.alter_column("amount_sar", new_column_name="amount", existing_type=sa.Integer(), nullable=True)
        batch_op.create_index("ix_lead_amount", ["amount"])


def downgrade() -> None:
    indexes = {index["name"] for index in sa.inspect(op.get_bind()).get_indexes("lead")}
    with op.batch_alter_table("lead") as batch_op:
        if "ix_lead_amount" in indexes:
            batch_op.drop_index("ix_lead_amount")
        batch_op.alter_column("amount", new_column_name="amount_sar", existing_type=sa.Integer(), nullable=True)
        batch_op.create_index("ix_lead_amount_sar", ["amount_sar"])

    with op.batch_alter_table("carlisting") as batch_op:
        batch_op.alter_column("description", new_column_name="description_ar", existing_type=sa.String(), nullable=False)
        batch_op.alter_column("title", new_column_name="title_ar", existing_type=sa.String(), nullable=False)
