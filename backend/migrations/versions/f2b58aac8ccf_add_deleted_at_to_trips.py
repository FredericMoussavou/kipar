"""add_deleted_at_to_trips

Revision ID: f2b58aac8ccf
Revises: aa5985aa1ff1
Create Date: 2026-05-03 03:19:16.881961

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f2b58aac8ccf'
down_revision: Union[str, None] = 'aa5985aa1ff1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('trips', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('trips', 'deleted_at')
