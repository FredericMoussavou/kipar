"""make_kg_columns_nullable

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-06-02 11:30:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('trips', 'total_kg', existing_type=sa.Float(), nullable=True)
    op.alter_column('trips', 'remaining_kg', existing_type=sa.Float(), nullable=True)
    op.alter_column('trips', 'price_per_kg', existing_type=sa.Float(), nullable=True)


def downgrade() -> None:
    op.alter_column('trips', 'price_per_kg', existing_type=sa.Float(), nullable=False)
    op.alter_column('trips', 'remaining_kg', existing_type=sa.Float(), nullable=False)
    op.alter_column('trips', 'total_kg', existing_type=sa.Float(), nullable=False)
