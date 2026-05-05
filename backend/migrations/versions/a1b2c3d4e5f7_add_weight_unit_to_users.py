"""add_weight_unit_to_users

Revision ID: a1b2c3d4e5f7
Revises: fb4c3385d3c4
Create Date: 2026-05-05 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f7'
down_revision: Union[str, None] = 'fb4c3385d3c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('weight_unit', sa.String(length=5), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'weight_unit')
