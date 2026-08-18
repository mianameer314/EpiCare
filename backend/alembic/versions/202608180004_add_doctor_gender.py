"""Add optional gender metadata to doctor profiles.

Revision ID: 202608180004
Revises: 202608180003
Create Date: 2026-08-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202608180004"
down_revision: Union[str, Sequence[str], None] = "202608180003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = {item["name"] for item in sa.inspect(bind).get_columns("doctor_profiles")}
    if "gender" not in existing:
        op.add_column("doctor_profiles", sa.Column("gender", sa.String(length=30), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    existing = {item["name"] for item in sa.inspect(bind).get_columns("doctor_profiles")}
    if "gender" in existing:
        op.drop_column("doctor_profiles", "gender")
