"""add recommender system tables

Revision ID: 202608200001
Revises: 202608180004
Create Date: 2026-08-20 14:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "202608200001"
down_revision: Union[str, Sequence[str], None] = "202608180004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create patient_feature_snapshots table
    op.create_table(
        "patient_feature_snapshots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("calculated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("feature_schema_version", sa.String(length=20), nullable=False),
        sa.Column("time_windows_used", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("missing_data_fields", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("data_source_timestamps", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("features", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("data_completeness_score", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_patient_feature_snapshots_id"), "patient_feature_snapshots", ["id"], unique=False)
    op.create_index(op.f("ix_patient_feature_snapshots_user_id"), "patient_feature_snapshots", ["user_id"], unique=False)

    # 2. Alter recommendations table to add new columns
    op.add_column("recommendations", sa.Column("rule_id", sa.String(length=100), nullable=True))
    op.add_column("recommendations", sa.Column("rule_version", sa.String(length=20), nullable=True))
    op.add_column("recommendations", sa.Column("content_version", sa.String(length=20), nullable=True))
    op.add_column("recommendations", sa.Column("source", sa.String(length=50), nullable=True))
    op.add_column("recommendations", sa.Column("priority", sa.String(length=20), nullable=True))
    op.add_column("recommendations", sa.Column("action_url", sa.String(length=255), nullable=True))
    op.add_column("recommendations", sa.Column("feature_snapshot_id", sa.Integer(), nullable=True))
    op.add_column("recommendations", sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False))
    op.add_column("recommendations", sa.Column("read_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("recommendations", sa.Column("dismissed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("recommendations", sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True))
    
    # Data migration: Set defaults for existing rows (if any)
    op.execute("UPDATE recommendations SET rule_id = 'LEGACY', rule_version = '1.0', content_version = '1.0', source = 'RULE_ENGINE', priority = 'INFORMATIONAL'")

    # Alter columns to non-nullable where required
    op.alter_column("recommendations", "rule_id", existing_type=sa.String(length=100), nullable=False)
    op.alter_column("recommendations", "rule_version", existing_type=sa.String(length=20), nullable=False)
    op.alter_column("recommendations", "content_version", existing_type=sa.String(length=20), nullable=False)
    op.alter_column("recommendations", "source", existing_type=sa.String(length=50), nullable=False)
    op.alter_column("recommendations", "priority", existing_type=sa.String(length=20), nullable=False)

    # Create constraints and indexes
    op.create_foreign_key(
        "fk_recommendations_feature_snapshot_id",
        "recommendations",
        "patient_feature_snapshots",
        ["feature_snapshot_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_recommendations_is_active"), "recommendations", ["is_active"], unique=False)

    # 3. Create recommendation_feedback table
    op.create_table(
        "recommendation_feedback",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("recommendation_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("feedback_text", sa.Text(), nullable=True),
        sa.Column("feature_snapshot_id", sa.Integer(), nullable=True),
        sa.Column("recommendation_category", sa.String(length=50), nullable=False),
        sa.Column("rule_id", sa.String(length=100), nullable=False),
        sa.Column("rule_version", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["feature_snapshot_id"], ["patient_feature_snapshots.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["recommendation_id"], ["recommendations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_recommendation_feedback_id"), "recommendation_feedback", ["id"], unique=False)
    op.create_index(op.f("ix_recommendation_feedback_recommendation_id"), "recommendation_feedback", ["recommendation_id"], unique=False)
    op.create_index(op.f("ix_recommendation_feedback_user_id"), "recommendation_feedback", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_recommendation_feedback_user_id"), table_name="recommendation_feedback")
    op.drop_index(op.f("ix_recommendation_feedback_recommendation_id"), table_name="recommendation_feedback")
    op.drop_index(op.f("ix_recommendation_feedback_id"), table_name="recommendation_feedback")
    op.drop_table("recommendation_feedback")

    op.drop_index(op.f("ix_recommendations_is_active"), table_name="recommendations")
    op.drop_constraint("fk_recommendations_feature_snapshot_id", "recommendations", type_="foreignkey")
    op.drop_column("recommendations", "expires_at")
    op.drop_column("recommendations", "dismissed_at")
    op.drop_column("recommendations", "read_at")
    op.drop_column("recommendations", "is_active")
    op.drop_column("recommendations", "feature_snapshot_id")
    op.drop_column("recommendations", "action_url")
    op.drop_column("recommendations", "priority")
    op.drop_column("recommendations", "source")
    op.drop_column("recommendations", "content_version")
    op.drop_column("recommendations", "rule_version")
    op.drop_column("recommendations", "rule_id")

    op.drop_index(op.f("ix_patient_feature_snapshots_user_id"), table_name="patient_feature_snapshots")
    op.drop_index(op.f("ix_patient_feature_snapshots_id"), table_name="patient_feature_snapshots")
    op.drop_table("patient_feature_snapshots")
