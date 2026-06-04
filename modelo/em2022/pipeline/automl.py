"""
automl.py — Optional FLAML AutoML and Optuna Bayesian tuning.
Both are guarded by try-imports so the pipeline runs without them.
"""
import numpy as np
from sklearn.model_selection import GroupKFold, cross_validate

from .config import SEED, FEATURES_CAT

try:
    import optuna
    optuna.logging.set_verbosity(optuna.logging.WARNING)
    OPTUNA_AVAILABLE = True
except ImportError:
    OPTUNA_AVAILABLE = False

try:
    from flaml import AutoML as FlamlAutoML
    FLAML_AVAILABLE = True
except ImportError:
    FLAML_AVAILABLE = False


# ─── FLAML ────────────────────────────────────────────────────────────────────

def run_flaml(X_train, y_train) -> dict:
    if not FLAML_AVAILABLE:
        print("\n  [FLAML no instalado — pip install flaml para AutoML]")
        return {"available": False}

    print("\n" + "=" * 65)
    print("  FLAML AutoML — comparación automática (budget=90s)")
    print("=" * 65)
    try:
        from sklearn.preprocessing import OrdinalEncoder as _OE
        flaml_automl = FlamlAutoML()
        flaml_X = X_train.copy()
        enc = _OE(handle_unknown="use_encoded_value", unknown_value=-1)
        for fc in FEATURES_CAT:
            flaml_X[fc] = enc.fit_transform(flaml_X[[fc]]).ravel()
        flaml_automl.fit(
            flaml_X, y_train,
            task="classification", metric="roc_auc",
            time_budget=90, verbose=0, seed=SEED,
        )
        result = {
            "best_estimator": str(flaml_automl.best_estimator),
            "best_auc_cv":    round(float(1 - flaml_automl.best_loss), 6),
            "available":      True,
        }
        print(f"  FLAML best: {result['best_estimator']}  AUC-CV={result['best_auc_cv']:.4f}")
        return result
    except Exception as e:
        print(f"  FLAML falló: {e}")
        return {"available": True, "error": str(e)}


# ─── Optuna ───────────────────────────────────────────────────────────────────

def run_optuna(candidatos: dict, ganador_nombre: str, X_train, y_train, g_train) -> dict:
    if not OPTUNA_AVAILABLE:
        print("\n  [Optuna no instalado — pip install optuna para tuning bayesiano]")
        return {"available": False}

    if ganador_nombre not in ("LightGBM", "XGBoost"):
        return {"available": True, "skipped": f"Optuna sólo aplica a LightGBM/XGBoost, ganador={ganador_nombre}"}

    print("\n" + "=" * 65)
    print(f"  OPTUNA — Bayesian hyperparameter tuning ({ganador_nombre})")
    print("=" * 65)
    gkf_opt = GroupKFold(n_splits=3)

    def _objective(trial: "optuna.Trial") -> float:
        if ganador_nombre == "LightGBM":
            params = {
                "clf__n_estimators":  trial.suggest_int("n_estimators", 150, 500),
                "clf__max_depth":     trial.suggest_int("max_depth", 3, 7),
                "clf__learning_rate": trial.suggest_float("learning_rate", 0.02, 0.12, log=True),
                "clf__num_leaves":    trial.suggest_int("num_leaves", 20, 80),
                "clf__subsample":     trial.suggest_float("subsample", 0.6, 1.0),
            }
        else:  # XGBoost
            params = {
                "clf__n_estimators":     trial.suggest_int("n_estimators", 150, 500),
                "clf__max_depth":        trial.suggest_int("max_depth", 3, 7),
                "clf__learning_rate":    trial.suggest_float("learning_rate", 0.02, 0.12, log=True),
                "clf__subsample":        trial.suggest_float("subsample", 0.6, 1.0),
                "clf__colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
            }
        pipe_trial = candidatos[ganador_nombre]
        pipe_trial.set_params(**params)
        scores = cross_validate(
            pipe_trial, X_train, y_train,
            cv=gkf_opt, groups=g_train, scoring="roc_auc", n_jobs=-1,
        )
        return float(scores["test_score"].mean())

    try:
        study = optuna.create_study(
            direction="maximize",
            sampler=optuna.samplers.TPESampler(seed=SEED),
        )
        study.optimize(_objective, n_trials=40, show_progress_bar=False)
        best_params = study.best_params
        best_auc    = study.best_value
        result = {
            "best_params": best_params,
            "best_auc_cv": float(best_auc),
            "n_trials":    40,
        }
        print(f"  Optuna Best AUC-CV: {best_auc:.4f}  params: {best_params}")
        # Apply best params to winner pipeline
        candidatos[ganador_nombre].set_params(
            **{f"clf__{k}": v for k, v in best_params.items()}
        )
        return result
    except Exception as e:
        print(f"  Optuna falló: {e}")
        return {"error": str(e)}
