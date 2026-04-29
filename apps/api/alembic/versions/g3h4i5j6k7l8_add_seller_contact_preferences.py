"""add seller contact preferences

Revision ID: g3h4i5j6k7l8
Revises: f2a3b4c5d6e7
Create Date: 2026-04-29 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "g3h4i5j6k7l8"
down_revision: Union[str, Sequence[str], None] = "f2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user", sa.Column("contact_text_enabled", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("user", sa.Column("contact_whatsapp_enabled", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.alter_column("user", "contact_text_enabled", server_default=None)
    op.alter_column("user", "contact_whatsapp_enabled", server_default=None)


def downgrade() -> None:
    op.drop_column("user", "contact_whatsapp_enabled")
    op.drop_column("user", "contact_text_enabled")
