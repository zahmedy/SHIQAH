"""add review metadata to car listing

Revision ID: c4d5e6f7a8b9
Revises: 9f1c2d3e4a5b
Create Date: 2026-03-22 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, Sequence[str], None] = "9f1c2d3e4a5b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("carlisting", sa.Column("reviewed_at", sa.DateTime(), nullable=True))
    op.add_column("carlisting", sa.Column("review_source", sa.String(), nullable=True))
    op.add_column("carlisting", sa.Column("review_reason", sa.String(), nullable=True))
    op.create_index(op.f("ix_carlisting_reviewed_at"), "carlisting", ["reviewed_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_carlisting_reviewed_at"), table_name="carlisting")
    op.drop_column("carlisting", "review_reason")
    op.drop_column("carlisting", "review_source")
    op.drop_column("carlisting", "reviewed_at")
