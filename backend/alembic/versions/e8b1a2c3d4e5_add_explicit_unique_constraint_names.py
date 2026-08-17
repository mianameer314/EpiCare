"""Add explicit unique constraint names for user registration

Revision ID: e8b1a2c3d4e5
Revises: 6c8f25f56b3e
Create Date: 2026-08-17 17:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8b1a2c3d4e5'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create explicit, stable unique constraints on users and doctor_profiles."""
    # Add named unique constraints
    op.create_unique_constraint('uq_users_email', 'users', ['email'])
    op.create_unique_constraint('uq_users_phone_number', 'users', ['phone_number'])
    op.create_unique_constraint('uq_doctor_profiles_pmdc_number', 'doctor_profiles', ['pmdc_number'])


def downgrade() -> None:
    """Drop the named unique constraints."""
    op.drop_constraint('uq_doctor_profiles_pmdc_number', 'doctor_profiles', type_='unique')
    op.drop_constraint('uq_users_phone_number', 'users', type_='unique')
    op.drop_constraint('uq_users_email', 'users', type_='unique')
