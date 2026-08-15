"""add_prescriber_and_details_to_medications

Revision ID: 63107fc227df
Revises: 7792114ecc50
Create Date: 2026-08-14 22:58:35.331693

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '63107fc227df'
down_revision: Union[str, Sequence[str], None] = '7792114ecc50'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('medications', sa.Column('prescribed_by_doctor_id', sa.Integer(), nullable=True))
    op.add_column('medications', sa.Column('generic_name', sa.String(length=150), nullable=True))
    op.add_column('medications', sa.Column('brand_name', sa.String(length=150), nullable=True))
    op.add_column('medications', sa.Column('intake_timing', sa.String(length=100), nullable=True))
    op.add_column('medications', sa.Column('end_date', sa.Date(), nullable=True))
    op.create_index(op.f('ix_medications_prescribed_by_doctor_id'), 'medications', ['prescribed_by_doctor_id'], unique=False)
    op.create_foreign_key('fk_medications_prescribed_by_doctor_id', 'medications', 'users', ['prescribed_by_doctor_id'], ['id'], ondelete='SET NULL')

    op.add_column('medication_logs', sa.Column('notes', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('medication_logs', 'notes')
    op.drop_constraint('fk_medications_prescribed_by_doctor_id', 'medications', type_='foreignkey')
    op.drop_index(op.f('ix_medications_prescribed_by_doctor_id'), table_name='medications')
    op.drop_column('medications', 'end_date')
    op.drop_column('medications', 'intake_timing')
    op.drop_column('medications', 'brand_name')
    op.drop_column('medications', 'generic_name')
    op.drop_column('medications', 'prescribed_by_doctor_id')
