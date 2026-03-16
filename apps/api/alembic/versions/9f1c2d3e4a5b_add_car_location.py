"""add car location

Revision ID: 9f1c2d3e4a5b
Revises: b7c3d2e9f1ab
Create Date: 2026-03-16 12:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "9f1c2d3e4a5b"
down_revision: Union[str, Sequence[str], None] = "b7c3d2e9f1ab"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("carlisting", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("carlisting", sa.Column("longitude", sa.Float(), nullable=True))
    op.create_index(op.f("ix_carlisting_latitude"), "carlisting", ["latitude"], unique=False)
    op.create_index(op.f("ix_carlisting_longitude"), "carlisting", ["longitude"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_carlisting_longitude"), table_name="carlisting")
    op.drop_index(op.f("ix_carlisting_latitude"), table_name="carlisting")
    op.drop_column("carlisting", "longitude")
    op.drop_column("carlisting", "latitude")
