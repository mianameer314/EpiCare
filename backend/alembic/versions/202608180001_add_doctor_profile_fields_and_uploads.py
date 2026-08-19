"""Add doctor professional profile fields and upload metadata.

Revision ID: 202608180001
Revises: 8746b80a90a1
Create Date: 2026-08-18

This revision is intentionally additive and idempotent. A previous local
revision already added some professional fields under legacy column names, so
those columns are detected and reused rather than duplicated or dropped.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "202608180001"
down_revision: Union[str, Sequence[str], None] = "8746b80a90a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _add_if_missing(table: str, name: str, column: sa.Column) -> None:
    bind = op.get_bind()
    existing = {item["name"] for item in sa.inspect(bind).get_columns(table)}
    if name not in existing:
        op.add_column(table, column)


def upgrade() -> None:
    table = "doctor_profiles"
    _add_if_missing(table, "pmdc_certificate_path", sa.Column("pmdc_certificate_path", sa.String(length=500), nullable=True))
    _add_if_missing(table, "pmdc_certificate_name", sa.Column("pmdc_certificate_name", sa.String(length=255), nullable=True))
    _add_if_missing(table, "pmdc_certificate_mime_type", sa.Column("pmdc_certificate_mime_type", sa.String(length=100), nullable=True))
    _add_if_missing(table, "pmdc_certificate_size", sa.Column("pmdc_certificate_size", sa.Integer(), nullable=True))
    _add_if_missing(table, "profile_photo_url", sa.Column("profile_photo_url", sa.String(length=500), nullable=True))
    _add_if_missing(table, "profile_photo_mime_type", sa.Column("profile_photo_mime_type", sa.String(length=100), nullable=True))
    _add_if_missing(table, "years_of_experience", sa.Column("years_of_experience", sa.Integer(), nullable=True))
    _add_if_missing(table, "consultation_fee", sa.Column("consultation_fee", sa.Numeric(precision=10, scale=2), nullable=True))
    _add_if_missing(table, "available_days", sa.Column("available_days", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    _add_if_missing(table, "available_times", sa.Column("available_times", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    _add_if_missing(table, "languages", sa.Column("languages", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    _add_if_missing(table, "bio", sa.Column("bio", sa.Text(), nullable=True))
    _add_if_missing(table, "consultation_types", sa.Column("consultation_types", postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    # Preserve legacy start/end availability values when present.
    columns = {item["name"] for item in sa.inspect(op.get_bind()).get_columns(table)}
    if {"available_times", "available_time_start", "available_time_end"}.issubset(columns):
        op.execute(
            sa.text(
                "UPDATE doctor_profiles "
                "SET available_times = jsonb_build_array(trim(both ' - ' from concat_ws(' - ', available_time_start, available_time_end))) "
                "WHERE available_times IS NULL AND (available_time_start IS NOT NULL OR available_time_end IS NOT NULL)"
            )
        )


def downgrade() -> None:
    # Conservative downgrade: only remove the certificate metadata and new
    # upload MIME field. Existing professional columns are never dropped.
    bind = op.get_bind()
    existing = {item["name"] for item in sa.inspect(bind).get_columns("doctor_profiles")}
    for name in (
        "pmdc_certificate_size",
        "pmdc_certificate_mime_type",
        "pmdc_certificate_name",
        "pmdc_certificate_path",
        "profile_photo_mime_type",
        "available_times",
    ):
        if name in existing:
            op.drop_column("doctor_profiles", name)
