"""make car price optional

Revision ID: b2c3d4e5f6a7
Revises: a7b8c9d0e1f2
Create Date: 2026-03-25 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b2c3d4e5f6a7"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("carlisting", "price_sar", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    op.alter_column("carlisting", "price_sar", existing_type=sa.Integer(), nullable=False)
