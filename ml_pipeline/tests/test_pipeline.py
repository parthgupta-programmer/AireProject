"""
test_pipeline.py
────────────────
Unit and integration tests for the Aire ML pipeline.
Tests data preprocessing, India CPCB AQI calculation,
feature engineering causality, temporal splits, and model loading.
"""

import json
import unittest
from pathlib import Path
import numpy as np
import pandas as pd

from ml_pipeline.collect_data import calc_aqi, _sub_index
from ml_pipeline.feature_engineering import (
    build_features,
    cyclical,
    future_cols,
    horizon_feature_cols,
    temporal_split,
    BASE_FEATURES,
    HORIZONS,
)


class TestAqiCalculation(unittest.TestCase):
    """Test CPCB AQI breakpoints and sub-index formulas."""

    def test_cpcb_sub_index_breakpoints(self):
        # PM2.5: 0-30 -> 0-50, 31-60 -> 51-100, 61-90 -> 101-200
        self.assertAlmostEqual(_sub_index("pm25", 15.0), 25.0, places=1)
        self.assertAlmostEqual(_sub_index("pm25", 30.0), 50.0, places=1)
        self.assertAlmostEqual(_sub_index("pm25", 60.0), 100.0, places=1)

        # PM10: 0-50 -> 0-50, 51-100 -> 51-100
        self.assertAlmostEqual(_sub_index("pm10", 25.0), 25.0, places=1)
        self.assertAlmostEqual(_sub_index("pm10", 100.0), 100.0, places=1)

    def test_calc_aqi_max_subindex(self):
        # Max of pollutants is the AQI
        row = pd.Series({
            "pm25_raw": 60.0,  # sub-index 100
            "pm10_raw": 50.0,  # sub-index 50
            "no2_raw": 40.0,   # sub-index 50
        })
        self.assertAlmostEqual(calc_aqi(row), 100.0, places=1)

    def test_calc_aqi_missing_data(self):
        row = pd.Series({
            "pm25_raw": np.nan,
            "pm10_raw": np.nan,
        })
        self.assertTrue(np.isnan(calc_aqi(row)))


class TestFeatureEngineering(unittest.TestCase):
    """Test feature engineering causality, cyclical encoding, and future features."""

    def test_cyclical_encoding_bounds(self):
        # Hour 0 and hour 24
        s = pd.Series([0, 6, 12, 18, 24])
        sin_vals, cos_vals = cyclical(s, 24)
        # Sin should be within [-1, 1]
        self.assertTrue((sin_vals >= -1.0001).all() and (sin_vals <= 1.0001).all())
        self.assertTrue((cos_vals >= -1.0001).all() and (cos_vals <= 1.0001).all())
        # Hour 0 cos should be 1, sin 0
        self.assertAlmostEqual(cos_vals.iloc[0], 1.0, places=4)
        self.assertAlmostEqual(sin_vals.iloc[0], 0.0, places=4)

    def test_temporal_split_no_leakage(self):
        # Generate 100 hours of continuous dummy data
        dates = pd.date_range("2026-01-01", periods=100, freq="1h", tz="UTC")
        df = pd.DataFrame({
            "timestamp": dates,
            "aqi": np.random.uniform(50, 200, size=100),
            "city_id": "delhi",
        })

        train, test = temporal_split(df, horizon_gap_h=24)
        # Test max timestamp > train max timestamp
        self.assertGreater(test["timestamp"].min(), train["timestamp"].max())
        # Gap between train and test must be at least 24 hours
        gap = (test["timestamp"].min() - train["timestamp"].max()).total_seconds() / 3600
        self.assertGreaterEqual(gap, 24.0)

    def test_feature_columns_consistency(self):
        for h in HORIZONS:
            cols = horizon_feature_cols(h)
            # Must include base features
            for bf in BASE_FEATURES:
                self.assertIn(bf, cols)
            # Must include future weather columns for horizon h
            for fc in future_cols(h):
                self.assertIn(fc, cols)


class TestModelArtifacts(unittest.TestCase):
    """Test that model metadata and artifact files are structurally valid."""

    def test_feature_names_json_schema(self):
        fn_path = Path(__file__).parent.parent / "models" / "feature_names.json"
        if not fn_path.exists():
            self.skipTest("feature_names.json not yet generated")
        with open(fn_path) as f:
            data = json.load(f)
        # Must be a dict mapping horizon strings to lists
        self.assertIsInstance(data, dict, "feature_names.json must be a dictionary, not a flat list")
        for h in HORIZONS:
            h_str = str(h)
            if h_str in data:
                self.assertIsInstance(data[h_str], list)
                self.assertGreater(len(data[h_str]), 30)

    def test_all_horizon_models_exist(self):
        models_dir = Path(__file__).parent.parent / "models"
        for h in HORIZONS:
            model_file = models_dir / f"model_{h}h.joblib"
            self.assertTrue(model_file.exists(), f"Model file {model_file} should exist")
            self.assertGreater(model_file.stat().st_size, 100_000)


class TestFastApiServer(unittest.TestCase):
    """Test the FastAPI prediction server endpoints."""

    @classmethod
    def setUpClass(cls):
        from fastapi.testclient import TestClient
        from ml_pipeline.serve import app
        cls.client = TestClient(app)

    def test_health_endpoint(self):
        resp = self.client.get("/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get("status"), "ok")
        self.assertEqual(data.get("models_loaded"), [1, 3, 6, 12, 24])

    def test_metrics_endpoint(self):
        resp = self.client.get("/metrics")
        self.assertEqual(resp.status_code, 200)
        metrics = resp.json()
        self.assertEqual(len(metrics), 5)
        for m in metrics:
            self.assertIn("horizon_h", m)
            self.assertIn("mae", m)
            self.assertIn("rmse", m)
            self.assertIn("r2", m)
            self.assertIn("persistence_mae", m)

    def test_predict_unknown_city_returns_404(self):
        resp = self.client.get("/predict/unknown_city_xyz")
        self.assertEqual(resp.status_code, 404)


if __name__ == "__main__":
    unittest.main()

