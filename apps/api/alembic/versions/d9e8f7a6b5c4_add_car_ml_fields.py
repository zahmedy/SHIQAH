"""add ml suggestion fields to carlisting

Revision ID: d9e8f7a6b5c4
Revises: b2c3d4e5f6a7
Create Date: 2026-04-08 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d9e8f7a6b5c4"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("carlisting", sa.Column("ml_status", sa.String(), nullable=True))
    op.add_column("carlisting", sa.Column("ml_source", sa.String(), nullable=True))
    op.add_column("carlisting", sa.Column("ml_make", sa.String(), nullable=True))
    op.add_column("carlisting", sa.Column("ml_model", sa.String(), nullable=True))
    op.add_column("carlisting", sa.Column("ml_year_start", sa.Integer(), nullable=True))
    op.add_column("carlisting", sa.Column("ml_year_end", sa.Integer(), nullable=True))
    op.add_column("carlisting", sa.Column("ml_confidence", sa.Float(), nullable=True))
    op.add_column("carlisting", sa.Column("ml_raw", sa.Text(), nullable=True))
    op.add_column("carlisting", sa.Column("ml_updated_at", sa.DateTime(), nullable=True))
    op.create_index(op.f("ix_carlisting_ml_status"), "carlisting", ["ml_status"], unique=False)
    op.create_index(op.f("ix_carlisting_ml_updated_at"), "carlisting", ["ml_updated_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_carlisting_ml_updated_at"), table_name="carlisting")
    op.drop_index(op.f("ix_carlisting_ml_status"), table_name="carlisting")
    op.drop_column("carlisting", "ml_updated_at")
    op.drop_column("carlisting", "ml_raw")
    op.drop_column("carlisting", "ml_confidence")
    op.drop_column("carlisting", "ml_year_end")
    op.drop_column("carlisting", "ml_year_start")
    op.drop_column("carlisting", "ml_model")
    op.drop_column("carlisting", "ml_make")
    op.drop_column("carlisting", "ml_source")
    op.drop_column("carlisting", "ml_status")
