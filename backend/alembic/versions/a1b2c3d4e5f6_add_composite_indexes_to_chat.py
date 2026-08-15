"""add_composite_indexes_to_chat

Revision ID: a1b2c3d4e5f6
Revises: 63107fc227df
Create Date: 2026-08-15 21:48:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '63107fc227df'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema with high-performance composite indexes."""
    # Composite index for rapid chat session listing and ordering
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_chat_sessions_user_updated ON chat_sessions(user_id, updated_at DESC);"
    )
    # Composite index for rapid session message thread loading
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_chat_messages_session_created ON chat_messages(session_id, created_at ASC);"
    )
    # Composite index for user chat history pagination
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_chat_messages_user_created ON chat_messages(user_id, created_at DESC);"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP INDEX IF EXISTS ix_chat_messages_user_created;")
    op.execute("DROP INDEX IF EXISTS ix_chat_messages_session_created;")
    op.execute("DROP INDEX IF EXISTS ix_chat_sessions_user_updated;")
