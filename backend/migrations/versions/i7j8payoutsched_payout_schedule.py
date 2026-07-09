"""Versement programme : payout_method/bank_holder_name (users), due_at/attempts (payout_ledger).

Revision ID: i7j8payoutsched
Revises: h5i6payoutledger
"""
from alembic import op
import sqlalchemy as sa

revision = "i7j8payoutsched"
down_revision = "h5i6payoutledger"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("payout_method", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("bank_holder_name", sa.String(150), nullable=True))
    op.add_column("payout_ledger", sa.Column("due_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "payout_ledger",
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_payout_ledger_due_at", "payout_ledger", ["due_at"])


def downgrade() -> None:
    op.drop_index("ix_payout_ledger_due_at", table_name="payout_ledger")
    op.drop_column("payout_ledger", "attempts")
    op.drop_column("payout_ledger", "due_at")
    op.drop_column("users", "bank_holder_name")
    op.drop_column("users", "payout_method")
