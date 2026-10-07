"""
train.py
────────
Step 3 of the ML pipeline.

Reads   ml_pipeline/data/features.csv
Trains  one XGBoost model per horizon (1h, 3h, 6h, 12h, 24h)
Fine-tunes hyperparameters with Optuna (Bayesian search)
Evaluates on a held-out test split
Saves artefacts to  ml_pipeline/models/

Artefacts produced
───────────────────
models/model_<h>h.joblib      – trained model
models/scaler.joblib           – StandardScaler for features
models/feature_names.json      – ordered list of feature columns used
models/metrics.json            – MAE, RMSE, R² per horizon
models/plots/                  – feature importance & residual plots
"""

from __future__ import annotations

import os
import sys
import json
import logging
import warnings
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import joblib
import matplotlib.pyplot as plt
import numpy as np
import optuna
import pandas as pd
import shap
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import StandardScaler
from xgboost import XGBRegressor

warnings.filterwarnings("ignore")
optuna.logging.set_verbosity(optuna.logging.WARNING)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE = Path(__file__).parent
DATA_DIR   = BASE / "data"
MODELS_DIR = BASE / "models"
PLOTS_DIR  = MODELS_DIR / "plots"
MODELS_DIR.mkdir(parents=True, exist_ok=True)
PLOTS_DIR.mkdir(parents=True, exist_ok=True)

FEATURES_CSV = DATA_DIR / "features.csv"

HORIZONS = [1, 3, 6, 12, 24]  # hours ahead
N_OPTUNA_TRIALS = int(os.getenv("N_OPTUNA_TRIALS", "15"))  # Bayesian tuning trials per horizon
TEST_FRACTION = 0.15           # fraction of (chronologically latest) data held out
N_CV_SPLITS = 4                # TimeSeriesSplit folds used during Optuna


# ── Feature & target columns ───────────────────────────────────────────────────

FEATURE_COLS = [
    "hour_sin", "hour_cos", "dow_sin", "dow_cos", "month_sin", "month_cos", "is_weekend",
    "aqi_lag_1h", "aqi_lag_2h", "aqi_lag_3h", "aqi_lag_6h", "aqi_lag_12h", "aqi_lag_24h",
    "aqi_roll3h", "aqi_roll6h", "aqi_roll12h", "aqi_roll24h",
    "pm25_lag1", "pm10_lag1", "no2_lag1", "o3_lag1",
    "temp_2m", "rh", "precip", "wind_speed", "wind_u", "wind_v",
    "pressure", "blh", "blh_log",
    "pm25_x_wind", "temp_x_o3",
]


def _available_features(df: pd.DataFrame) -> list[str]:
    return [c for c in FEATURE_COLS if c in df.columns]


# ── Train / test split (temporal — never shuffle!) ─────────────────────────────

def temporal_split(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    df = df.sort_values("timestamp").reset_index(drop=True)
    n = len(df)
    split = int(n * (1 - TEST_FRACTION))
    return df.iloc[:split], df.iloc[split:]


# ── Optuna objective ───────────────────────────────────────────────────────────

def make_objective(X_train: np.ndarray, y_train: np.ndarray, n_splits: int):
    tscv = TimeSeriesSplit(n_splits=n_splits)

    def objective(trial: optuna.Trial) -> float:
        params = {
            "n_estimators":      trial.suggest_int("n_estimators", 200, 1200),
            "max_depth":         trial.suggest_int("max_depth", 3, 10),
            "learning_rate":     trial.suggest_float("learning_rate", 0.005, 0.3, log=True),
            "subsample":         trial.suggest_float("subsample", 0.5, 1.0),
            "colsample_bytree":  trial.suggest_float("colsample_bytree", 0.4, 1.0),
            "reg_alpha":         trial.suggest_float("reg_alpha", 1e-4, 10.0, log=True),
            "reg_lambda":        trial.suggest_float("reg_lambda", 1e-4, 10.0, log=True),
            "min_child_weight":  trial.suggest_int("min_child_weight", 1, 10),
            "gamma":             trial.suggest_float("gamma", 0, 5),
            "tree_method": "hist",
            "random_state": 42,
            "n_jobs": -1,
        }
        maes = []
        for train_idx, val_idx in tscv.split(X_train):
            model = XGBRegressor(**params)
            model.fit(
                X_train[train_idx], y_train[train_idx],
                eval_set=[(X_train[val_idx], y_train[val_idx])],
                verbose=False,
            )
            preds = model.predict(X_train[val_idx])
            maes.append(mean_absolute_error(y_train[val_idx], preds))
        return float(np.mean(maes))

    return objective


# ── Training ───────────────────────────────────────────────────────────────────

def train_horizon(
    train_df: pd.DataFrame,
    test_df:  pd.DataFrame,
    feature_cols: list[str],
    horizon: int,
    scaler: StandardScaler,
) -> dict:
    target = f"aqi_next_{horizon}h"
    log.info("  Target: %s", target)

    X_train_raw = train_df[feature_cols].values
    y_train     = train_df[target].values
    X_test_raw  = test_df[feature_cols].values
    y_test      = test_df[target].values

    X_train = scaler.transform(X_train_raw)
    X_test  = scaler.transform(X_test_raw)

    # ── Optuna hyperparameter search ──────────────────────────────────────
    log.info("  Running Optuna (%d trials) ...", N_OPTUNA_TRIALS)
    study = optuna.create_study(direction="minimize", study_name=f"aqi_{horizon}h")
    study.optimize(make_objective(X_train, y_train, N_CV_SPLITS), n_trials=N_OPTUNA_TRIALS)
    best_params = study.best_params
    log.info("  Best params: %s", best_params)
    log.info("  Best CV MAE: %.2f", study.best_value)

    # ── Final fit on full training set ────────────────────────────────────
    final_model = XGBRegressor(**best_params, tree_method="hist", random_state=42, n_jobs=-1)
    final_model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    # ── Evaluate ──────────────────────────────────────────────────────────
    preds = np.clip(final_model.predict(X_test), 0, 500)
    mae   = mean_absolute_error(y_test, preds)
    rmse  = np.sqrt(mean_squared_error(y_test, preds))
    r2    = r2_score(y_test, preds)
    log.info("  Test MAE=%.2f  RMSE=%.2f  R2=%.4f", mae, rmse, r2)

    # ── Save model ────────────────────────────────────────────────────────
    model_path = MODELS_DIR / f"model_{horizon}h.joblib"
    joblib.dump(final_model, model_path)
    log.info("  Saved -> %s", model_path)

    # ── Feature importance plot ───────────────────────────────────────────
    _plot_importance(final_model, feature_cols, horizon)

    # ── SHAP explainability (on 500-row sample) ───────────────────────────
    _plot_shap(final_model, X_test[:500], feature_cols, horizon)

    # ── Residual plot ─────────────────────────────────────────────────────
    _plot_residuals(y_test, preds, horizon)

    return {
        "horizon_h": horizon,
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "r2": round(r2, 4),
        "best_params": best_params,
        "cv_mae": round(study.best_value, 2),
    }


# ── Plotting helpers ───────────────────────────────────────────────────────────

def _plot_importance(model: XGBRegressor, feature_cols: list[str], h: int) -> None:
    imp = model.feature_importances_
    idx = np.argsort(imp)[::-1][:20]
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.barh([feature_cols[i] for i in idx][::-1], imp[idx][::-1], color="#4f86c6")
    ax.set_title(f"Feature Importance — {h}h horizon")
    ax.set_xlabel("Gain")
    fig.tight_layout()
    fig.savefig(PLOTS_DIR / f"importance_{h}h.png", dpi=120)
    plt.close(fig)


def _plot_shap(model: XGBRegressor, X: np.ndarray, feature_cols: list[str], h: int) -> None:
    try:
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X)
        fig, ax = plt.subplots(figsize=(10, 6))
        shap.summary_plot(shap_values, X, feature_names=feature_cols, show=False)
        plt.title(f"SHAP Summary — {h}h horizon")
        fig = plt.gcf()
        fig.savefig(PLOTS_DIR / f"shap_{h}h.png", dpi=120, bbox_inches="tight")
        plt.close("all")
    except Exception as e:
        log.warning("SHAP plot failed for %dh: %s", h, e)


def _plot_residuals(y_true: np.ndarray, y_pred: np.ndarray, h: int) -> None:
    residuals = y_pred - y_true
    fig, axes = plt.subplots(1, 2, figsize=(12, 4))
    axes[0].scatter(y_true, residuals, alpha=0.3, s=8, color="#e07b54")
    axes[0].axhline(0, color="black", linewidth=0.8)
    axes[0].set_xlabel("Actual AQI")
    axes[0].set_ylabel("Residual")
    axes[0].set_title(f"Residuals vs Actual — {h}h")

    axes[1].hist(residuals, bins=60, color="#4f86c6", edgecolor="white")
    axes[1].set_xlabel("Residual")
    axes[1].set_title(f"Residual Distribution — {h}h")
    fig.tight_layout()
    fig.savefig(PLOTS_DIR / f"residuals_{h}h.png", dpi=120)
    plt.close(fig)


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    log.info("Loading features from %s ...", FEATURES_CSV)
    df = pd.read_csv(FEATURES_CSV)
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    log.info("  %d rows", len(df))

    feature_cols = _available_features(df)
    log.info("Using %d features: %s", len(feature_cols), feature_cols)

    # Save canonical feature list so the API server uses the same order
    with open(MODELS_DIR / "feature_names.json", "w") as f:
        json.dump(feature_cols, f, indent=2)

    train_df, test_df = temporal_split(df)
    log.info("Train: %d rows  Test: %d rows", len(train_df), len(test_df))

    # Fit scaler on training data only
    scaler = StandardScaler()
    scaler.fit(train_df[feature_cols].values)
    joblib.dump(scaler, MODELS_DIR / "scaler.joblib")

    all_metrics = []
    for h in HORIZONS:
        log.info("\n--- Horizon: %dh ---", h)
        # Drop rows where this target is NaN (can happen at end of each city block)
        t_train = train_df.dropna(subset=[f"aqi_next_{h}h"])
        t_test  = test_df.dropna(subset=[f"aqi_next_{h}h"])
        metrics = train_horizon(t_train, t_test, feature_cols, h, scaler)
        all_metrics.append(metrics)

    # Save all metrics
    metrics_path = MODELS_DIR / "metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(all_metrics, f, indent=2)
    log.info("\nAll metrics saved -> %s", metrics_path)

    # Print summary table
    print("\n" + "=" * 60)
    print(f"{'Horizon':>10} {'MAE':>8} {'RMSE':>8} {'R2':>8} {'CV MAE':>8}")
    print("-" * 60)
    for m in all_metrics:
        print(f"  {m['horizon_h']:>4}h    {m['mae']:>8.2f} {m['rmse']:>8.2f} {m['r2']:>8.4f} {m['cv_mae']:>8.2f}")
    print("=" * 60)


if __name__ == "__main__":
    main()
