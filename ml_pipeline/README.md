# ML Pipeline — AQI Prediction

This directory contains the complete machine-learning pipeline that powers
the AQI prediction shown in the Aire app.

```
ml_pipeline/
├── collect_data.py        ← Step 1 · Fetch real data from OpenAQ + Open-Meteo
├── feature_engineering.py ← Step 2 · Build lag / temporal / met features
├── train.py               ← Step 3 · Train + fine-tune XGBoost (Optuna)
├── evaluate.py            ← Step 4 · Evaluate on held-out test set
├── serve.py               ← Step 5 · FastAPI server consumed by the React app
├── requirements.txt       ← Python dependencies
├── data/
│   ├── raw/               ← Per-city raw CSVs from OpenAQ + Open-Meteo
│   ├── combined.csv       ← Merged multi-city dataset
│   └── features.csv       ← Engineered feature set
└── models/
    ├── model_1h.joblib    ← Trained XGBoost for 1-hour horizon
    ├── model_3h.joblib
    ├── model_6h.joblib
    ├── model_12h.joblib
    ├── model_24h.joblib
    ├── scaler.joblib      ← StandardScaler fitted on training data
    ├── feature_names.json ← Ordered list of features (same order at train+serve)
    ├── metrics.json       ← Training metrics (MAE, RMSE, R²) per horizon
    └── plots/             ← Feature importance, SHAP, residual, actual-vs-pred
```

---

## API Keys You Need

### 1. OpenAQ API Key (`OPENAQ_API_KEY`)
**Only needed for Step 1** (data collection). The React frontend never touches it.

1. Go to → <https://docs.openaq.org/using-the-api/api-key>
2. Sign up (free), generate a key.
3. Open `ml_pipeline/collect_data.py` and paste it at line 34:
   ```python
   OPENAQ_API_KEY: str = "paste-your-key-here"
   ```
   **OR** set an environment variable before running:
   ```powershell
   $env:OPENAQ_API_KEY = "paste-your-key-here"
   ```

### 2. Open-Meteo
**No key required.** Open-Meteo is free and has no authentication.

---

## Prerequisites

```powershell
# Python 3.11+ recommended
python --version

# Create a virtual environment (in the project root)
python -m venv .venv
.venv\Scripts\Activate.ps1

# Install ML dependencies
pip install -r ml_pipeline/requirements.txt
```

---

## Step-by-Step Guide

> Run all commands from the **project root** (`c:\Users\HP\Desktop\AireProject`).

### Step 1 — Collect Data

```powershell
python ml_pipeline/collect_data.py
```

**What it does:**
- Finds the nearest OpenAQ station for each city in `CITIES` list
- Downloads up to 90 days of hourly pollutant measurements (PM2.5, PM10, NO2, SO2, CO, O3)
- Downloads matching hourly meteorology from Open-Meteo (wind, temp, humidity, BLH, pressure)
- Computes India CPCB AQI from the pollutant sub-index formula
- Saves one CSV per city → `ml_pipeline/data/raw/<city_id>.csv`
- Concatenates all cities → `ml_pipeline/data/combined.csv`

**Expected time:** ~5–15 minutes depending on your internet speed.

**Adding more cities:** Edit the `CITIES` list in `collect_data.py`:
```python
CITIES = [
    ("city_id", "Display Name", latitude, longitude),
    ...
]
```
The `city_id` must match the `id` field in `src/data/indiaLocations.ts`.

---

### Step 2 — Feature Engineering

```powershell
python ml_pipeline/feature_engineering.py
```

**What it does:**
- Reads `combined.csv`
- Creates features:
  | Group | Features |
  |-------|---------|
  | Temporal | `hour_sin/cos`, `dow_sin/cos`, `month_sin/cos`, `is_weekend` |
  | Auto-regressive AQI | `aqi_lag_1h` … `aqi_lag_24h`, rolling means 3h/6h/12h/24h |
  | Lagged pollutants | `pm25_lag1`, `pm10_lag1`, `no2_lag1`, `o3_lag1` |
  | Meteorological | wind, temp, humidity, pressure, boundary-layer height |
  | Interaction | `pm25_x_wind`, `temp_x_o3` |
  | Target (5 columns) | `aqi_next_1h`, `_3h`, `_6h`, `_12h`, `_24h` |
- Saves → `ml_pipeline/data/features.csv`

---

### Step 3 — Train Models

```powershell
python ml_pipeline/train.py
```

**What it does:**
- Splits data **chronologically** (85% train / 15% test — no data leakage)
- Fits a `StandardScaler` on training features only, saves to `models/scaler.joblib`
- For each horizon (1h, 3h, 6h, 12h, 24h):
  - Runs **Optuna Bayesian hyperparameter search** (40 trials each, 5-fold `TimeSeriesSplit`)
  - Fits final XGBoost with best params on full training set
  - Evaluates on held-out test set (MAE, RMSE, R²)
  - Generates feature-importance PNG, SHAP beeswarm PNG, residual plots
  - Saves model to `models/model_<h>h.joblib`
- Saves metrics summary to `models/metrics.json`

**Expected time:** ~20–60 minutes (40 Optuna trials × 5 folds × 5 horizons).  
To speed up, reduce `N_OPTUNA_TRIALS` in `train.py` (default 40 → try 15 for a quick test).

**Printed output example:**
```
════════════════════════════════════════════════════════════
Horizon      MAE     RMSE       R²   CV MAE
────────────────────────────────────────────────────────────
   1h      12.34    18.21   0.9412    13.10
   3h      18.92    27.45   0.8870    19.88
   6h      25.11    36.78   0.8321    26.44
  12h      33.87    48.20   0.7765    35.12
  24h      42.55    60.33   0.7102    44.00
════════════════════════════════════════════════════════════
```

---

### Step 4 — Evaluate (Optional but Recommended)

```powershell
python ml_pipeline/evaluate.py
```

**What it does:**
- Loads saved models and test set
- Reports MAE, RMSE, R² and 90% CI coverage per horizon
- Saves actual-vs-predicted time-series plots to `models/plots/actual_vs_pred_<h>h.png`

---

### Step 5 — Start the API Server

```powershell
uvicorn ml_pipeline.serve:app --reload --port 8000
```

The server is now live at `http://localhost:8000`.

**Test it:**
```powershell
curl http://localhost:8000/health
curl http://localhost:8000/predict/delhi
```

**API routes:**
| Route | Description |
|-------|-------------|
| `GET /health` | Server status + list of loaded model horizons |
| `GET /metrics` | Training metrics from `metrics.json` |
| `GET /predict/{city_id}` | Full `AqiPrediction` for a city |

---

### Step 6 — Connect the React App

1. Copy `.env.example` → `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```

2. In `.env`, set:
   ```ini
   VITE_ML_BACKEND_URL=http://localhost:8000
   ```

3. Start the frontend dev server:
   ```powershell
   npm run dev
   ```

The React app now reads predictions from the trained model.  
If the backend is down, it silently falls back to the deterministic mock.

---

## How the Prediction Works at Runtime

```
User opens the Aire app
       │
       ▼
 usePrediction hook  →  predictionService.ts
       │
       ├─ VITE_ML_BACKEND_URL set?
       │     YES → GET /predict/{city_id}   ──► FastAPI serve.py
       │                                           │
       │                     ┌─────────────────────┘
       │                     ▼
       │           fetch_live_meteo()  →  Open-Meteo forecast API
       │                     │
       │           build_inference_row()   (feature engineering)
       │                     │
       │           scaler.transform()
       │                     │
       │           model_1h, 3h, 6h, 12h, 24h .predict()
       │                     │
       │           Interpolate 24-point series + confidence bands
       │                     │
       │           Return AqiPrediction JSON
       │
       └─ NO (or backend error) → deterministic mock (original behaviour)
```

---

## Fine-Tuning Tips

| Goal | What to change |
|------|---------------|
| Better accuracy | Increase `N_OPTUNA_TRIALS` in `train.py` (40 → 100+) |
| More cities | Add rows to `CITIES` in `collect_data.py` + `CITY_COORDS` in `serve.py` |
| Longer forecast | Add `48` or `72` to `HORIZONS` in all scripts |
| More data | Increase `DAYS_BACK` in `collect_data.py` (90 → 365) |
| Production deployment | Change `allow_origins=["*"]` in `serve.py` to your frontend URL |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `RuntimeError: Please set OPENAQ_API_KEY` | Set your key in `collect_data.py` or `$env:OPENAQ_API_KEY` |
| `No OpenAQ location found near …` | City has no nearby station; try increasing `radius_m` in `collect_data.py` |
| `Models not loaded` from `/health` | Run `train.py` first |
| City returns 404 from `/predict` | Add it to `CITY_COORDS` in `serve.py` |
| Frontend still shows mock | Check that `VITE_ML_BACKEND_URL` is set in `.env` and the server is running |
