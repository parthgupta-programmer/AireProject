"""
feature_engineering.py
───────────────────────
Step 2 of the ML pipeline.

Reads   ml_pipeline/data/combined.csv  (produced by collect_data.py)
Writes  ml_pipeline/data/features.csv

Features created
─────────────────
Temporal
  hour_sin, hour_cos            – cyclical hour encoding
  dow_sin,  dow_cos             – cyclical day-of-week encoding
  month_sin, month_cos          – cyclical month encoding
  is_weekend                    – boolean

Lagged AQI  (auto-regressive)
  aqi_lag_1h … aqi_lag_24h     – AQI 1, 2, 3, 6, 12, 24 hours ago
  aqi_roll3h, aqi_roll6h, aqi_roll12h, aqi_roll24h  – rolling mean

Lagged pollutants
  pm25_lag1, pm10_lag1, no2_lag1, o3_lag1

Meteorological
  temp_2m, rh, precip, wind_speed, wind_dir, pressure, blh
  wind_u, wind_v                – u/v components (cyclical decomposition)
  blh_log                       – log of boundary-layer height (approx. dispersion capacity)

Interaction
  pm25_x_wind                   – PM2.5 * wind speed (dispersion proxy)
  temp_x_o3                     – temperature * O3 (photochemical proxy)

Target
  aqi_next_1h … aqi_next_24h   – future AQI at +1h, +3h, +6h, +12h, +24h
"""

from __future__ import annotations

import sys
import numpy as np
import pandas as pd
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DATA_DIR = Path(__file__).parent / "data"
COMBINED = DATA_DIR / "combined.csv"
OUTPUT   = DATA_DIR / "features.csv"

HORIZONS = [1, 3, 6, 12, 24]   # hours ahead to predict


def cyclical(series: pd.Series, period: float):
    """Return (sin, cos) encoding of a cyclic variable."""
    angle = 2 * np.pi * series / period
    return np.sin(angle), np.cos(angle)


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df = df.sort_values(["city_id", "timestamp"]).reset_index(drop=True)

    out_frames = []
    for city_id, group in df.groupby("city_id"):
        g = group.sort_values("timestamp").copy()

        # ── Temporal features ──────────────────────────────────────────────
        g["hour"]  = g["timestamp"].dt.hour
        g["dow"]   = g["timestamp"].dt.dayofweek
        g["month"] = g["timestamp"].dt.month

        g["hour_sin"],  g["hour_cos"]  = cyclical(g["hour"],  24)
        g["dow_sin"],   g["dow_cos"]   = cyclical(g["dow"],   7)
        g["month_sin"], g["month_cos"] = cyclical(g["month"], 12)
        g["is_weekend"] = (g["dow"] >= 5).astype(int)

        # ── Lagged AQI ─────────────────────────────────────────────────────
        for lag in [1, 2, 3, 6, 12, 24]:
            g[f"aqi_lag_{lag}h"] = g["aqi"].shift(lag)

        for window in [3, 6, 12, 24]:
            g[f"aqi_roll{window}h"] = (
                g["aqi"].shift(1).rolling(window, min_periods=max(1, window // 2)).mean()
            )

        # ── Lagged pollutants ──────────────────────────────────────────────
        for p in ["pm25_raw", "pm10_raw", "no2_raw", "o3_raw"]:
            if p in g.columns:
                g[f"{p.replace('_raw','')}_lag1"] = g[p].shift(1)

        # ── Meteorological features ────────────────────────────────────────
        rename = {
            "temperature_2m": "temp_2m",
            "relative_humidity_2m": "rh",
            "precipitation": "precip",
            "wind_speed_10m": "wind_speed",
            "wind_direction_10m": "wind_dir",
            "surface_pressure": "pressure",
            "boundary_layer_height": "blh",
        }
        g = g.rename(columns=rename)

        # Wind decomposition
        if "wind_speed" in g.columns and "wind_dir" in g.columns:
            rad = np.deg2rad(g["wind_dir"].fillna(0))
            g["wind_u"] = g["wind_speed"] * np.sin(rad)
            g["wind_v"] = g["wind_speed"] * np.cos(rad)

        # Boundary-layer height log (larger → better dispersion → lower AQI)
        if "blh" in g.columns:
            g["blh_log"] = np.log1p(g["blh"].clip(lower=0))

        # ── Interaction features ───────────────────────────────────────────
        if "pm25_raw" in g.columns and "wind_speed" in g.columns:
            g["pm25_x_wind"] = g["pm25_raw"] * g["wind_speed"].fillna(0)

        if "temp_2m" in g.columns and "o3_raw" in g.columns:
            g["temp_x_o3"] = g["temp_2m"].fillna(0) * g["o3_raw"].fillna(0)

        # ── Target variables ───────────────────────────────────────────────
        for h in HORIZONS:
            g[f"aqi_next_{h}h"] = g["aqi"].shift(-h)

        out_frames.append(g)

    result = pd.concat(out_frames, ignore_index=True)

    # Drop rows where any target is missing (end of each city's time-series)
    target_cols = [f"aqi_next_{h}h" for h in HORIZONS]
    result = result.dropna(subset=target_cols + ["aqi_lag_1h"])

    # Drop raw pollutant columns (not available at inference time, model uses lags)
    raw_cols = [c for c in result.columns if c.endswith("_raw")]
    result = result.drop(columns=raw_cols, errors="ignore")

    return result


def main() -> None:
    print(f"Loading {COMBINED} ...")
    df = pd.read_csv(COMBINED)
    print(f"  {len(df):,} rows, {len(df.columns)} columns")

    print("Building features ...")
    feat = build_features(df)
    print(f"  {len(feat):,} rows, {len(feat.columns)} columns after feature engineering")

    feat.to_csv(OUTPUT, index=False)
    print(f"Saved -> {OUTPUT}")

    # Quick sanity check
    print("\nFeature columns:")
    print([c for c in feat.columns if not c.startswith("aqi_next")])
    print("\nTarget columns:")
    print([c for c in feat.columns if c.startswith("aqi_next")])
    print("\nMissing value %:")
    miss = feat.isnull().mean() * 100
    print(miss[miss > 0].sort_values(ascending=False).head(10))


if __name__ == "__main__":
    main()
