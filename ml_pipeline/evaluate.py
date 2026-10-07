"""
evaluate.py
───────────
Step 4 of the ML pipeline (optional but recommended before deploying).

Loads saved models and the held-out test split, then produces:
  • A detailed per-horizon metrics report printed to stdout
  • Actual vs Predicted time-series plots  (models/plots/actual_vs_pred_<h>h.png)
  • A calibration check (predicted confidence interval coverage)

Run after train.py:
    python ml_pipeline/evaluate.py
"""

from __future__ import annotations

import sys
import json
import logging
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

BASE       = Path(__file__).parent
DATA_DIR   = BASE / "data"
MODELS_DIR = BASE / "models"
PLOTS_DIR  = MODELS_DIR / "plots"
PLOTS_DIR.mkdir(parents=True, exist_ok=True)

FEATURES_CSV = DATA_DIR / "features.csv"
HORIZONS = [1, 3, 6, 12, 24]
TEST_FRACTION = 0.15


def temporal_split(df: pd.DataFrame):
    df = df.sort_values("timestamp").reset_index(drop=True)
    split = int(len(df) * (1 - TEST_FRACTION))
    return df.iloc[:split], df.iloc[split:]


def main() -> None:
    log.info("Loading features …")
    df = pd.read_csv(FEATURES_CSV)
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)

    with open(MODELS_DIR / "feature_names.json") as f:
        feature_cols = json.load(f)

    scaler = joblib.load(MODELS_DIR / "scaler.joblib")

    _, test_df = temporal_split(df)
    log.info("Test set: %d rows", len(test_df))

    X_test_raw = test_df[feature_cols].values
    X_test = scaler.transform(X_test_raw)

    summary = []
    for h in HORIZONS:
        target = f"aqi_next_{h}h"
        model_path = MODELS_DIR / f"model_{h}h.joblib"
        if not model_path.exists():
            log.warning("Model not found: %s", model_path)
            continue

        model = joblib.load(model_path)
        mask = test_df[target].notna()
        y_true = test_df.loc[mask, target].values
        preds  = np.clip(model.predict(X_test[mask]), 0, 500)

        mae  = mean_absolute_error(y_true, preds)
        rmse = np.sqrt(mean_squared_error(y_true, preds))
        r2   = r2_score(y_true, preds)

        # ── Approximate 90% interval using residual std ───────────────────
        residuals = preds - y_true
        std = np.std(residuals)
        low  = np.clip(preds - 1.645 * std, 0, 500)
        high = np.clip(preds + 1.645 * std, 0, 500)
        coverage = np.mean((y_true >= low) & (y_true <= high))

        log.info(
            "Horizon %2dh -- MAE=%5.2f  RMSE=%5.2f  R2=%6.4f  90%%CI Coverage=%.2f",
            h, mae, rmse, r2, coverage,
        )
        summary.append({"horizon_h": h, "mae": mae, "rmse": rmse, "r2": r2, "coverage_90": coverage})

        # ── Actual vs Predicted plot (first 200 test points) ─────────────
        n_plot = min(200, len(y_true))
        fig, ax = plt.subplots(figsize=(14, 4))
        ax.plot(range(n_plot), y_true[:n_plot], label="Actual", color="#333", linewidth=1)
        ax.plot(range(n_plot), preds[:n_plot], label="Predicted", color="#4f86c6", linewidth=1)
        ax.fill_between(
            range(n_plot),
            low[:n_plot], high[:n_plot],
            alpha=0.2, color="#4f86c6", label="90% CI",
        )
        ax.set_xlabel("Test sample index")
        ax.set_ylabel("AQI")
        ax.set_title(f"Actual vs Predicted AQI -- {h}h horizon")
        ax.legend()
        fig.tight_layout()
        fig.savefig(PLOTS_DIR / f"actual_vs_pred_{h}h.png", dpi=120)
        plt.close(fig)
        log.info("  Saved plot -> %s", PLOTS_DIR / f"actual_vs_pred_{h}h.png")

    # Save updated metrics
    with open(MODELS_DIR / "eval_metrics.json", "w") as f:
        json.dump(summary, f, indent=2)

    print("\n--- Final Evaluation Summary ---")
    print(f"{'Horizon':>10} {'MAE':>8} {'RMSE':>8} {'R2':>8} {'90%CI':>8}")
    print("-" * 50)
    for m in summary:
        print(
            f"  {m['horizon_h']:>4}h   "
            f"{m['mae']:>8.2f} {m['rmse']:>8.2f} {m['r2']:>8.4f} {m['coverage_90']:>8.2f}"
        )


if __name__ == "__main__":
    main()
