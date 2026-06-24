# 📦 KIPAR

> Plateforme de transport de colis entre particuliers de pays en pays (Peer-to-Peer Shipping).

---

## 🛠️ Architecture & Stack Technique

### Backend
* **Framework :** Python 3.12 + FastAPI (Async)
* **Base de données :** PostgreSQL 16 + SQLAlchemy 2.0 (ORM) & Alembic (Migrations)
* **Tâches de fond & Workers :** Celery + Redis 7 (Broker)
* **Tests :** Pytest (Suites de tests E2E, API, WebSockets et services)

### Frontend
* **Framework :** Next.js 14+ (App Router, Groupes de routes : `(app)`, `(auth)`, `(legal)`, `(admin)`)
* **Styles :** Tailwind CSS + Shadcn UI
* **Gestion d'état :** Zustand (`stores/`)
* **Temps réel & Événements :** WebSockets (Chat) & SSE (Server-Sent Events)

### Intégrations Tierces (Services)
* **Paiements & Escrow :** Stripe & Pawapay (Mobile Money)
* **Vérification d'identité (KYC) :** iDenfy
* **E-mails :** Resend
* **Stockage Médias :** Cloudinary
* **Monitoring :** Sentry

---

## 🚀 Fonctionnalités Clés

* **Authentification Avancée :** Inscription, Connexion, OAuth Google, et Double Authentification (2FA via TOTP & SMS + Codes de secours).
* **Gestion des Flux (P2P) :** Création de trajets (`trips`), demandes d'envois (`requests`), correspondances et système de réservation (`bookings`).
* **Sécurité & Conformité :** Vérification KYC des utilisateurs avant validation, gestion des litiges (`disputes`) avec export de rapports PDF pour l'administration.
* **Logistique & Validation :** Système de validation sécurisé des étapes de collecte (`pickup`) et de livraison (`delivery`) par génération/vérification de codes uniques et QR codes.
* **Messagerie :** Chat en temps réel via WebSockets entre expéditeurs et transporteurs.

---

## 📂 Structure du Projet

```text
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/  # Contrôleurs FastAPI (Admin, Auth, Bookings, etc.)
│   │   ├── core/              # Configuration, Sécurité, Base de données
│   │   ├── models/            # Modèles de données SQLAlchemy
│   │   ├── schemas/           # Schémas de validation Pydantic
│   │   ├── services/          # Logique métier & API tierces (Stripe, iDenfy...)
│   │   └── workers/           # Tâches asynchrones Celery (Bookings, Flights)
│   └── tests/                 # Tests unitaires et d'intégration
└── frontend/
    ├── app/                   # Next.js App Router (Pages & Layouts)
    ├── components/            # Composants UI globaux et modulaires
    ├── hooks/                 # Hooks React personnalisés (useSSE, useLanguage...)
    └── stores/                # Gestion des états globaux Zustand

💻 Démarrage Rapide
Configuration du Backend

cd backend
python -m venv venv
source venv/Scripts/activate  # Sur Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

Configuration du Frontend

cd frontend
npm install
npm run dev