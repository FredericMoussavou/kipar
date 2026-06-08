"""add pending_kyc hold fields to bookings

Revision ID: c3d4e5kycb01
Revises: b2d3e4pend01
"""
from alembic import op
import sqlalchemy as sa

revision = 'c3d4e5kycb01'
down_revision = 'b2d3e4pend01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'bookings',
        sa.Column('kg_held', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.add_column(
        'bookings',
        sa.Column('pending_kyc_expires_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        'bookings',
        sa.Column('promoted_at', sa.DateTime(timezone=True), nullable=True),
    )
    # Backfill : les bookings deja acceptes ont consomme des kg -> kg_held=true.
    # On se base sur accepted_at (preuve du decrement a l'accept), pas sur le statut.
    op.execute(
        """
        UPDATE bookings
        SET kg_held = true
        WHERE accepted_at IS NOT NULL
          AND status NOT IN (
            'cancelled_by_sender', 'cancelled_by_carrier',
            'cancelled', 'refused', 'refunded'
          )
        """
    )


def downgrade() -> None:
    op.drop_column('bookings', 'promoted_at')
    op.drop_column('bookings', 'pending_kyc_expires_at')
    op.drop_column('bookings', 'kg_held')
