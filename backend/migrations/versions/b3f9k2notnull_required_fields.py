"""rend obligatoires les champs trip (vol/horaires/poids/prix) + photos annonce

Revision ID: b3f9k2notnull
Revises: a8d2e6ledg01
"""
from alembic import op
import sqlalchemy as sa

revision = 'b3f9k2notnull'
down_revision = 'a8d2e6ledg01'
branch_labels = None
depends_on = None


# Colonnes trips a passer NOT NULL
TRIP_COLS = [
    'departure_time',
    'arrival_date',
    'arrival_time',
    'flight_number',
    'total_kg',
    'price_per_kg',
]


def upgrade() -> None:
    # trips : champs desormais obligatoires (base purgee, aucune ligne NULL)
    for col in TRIP_COLS:
        op.alter_column('trips', col, nullable=False)

    # package_requests.photos : garantir NOT NULL avec defaut tableau vide.
    # La contrainte ">= 1 photo" reste applicative (Pydantic) ; la DB garantit juste non-NULL.
    op.alter_column(
        'package_requests', 'photos',
        nullable=False,
        server_default=sa.text("'{}'::varchar[]"),
    )


def downgrade() -> None:
    # package_requests.photos : retire NOT NULL + defaut
    op.alter_column(
        'package_requests', 'photos',
        nullable=True,
        server_default=None,
    )
    # trips : redevient nullable
    for col in reversed(TRIP_COLS):
        op.alter_column('trips', col, nullable=True)