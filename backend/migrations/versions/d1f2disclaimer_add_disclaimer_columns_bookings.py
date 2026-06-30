"""disclaimer : colonnes sender_disclaimer_at et carrier_disclaimer_at sur bookings (preuve horodatee)

Revision ID: d1f2disclaimer
Revises: c4a1k7softprice
"""
from alembic import op
import sqlalchemy as sa

revision = 'd1f2disclaimer'
down_revision = 'c4a1k7softprice'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Traces horodatees d'acceptation des disclaimers de responsabilite.
    # sender_disclaimer_at : expediteur (reservation / acceptation candidature).
    # carrier_disclaimer_at : transporteur (candidature / acceptation reservation) - chantier 2.
    op.add_column('bookings', sa.Column('sender_disclaimer_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('bookings', sa.Column('carrier_disclaimer_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('bookings', 'carrier_disclaimer_at')
    op.drop_column('bookings', 'sender_disclaimer_at')