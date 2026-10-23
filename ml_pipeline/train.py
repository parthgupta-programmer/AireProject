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
models/feature_names.json      – {horizon: ordered feature list} used by that model
models/metrics.json            – MAE, RMSE, R² per horizon (+ persistence baseline)

Each model predicts the CHANGE in AQI from the current AQI (delta target); the
current AQI is added back before scoring / serving. Trees cannot extrapolate, so
this is far easier to learn than the absolute level.
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
from xgboost import XGBRegressor

try:                                    # imported as a package (uvicorn / tests)
    from ml_pipeline.feature_engineering import horizon_feature_cols, temporal_split
except ImportError:                     # run as a script: python ml_pipeline/train.py
    from feature_engineering import horizon_feature_cols, temporal_split

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
N_OPTUNA_TRIALS = int(os.getenv("N_OPTUNA_TRIALS", "40"))  # Bayesian tuning trials per horizon
N_CV_SPLITS = 4                # TimeSeriesSplit folds used during Optuna
MAX_TREES = 2000               # upper bound; early stopping picks the real number
EARLY_STOP = 50


# ── Optuna objective ───────────────────────────────────────────────────────────

def make_objective(X_train: np.ndarray, y_train: np.ndarray, n_splits: int, gap: int):
    # `gap` rows are skipped between each train and validation block so that
    # multi-hour-ahead targets cannot leak across the fold boundary.
    tscv = TimeSeriesSplit(n_splits=n_splits, gap=gap)

    def objective(trial: optuna.Trial) -> float:
        params = {
            "max_depth":         trial.suggest_int("max_depth", 3, 8),
            "learning_rate":     trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
            "subsample":         trial.suggest_float("subsample", 0.5, 1.0),
            "colsample_bytree":  trial.suggest_float("colsample_bytree", 0.4, 1.0),
            "reg_alpha":         trial.suggest_float("reg_alpha", 1e-3, 10.0, log=True),
            "reg_lambda":        trial.suggest_float("reg_lambda", 1e-3, 10.0, log=True),
            "min_child_weight":  trial.suggest_int("min_child_weight", 1, 20),
            "gamma":             trial.suggest_float("gamma", 0, 5),
            "n_estimators": MAX_TREES,
            "early_stopping_rounds": EARLY_STOP,
            "eval_metric": "mae",
            "tree_method": "hist",
            "random_state": 42,
            "n_jobs": -1,
        }
        maes, best_iters = [], []
        for train_idx, val_idx in tscv.split(X_train):
            model = XGBRegressor(**params)
            model.fit(
                X_train[train_idx], y_train[train_idx],
                eval_set=[(X_train[val_idx], y_train[val_idx])],
                verbose=False,
            )
            preds = model.predict(X_train[val_idx], iteration_range=(0, model.best_iteration + 1))
            maes.append(mean_absolute_error(y_train[val_idx], preds))
            best_iters.append(model.best_iteration + 1)
        trial.set_user_attr("best_iter", int(np.mean(best_iters)))
        return float(np.mean(maes))

    return objective


# ── Training ───────────────────────────────────────────────────────────────────

def train_horizon(
    train_df: pd.DataFrame,
    test_df:  pd.DataFrame,
    feature_cols: list[str],
    horizon: int,
    n_cities: int,
) -> dict:
    target = f"aqi_next_{horizon}h"
    log.info("  Target: %s  (%d features)", target, len(feature_cols))

    # Trees handle NaN natively and are scale-invariant, so no scaler is needed.
    X_train = train_df[feature_cols].values.astype(float)
    X_test  = test_df[feature_cols].values.astype(float)
    now_train = train_df["aqi_lag_0h"].values
    now_test  = test_df["aqi_lag_0h"].values
    y_test    = test_df[target].values

    # Delta target: predict the change from the current AQI
    y_train = train_df[target].values - now_train

    # ── Optuna hyperparameter search ──────────────────────────────────────
    log.info("  Running Optuna (%d trials) ...", N_OPTUNA_TRIALS)
    study = optuna.create_study(
        direction="minimize",
        study_name=f"aqi_{horizon}h",
        sampler=optuna.samplers.TPESampler(seed=42),
    )
    study.optimize(
        make_objective(X_train, y_train, N_CV_SPLITS, gap=horizon * n_cities),
        n_trials=N_OPTUNA_TRIALS,
    )
    best_params = dict(study.best_params)
    best_iter = study.best_trial.user_attrs["best_iter"]
    best_params["n_estimators"] = max(50, int(best_iter * 1.15))   # a bit more data than a CV fold
    log.info("  Best params: %s", best_params)
    log.info("  Best CV MAE: %.2f", study.best_value)

    # ── Final fit on full training set (test set is never touched) ────────
    final_model = XGBRegressor(**best_params, eval_metric="mae", tree_method="hist",
                               random_state=42, n_jobs=-1)
    final_model.fit(X_train, y_train, verbose=False)

    # ── Evaluate (absolute AQI) vs. a "nothing changes" persistence baseline
    preds = np.clip(final_model.predict(X_test) + now_test, 0, 500)
    mae   = mean_absolute_error(y_test, preds)
    rmse  = np.sqrt(mean_squared_error(y_test, preds))
    r2    = r2_score(y_test, preds)

    base = np.clip(now_test, 0, 500)
    base_mae = mean_absolute_error(y_test, base)
    base_r2  = r2_score(y_test, base)
    log.info("  Test MAE=%.2f  RMSE=%.2f  R2=%.4f   | persistence MAE=%.2f R2=%.4f",
             mae, rmse, r2, base_mae, base_r2)

    # ── Save model ────────────────────────────────────────────────────────
    model_path = MODELS_DIR / f"model_{horizon}h.joblib"
    joblib.dump(final_model, model_path)
    log.info("  Saved -> %s", model_path)

    _plot_importance(final_model, feature_cols, horizon)
    _plot_shap(final_model, X_test[:500], feature_cols, horizon)
    _plot_residuals(y_test, preds, horizon)

    return {
        "horizon_h": horizon,
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "r2": round(r2, 4),
        "persistence_mae": round(base_mae, 2),
        "persistence_r2": round(base_r2, 4),
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

    train_df, test_df = temporal_split(df, horizon_gap_h=max(HORIZONS))
    n_cities = int(df["city_id"].nunique())
    log.info("Train: %d rows  Test: %d rows  Cities: %d", len(train_df), len(test_df), n_cities)

    # Canonical per-horizon feature lists so serve.py uses the same order
    feature_map = {str(h): horizon_feature_cols(h, list(df.columns)) for h in HORIZONS}
    with open(MODELS_DIR / "feature_names.json", "w") as f:
        json.dump(feature_map, f, indent=2)

    all_metrics = []
    for h in HORIZONS:
        log.info("\n--- Horizon: %dh ---", h)
        target = f"aqi_next_{h}h"
        t_train = train_df.dropna(subset=[target, "aqi_lag_0h"])
        t_test  = test_df.dropna(subset=[target, "aqi_lag_0h"])
        all_metrics.append(train_horizon(t_train, t_test, feature_map[str(h)], h, n_cities))

    metrics_path = MODELS_DIR / "metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(all_metrics, f, indent=2)
    log.info("\nAll metrics saved -> %s", metrics_path)

    print("\n" + "=" * 78)
    print(f"{'Horizon':>8} {'MAE':>8} {'RMSE':>8} {'R2':>8} {'CV MAE':>8}   {'persist MAE':>11} {'persist R2':>10}")
    print("-" * 78)
    for m in all_metrics:
        print(f"  {m['horizon_h']:>4}h  {m['mae']:>8.2f} {m['rmse']:>8.2f} {m['r2']:>8.4f} {m['cv_mae']:>8.2f}"
              f"   {m['persistence_mae']:>11.2f} {m['persistence_r2']:>10.4f}")
    print("=" * 78)


if __name__ == "__main__":
    main()
