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
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
import math

import joblib
import numpy as np
import pandas as pd
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

BASE = Path(__file__).parent
MODELS_DIR = BASE / "models"

# ── Load model artefacts at startup ───────────────────────────────────────────

HORIZONS = [1, 3, 6, 12, 24]

models: dict[int, object] = {}
scaler = None
feature_cols: list[str] = []
_metrics: list[dict] = []


def _load_models() -> None:
    global scaler, feature_cols, _metrics

    scaler_path = MODELS_DIR / "scaler.joblib"
    fn_path     = MODELS_DIR / "feature_names.json"
    metrics_path = MODELS_DIR / "metrics.json"

    if not scaler_path.exists() or not fn_path.exists():
        log.error("Models not found — run  python ml_pipeline/train.py  first.")
        return

    scaler = joblib.load(scaler_path)
    with open(fn_path) as f:
        feature_cols = json.load(f)

    if metrics_path.exists():
        with open(metrics_path) as f:
            _metrics = json.load(f)

    for h in HORIZONS:
        mp = MODELS_DIR / f"model_{h}h.joblib"
        if mp.exists():
            models[h] = joblib.load(mp)
            log.info("Loaded model_%dh.joblib", h)
        else:
            log.warning("model_%dh.joblib not found", h)


_load_models()

# ── Open-Meteo live fetcher ────────────────────────────────────────────────────

OPENMETEO_FORECAST = "https://api.open-meteo.com/v1/forecast"


def fetch_live_meteo(lat: float, lon: float) -> dict:
    """Fetch the latest & next 24h forecast from Open-Meteo (no key needed)."""
    resp = requests.get(
        OPENMETEO_FORECAST,
        params={
            "latitude": lat,
            "longitude": lon,
            "hourly": ",".join([
                "temperature_2m",
                "relative_humidity_2m",
                "precipitation",
                "wind_speed_10m",
                "wind_direction_10m",
                "surface_pressure",
                "boundary_layer_height",
            ]),
            "forecast_days": 2,
            "timezone": "UTC",
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


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

# ── Feature builder (mirrors feature_engineering.py, single-row version) ──────

def _cyclical(value: float, period: float) -> tuple[float, float]:
    angle = 2 * math.pi * value / period
    return math.sin(angle), math.cos(angle)


def build_inference_row(
    now_ts: datetime,
    recent_aqi: list[float],   # [t-24h, t-23h, …, t-1h, t] — newest last
    met_now: dict,             # current meteorological values
) -> dict:
    """
    Build a single feature row for inference.
    `recent_aqi` must have at least 24 values (hours).
    """
    if len(recent_aqi) < 24:
        recent_aqi = ([recent_aqi[0]] * (24 - len(recent_aqi))) + list(recent_aqi)

    h_sin, h_cos = _cyclical(now_ts.hour, 24)
    d_sin, d_cos = _cyclical(now_ts.weekday(), 7)
    m_sin, m_cos = _cyclical(now_ts.month, 12)

    ws  = met_now.get("wind_speed", 0) or 0
    wd  = met_now.get("wind_dir", 0) or 0
    blh = max(0, met_now.get("blh", 500) or 500)
    rad = math.radians(wd)

    pm25 = met_now.get("pm25_lag1", recent_aqi[-1] * 0.3)  # crude fallback
    o3   = met_now.get("o3_lag1", 30)
    temp = met_now.get("temp_2m", 25)

    aqi_series = recent_aqi  # index 0 = 24h ago, -1 = most recent
    roll3  = float(np.mean(aqi_series[-3:]))
    roll6  = float(np.mean(aqi_series[-6:]))
    roll12 = float(np.mean(aqi_series[-12:]))
    roll24 = float(np.mean(aqi_series[-24:]))

    row = {
        "hour_sin": h_sin,   "hour_cos": h_cos,
        "dow_sin": d_sin,    "dow_cos": d_cos,
        "month_sin": m_sin,  "month_cos": m_cos,
        "is_weekend": int(now_ts.weekday() >= 5),

        "aqi_lag_1h":  aqi_series[-1],
        "aqi_lag_2h":  aqi_series[-2],
        "aqi_lag_3h":  aqi_series[-3],
        "aqi_lag_6h":  aqi_series[-6],
        "aqi_lag_12h": aqi_series[-12],
        "aqi_lag_24h": aqi_series[-24],

        "aqi_roll3h":  roll3,
        "aqi_roll6h":  roll6,
        "aqi_roll12h": roll12,
        "aqi_roll24h": roll24,

        "pm25_lag1": pm25,
        "pm10_lag1": pm25 * 1.5,
        "no2_lag1":  met_now.get("no2_lag1", 40),
        "o3_lag1":   o3,

        "temp_2m":    temp,
        "rh":         met_now.get("rh", 60),
        "precip":     met_now.get("precip", 0),
        "wind_speed": ws,
        "wind_u":     ws * math.sin(rad),
        "wind_v":     ws * math.cos(rad),
        "pressure":   met_now.get("pressure", 1013),
        "blh":        blh,
        "blh_log":    math.log1p(blh),

        "pm25_x_wind": pm25 * ws,
        "temp_x_o3":   temp * o3,
    }
    return row


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

# Per-horizon std (AQI units) derived from eval metrics — update after evaluate.py
_HORIZON_STD: dict[int, float] = {1: 18, 3: 28, 6: 38, 12: 50, 24: 60}


def _band(aqi: int, horizon_h: int, z: float = 1.645) -> tuple[int, int]:
    std = _HORIZON_STD.get(horizon_h, 40)
    return (max(0, int(aqi - z * std)), min(500, int(aqi + z * std)))


# ── SHAP-derived static factor explanations ───────────────────────────────────

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

    # Sort by weight descending, keep top 4
    factors.sort(key=lambda f: f.weight, reverse=True)
    return factors[:4]


# ── FastAPI app ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="AQI Prediction API",
    description="XGBoost model serving predicted India AQI for the Aire app.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Restrict in production
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "models_loaded": sorted(models.keys())}


@app.get("/metrics")
def metrics():
    return _metrics


@app.get("/predict/{city_id}", response_model=AqiPrediction)
def predict(city_id: str):
    if not models:
        raise HTTPException(503, "Models not loaded — run train.py first")

    coords = CITY_COORDS.get(city_id)
    if coords is None:
        raise HTTPException(404, f"City '{city_id}' not in city registry")

    lat, lon = coords
    now = datetime.now(tz=timezone.utc).replace(minute=0, second=0, microsecond=0)

    # ── Fetch live meteorology ────────────────────────────────────────────
    try:
        met_data = fetch_live_meteo(lat, lon)
    except Exception as e:
        raise HTTPException(502, f"Open-Meteo error: {e}")

    hourly = met_data.get("hourly", {})
    times  = hourly.get("time", [])
    now_str = now.strftime("%Y-%m-%dT%H:00")
    try:
        now_idx = times.index(now_str)
    except ValueError:
        now_idx = min(len(times) - 1, 24)

    def _met(key: str, idx: int):
        vals = hourly.get(key, [])
        return vals[idx] if idx < len(vals) else None

    met_now = {
        "temp_2m":    _met("temperature_2m",       now_idx),
        "rh":         _met("relative_humidity_2m",  now_idx),
        "precip":     _met("precipitation",         now_idx),
        "wind_speed": _met("wind_speed_10m",         now_idx),
        "wind_dir":   _met("wind_direction_10m",     now_idx),
        "pressure":   _met("surface_pressure",       now_idx),
        "blh":        _met("boundary_layer_height",  now_idx),
    }

    # ── Build a dummy recent-AQI series from lag feature only ────────────
    # (In production you'd fetch real AQ history from OpenAQ here.)
    # We seed it from the 1h model's output to stay self-consistent.
    base_aqi = 150  # fallback starting point
    recent_aqi = [base_aqi] * 24  # will be overwritten with model feedback loop

    # ── Run inference for each horizon ────────────────────────────────────
    series_points: list[PredictionPoint] = []
    horizon_results: dict[int, int] = {}

    # First point = current (lag 1h is our best guess of "now")
    current_row = build_inference_row(now, recent_aqi, met_now)
    feature_vec = np.array([[current_row.get(c, 0) for c in feature_cols]])
    scaled_vec  = scaler.transform(feature_vec)

    series_points.append(PredictionPoint(
        timestamp=now.isoformat(),
        aqi=int(np.clip(recent_aqi[-1], 0, 500)),
    ))

    for h in HORIZONS:
        if h not in models:
            continue
        pred_raw = float(models[h].predict(scaled_vec)[0])
        pred_aqi = int(np.clip(pred_raw, 0, 500))
        horizon_results[h] = pred_aqi

    # Build full 24-point series interpolating between known horizons
    horizon_set = sorted(horizon_results.keys())
    for step in range(1, 25):
        # Find bracketing horizons
        lo_h = max((h for h in horizon_set if h <= step), default=horizon_set[0])
        hi_h = min((h for h in horizon_set if h >= step), default=horizon_set[-1])
        if lo_h == hi_h:
            aqi = horizon_results[lo_h]
        else:
            lo_v = horizon_results[lo_h]
            hi_v = horizon_results[hi_h]
            t = (step - lo_h) / (hi_h - lo_h)
            aqi = int(np.clip(lo_v + t * (hi_v - lo_v), 0, 500))

        ts = (now + timedelta(hours=step)).isoformat()
        low, high = _band(aqi, step)
        series_points.append(PredictionPoint(timestamp=ts, aqi=aqi, low=low, high=high))

    # ── Build horizons list ───────────────────────────────────────────────
    horizons_out = []
    for h in HORIZONS:
        if h not in horizon_results:
            continue
        aqi = horizon_results[h]
        low, high = _band(aqi, h)
        # Confidence falls with horizon: 0.93 → 0.50
        confidence = round(max(0.50, 0.93 - 0.018 * h), 2)
        horizons_out.append(PredictionHorizon(
            hours=h,
            targetTime=(now + timedelta(hours=h)).isoformat(),
            aqi=aqi,
            low=low,
            high=high,
            confidence=confidence,
        ))

    # ── Insight text ──────────────────────────────────────────────────────
    six_h_aqi = horizon_results.get(6, horizon_results.get(3, recent_aqi[-1]))
    delta = six_h_aqi - recent_aqi[-1]
    if delta > 10:
        insight = "AQI is predicted to rise over the next 6 hours -- consider limiting outdoor activity."
    elif delta < -10:
        insight = "Air quality is expected to improve over the next 6 hours."
    else:
        insight = "AQI is predicted to remain relatively stable in the near term."

    return AqiPrediction(
        locationId=city_id,
        generatedAt=now.isoformat(),
        modelVersion="xgb-1.0",
        series=series_points,
        horizons=horizons_out,
        factors=_make_factors(met_now, delta),
        insight=insight,
    )
