"""
collect_data.py
───────────────
Step 1 of the ML pipeline.

Pulls historical air-quality measurements (PM2.5, PM10, NO2, SO2, CO, O3)
from OpenAQ and matching meteorological features (wind speed/direction,
temperature, humidity, boundary-layer height, precipitation) from Open-Meteo.

Data is saved to   ml_pipeline/data/raw/<city_id>.csv

Usage:
    python ml_pipeline/collect_data.py

Environment variables (set in .env or pass on the command line):
    OPENAQ_API_KEY   – free key from https://docs.openaq.org/using-the-api/api-key
    (Open-Meteo is free and requires no key)

Flags (edit at the top of this file):
    CITIES           – which city IDs to download  (subset of indiaLocations)
    DAYS_BACK        – how many days of history to fetch (default 90)
"""

from __future__ import annotations

import os
import time
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
import requests

# ── Configuration ─────────────────────────────────────────────────────────────

# Your OpenAQ API key (from https://docs.openaq.org/using-the-api/api-key)
# Either set the environment variable OPENAQ_API_KEY or paste it here:
OPENAQ_API_KEY: str = os.getenv("OPENAQ_API_KEY", "")

# How many days of past data to download
DAYS_BACK: int = 90

# Cities to train on — must match IDs in src/data/indiaLocations.ts
# Format: (city_id, display_name, latitude, longitude)
CITIES = [
    ("delhi",          "Delhi",          28.6139,  77.2090),
    ("mumbai",         "Mumbai",         19.0760,  72.8777),
    ("ghaziabad",      "Ghaziabad",      28.6692,  77.4538),
    ("bangalore",      "Bengaluru",      12.9716,  77.5946),
    ("kolkata",        "Kolkata",        22.5726,  88.3639),
    ("hyderabad",      "Hyderabad",      17.3850,  78.4867),
    ("chennai",        "Chennai",        13.0827,  80.2707),
    ("patna",          "Patna",          25.5941,  85.1376),
    ("lucknow",        "Lucknow",        26.8467,  80.9462),
    ("ahmedabad",      "Ahmedabad",      23.0225,  72.5714),
]

RAW_DIR = Path(__file__).parent / "data" / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)

OPENAQ_BASE = "https://api.openaq.org/v3"
OPENMETEO_BASE = "https://archive-api.open-meteo.com/v1/archive"

POLLUTANT_MAP = {
    "pm25": "pm25",
    "pm10": "pm10",
    "no2":  "no2",
    "so2":  "so2",
    "co":   "co",
    "o3":   "o3",
}

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)


OPENMETEO_AQ_BASE = "https://air-quality-api.open-meteo.com/v1/air-quality"


# ── OpenAQ helpers ─────────────────────────────────────────────────────────────

def _openaq_headers() -> dict:
    if OPENAQ_API_KEY == "YOUR_OPENAQ_API_KEY_HERE":
        raise RuntimeError(
            "Please set OPENAQ_API_KEY in your environment or in collect_data.py.\n"
            "Get a free key at: https://docs.openaq.org/using-the-api/api-key"
        )
    return {"X-API-Key": OPENAQ_API_KEY}


def find_openaq_location(city_name: str, lat: float, lon: float, radius_m: int = 25_000) -> Optional[int]:
    """Return the first OpenAQ location ID near (lat, lon)."""
    try:
        resp = requests.get(
            f"{OPENAQ_BASE}/locations",
            params={"coordinates": f"{lat},{lon}", "radius": radius_m, "limit": 5},
            headers=_openaq_headers(),
            timeout=20,
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if not results:
            log.warning("No OpenAQ location found near %s", city_name)
            return None
        loc_id: int = results[0]["id"]
        log.info("  OpenAQ location %d  (%s)", loc_id, results[0].get("name", "?"))
        return loc_id
    except Exception as exc:
        log.warning("OpenAQ location lookup failed for %s: %s", city_name, exc)
        return None


def fetch_openaq_measurements(
    location_id: int,
    date_from: datetime,
    date_to: datetime,
) -> pd.DataFrame:
    """Fetch hourly averages for sensors at location_id via OpenAQ v3."""
    # In OpenAQ v3, sensors are listed under /locations/{location_id}/sensors
    resp = requests.get(
        f"{OPENAQ_BASE}/locations/{location_id}/sensors",
        headers=_openaq_headers(),
        timeout=20,
    )
    resp.raise_for_status()
    sensors = resp.json().get("results", [])
    if not sensors:
        return pd.DataFrame()

    records = []
    for s in sensors:
        param_name = s.get("parameter", {}).get("name", "").lower()
        if param_name not in POLLUTANT_MAP:
            continue
        sensor_id = s["id"]
        # Query hourly aggregations for this sensor
        try:
            h_resp = requests.get(
                f"{OPENAQ_BASE}/sensors/{sensor_id}/hours",
                params={
                    "datetime_from": date_from.isoformat(),
                    "datetime_to": date_to.isoformat(),
                    "limit": 1000,
                },
                headers=_openaq_headers(),
                timeout=20,
            )
            if h_resp.status_code == 200:
                for row in h_resp.json().get("results", []):
                    t_str = row.get("period", {}).get("datetimeFrom", {}).get("utc")
                    val = row.get("value")
                    if t_str and val is not None and val >= 0:
                        records.append({
                            "timestamp": t_str,
                            "parameter": param_name,
                            "value": val,
                        })
        except Exception:
            pass

    if not records:
        return pd.DataFrame()

    df = pd.DataFrame(records)
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df = df.pivot_table(index="timestamp", columns="parameter", values="value", aggfunc="mean")
    df.columns.name = None
    df = df.reset_index()
    df = df.rename(columns={"pm25": "pm25_raw", "pm10": "pm10_raw",
                              "no2": "no2_raw", "so2": "so2_raw",
                              "co": "co_raw", "o3": "o3_raw"})
    df = df.set_index("timestamp").resample("1H").mean(numeric_only=True).interpolate(method="linear", limit=2).reset_index()
    return df


def fetch_openmeteo_airquality(lat: float, lon: float, date_from: datetime, date_to: datetime) -> pd.DataFrame:
    """Fetch hourly PM2.5, PM10, NO2, SO2, CO, O3 from Open-Meteo Air Quality Archive."""
    resp = requests.get(
        OPENMETEO_AQ_BASE,
        params={
            "latitude": lat,
            "longitude": lon,
            "hourly": "pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide",
            "start_date": date_from.strftime("%Y-%m-%d"),
            "end_date": date_to.strftime("%Y-%m-%d"),
            "timezone": "UTC",
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json().get("hourly", {})
    if not data or "time" not in data:
        return pd.DataFrame()

    df = pd.DataFrame(data)
    df = df.rename(columns={
        "time": "timestamp",
        "pm2_5": "pm25_raw",
        "pm10": "pm10_raw",
        "nitrogen_dioxide": "no2_raw",
        "sulphur_dioxide": "so2_raw",
        "ozone": "o3_raw",
        "carbon_monoxide": "co_raw_ug",
    })
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    # Convert CO from ug/m3 to mg/m3 for India CPCB formula
    if "co_raw_ug" in df.columns:
        df["co_raw"] = df["co_raw_ug"] / 1000.0
        df = df.drop(columns=["co_raw_ug"])
    return df


# ── Open-Meteo helpers ─────────────────────────────────────────────────────────

def fetch_openmeteo(lat: float, lon: float, date_from: datetime, date_to: datetime) -> pd.DataFrame:
    """
    Fetch hourly meteorological variables from the Open-Meteo historical archive.
    No API key required.
    """
    resp = requests.get(
        OPENMETEO_BASE,
        params={
            "latitude": lat,
            "longitude": lon,
            "start_date": date_from.strftime("%Y-%m-%d"),
            "end_date": date_to.strftime("%Y-%m-%d"),
            "hourly": ",".join([
                "temperature_2m",
                "relative_humidity_2m",
                "precipitation",
                "wind_speed_10m",
                "wind_direction_10m",
                "surface_pressure",
                "boundary_layer_height",
            ]),
            "timezone": "UTC",
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    hourly = data["hourly"]
    df = pd.DataFrame(hourly)
    df = df.rename(columns={"time": "timestamp"})
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    return df


# ── India AQI calculator ──────────────────────────────────────────────────────

# Sub-index breakpoints table (CPCB India)
_BP = {
    "pm25": [
        (0,    30,   0,   50),
        (31,   60,   51,  100),
        (61,   90,   101, 200),
        (91,   120,  201, 300),
        (121,  250,  301, 400),
        (251,  500,  401, 500),
    ],
    "pm10": [
        (0,    50,   0,   50),
        (51,   100,  51,  100),
        (101,  250,  101, 200),
        (251,  350,  201, 300),
        (351,  430,  301, 400),
        (431,  600,  401, 500),
    ],
    "no2": [
        (0,    40,   0,   50),
        (41,   80,   51,  100),
        (81,   180,  101, 200),
        (181,  280,  201, 300),
        (281,  400,  301, 400),
        (401,  800,  401, 500),
    ],
    "so2": [
        (0,    40,   0,   50),
        (41,   80,   51,  100),
        (81,   380,  101, 200),
        (381,  800,  201, 300),
        (801,  1600, 301, 400),
        (1601, 2100, 401, 500),
    ],
    "co": [
        (0,    1,    0,   50),
        (1.1,  2,    51,  100),
        (2.1,  10,   101, 200),
        (10.1, 17,   201, 300),
        (17.1, 34,   301, 400),
        (34.1, 50,   401, 500),
    ],
    "o3": [
        (0,    50,   0,   50),
        (51,   100,  51,  100),
        (101,  168,  101, 200),
        (169,  208,  201, 300),
        (209,  748,  301, 400),
        (749,  1000, 401, 500),
    ],
}


def _sub_index(pollutant: str, conc: float) -> Optional[float]:
    if pd.isna(conc) or conc < 0:
        return None
    for (cl, ch, il, ih) in _BP[pollutant]:
        if cl <= conc <= ch:
            return il + (ih - il) * (conc - cl) / (ch - cl)
    return 500.0


def calc_aqi(row: pd.Series) -> float:
    """Return India CPCB AQI from a row that may have raw pollutant columns."""
    sub = []
    for p in ["pm25", "pm10", "no2", "so2", "co", "o3"]:
        col = f"{p}_raw"
        if col in row.index and not pd.isna(row[col]):
            si = _sub_index(p, row[col])
            if si is not None:
                sub.append(si)
    return max(sub) if sub else float("nan")


# ── Main ──────────────────────────────────────────────────────────────────────

def collect_city(city_id: str, name: str, lat: float, lon: float) -> None:
    out_path = RAW_DIR / f"{city_id}.csv"
    if out_path.exists():
        log.info("Skipping %s — already downloaded (%s)", name, out_path)
        return

    log.info("=== %s ===", name)
    date_to   = datetime.now(tz=timezone.utc)
    date_from = date_to - timedelta(days=DAYS_BACK)

    # --- Air Quality measurements (OpenAQ v3 with Open-Meteo fallback) ---
    aq_df = pd.DataFrame()
    loc_id = find_openaq_location(name, lat, lon)
    if loc_id is not None:
        log.info("  Querying OpenAQ station %d …", loc_id)
        try:
            aq_df = fetch_openaq_measurements(loc_id, date_from, date_to)
            log.info("  Got %d AQ rows from OpenAQ", len(aq_df))
        except Exception as exc:
            log.warning("  OpenAQ query failed (%s)", exc)

    if aq_df.empty:
        log.info("  No recent OpenAQ measurements found; fetching from Open-Meteo Air Quality archive …")
        try:
            aq_df = fetch_openmeteo_airquality(lat, lon, date_from, date_to)
            log.info("  Got %d AQ rows from Open-Meteo Air Quality archive", len(aq_df))
        except Exception as exc:
            log.error("  Open-Meteo AQ fetch failed: %s", exc)

    if aq_df.empty:
        log.warning("No AQ data obtainable for %s, skipping", name)
        return

    # --- Open-Meteo Weather data ---
    log.info("  Fetching Open-Meteo meteorological data …")
    met_df = fetch_openmeteo(lat, lon, date_from, date_to)
    log.info("  Got %d met rows", len(met_df))

    # --- Merge on hourly timestamp ---
    df = pd.merge(aq_df, met_df, on="timestamp", how="inner")

    # --- Compute AQI target ---
    df["aqi"] = df.apply(calc_aqi, axis=1)
    df = df.dropna(subset=["aqi"])

    # --- Add city metadata ---
    df["city_id"] = city_id
    df["lat"] = lat
    df["lon"] = lon

    df.to_csv(out_path, index=False)
    log.info("  Saved %d rows → %s", len(df), out_path)
    time.sleep(1)  # be polite to OpenAQ


def main() -> None:
    log.info("Starting data collection — %d cities, %d days back", len(CITIES), DAYS_BACK)
    for city_id, name, lat, lon in CITIES:
        try:
            collect_city(city_id, name, lat, lon)
        except Exception as exc:
            log.error("Error collecting %s: %s", name, exc)

    # Concatenate all into one master file
    frames = [pd.read_csv(f) for f in sorted(RAW_DIR.glob("*.csv"))]
    if frames:
        master = pd.concat(frames, ignore_index=True)
        master_path = RAW_DIR.parent / "combined.csv"
        master.to_csv(master_path, index=False)
        log.info("Combined dataset: %d rows → %s", len(master), master_path)


if __name__ == "__main__":
    main()
