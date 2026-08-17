"""Create apscheduler_jobs table for APScheduler

Revision ID: 2f1a9c3b4d5e
Revises: 7d5c9aa302cc
Create Date: 2026-08-17 20:30:00.000000

The apscheduler_jobs table was never created by any migration's upgrade()
path — earlier auto-generated revisions only dropped it. APScheduler needs
this table to persist scheduled jobs (medication reminders, missed-med
detection), so create it here explicitly.

Uses IF NOT EXISTS so the migration is idempotent: the scheduler also
creates the table on startup (jobs_t.create(checkfirst=True)), so by the
time this migration runs the table may already exist.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '2f1a9c3b4d5e'
down_revision: Union[str, Sequence[str], None] = '7d5c9aa302cc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS apscheduler_jobs (
            id VARCHAR(191) NOT NULL,
            next_run_time DOUBLE PRECISION,
            job_state BYTEA NOT NULL,
            CONSTRAINT apscheduler_jobs_pkey PRIMARY KEY (id)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_apscheduler_jobs_next_run_time "
        "ON apscheduler_jobs (next_run_time)"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP INDEX IF EXISTS ix_apscheduler_jobs_next_run_time")
    op.execute("DROP TABLE IF EXISTS apscheduler_jobs")
