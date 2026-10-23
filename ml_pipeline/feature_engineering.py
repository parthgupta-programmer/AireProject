"""
feature_engineering.py
───────────────────────
Step 2 of the ML pipeline.

Reads   ml_pipeline/data/combined.csv  (produced by collect_data.py)
Writes  ml_pipeline/data/features.csv

This module is also imported by train.py, evaluate.py and serve.py so that
training and serving build features with *exactly* the same code.

Features created
─────────────────
Temporal      hour/dow/month sin+cos, is_weekend
Static        lat, lon   (lets one model tell cities apart)

AQI history   aqi_lag_0h (the CURRENT AQI), lags 1/2/3/6/12/24/48 h,
              rolling mean 3/6/12/24/72/168 h, rolling std 6/24 h,
              rolling max/min 24 h, and differences (trend) over 1/3/6/24 h

Pollutants    current PM2.5/PM10/NO2/SO2/CO/O3, a few lags, PM2.5/PM10 ratio

Meteorology   current temp, humidity, precip, wind, pressure, boundary-layer
              height, plus short-term trends (pressure/temp change, 24 h rain,
              6 h mean wind) and the ventilation index (wind * BLH)

Future met    per horizon h: weather at t+h and the mean/sum over (t, t+h]
              (available at serving time from the Open-Meteo forecast API)

Target        aqi_next_1h … aqi_next_24h
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
TEST_FRACTION = 0.15           # fraction of (chronologically latest) data held out

# Variables whose value at t+h is used as a feature for the h-hour model
FUT_POINT_VARS = ["temp_2m", "rh", "wind_speed", "wind_u", "wind_v", "blh_log", "pressure"]

BASE_FEATURES = [
    # temporal
    "hour_sin", "hour_cos", "dow_sin", "dow_cos", "month_sin", "month_cos", "is_weekend",
    # static
    "lat", "lon",
    # AQI history (aqi_lag_0h == AQI right now)
    "aqi_lag_0h", "aqi_lag_1h", "aqi_lag_2h", "aqi_lag_3h", "aqi_lag_6h",
    "aqi_lag_12h", "aqi_lag_24h", "aqi_lag_48h",
    "aqi_roll3h", "aqi_roll6h", "aqi_roll12h", "aqi_roll24h", "aqi_roll72h", "aqi_roll168h",
    "aqi_std6h", "aqi_std24h", "aqi_max24h", "aqi_min24h",
    "aqi_d1", "aqi_d3", "aqi_d6", "aqi_d24",
    # pollutants
    "pm25_now", "pm10_now", "no2_now", "so2_now", "co_now", "o3_now",
    "pm25_lag1", "pm25_lag3", "pm25_roll6", "pm10_lag1", "no2_lag1", "o3_lag1",
    "pm25_pm10_ratio",
    # meteorology (now)
    "temp_2m", "rh", "precip", "wind_speed", "wind_u", "wind_v",
    "pressure", "blh", "blh_log",
    "pressure_diff3", "temp_diff3", "precip_sum24", "wind_mean6", "vent_idx",
    # interactions
    "pm25_x_wind", "temp_x_o3", "pm25_per_blh",
]


def future_cols(h: int) -> list[str]:
    """Names of the future-weather columns used by the h-hour model."""
    return (
        [f"{v}_fut_{h}h" for v in FUT_POINT_VARS]
        + [f"precip_fut_sum_{h}h", f"wind_fut_mean_{h}h", f"blh_fut_mean_{h}h"]
    )


def horizon_feature_cols(h: int, available: list[str] | None = None) -> list[str]:
    """Ordered feature list for the h-hour model (optionally filtered)."""
    cols = BASE_FEATURES + future_cols(h)
    if available is not None:
        avail = set(available)
        cols = [c for c in cols if c in avail]
    return cols


def temporal_split(df: pd.DataFrame, horizon_gap_h: int = 24) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Chronological train/test split. The last `horizon_gap_h` hours of the train
    block are dropped so that no training target overlaps the test period.
    """
    df = df.sort_values("timestamp").reset_index(drop=True)
    split = int(len(df) * (1 - TEST_FRACTION))
    train, test = df.iloc[:split], df.iloc[split:]
    if len(test):
        cutoff = test["timestamp"].min() - pd.Timedelta(hours=horizon_gap_h)
        train = train[train["timestamp"] <= cutoff]
    return train, test


def cyclical(series: pd.Series, period: float):
    """Return (sin, cos) encoding of a cyclic variable."""
    angle = 2 * np.pi * series / period
    return np.sin(angle), np.cos(angle)


def _build_city(city_id: str, group: pd.DataFrame, for_inference: bool) -> pd.DataFrame:
    # ── Regularise to a strict hourly grid so shift(n) really means n hours ──
    g = group.sort_values("timestamp").drop_duplicates("timestamp").set_index("timestamp")
    full_idx = pd.date_range(g.index.min(), g.index.max(), freq="1h")
    g = g.reindex(full_idx)
    g.index.name = "timestamp"
    num_cols = g.select_dtypes("number").columns
    g[num_cols] = g[num_cols].interpolate(limit=3, limit_area="inside")
    g["city_id"] = city_id
    g = g.reset_index()

    # ── Temporal features ──────────────────────────────────────────────────
    g["hour"]  = g["timestamp"].dt.hour
    g["dow"]   = g["timestamp"].dt.dayofweek
    g["month"] = g["timestamp"].dt.month

    g["hour_sin"],  g["hour_cos"]  = cyclical(g["hour"],  24)
    g["dow_sin"],   g["dow_cos"]   = cyclical(g["dow"],   7)
    g["month_sin"], g["month_cos"] = cyclical(g["month"], 12)
    g["is_weekend"] = (g["dow"] >= 5).astype(int)

    # ── Meteorological features (now) ──────────────────────────────────────
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

    rad = np.deg2rad(g["wind_dir"].fillna(0))
    g["wind_u"] = g["wind_speed"] * np.sin(rad)
    g["wind_v"] = g["wind_speed"] * np.cos(rad)
    g["blh_log"] = np.log1p(g["blh"].clip(lower=0))

    g["pressure_diff3"] = g["pressure"].diff(3)
    g["temp_diff3"]     = g["temp_2m"].diff(3)
    g["precip_sum24"]   = g["precip"].rolling(24, min_periods=1).sum()
    g["wind_mean6"]     = g["wind_speed"].rolling(6, min_periods=1).mean()
    g["vent_idx"]       = g["wind_speed"] * g["blh"].clip(lower=0)   # ventilation coefficient

    # ── AQI history (all causal: nothing after time t is used) ─────────────
    g["aqi_lag_0h"] = g["aqi"]
    for lag in [1, 2, 3, 6, 12, 24, 48]:
        g[f"aqi_lag_{lag}h"] = g["aqi"].shift(lag)

    for window in [3, 6, 12, 24, 72, 168]:
        g[f"aqi_roll{window}h"] = g["aqi"].rolling(window, min_periods=max(1, window // 2)).mean()
    for window in [6, 24]:
        g[f"aqi_std{window}h"] = g["aqi"].rolling(window, min_periods=max(2, window // 2)).std()
    g["aqi_max24h"] = g["aqi"].rolling(24, min_periods=12).max()
    g["aqi_min24h"] = g["aqi"].rolling(24, min_periods=12).min()

    g["aqi_d1"]  = g["aqi"] - g["aqi_lag_1h"]
    g["aqi_d3"]  = g["aqi"] - g["aqi_lag_3h"]
    g["aqi_d6"]  = g["aqi"] - g["aqi_lag_6h"]
    g["aqi_d24"] = g["aqi"] - g["aqi_lag_24h"]

    # ── Pollutants ─────────────────────────────────────────────────────────
    for p in ["pm25", "pm10", "no2", "so2", "co", "o3"]:
        if f"{p}_raw" in g.columns:
            g[f"{p}_now"] = g[f"{p}_raw"]
    if "pm25_now" in g.columns:
        g["pm25_lag1"]  = g["pm25_now"].shift(1)
        g["pm25_lag3"]  = g["pm25_now"].shift(3)
        g["pm25_roll6"] = g["pm25_now"].rolling(6, min_periods=3).mean()
    if "pm10_now" in g.columns:
        g["pm10_lag1"] = g["pm10_now"].shift(1)
    if "no2_now" in g.columns:
        g["no2_lag1"] = g["no2_now"].shift(1)
    if "o3_now" in g.columns:
        g["o3_lag1"] = g["o3_now"].shift(1)
    if "pm25_now" in g.columns and "pm10_now" in g.columns:
        g["pm25_pm10_ratio"] = g["pm25_now"] / (g["pm10_now"] + 1.0)

    # ── Interaction features ───────────────────────────────────────────────
    if "pm25_now" in g.columns:
        g["pm25_x_wind"]  = g["pm25_now"] * g["wind_speed"].fillna(0)
        g["pm25_per_blh"] = g["pm25_now"] / (g["blh"].clip(lower=0) + 50.0)
    if "o3_now" in g.columns:
        g["temp_x_o3"] = g["temp_2m"].fillna(0) * g["o3_now"].fillna(0)

    # ── Future weather for each horizon (forecast-available at serve time) ─
    new_cols: dict[str, pd.Series] = {}
    for h in HORIZONS:
        for v in FUT_POINT_VARS:
            new_cols[f"{v}_fut_{h}h"] = g[v].shift(-h)
        new_cols[f"precip_fut_sum_{h}h"] = g["precip"].rolling(h, min_periods=1).sum().shift(-h)
        new_cols[f"wind_fut_mean_{h}h"]  = g["wind_speed"].rolling(h, min_periods=1).mean().shift(-h)
        new_cols[f"blh_fut_mean_{h}h"]   = g["blh_log"].rolling(h, min_periods=1).mean().shift(-h)

    # ── Targets ────────────────────────────────────────────────────────────
    if not for_inference:
        for h in HORIZONS:
            new_cols[f"aqi_next_{h}h"] = g["aqi"].shift(-h)

    g = pd.concat([g, pd.DataFrame(new_cols, index=g.index)], axis=1)

    return g


def build_features(df: pd.DataFrame, for_inference: bool = False) -> pd.DataFrame:
    """
    Build the full feature table.

    for_inference=False  → adds target columns and drops rows without targets
                           or without a current AQI (training / evaluation).
    for_inference=True   → keeps every row (incl. future-weather rows with no
                           AQI); the caller picks the row it needs (serve.py).
    """
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)

    frames = [_build_city(cid, grp, for_inference) for cid, grp in df.groupby("city_id")]
    result = pd.concat(frames, ignore_index=True)

    if not for_inference:
        target_cols = [f"aqi_next_{h}h" for h in HORIZONS]
        result = result.dropna(subset=target_cols + ["aqi_lag_0h"])

    # Raw pollutant columns are only needed to derive *_now / lags above
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

    print("\nTarget columns:")
    print([c for c in feat.columns if c.startswith("aqi_next")])
    print("\nMissing value % (top 10):")
    miss = feat.isnull().mean() * 100
    print(miss[miss > 0].sort_values(ascending=False).head(10))


if __name__ == "__main__":
    main()
