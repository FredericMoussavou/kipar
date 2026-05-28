"""add_kyc_approved_at_is_banned_banned_at

Revision ID: a1b2c3d4e5f6
Revises: fb4c3385d3c4
Create Date: 2026-05-28 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'fb4c3385d3c4'
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('kyc_approved_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('is_banned', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('users', sa.Column('banned_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'banned_at')
    op.drop_column('users', 'is_banned')
    op.drop_column('users', 'kyc_approved_at')