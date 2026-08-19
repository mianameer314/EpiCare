"""Add shared profile-photo metadata for every authenticated role.

Revision ID: 202608180003
Revises: 202608180002
Create Date: 2026-08-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202608180003"
down_revision: Union[str, Sequence[str], None] = "202608180002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _add_if_missing(name: str, column: sa.Column) -> None:
    bind = op.get_bind()
    existing = {item["name"] for item in sa.inspect(bind).get_columns("users")}
    if name not in existing:
        op.add_column("users", column)


def upgrade() -> None:
    _add_if_missing("profile_photo_url", sa.Column("profile_photo_url", sa.String(length=500), nullable=True))
    _add_if_missing("profile_photo_mime_type", sa.Column("profile_photo_mime_type", sa.String(length=100), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    existing = {item["name"] for item in sa.inspect(bind).get_columns("users")}
    for name in ("profile_photo_mime_type", "profile_photo_url"):
        if name in existing:
            op.drop_column("users", name)
