"""add_is_permanently_deleted

Revision ID: d4e5f6a7b8c9
Revises: b2c3d4e5f6a7
Create Date: 2026-05-28 14:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column(
        'is_permanently_deleted',
        sa.Boolean(),
        server_default='false',
        nullable=False
    ))


def downgrade() -> None:
    op.drop_column('users', 'is_permanently_deleted')
