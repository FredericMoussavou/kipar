"""add package_mode to bookings

Revision ID: a1c2e3mode01
Revises: f6a7b8c9d0e1
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1c2e3mode01'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('bookings', sa.Column('package_mode', sa.String(length=8), server_default='kg', nullable=False))


def downgrade() -> None:
    op.drop_column('bookings', 'package_mode')
