"""add sold_at to car

Revision ID: e7f8a9b0c1d2
Revises: c9d8e7f6a5b4
Create Date: 2026-04-27 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, Sequence[str], None] = "c9d8e7f6a5b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("carlisting", sa.Column("sold_at", sa.DateTime(), nullable=True))
    op.create_index(op.f("ix_carlisting_sold_at"), "carlisting", ["sold_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_carlisting_sold_at"), table_name="carlisting")
    op.drop_column("carlisting", "sold_at")
