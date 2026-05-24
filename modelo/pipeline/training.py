"""
training.py — Model selection, GridSearchCV, stacking, calibration, stability analysis.
"""
import numpy as np
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import GroupKFold, GroupShuffleSplit, GridSearchCV, cross_validate
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier

from .config import (
    SEED, ALL_FEATURES, TARGET, GROUP_COL,
    FEATURES_CAT, FEATURES_NUM, FEATURES_IE, FEATURES_DERIVED,
    MONOTONIC_CONSTRAINTS,
)
from .preprocessing import make_pipeline, evaluate_cv, add_ie_features


def build_candidates(y_train: np.ndarray) -> dict:
    """Return the four baseline candidate pipelines."""
    pos_weight = (y_train == 0).sum() / (y_train == 1).sum()
    return {
        "Logistic Regression": make_pipeline(
            LogisticRegression(max_iter=1000, class_weight="balanced", random_state=SEED)
        ),
        "Random Forest": make_pipeline(
            RandomForestClassifier(
                n_estimators=300, max_depth=10,
                class_weight="balanced", random_state=SEED, n_jobs=-1,
                monotonic_cst=MONOTONIC_CONSTRAINTS,
            )
        ),
        "XGBoost": make_pipeline(
            XGBClassifier(
                n_estimators=300, max_depth=6, learning_rate=0.05,
                subsample=0.8, colsample_bytree=0.8,
                scale_pos_weight=pos_weight,
                random_state=SEED, eval_metric="logloss", verbosity=0,
                monotone_constraints=tuple(MONOTONIC_CONSTRAINTS),
            )
        ),
        "LightGBM": make_pipeline(
            LGBMClassifier(
                n_estimators=300, max_depth=6, learning_rate=0.05,
                subsample=0.8, colsample_bytree=0.8,
                class_weight="balanced", random_state=SEED, verbosity=-1,
                monotone_constraints=MONOTONIC_CONSTRAINTS,
                monotone_constraints_method="basic",
            )
        ),
    }


def run_cv_comparison(candidatos: dict, X_train, y_train, g_train, cv) -> dict:
    """GroupKFold comparison across all candidates."""
    resultados = {}
    for nombre, pipe in candidatos.items():
        res = evaluate_cv(pipe, X_train, y_train, g_train, cv)
        resultados[nombre] = res
        print(f"  {nombre:<22} {res['auc_mean']:.4f}  +-{res['auc_std']:.4f}  "
              f"{res['f1_mean']:.4f}  +-{res['f1_std']:.4f}")
    return resultados


def run_nested_cv(candidatos: dict, ganador_nombre: str, resultados: dict,
                  X_train, y_train, g_train) -> dict:
    """Outer 5-fold / inner 3-fold nested CV for unbiased AUC."""
    nested_outer = GroupKFold(n_splits=5)
    nested_inner = GroupKFold(n_splits=3)
    nested_auc_list: list[float] = []
    best_winner_pipe = candidatos[ganador_nombre]
    for _outer_tr, _outer_val in nested_outer.split(X_train, y_train, groups=g_train):
        X_ot, y_ot = X_train.iloc[_outer_tr], y_train[_outer_tr]
        g_ot       = g_train[_outer_tr]
        X_ov, y_ov = X_train.iloc[_outer_val], y_train[_outer_val]
        cross_validate(best_winner_pipe, X_ot, y_ot, cv=nested_inner, groups=g_ot, scoring="roc_auc", n_jobs=-1)
        best_winner_pipe.fit(X_ot, y_ot)
        y_ov_prob = best_winner_pipe.predict_proba(X_ov)[:, 1]
        if len(np.unique(y_ov)) > 1:
            from sklearn.metrics import roc_auc_score
            nested_auc_list.append(float(roc_auc_score(y_ov, y_ov_prob)))
    # Refit on full train
    best_winner_pipe.fit(X_train, y_train)
    inner_auc_mean  = float(resultados[ganador_nombre]["auc_mean"])
    nested_auc_mean = float(np.mean(nested_auc_list)) if nested_auc_list else 0.0
    nested_auc_std  = float(np.std(nested_auc_list))  if nested_auc_list else 0.0
    nested_cv = {
        "nested_auc_mean": round(nested_auc_mean, 6),
        "nested_auc_std":  round(nested_auc_std,  6),
        "bias_estimate":   round(inner_auc_mean - nested_auc_mean, 6),
        "n_outer_folds":   5,
        "n_inner_folds":   3,
    }
    print(f"  Nested AUC: {nested_auc_mean:.4f} ± {nested_auc_std:.4f}  "
          f"(inner AUC: {inner_auc_mean:.4f}  bias={inner_auc_mean - nested_auc_mean:+.4f})")
    return nested_cv


# ─── Grid search ──────────────────────────────────────────────────────────────

GRID_PARAMS: dict[str, dict] = {
    "Logistic Regression": {
        "clf__C":      [0.1, 1.0, 10.0],
        "clf__solver": ["liblinear", "lbfgs"],
    },
    "Random Forest": {
        "clf__n_estimators":    [200, 400],
        "clf__max_depth":       [8, 12],
        "clf__min_samples_leaf":[2, 5],
    },
    "XGBoost": {
        "clf__n_estimators":  [200, 400],
        "clf__max_depth":     [4, 6],
        "clf__learning_rate": [0.03, 0.07],
        "clf__subsample":     [0.7, 0.9],
    },
    "LightGBM": {
        "clf__n_estimators":  [200, 400],
        "clf__max_depth":     [4, 6],
        "clf__learning_rate": [0.03, 0.07],
        "clf__num_leaves":    [31, 63],
    },
}


def run_gridsearch(candidatos: dict, top2_nombres: list[str],
                   X_train, y_train, g_train, cv) -> dict:
    grid_resultados = {}
    for nombre in top2_nombres:
        if nombre not in GRID_PARAMS:
            continue
        print(f"\n  GridSearch para {nombre}...")
        gs = GridSearchCV(
            candidatos[nombre], param_grid=GRID_PARAMS[nombre],
            cv=cv, scoring="roc_auc", n_jobs=-1, refit=True, verbose=0,
        )
        gs.fit(X_train, y_train, groups=g_train)
        grid_resultados[nombre] = {
            "best_auc_cv": float(gs.best_score_),
            "best_params": gs.best_params_,
        }
        print(f"    Mejor AUC-CV: {gs.best_score_:.4f}  params: {gs.best_params_}")
        candidatos[nombre] = gs.best_estimator_
    return grid_resultados


# ─── Stacking ─────────────────────────────────────────────────────────────────

def run_stacking(candidatos: dict, top2_nombres: list[str],
                 X_train, y_train, g_train, cv, resultados: dict,
                 ganador_nombre: str) -> tuple[dict, str]:
    """Soft-voting stacking. Returns (stacking_result, ganador_nombre)."""
    try:
        stack_pipe = VotingClassifier(
            estimators=[(n.replace(" ", "_"), candidatos[n]) for n in top2_nombres],
            voting="soft",
        )
        stacking_cv_res = evaluate_cv(stack_pipe, X_train, y_train, g_train, cv)
        winner_auc = resultados[ganador_nombre].get(
            "auc_mean_grid", resultados[ganador_nombre]["auc_mean"]
        )
        stacking_result = {
            "modelos_base": top2_nombres,
            "auc_cv_mean":  float(stacking_cv_res["auc_mean"]),
            "auc_cv_std":   float(stacking_cv_res["auc_std"]),
            "f1_cv_mean":   float(stacking_cv_res["f1_mean"]),
            "ganador":      stacking_cv_res["auc_mean"] > winner_auc + 0.002,
        }
        print(f"  Stacking AUC-CV: {stacking_cv_res['auc_mean']:.4f}  ±{stacking_cv_res['auc_std']:.4f}  "
              f"F1: {stacking_cv_res['f1_mean']:.4f}")
        if stacking_result["ganador"]:
            print("  >> Stacking supera al ganador individual — incluyendo como candidato final")
            candidatos["Stacking"] = stack_pipe
            ganador_nombre = "Stacking"
        else:
            print(f"  >> {ganador_nombre} individual sigue siendo preferible "
                  f"(Δ={winner_auc - stacking_cv_res['auc_mean']:.4f})")
    except Exception as e:
        print(f"  Stacking no disponible: {e}")
        stacking_result = {"error": str(e)}
    return stacking_result, ganador_nombre


# ─── Final training + calibration ─────────────────────────────────────────────

def fit_final_model(candidatos: dict, ganador_nombre: str, X_train, y_train):
    """Fit the winner on full train and wrap with isotonic calibration."""
    pipe_final = candidatos[ganador_nombre]
    pipe_final.fit(X_train, y_train)
    print("Calibrando probabilidades (método isotónico)...")
    calibrated = CalibratedClassifierCV(pipe_final, method="isotonic", cv=5)
    calibrated.fit(X_train, y_train)
    return pipe_final, calibrated


# ─── Stability analysis (10 seeds) ────────────────────────────────────────────

def run_stability_analysis(df, candidatos: dict, ganador_nombre: str,
                            X_train, y_train) -> dict:
    from sklearn.metrics import roc_auc_score
    stab_aucs: list[float] = []
    stab_gss = GroupShuffleSplit(n_splits=1, test_size=0.20)
    for seed_i in range(10):
        stab_gss.random_state = seed_i
        tr_i, val_i = next(stab_gss.split(df, df[TARGET], groups=df[GROUP_COL]))
        tr_raw_i  = df.iloc[tr_i].copy()
        val_raw_i = df.iloc[val_i].copy()
        tr_eng_i  = add_ie_features(tr_raw_i, tr_raw_i)
        val_eng_i = add_ie_features(tr_raw_i, val_raw_i)
        X_tr_i  = tr_eng_i[ALL_FEATURES]
        y_tr_i  = tr_eng_i[TARGET].values
        X_val_i = val_eng_i[ALL_FEATURES]
        y_val_i = val_eng_i[TARGET].values
        stab_pipe = candidatos[ganador_nombre]
        try:
            stab_pipe.fit(X_tr_i, y_tr_i)
            stab_prob = stab_pipe.predict_proba(X_val_i)[:, 1]
            if len(np.unique(y_val_i)) > 1:
                stab_aucs.append(float(roc_auc_score(y_val_i, stab_prob)))
        except Exception:
            pass
    # Refit on original train
    candidatos[ganador_nombre].fit(X_train, y_train)
    stability = {
        "auc_per_seed": [round(a, 6) for a in stab_aucs],
        "mean": round(float(np.mean(stab_aucs)), 6) if stab_aucs else 0.0,
        "std":  round(float(np.std(stab_aucs)),  6) if stab_aucs else 0.0,
        "min":  round(float(np.min(stab_aucs)),  6) if stab_aucs else 0.0,
        "max":  round(float(np.max(stab_aucs)),  6) if stab_aucs else 0.0,
        "n_seeds": len(stab_aucs),
    }
    print(f"  Estabilidad AUC: mean={stability['mean']:.4f}  std={stability['std']:.4f}  "
          f"min={stability['min']:.4f}  max={stability['max']:.4f}  (n={stability['n_seeds']})")
    return stability
