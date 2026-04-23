"""add engine specs to car listing

Revision ID: c9d8e7f6a5b4
Revises: ab12cd34ef56
Create Date: 2026-04-23 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c9d8e7f6a5b4"
down_revision: Union[str, Sequence[str], None] = "ab12cd34ef56"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("carlisting", sa.Column("engine_cylinders", sa.Integer(), nullable=True))
    op.add_column("carlisting", sa.Column("engine_volume", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("carlisting", "engine_volume")
    op.drop_column("carlisting", "engine_cylinders")
