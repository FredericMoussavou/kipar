"""add penalty_balance to users (dette penalites transporteur, reportee au prochain release)
Revision ID: f7e1c5penal1
Revises: e5f6small01
"""
from alembic import op
import sqlalchemy as sa

revision = 'f7e1c5penal1'
down_revision = 'e5f6small01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Solde de penalites du par le transporteur a KIPAR (ex: annulation jugee non
    # justifiee). Non-nullable, defaut 0 ; server_default pour les lignes existantes.
    # Deduit du prochain paiement (release) puis decremente.
    op.add_column(
        'users',
        sa.Column('penalty_balance', sa.Float(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_column('users', 'penalty_balance')