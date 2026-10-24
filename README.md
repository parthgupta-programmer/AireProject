# 🌬️ Aire — Pollution-Aware Air Quality Intelligence Platform

Aire is an enterprise-grade, end-to-end environmental intelligence platform designed for monitoring, forecasting, and navigating air pollution across India. It integrates live ambient atmospheric observations, machine-learning-driven AQI forecasting, secure user preference persistence, pollution-aware multimodal route planning with Google Maps direction navigation, and proactive health alerts.

---

## 🏛️ System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Client Tier (React 18 / Vite SPA)                 │
│  • CPCB NAQI Visualizer     • ML Forecast Trends     • Leaflet & Google Map  │
│  • Routing & Exposure Index • Alerts Management      • Health & Learn Hub   │
└───────────────────────┬─────────────────────────────────────┬───────────────┘
                        │ HTTP / JSON                         │ OSRM / Open-Meteo
                        ▼                                     ▼
┌──────────────────────────────────────────────┐    ┌─────────────────────────┐
│     Backend Services (FastAPI / Uvicorn)     │    │   External Providers    │
│  • /predict/{city_id} (XGBoost ML Inference) │    │  • Open-Meteo AQ API    │
│  • /auth (JWT + bcrypt + HTTP-Only Cookies)  │    │  • Open-Meteo Forecast  │
│  • /user/preferences (Persistent Settings)   │    │  • OSRM Routing Engine  │
│  • /alerts (Rules & Notification Events)     │    │  • Nominatim Geocoding  │
└───────────────────────┬──────────────────────┘    └─────────────────────────┘
                        │ SQLAlchemy ORM
                        ▼
┌──────────────────────────────────────────────┐
│        Persistence Layer (SQLite / PG)       │
│  • Users, Sessions, Preferences, Alert Rules │
└──────────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript 5.6
- **Build System**: Vite 5
- **Styling**: Tailwind CSS 3.4 & Vanilla CSS design system
- **Routing**: React Router 6
- **Data Visualization**: Recharts (trend charts) & Canvas/Lucide-React
- **Mapping**: Leaflet 1.9, OpenStreetMap, CARTO voyager, and Google Maps tiles
- **Audio & Push**: Web Audio API synthesizer & Web Notifications API

### Backend & ML Pipeline
- **API Framework**: FastAPI 0.111, Uvicorn, Pydantic v2
- **Machine Learning**: XGBoost 2.0, Scikit-learn 1.4, Pandas, NumPy, Joblib
- **Database / ORM**: SQLAlchemy 2.0 (SQLite for local/container, PostgreSQL compatible)
- **Security**: Bcrypt (12-round salting), PyJWT (HS256 tokens with JTI tracking), secure HTTP-Only cookies, sliding-window rate limiting
- **Data Collection**: OpenAQ API & Open-Meteo historical reanalysis

---

## ✨ Core Implemented Capabilities

### 1. Live Ambient AQI & India CPCB NAQI Standard
- Connects directly to Open-Meteo live atmospheric observations across Indian cities.
- Strictly calculates the **India Central Pollution Control Board (CPCB) NAQI** composite index:
  - Sub-indices for PM2.5, PM10, NO₂, SO₂, CO, and O₃ based on official breakpoints.
  - Data sufficiency validation: requires at least 3 monitored pollutants with at least one particulate matter (PM2.5 or PM10).
  - CO concentration converted from $\mu g/m^3$ to $mg/m^3$.
- Visualizes AQI gauge, pollutant breakdowns, and historical trends (24h, 3d, 7d).

### 2. Machine Learning AQI Forecasting (5 Horizons)
- Custom-trained XGBoost regressors predicting AQI change ($\Delta \text{AQI}$) across 5 discrete forecast horizons: **1h, 3h, 6h, 12h, and 24h**.
- Models trained with time-series cross-validation (zero future data leakage, 24h purge gap).
- Live feature engineering dynamically extracts rolling statistics (24h/168h means and standard deviations), meteorological variables, cyclical diurnal/seasonal encodings, and future weather forecasts.
- Inference server provides point forecasts, 90% confidence bands ($z=1.645 \times \text{RMSE}$), and rule-based environmental factor explanations.
- Honest error reporting: never silently falls back to synthetic mock data in production.

### 3. Authentication & Persistent User Data
- User registration, login, and password management with bcrypt hashing.
- Dual-channel session authentication: signed Bearer JWT and secure HTTP-Only cookies.
- Complete per-user data isolation: saved locations, theme preference, sensitive health profile, and alert threshold preferences persist across restarts.
- Session revocation tracking and sliding-window rate limiting on sensitive auth endpoints.

### 4. Pollution-Aware Route Planning & Google Maps Navigation
- Origin and destination location selector with India city presets and Nominatim free-text geocoding.
- Multimodal route computation (Driving, Cycling, Walking) via OSRM with alternative route analysis.
- Route sampling every 3 km calculating a relative exposure indicator ($\sum \text{AQI}_i \times \text{Duration}_i$).
- **Google Maps Integration**: One-click **"Give directions in Google Maps"** redirection opening the route in Google Maps navigation.
- Map style switcher supporting Google Maps Road, Satellite, Terrain, and OpenStreetMap.

### 5. Functional Alerts, In-App Center & Notifications
- User-defined threshold rules matching CPCB categories with per-city or global monitoring.
- Native browser Web Notifications API integration with status detection and permission manager.
- Low-latency warning chime synthesis via Web Audio API.
- Notification history drawer with read/unread tracking and batch dismissal.

### 6. Health & Environmental Guidance
- Personalized advisories tailored to sensitive groups (asthma, elderly, children, pregnancy, outdoor workers).
- Real-time mask recommendations (N95 / surgical / none), exercise safety windows, and indoor ventilation advice.
- Educational encyclopedia on CPCB NAQI breakpoints and primary atmospheric pollutants.

---

## 🚀 Quickstart & Local Setup

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+ (Python 3.12 recommended)
- Git

### 1. Environment Configuration

```bash
# Copy template configuration
cp .env.example .env
```

Review `.env` to customize backend URLs or secrets. Default values work out-of-the-box for local development.

### 2. Frontend Development Server

```powershell
# In PowerShell:
npm install
npm run dev
```

The frontend will start at `http://localhost:5173`.

### 3. Backend & ML Inference Server

```powershell
# Set up Python virtual environment (if not already created):
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install requirements:
pip install -r ml_pipeline/requirements.txt

# Start the FastAPI server on port 8000:
uvicorn ml_pipeline.serve:app --reload --port 8000
```

The backend API will be accessible at `http://localhost:8000` (docs at `http://localhost:8000/docs`).

---

## 🧪 Automated Testing

### Frontend Test Suite (Vitest)
Executes 87 unit and integration tests covering routing, CPCB calculation, prediction parsing, alert evaluation, and air quality services:

```powershell
npm test
```

### Backend Test Suite (Pytest)
Executes 30 test cases validating authentication, token lifecycle, rate limiting, user preference isolation, CPCB sub-index math, model artifacts, and FastAPI endpoints:

```powershell
.\.venv\Scripts\pytest
# Or:
python -m pytest
```

### Production Build Verification
Compiles TypeScript and creates optimized minified assets:

```powershell
npm run build
```

---

## 🐳 Docker Deployment

The project provides a multi-stage container deployment architecture:

```bash
# Build and run all services in the background:
docker-compose up -d --build

# Inspect running services:
docker-compose ps

# View service logs:
docker-compose logs -f
```

- **Frontend**: Available on port `80` (served by Nginx Alpine with gzip, security headers, and reverse proxy).
- **Backend**: Available on port `8000` (FastAPI with persistent volume for user database).

---

## 🔐 Security Hardening Summary

- **Secrets Sanitization**: No secret keys, credentials, or private databases are checked into version control. `.env`, `*.db`, and `*.sqlite` are enforced in `.gitignore`.
- **CORS Protection**: Restricted by default to designated origin URLs configured via `CORS_ORIGINS`.
- **Data Isolation**: All database queries strictly join against `current_user.id` resolved from cryptographic JWT tokens.
- **Rate Limiting**: Sliding-window rate limiter prevents credential-stuffing attacks on login/registration endpoints.
- **Transparent Health & Exposure Disclaimers**: Route exposure metrics and health notices are transparently qualified as indicative decision-support tools rather than diagnostic measurements.
