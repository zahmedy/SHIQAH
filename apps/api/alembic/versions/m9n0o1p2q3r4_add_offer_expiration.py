"""Add offer expiration

Revision ID: m9n0o1p2q3r4
Revises: l8m9n0o1p2q3
Create Date: 2026-05-06
"""

from alembic import op
import sqlalchemy as sa


revision = "m9n0o1p2q3r4"
down_revision = "l8m9n0o1p2q3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("lead")}
    indexes = {index["name"] for index in inspector.get_indexes("lead")}

    if "expires_at" not in columns:
        op.add_column("lead", sa.Column("expires_at", sa.DateTime(), nullable=True))
    if "ix_lead_expires_at" not in indexes:
        op.create_index(op.f("ix_lead_expires_at"), "lead", ["expires_at"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("lead")}
    indexes = {index["name"] for index in inspector.get_indexes("lead")}

    if "ix_lead_expires_at" in indexes:
        op.drop_index(op.f("ix_lead_expires_at"), table_name="lead")
    if "expires_at" in columns:
        op.drop_column("lead", "expires_at")
