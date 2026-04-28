# KIPAR.
Transport de colis entre particuliers, de pays en pays.

## Stack
| Couche | Technologie |
|--------|-------------|
| Backend | Python 3.12 + FastAPI + SQLAlchemy 2.0 |
| Base de données | PostgreSQL 16 |
| Cache / Broker | Redis 7 |
| Frontend | Next.js 14 + Tailwind CSS |

## Démarrage
```bash
cd backend
python -m venv venv && source venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
