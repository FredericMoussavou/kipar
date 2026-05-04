"""add_is_temporary_password_and_receiver_refused_at

Revision ID: b1a2c3d4e5f6
Revises: 5581f5105f24
Create Date: 2026-05-04 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b1a2c3d4e5f6'
down_revision: Union[str, None] = '5581f5105f24'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column(
        'is_temporary_password', sa.Boolean(), nullable=False, server_default=sa.text('false')
    ))
    op.add_column('receiver_invitations', sa.Column(
        'refused_at', sa.DateTime(timezone=True), nullable=True
    ))


def downgrade() -> None:
    op.drop_column('users', 'is_temporary_password')
    op.drop_column('receiver_invitations', 'refused_at')
