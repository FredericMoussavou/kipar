"""correction : total_kg et price_per_kg redeviennent nullable (trip petit-colis-only autorise)

Revision ID: c4a1k7softprice
Revises: b3f9k2notnull
"""
from alembic import op

revision = 'c4a1k7softprice'
down_revision = 'b3f9k2notnull'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Un trip peut etre "petit colis uniquement" (sans tarif au kg).
    # La regle "au moins un mode de tarification" est garantie par le model_validator
    # at_least_one_mode (Pydantic), pas par une contrainte DB.
    op.alter_column('trips', 'total_kg', nullable=True)
    op.alter_column('trips', 'price_per_kg', nullable=True)


def downgrade() -> None:
    op.alter_column('trips', 'price_per_kg', nullable=False)
    op.alter_column('trips', 'total_kg', nullable=False)