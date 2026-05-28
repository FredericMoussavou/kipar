"""merge_heads

Revision ID: f6780d40c20e
Revises: a1b2c3d4e5f6, e3874d347882
Create Date: 2026-05-28 09:30:01.056059

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'f6780d40c20e'
down_revision: Union[str, None] = ('a1b2c3d4e5f6', 'e3874d347882')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
