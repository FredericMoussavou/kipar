"""create payout_ledger table (releve des versements transporteurs)

Revision ID: h5i6payoutledger
Revises: g4h5platreview
Create Date: 2026-07-06

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = 'h5i6payoutledger'
down_revision = 'g4h5platreview'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'payout_ledger',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('carrier_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('booking_id', UUID(as_uuid=True), sa.ForeignKey('bookings.id'), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(length=5), nullable=False, server_default='EUR'),
        sa.Column('rail', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('failure_reason', sa.String(length=100), nullable=True),
        sa.Column('external_ref', sa.String(length=200), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_payout_ledger_carrier_id', 'payout_ledger', ['carrier_id'])
    op.create_index('ix_payout_ledger_booking_id', 'payout_ledger', ['booking_id'])
    op.create_index('ix_payout_ledger_status', 'payout_ledger', ['status'])


def downgrade() -> None:
    op.drop_index('ix_payout_ledger_status', table_name='payout_ledger')
    op.drop_index('ix_payout_ledger_booking_id', table_name='payout_ledger')
    op.drop_index('ix_payout_ledger_carrier_id', table_name='payout_ledger')
    op.drop_table('payout_ledger')