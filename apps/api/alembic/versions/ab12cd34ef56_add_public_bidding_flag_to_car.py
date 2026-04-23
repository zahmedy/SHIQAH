"""add public bidding flag to car listing

Revision ID: ab12cd34ef56
Revises: f1a2b3c4d5e6
Create Date: 2026-04-23 09:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "ab12cd34ef56"
down_revision: Union[str, Sequence[str], None] = "d9e8f7a6b5c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "carlisting",
        sa.Column("public_bidding_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(
        op.f("ix_carlisting_public_bidding_enabled"),
        "carlisting",
        ["public_bidding_enabled"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_carlisting_public_bidding_enabled"), table_name="carlisting")
    op.drop_column("carlisting", "public_bidding_enabled")
