"""add otp_attempts tracking

Revision ID: 202608210001
Revises: 202608200001
Create Date: 2026-08-21 21:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "202608210001"
down_revision: Union[str, Sequence[str], None] = "202608200001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "pending_registrations",
        sa.Column("otp_attempts", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("otp_attempts", sa.Integer(), server_default="0", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("users", "otp_attempts")
    op.drop_column("pending_registrations", "otp_attempts")
