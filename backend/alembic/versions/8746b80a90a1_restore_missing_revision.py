"""Compatibility bridge for a revision recorded by existing local databases.

Revision ID: 8746b80a90a1
Revises: 2f1a9c3b4d5e

The original file for this already-applied revision is not present in the
repository. Keeping this no-op revision restores Alembic graph integrity for
existing databases without changing or deleting any data.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "8746b80a90a1"
down_revision: Union[str, Sequence[str], None] = "2f1a9c3b4d5e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
