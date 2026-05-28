"""add_flight_tracking_airlabs_fields

Revision ID: b2c3d4e5f6a7
Revises: f6780d40c20e
Create Date: 2026-05-28 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'f6780d40c20e'
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('flight_tracking', sa.Column('dep_iata', sa.String(10), nullable=True))
    op.add_column('flight_tracking', sa.Column('arr_iata', sa.String(10), nullable=True))
    op.add_column('flight_tracking', sa.Column('delayed_minutes', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('flight_tracking', 'delayed_minutes')
    op.drop_column('flight_tracking', 'arr_iata')
    op.drop_column('flight_tracking', 'dep_iata')