"""add archive restore metadata

Revision ID: f2a3b4c5d6e7
Revises: e9f0a1b2c3d4
Create Date: 2026-04-29 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "f2a3b4c5d6e7"
down_revision: Union[str, Sequence[str], None] = "e9f0a1b2c3d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("carlisting", sa.Column("archived_at", sa.DateTime(), nullable=True))
    op.add_column("carlisting", sa.Column("status_before_archive", sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.create_index(op.f("ix_carlisting_archived_at"), "carlisting", ["archived_at"], unique=False)
    op.create_index(op.f("ix_carlisting_status_before_archive"), "carlisting", ["status_before_archive"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_carlisting_status_before_archive"), table_name="carlisting")
    op.drop_index(op.f("ix_carlisting_archived_at"), table_name="carlisting")
    op.drop_column("carlisting", "status_before_archive")
    op.drop_column("carlisting", "archived_at")
