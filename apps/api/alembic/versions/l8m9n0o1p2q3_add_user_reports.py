"""add user reports

Revision ID: l8m9n0o1p2q3
Revises: k7l8m9n0o1p2
Create Date: 2026-05-05 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op


revision: str = "l8m9n0o1p2q3"
down_revision: Union[str, None] = "k7l8m9n0o1p2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "userreport",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("report_type", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("car_id", sa.Integer(), nullable=False),
        sa.Column("offer_id", sa.Integer(), nullable=True),
        sa.Column("reporter_user_id", sa.Integer(), nullable=False),
        sa.Column("reported_user_id", sa.Integer(), nullable=True),
        sa.Column("reason", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("admin_notes", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("reviewed_by_id", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["car_id"], ["carlisting.id"]),
        sa.ForeignKeyConstraint(["offer_id"], ["lead.id"]),
        sa.ForeignKeyConstraint(["reporter_user_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["reported_user_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["reviewed_by_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_userreport_car_id"), "userreport", ["car_id"], unique=False)
    op.create_index(op.f("ix_userreport_created_at"), "userreport", ["created_at"], unique=False)
    op.create_index(op.f("ix_userreport_offer_id"), "userreport", ["offer_id"], unique=False)
    op.create_index(op.f("ix_userreport_reason"), "userreport", ["reason"], unique=False)
    op.create_index(op.f("ix_userreport_report_type"), "userreport", ["report_type"], unique=False)
    op.create_index(op.f("ix_userreport_reported_user_id"), "userreport", ["reported_user_id"], unique=False)
    op.create_index(op.f("ix_userreport_reporter_user_id"), "userreport", ["reporter_user_id"], unique=False)
    op.create_index(op.f("ix_userreport_reviewed_at"), "userreport", ["reviewed_at"], unique=False)
    op.create_index(op.f("ix_userreport_reviewed_by_id"), "userreport", ["reviewed_by_id"], unique=False)
    op.create_index(op.f("ix_userreport_status"), "userreport", ["status"], unique=False)
    op.create_index(op.f("ix_userreport_updated_at"), "userreport", ["updated_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_userreport_updated_at"), table_name="userreport")
    op.drop_index(op.f("ix_userreport_status"), table_name="userreport")
    op.drop_index(op.f("ix_userreport_reviewed_by_id"), table_name="userreport")
    op.drop_index(op.f("ix_userreport_reviewed_at"), table_name="userreport")
    op.drop_index(op.f("ix_userreport_reporter_user_id"), table_name="userreport")
    op.drop_index(op.f("ix_userreport_reported_user_id"), table_name="userreport")
    op.drop_index(op.f("ix_userreport_report_type"), table_name="userreport")
    op.drop_index(op.f("ix_userreport_reason"), table_name="userreport")
    op.drop_index(op.f("ix_userreport_offer_id"), table_name="userreport")
    op.drop_index(op.f("ix_userreport_created_at"), table_name="userreport")
    op.drop_index(op.f("ix_userreport_car_id"), table_name="userreport")
    op.drop_table("userreport")
