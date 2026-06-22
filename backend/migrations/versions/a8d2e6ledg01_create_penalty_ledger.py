"""create penalty_ledger table (releve mouvements penalite transporteur)
Revision ID: a8d2e6ledg01
Revises: f7e1c5penal1
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'a8d2e6ledg01'
down_revision = 'f7e1c5penal1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'penalty_ledger',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('carrier_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('booking_id', UUID(as_uuid=True), sa.ForeignKey('bookings.id'), nullable=True),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('entry_type', sa.String(length=20), nullable=False),
        sa.Column('balance_after', sa.Float(), nullable=False),
        sa.Column('description', sa.String(length=200), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_penalty_ledger_carrier_id', 'penalty_ledger', ['carrier_id'])
    op.create_index('ix_penalty_ledger_booking_id', 'penalty_ledger', ['booking_id'])


def downgrade() -> None:
    op.drop_index('ix_penalty_ledger_booking_id', table_name='penalty_ledger')
    op.drop_index('ix_penalty_ledger_carrier_id', table_name='penalty_ledger')
    op.drop_table('penalty_ledger')