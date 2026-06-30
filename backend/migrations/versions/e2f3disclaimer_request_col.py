"""disclaimer : colonne sender_disclaimer_at sur package_requests (preuve creation annonce)

Revision ID: e2f3disclaimer
Revises: d1f2disclaimer
"""
from alembic import op
import sqlalchemy as sa

revision = 'e2f3disclaimer'
down_revision = 'd1f2disclaimer'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('package_requests', sa.Column('sender_disclaimer_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('package_requests', 'sender_disclaimer_at')