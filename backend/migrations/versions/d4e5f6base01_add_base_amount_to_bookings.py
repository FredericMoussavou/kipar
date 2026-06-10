"""add base_amount (carrier transport part) to bookings

Revision ID: d4e5f6base01
Revises: c3d4e5kycb01
"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6base01'
down_revision = 'c3d4e5kycb01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Part transporteur (transport seul, hors service + forfait). Nullable, pas de backfill :
    # les bookings existants conservent base_amount NULL (detail affiche seulement si present).
    op.add_column(
        'bookings',
        sa.Column('base_amount', sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('bookings', 'base_amount')
