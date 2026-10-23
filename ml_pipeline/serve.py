"""
serve.py
────────
Step 5 of the ML pipeline — FastAPI prediction server.

The React frontend calls  GET /predict/{city_id}  and receives a JSON payload
that exactly matches the  AqiPrediction  TypeScript type.

Start the server:
    uvicorn ml_pipeline.serve:app --reload --port 8000

API routes
──────────
GET  /predict/{city_id}    → AqiPrediction JSON
GET  /health               → {"status": "ok", "models_loaded": [...]}
GET  /metrics              → training metrics from metrics.json

How a prediction is made
────────────────────────
1. Pull the last ~8 days of air quality (Open-Meteo Air Quality API) and
   weather + 2-day forecast (Open-Meteo Forecast API) for the city.
2. Compute the current AQI with the same CPCB formula used for training.
3. Build features with feature_engineering.build_features (the SAME code used
   in training, so there is no train/serve skew).
4. Each horizon model predicts the *change* in AQI; the current AQI is added back.
"""

from __future__ import annotations

import os
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:                                    # run as a package (uvicorn ml_pipeline.serve:app)
    from ml_pipeline.collect_data import calc_aqi
    from ml_pipeline.feature_engineering import build_features
    from ml_pipeline.auth.database import init_db
    from ml_pipeline.auth.routes_auth import router as auth_router
    from ml_pipeline.auth.routes_user import router as user_router
except ImportError:                     # run from inside ml_pipeline/
    from collect_data import calc_aqi
    from feature_engineering import build_features
    from auth.database import init_db
    from auth.routes_auth import router as auth_router
    from auth.routes_user import router as user_router

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

BASE = Path(__file__).parent
MODELS_DIR = BASE / "models"

# ── Load model artefacts at startup ───────────────────────────────────────────

HORIZONS = [1, 3, 6, 12, 24]

models: dict[int, object] = {}
feature_map: dict[int, list[str]] = {}
_metrics: list[dict] = []


def _load_models() -> None:
    global _metrics

    fn_path      = MODELS_DIR / "feature_names.json"
    metrics_path = MODELS_DIR / "metrics.json"

    if not fn_path.exists():
        log.error("Models not found — run  python ml_pipeline/train.py  first.")
        return

    with open(fn_path) as f:
        raw = json.load(f)
    if not isinstance(raw, dict):
        log.error("feature_names.json is from an older pipeline version — "
                  "re-run feature_engineering.py and train.py.")
        return
    feature_map.update({int(k): v for k, v in raw.items()})

    if metrics_path.exists():
        with open(metrics_path) as f:
            _metrics = json.load(f)

    for h in HORIZONS:
        mp = MODELS_DIR / f"model_{h}h.joblib"
        if mp.exists() and h in feature_map:
            models[h] = joblib.load(mp)
            log.info("Loaded model_%dh.joblib", h)
        else:
            log.warning("model_%dh.joblib not found", h)


_load_models()

# ── Open-Meteo live fetchers ───────────────────────────────────────────────────

OPENMETEO_FORECAST = "https://api.open-meteo.com/v1/forecast"
OPENMETEO_AQ       = "https://air-quality-api.open-meteo.com/v1/air-quality"
HISTORY_DAYS = 8      # enough for the 168 h rolling features

MET_VARS = [
    "temperature_2m", "relative_humidity_2m", "precipitation", "wind_speed_10m",
    "wind_direction_10m", "surface_pressure", "boundary_layer_height",
]


def fetch_live_frame(city_id: str, lat: float, lon: float, now: datetime) -> pd.DataFrame:
    """
    Hourly frame in the same schema as combined.csv: past HISTORY_DAYS days of
    air quality + weather, plus 2 days of forecast weather (no AQ in the future).
    """
    met_resp = requests.get(
        OPENMETEO_FORECAST,
        params={
            "latitude": lat, "longitude": lon,
            "hourly": ",".join(MET_VARS),
            "past_days": HISTORY_DAYS, "forecast_days": 2, "timezone": "UTC",
        },
        timeout=20,
    )
    met_resp.raise_for_status()
    met = pd.DataFrame(met_resp.json()["hourly"]).rename(columns={"time": "timestamp"})
    met["timestamp"] = pd.to_datetime(met["timestamp"], utc=True)

    aq_resp = requests.get(
        OPENMETEO_AQ,
        params={
            "latitude": lat, "longitude": lon,
            "hourly": "pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide",
            "past_days": HISTORY_DAYS, "forecast_days": 1, "timezone": "UTC",
        },
        timeout=20,
    )
    aq_resp.raise_for_status()
    aq = pd.DataFrame(aq_resp.json()["hourly"]).rename(columns={
        "time": "timestamp", "pm2_5": "pm25_raw", "pm10": "pm10_raw",
        "nitrogen_dioxide": "no2_raw", "sulphur_dioxide": "so2_raw",
        "ozone": "o3_raw", "carbon_monoxide": "co_raw",
    })
    aq["timestamp"] = pd.to_datetime(aq["timestamp"], utc=True)
    aq["co_raw"] = aq["co_raw"] / 1000.0           # ug/m3 -> mg/m3 (as in collect_data.py)
    aq = aq[aq["timestamp"] <= pd.Timestamp(now)]   # never use modelled "future" AQ as history

    df = met.merge(aq, on="timestamp", how="left")
    df["aqi"] = df.apply(calc_aqi, axis=1)
    df["city_id"] = city_id
    df["lat"] = lat
    df["lon"] = lon
    return df


# ── City registry — must match src/data/indiaLocations.ts ─────────────────────

CITY_COORDS: dict[str, tuple[float, float]] = {
    "delhi":       (28.6139,  77.2090),
    "mumbai":      (19.0760,  72.8777),
    "ghaziabad":   (28.6692,  77.4538),
    "bangalore":   (12.9716,  77.5946),
    "kolkata":     (22.5726,  88.3639),
    "hyderabad":   (17.3850,  78.4867),
    "chennai":     (13.0827,  80.2707),
    "patna":       (25.5941,  85.1376),
    "lucknow":     (26.8467,  80.9462),
    "ahmedabad":   (23.0225,  72.5714),
    # Add more as you train more cities
}


# ── Pydantic models (match TypeScript AqiPrediction type) ─────────────────────

class PredictionFactor(BaseModel):
    id: str
    label: str
    impact: str   # 'raises' | 'lowers' | 'neutral'
    weight: float
    detail: Optional[str] = None


class PredictionPoint(BaseModel):
    timestamp: str
    aqi: int
    low: Optional[int] = None
    high: Optional[int] = None


class PredictionHorizon(BaseModel):
    hours: int
    targetTime: str
    aqi: int
    low: Optional[int] = None
    high: Optional[int] = None
    confidence: Optional[float] = None


class AqiPrediction(BaseModel):
    locationId: str
    generatedAt: str
    modelVersion: str
    series: list[PredictionPoint]
    horizons: list[PredictionHorizon]
    factors: list[PredictionFactor]
    insight: Optional[str] = None


# ── Confidence interval helper ─────────────────────────────────────────────────

# Fallback per-horizon std (AQI units) used only if metrics.json is missing.
_FALLBACK_STD: dict[int, float] = {1: 18, 3: 28, 6: 38, 12: 50, 24: 60}


def _horizon_std() -> dict[int, float]:
    """Test-set RMSE per horizon from training (a real error estimate)."""
    from_metrics = {int(m["horizon_h"]): float(m["rmse"]) for m in _metrics if "rmse" in m}
    return from_metrics or _FALLBACK_STD


def _band(aqi: int, horizon_h: int, z: float = 1.645) -> tuple[int, int]:
    table = _horizon_std()
    # use the smallest trained horizon that is >= the requested step
    keys = sorted(table)
    h = next((k for k in keys if k >= horizon_h), keys[-1])
    std = table[h]
    return (max(0, int(aqi - z * std)), min(500, int(aqi + z * std)))


# ── Rule-based factor explanations ────────────────────────────────────────────

def _make_factors(row: dict, aqi_trend: float) -> list[PredictionFactor]:
    """Build a short, rule-based explanation from key feature values."""
    factors = []
    ws = row.get("wind_speed", 2)
    blh = row.get("blh", 500)
    precip = row.get("precip", 0)
    pm25 = row.get("pm25_lag1", 60)

    if ws < 3:
        factors.append(PredictionFactor(
            id="wind", label="Calm winds", impact="raises", weight=0.35,
            detail="Low wind speed traps pollutants near the surface.",
        ))
    else:
        factors.append(PredictionFactor(
            id="wind", label="Moderate winds", impact="lowers", weight=0.30,
            detail="Wind helps disperse airborne pollutants.",
        ))

    if blh < 400:
        factors.append(PredictionFactor(
            id="blh", label="Shallow mixing layer", impact="raises", weight=0.30,
            detail="Low boundary layer height concentrates pollutants.",
        ))
    else:
        factors.append(PredictionFactor(
            id="blh", label="Deep mixing layer", impact="lowers", weight=0.25,
            detail="Tall mixing layer dilutes surface pollutants.",
        ))

    if precip > 0.5:
        factors.append(PredictionFactor(
            id="precip", label="Rainfall", impact="lowers", weight=0.20,
            detail="Precipitation washes particles out of the air.",
        ))

    if pm25 > 100:
        factors.append(PredictionFactor(
            id="pm25", label="High PM2.5 loading", impact="raises", weight=0.25,
            detail="Recent fine-particle concentrations are elevated.",
        ))

    factors.sort(key=lambda f: f.weight, reverse=True)
    return factors[:4]


# ── FastAPI app ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Aire API",
    description="Backend API serving predicted India AQI, secure authentication, and persistent user data.",
    version="3.0.0",
)

raw_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
)
allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database tables on startup
init_db()

# Mount auth and user routers
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(user_router, prefix="/user", tags=["user"])


@app.get("/health")
def health():
    return {"status": "ok", "models_loaded": sorted(models.keys())}


@app.get("/metrics")
def metrics():
    return _metrics


def _num(row: pd.Series, key: str, default: float) -> float:
    v = row.get(key, np.nan)
    return default if v is None or pd.isna(v) else float(v)


@app.get("/predict/{city_id}", response_model=AqiPrediction)
def predict(city_id: str):
    if not models:
        raise HTTPException(503, "Models not loaded — run train.py first")

    coords = CITY_COORDS.get(city_id)
    if coords is None:
        raise HTTPException(404, f"City '{city_id}' not in city registry")

    lat, lon = coords
    now = datetime.now(tz=timezone.utc).replace(minute=0, second=0, microsecond=0)

    # ── Real recent air quality + weather/forecast → features ─────────────
    try:
        frame = fetch_live_frame(city_id, lat, lon, now)
    except Exception as e:
        raise HTTPException(502, f"Open-Meteo error: {e}")

    feats = build_features(frame, for_inference=True)
    feats = feats[(feats["timestamp"] <= pd.Timestamp(now)) & feats["aqi_lag_0h"].notna()]
    if feats.empty:
        raise HTTPException(502, "No recent air-quality reading available for this city")
    row = feats.sort_values("timestamp").iloc[-1]

    base_ts = row["timestamp"].to_pydatetime()
    if now - base_ts > timedelta(hours=3):
        raise HTTPException(502, f"Latest air-quality reading is stale ({base_ts.isoformat()})")

    aqi_now = float(row["aqi_lag_0h"])

    # ── Run inference for each horizon (models predict change vs. now) ────
    horizon_results: dict[int, int] = {}
    for h in HORIZONS:
        if h not in models:
            continue
        x = np.array([[_num(row, c, np.nan) for c in feature_map[h]]], dtype=float)
        pred_raw = float(models[h].predict(x)[0]) + aqi_now
        horizon_results[h] = int(np.clip(pred_raw, 0, 500))

    if not horizon_results:
        raise HTTPException(503, "No horizon models available")

    series_points: list[PredictionPoint] = [
        PredictionPoint(timestamp=base_ts.isoformat(), aqi=int(np.clip(aqi_now, 0, 500)))
    ]

    # Build full 24-point series interpolating between known horizons
    horizon_set = sorted(horizon_results.keys())
    for step in range(1, 25):
        lo_h = max((h for h in horizon_set if h <= step), default=horizon_set[0])
        hi_h = min((h for h in horizon_set if h >= step), default=horizon_set[-1])
        if lo_h == hi_h:
            aqi = horizon_results[lo_h]
        else:
            lo_v = horizon_results[lo_h]
            hi_v = horizon_results[hi_h]
            t = (step - lo_h) / (hi_h - lo_h)
            aqi = int(np.clip(lo_v + t * (hi_v - lo_v), 0, 500))

        ts = (base_ts + timedelta(hours=step)).isoformat()
        low, high = _band(aqi, step)
        series_points.append(PredictionPoint(timestamp=ts, aqi=aqi, low=low, high=high))

    # ── Build horizons list ───────────────────────────────────────────────
    horizons_out = []
    for h in HORIZONS:
        if h not in horizon_results:
            continue
        aqi = horizon_results[h]
        low, high = _band(aqi, h)
        confidence = round(max(0.50, 0.93 - 0.018 * h), 2)
        horizons_out.append(PredictionHorizon(
            hours=h,
            targetTime=(base_ts + timedelta(hours=h)).isoformat(),
            aqi=aqi,
            low=low,
            high=high,
            confidence=confidence,
        ))

    # ── Insight text ──────────────────────────────────────────────────────
    six_h_aqi = horizon_results.get(6, horizon_results.get(3, aqi_now))
    delta = six_h_aqi - aqi_now
    if delta > 10:
        insight = "AQI is predicted to rise over the next 6 hours -- consider limiting outdoor activity."
    elif delta < -10:
        insight = "Air quality is expected to improve over the next 6 hours."
    else:
        insight = "AQI is predicted to remain relatively stable in the near term."

    factor_inputs = {
        "wind_speed": _num(row, "wind_speed", 2.0),
        "blh":        _num(row, "blh", 500.0),
        "precip":     _num(row, "precip", 0.0),
        "pm25_lag1":  _num(row, "pm25_now", 60.0),
    }

    return AqiPrediction(
        locationId=city_id,
        generatedAt=now.isoformat(),
        modelVersion="xgb-2.0",
        series=series_points,
        horizons=horizons_out,
        factors=_make_factors(factor_inputs, delta),
        insight=insight,
    )
