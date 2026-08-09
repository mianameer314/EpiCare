"""Initial schema — all EpiCare tables + pgvector setup.

Revision ID: 202608080001
Revises:
Create Date: 2026-08-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "202608080001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create every table plus the pgvector extension."""
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ---------- Core / Auth ----------
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "patient_profiles",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("gender", sa.String(length=30), nullable=True),
        sa.Column("height_cm", sa.Float(), nullable=True),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("known_triggers", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("timezone", sa.String(length=64), server_default="UTC", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_patient_profiles_user_id", "patient_profiles", ["user_id"], unique=True)

    # ---------- EEG pipeline ----------
    op.create_table(
        "eeg_sessions",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("stored_path", sa.String(length=500), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("file_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=30), server_default="UPLOADED", nullable=False),
        sa.Column("validation_result", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_eeg_sessions_file_hash", "eeg_sessions", ["file_hash"])
    op.create_index("ix_eeg_sessions_status", "eeg_sessions", ["status"])
    op.create_index("ix_eeg_sessions_user_id", "eeg_sessions", ["user_id"])
    op.create_index("ix_eeg_sessions_user_created", "eeg_sessions", ["user_id", sa.text("created_at DESC")])

    op.create_table(
        "model_versions",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("version", sa.String(length=20), nullable=False),
        sa.Column("framework", sa.String(length=50), server_default="onnx", nullable=False),
        sa.Column("path", sa.String(length=500), nullable=False),
        sa.Column("input_schema", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("threshold", sa.Float(), server_default="0.5", nullable=False),
        sa.Column("accuracy", sa.Float(), nullable=True),
        sa.Column("sensitivity", sa.Float(), nullable=True),
        sa.Column("specificity", sa.Float(), nullable=True),
        sa.Column("f1", sa.Float(), nullable=True),
        sa.Column("auroc", sa.Float(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_model_versions_version", "model_versions", ["version"], unique=True)

    op.create_table(
        "predictions",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("model_version_id", sa.Integer(), nullable=True),
        sa.Column("predicted_class", sa.String(length=20), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("threshold", sa.Float(), nullable=False),
        sa.Column("positive_windows", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_windows", sa.Integer(), server_default="0", nullable=False),
        sa.Column("max_probability", sa.Float(), nullable=False),
        sa.Column("mean_probability", sa.Float(), nullable=False),
        sa.Column("window_probabilities", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(length=30), server_default="COMPLETED", nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["model_version_id"], ["model_versions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["session_id"], ["eeg_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_predictions_model_version_id", "predictions", ["model_version_id"])
    op.create_index("ix_predictions_session_id", "predictions", ["session_id"], unique=True)
    op.create_index("ix_predictions_user_id", "predictions", ["user_id"])
    op.create_index("ix_predictions_user_completed", "predictions", ["user_id", sa.text("completed_at DESC")])

    op.create_table(
        "ai_reports",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("prediction_id", sa.Integer(), nullable=False),
        sa.Column("report_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("model_version", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=30), server_default="COMPLETED", nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["prediction_id"], ["predictions.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_ai_reports_prediction_id", "ai_reports", ["prediction_id"], unique=True)

    # ---------- Medication ----------
    op.create_table(
        "medications",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("dosage", sa.String(length=100), nullable=False),
        sa.Column("frequency", sa.String(length=50), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_medications_user_id", "medications", ["user_id"])

    op.create_table(
        "medication_schedules",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("medication_id", sa.Integer(), nullable=False),
        sa.Column("scheduled_time", sa.Time(), nullable=False),
        sa.Column("days_of_week", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("reminder_enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["medication_id"], ["medications.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_medication_schedules_medication_id", "medication_schedules", ["medication_id"])

    op.create_table(
        "medication_logs",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("schedule_id", sa.Integer(), nullable=True),
        sa.Column("medication_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("taken_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="TAKEN", nullable=False),
        sa.Column("dose_taken", sa.String(length=100), nullable=True),
        sa.ForeignKeyConstraint(["medication_id"], ["medications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["schedule_id"], ["medication_schedules.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_medication_logs_medication_id", "medication_logs", ["medication_id"])
    op.create_index("ix_medication_logs_schedule_id", "medication_logs", ["schedule_id"])
    op.create_index("ix_medication_logs_user_id", "medication_logs", ["user_id"])
    op.create_index("ix_medication_logs_user_taken", "medication_logs", ["user_id", "taken_at"])

    # ---------- Lifestyle ----------
    op.create_table(
        "lifestyle_logs",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("log_type", sa.String(length=20), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_lifestyle_logs_log_type", "lifestyle_logs", ["log_type"])
    op.create_index("ix_lifestyle_logs_user_id", "lifestyle_logs", ["user_id"])

    op.create_table(
        "sleep_logs",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("slept_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("woke_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("quality", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_sleep_logs_user_id", "sleep_logs", ["user_id"])

    op.create_table(
        "trigger_logs",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("trigger_name", sa.String(length=100), nullable=False),
        sa.Column("severity", sa.Integer(), server_default="1", nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_trigger_logs_user_id", "trigger_logs", ["user_id"])

    # ---------- Recommendations ----------
    op.create_table(
        "recommendations",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column("evidence_tags", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("is_dismissed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_recommendations_user_id", "recommendations", ["user_id"])

    # ---------- Emergency ----------
    op.create_table(
        "emergency_contacts",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("relationship", sa.String(length=100), nullable=False),
        sa.Column("phone_number", sa.String(length=30), nullable=False),
        sa.Column("is_primary", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("verified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_emergency_contacts_user_id", "emergency_contacts", ["user_id"])

    op.create_table(
        "sos_events",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("triggered_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("location_available", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("status", sa.String(length=30), server_default="SENDING", nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_sos_events_user_id", "sos_events", ["user_id"])

    op.create_table(
        "sos_deliveries",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("sos_event_id", sa.Integer(), nullable=False),
        sa.Column("contact_id", sa.Integer(), nullable=False),
        sa.Column("delivery_status", sa.String(length=30), server_default="PENDING", nullable=False),
        sa.Column("provider_message_id", sa.String(length=100), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["contact_id"], ["emergency_contacts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sos_event_id"], ["sos_events.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_sos_deliveries_contact_id", "sos_deliveries", ["contact_id"])
    op.create_index("ix_sos_deliveries_sos_event_id", "sos_deliveries", ["sos_event_id"])

    # ---------- Chat / RAG ----------
    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), server_default="New chat", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_chat_sessions_user_id", "chat_sessions", ["user_id"])

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sources", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["chat_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_chat_messages_session_id", "chat_messages", ["session_id"])
    op.create_index("ix_chat_messages_session_created", "chat_messages", ["session_id", "created_at"])
    op.create_index("ix_chat_messages_user_id", "chat_messages", ["user_id"])

    op.create_table(
        "rag_documents",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("source_path", sa.String(length=500), nullable=False),
        sa.Column("checksum", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=30), server_default="INGESTED", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_rag_documents_checksum", "rag_documents", ["checksum"])

    op.create_table(
        "rag_chunks",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["rag_documents.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_rag_chunks_document_id", "rag_chunks", ["document_id"])
    op.execute(
        "CREATE INDEX ix_rag_chunks_embedding_hnsw ON rag_chunks "
        "USING hnsw (embedding vector_cosine_ops)"
    )

    # ---------- Audit ----------
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])


def downgrade() -> None:
    """Drop every table (reverse order)."""
    op.drop_table("audit_logs")
    op.drop_index("ix_rag_chunks_embedding_hnsw", table_name="rag_chunks")
    op.drop_table("rag_chunks")
    op.drop_table("rag_documents")
    op.drop_table("chat_messages")
    op.drop_table("chat_sessions")
    op.drop_table("sos_deliveries")
    op.drop_table("sos_events")
    op.drop_table("emergency_contacts")
    op.drop_table("recommendations")
    op.drop_table("trigger_logs")
    op.drop_table("sleep_logs")
    op.drop_table("lifestyle_logs")
    op.drop_table("medication_logs")
    op.drop_table("medication_schedules")
    op.drop_table("medications")
    op.drop_table("ai_reports")
    op.drop_table("predictions")
    op.drop_table("model_versions")
    op.drop_table("eeg_sessions")
    op.drop_table("patient_profiles")
    op.drop_table("users")
    op.execute("DROP EXTENSION IF EXISTS vector")
