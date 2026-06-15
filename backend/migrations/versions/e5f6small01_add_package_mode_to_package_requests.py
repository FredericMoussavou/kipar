"""add package_mode (kg | small) to package_requests

Revision ID: e5f6small01
Revises: d4e5f6base01
"""
from alembic import op
import sqlalchemy as sa

revision = 'e5f6small01'
down_revision = 'd4e5f6base01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Mode de tarification de l'annonce : 'kg' (au poids) ou 'small' (petit colis <= 1kg, forfait KIPAR).
    # server_default='kg' pour backfiller les annonces existantes (colonne NOT NULL).
    op.add_column(
        'package_requests',
        sa.Column('package_mode', sa.String(length=8), nullable=False, server_default='kg'),
    )


def downgrade() -> None:
    op.drop_column('package_requests', 'package_mode')
