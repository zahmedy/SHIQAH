"""add accepted_at to lead

Revision ID: a7b8c9d0e1f2
Revises: f1a2b3c4d5e6
Create Date: 2026-03-25 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a7b8c9d0e1f2"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("lead", sa.Column("accepted_at", sa.DateTime(), nullable=True))
    op.create_index(op.f("ix_lead_accepted_at"), "lead", ["accepted_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_lead_accepted_at"), table_name="lead")
    op.drop_column("lead", "accepted_at")
