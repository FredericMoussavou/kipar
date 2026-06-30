"""disclaimer : colonne carrier_disclaimer_at sur applications (preuve candidature transporteur)

Revision ID: f3g4disclaimer
Revises: e2f3disclaimer
"""
from alembic import op
import sqlalchemy as sa

revision = 'f3g4disclaimer'
down_revision = 'e2f3disclaimer'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('applications', sa.Column('carrier_disclaimer_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('applications', 'carrier_disclaimer_at')