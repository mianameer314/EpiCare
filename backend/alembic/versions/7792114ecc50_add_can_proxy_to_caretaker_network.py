"""Add can_proxy to caretaker network

Revision ID: 7792114ecc50
Revises: 928d3b7d19a9
Create Date: 2026-08-10 17:04:07.714177

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import pgvector
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '7792114ecc50'
down_revision: Union[str, Sequence[str], None] = '928d3b7d19a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('patient_caretaker_networks', sa.Column('can_proxy', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('patient_caretaker_networks', 'can_proxy')
