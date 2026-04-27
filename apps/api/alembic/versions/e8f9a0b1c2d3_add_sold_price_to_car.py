"""add sold price to car

Revision ID: e8f9a0b1c2d3
Revises: e7f8a9b0c1d2
Create Date: 2026-04-27 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "e8f9a0b1c2d3"
down_revision: Union[str, Sequence[str], None] = "e7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("carlisting", sa.Column("sold_price_sar", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_carlisting_sold_price_sar"), "carlisting", ["sold_price_sar"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_carlisting_sold_price_sar"), table_name="carlisting")
    op.drop_column("carlisting", "sold_price_sar")
