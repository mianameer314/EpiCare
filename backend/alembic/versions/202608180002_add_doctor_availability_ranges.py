"""Add explicit doctor availability ranges without removing legacy values.

Revision ID: 202608180002
Revises: 202608180001
Create Date: 2026-08-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202608180002"
down_revision: Union[str, Sequence[str], None] = "202608180001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _add_if_missing(name: str, column: sa.Column) -> None:
    bind = op.get_bind()
    existing = {item["name"] for item in sa.inspect(bind).get_columns("doctor_profiles")}
    if name not in existing:
        op.add_column("doctor_profiles", column)


def upgrade() -> None:
    _add_if_missing("available_day_start", sa.Column("available_day_start", sa.String(length=20), nullable=True))
    _add_if_missing("available_day_end", sa.Column("available_day_end", sa.String(length=20), nullable=True))
    _add_if_missing("available_time_start", sa.Column("available_time_start", sa.String(length=20), nullable=True))
    _add_if_missing("available_time_end", sa.Column("available_time_end", sa.String(length=20), nullable=True))

    columns = {item["name"] for item in sa.inspect(op.get_bind()).get_columns("doctor_profiles")}
    if {"available_days", "available_day_start", "available_day_end"}.issubset(columns):
        op.execute(
            sa.text(
                "UPDATE doctor_profiles "
                "SET available_day_start = available_days ->> 0, "
                "    available_day_end = available_days ->> (jsonb_array_length(available_days) - 1) "
                "WHERE available_day_start IS NULL "
                "  AND available_days IS NOT NULL "
                "  AND jsonb_array_length(available_days) > 0"
            )
        )

    if {"available_times", "available_time_start", "available_time_end"}.issubset(columns):
        op.execute(
            sa.text(
                "UPDATE doctor_profiles "
                "SET available_time_start = available_times ->> 0, "
                "    available_time_end = available_times ->> (jsonb_array_length(available_times) - 1) "
                "WHERE available_time_start IS NULL "
                "  AND available_times IS NOT NULL "
                "  AND jsonb_array_length(available_times) > 0"
            )
        )


def downgrade() -> None:
    bind = op.get_bind()
    existing = {item["name"] for item in sa.inspect(bind).get_columns("doctor_profiles")}
    for name in ("available_time_end", "available_time_start", "available_day_end", "available_day_start"):
        if name in existing:
            op.drop_column("doctor_profiles", name)
