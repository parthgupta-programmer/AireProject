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
    ├── feature_names.json ← Ordered feature list PER horizon (same order at train+serve)
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
- Downloads up to 730 days (`DAYS_BACK`) of hourly pollutant measurements (PM2.5, PM10, NO2, SO2, CO, O3)
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
- Reads `combined.csv`, puts each city on a strict hourly grid (short gaps interpolated)
- Creates features (all causal - nothing after time *t* is used):
  | Group | Features |
  |-------|---------|
  | Temporal | `hour_sin/cos`, `dow_sin/cos`, `month_sin/cos`, `is_weekend` |
  | Static | `lat`, `lon` |
  | AQI history | `aqi_lag_0h` (**current AQI**), lags 1-48h, rolling mean 3h-168h, rolling std/max/min, trends `aqi_d1/d3/d6/d24` |
  | Pollutants | current PM2.5/PM10/NO2/SO2/CO/O3, lags, PM2.5/PM10 ratio |
  | Meteorological | wind, temp, humidity, pressure, BLH, pressure/temp trends, 24h rain, ventilation index |
  | Future weather | per horizon *h*: weather at *t+h* and mean/sum over (*t*, *t+h*] (from the forecast API at serve time) |
  | Target (5 columns) | `aqi_next_1h`, `_3h`, `_6h`, `_12h`, `_24h` |
- Saves → `ml_pipeline/data/features.csv`

---

### Step 3 — Train Models

```powershell
python ml_pipeline/train.py
```

**What it does:**
- Splits data **chronologically** (85% train / 15% test, with a 24h purge gap - no leakage)
- For each horizon (1h, 3h, 6h, 12h, 24h):
  - Each model predicts the **change from the current AQI** (delta target); the current AQI is added back
  - Runs **Optuna Bayesian search** (`N_OPTUNA_TRIALS`, default 40, 4-fold `TimeSeriesSplit` with a gap)
    using XGBoost **early stopping** to pick the number of trees
  - Fits the final XGBoost on the full training set (the test set is never used for fitting)
  - Reports MAE / RMSE / R² on the held-out test set **and the same metrics for a
    "nothing changes" persistence baseline**, so you can see the real skill of the model
  - Generates feature-importance, SHAP and residual plots
- Saves `models/model_<h>h.joblib`, `models/feature_names.json`, `models/metrics.json`

**Expected time:** ~30-90 minutes with the default 40 trials. Use `N_OPTUNA_TRIALS=10` for a quick test.

> If you re-collect data, delete `ml_pipeline/data/raw/` first - existing city files are skipped.
> Models trained with the previous version of the pipeline are **not compatible** with the new
> features: re-run Steps 1-3 before starting the API server.

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
| More data | Increase `DAYS_BACK` in `collect_data.py` (default is now 730) |
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
