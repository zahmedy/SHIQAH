"""rename price and mileage columns

Revision ID: e9f0a1b2c3d4
Revises: e8f9a0b1c2d3
Create Date: 2026-04-27 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "e9f0a1b2c3d4"
down_revision: Union[str, Sequence[str], None] = "e8f9a0b1c2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("carlisting") as batch_op:
        batch_op.drop_index("ix_carlisting_price_sar")
        batch_op.drop_index("ix_carlisting_mileage_km")
        batch_op.drop_index("ix_carlisting_sold_price_sar")
        batch_op.alter_column("price_sar", new_column_name="price", existing_type=sa.Integer(), nullable=True)
        batch_op.alter_column("mileage_km", new_column_name="mileage", existing_type=sa.Integer(), nullable=True)
        batch_op.alter_column("sold_price_sar", new_column_name="sold_price", existing_type=sa.Integer(), nullable=True)
        batch_op.create_index("ix_carlisting_price", ["price"])
        batch_op.create_index("ix_carlisting_mileage", ["mileage"])
        batch_op.create_index("ix_carlisting_sold_price", ["sold_price"])


def downgrade() -> None:
    with op.batch_alter_table("carlisting") as batch_op:
        batch_op.drop_index("ix_carlisting_sold_price")
        batch_op.drop_index("ix_carlisting_mileage")
        batch_op.drop_index("ix_carlisting_price")
        batch_op.alter_column("price", new_column_name="price_sar", existing_type=sa.Integer(), nullable=True)
        batch_op.alter_column("mileage", new_column_name="mileage_km", existing_type=sa.Integer(), nullable=True)
        batch_op.alter_column("sold_price", new_column_name="sold_price_sar", existing_type=sa.Integer(), nullable=True)
        batch_op.create_index("ix_carlisting_price_sar", ["price_sar"])
        batch_op.create_index("ix_carlisting_mileage_km", ["mileage_km"])
        batch_op.create_index("ix_carlisting_sold_price_sar", ["sold_price_sar"])
