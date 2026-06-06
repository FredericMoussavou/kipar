"""add pending_trip_id to users

Revision ID: b2d3e4pend01
Revises: a1c2e3mode01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'b2d3e4pend01'
down_revision = 'a1c2e3mode01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('pending_trip_id', UUID(as_uuid=True), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'pending_trip_id')
