"""create platform_reviews table (avis utilisateur sur KIPAR)

Revision ID: g4h5platreview
Revises: f3g4disclaimer
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'g4h5platreview'
down_revision = 'f3g4disclaimer'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'platform_reviews',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False, unique=True),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_platform_reviews_user_id', 'platform_reviews', ['user_id'])
    op.create_index('ix_platform_reviews_status', 'platform_reviews', ['status'])


def downgrade() -> None:
    op.drop_index('ix_platform_reviews_status', table_name='platform_reviews')
    op.drop_index('ix_platform_reviews_user_id', table_name='platform_reviews')
    op.drop_table('platform_reviews')