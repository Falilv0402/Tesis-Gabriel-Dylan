"""
comparar_algoritmos.py
======================
Script independiente que evalúa todos los algoritmos sobre el dataset EM 2022
y muestra una tabla comparativa de precisión.

NO modifica ni genera los artefactos de producción (.pkl).
Solo compara y reporta.

Uso:
    cd modelo
    python -m em2022.comparacion.comparar_algoritmos

Salida:
    Tabla en consola + CSV en em2022/comparacion/resultados_comparacion.csv
"""

import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, VotingClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold, GroupShuffleSplit, cross_validate
from sklearn.svm import SVC
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier

# Añadir raíz del proyecto al path para poder importar pipeline
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "modelo"))

from em2022.pipeline.config import (
    SEED, DATASET, TARGET, GROUP_COL, ALL_FEATURES, MONOTONIC_CONSTRAINTS,
)
from em2022.pipeline.preprocessing import add_ie_features, make_pipeline


# ─── Algoritmos a comparar ────────────────────────────────────────────────────

def build_algoritmos(pos_weight: float) -> dict:
    """
    Define los algoritmos a comparar.
    Incluye: LR, RF, XGBoost, LightGBM, GradientBoosting, SVM, Ensemble LR+RF.
    """
    return {
        "Logistic Regression": make_pipeline(
            LogisticRegression(
                max_iter=1000, class_weight="balanced", random_state=SEED
            )
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
        "Gradient Boosting": make_pipeline(
            GradientBoostingClassifier(
                n_estimators=200, max_depth=4, learning_rate=0.05,
                subsample=0.8, random_state=SEED,
            )
        ),
        "SVM (RBF)": make_pipeline(
            SVC(
                kernel="rbf", C=1.0, gamma="scale",
                class_weight="balanced", probability=True, random_state=SEED,
            )
        ),
    }


# ─── Evaluación ───────────────────────────────────────────────────────────────

def evaluar_algoritmo(pipe, X, y, g, cv) -> dict:
    """Evalúa un pipeline con GroupKFold y devuelve métricas promedio."""
    scores = cross_validate(
        pipe, X, y,
        cv=cv,
        groups=g,
        scoring={
            "auc":       "roc_auc",
            "f1":        "f1",
            "precision": "precision",
            "recall":    "recall",
            "accuracy":  "accuracy",
        },
        n_jobs=-1,
    )
    return {
        "AUC-ROC":   round(scores["test_auc"].mean(), 4),
        "AUC±":      round(scores["test_auc"].std(), 4),
        "F1":        round(scores["test_f1"].mean(), 4),
        "Precision": round(scores["test_precision"].mean(), 4),
        "Recall":    round(scores["test_recall"].mean(), 4),
        "Accuracy":  round(scores["test_accuracy"].mean(), 4),
    }


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print(f"\n{'='*65}")
    print("  COMPARATIVA DE ALGORITMOS — Dataset EM 2022")
    print(f"{'='*65}")

    # 1. Cargar datos
    print(f"\nCargando {DATASET}...")
    df = pd.read_csv(DATASET)
    for col in ["M500_L", "M500_CN", "M500_M", "ise"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=["M500_L", "M500_CN", "ise"])
    print(f"  {len(df):,} estudiantes | {df[GROUP_COL].nunique()} IEs")

    # 2. Split train (usamos 80% para comparación, consistente con el pipeline principal)
    gss = GroupShuffleSplit(n_splits=1, test_size=0.20, random_state=SEED)
    train_idx, _ = next(gss.split(df, df[TARGET], groups=df[GROUP_COL]))
    train_df = add_ie_features(df.iloc[train_idx], df.iloc[train_idx])

    X = train_df[ALL_FEATURES]
    y = train_df[TARGET].values
    g = train_df[GROUP_COL].values
    pos_weight = (y == 0).sum() / (y == 1).sum()

    print(f"  Train: {len(X):,} alumnos | Positivos: {y.mean()*100:.1f}%")

    # 3. Evaluar cada algoritmo
    cv = GroupKFold(n_splits=5)
    algoritmos = build_algoritmos(pos_weight)

    print(f"\n{'─'*65}")
    print(f"  {'Algoritmo':<25} {'AUC-ROC':>8} {'±':>6} {'F1':>8} {'Precision':>10} {'Recall':>8}")
    print(f"{'─'*65}")

    resultados = {}
    for nombre, pipe in algoritmos.items():
        print(f"  Evaluando {nombre}...", end="\r")
        res = evaluar_algoritmo(pipe, X, y, g, cv)
        resultados[nombre] = res
        print(f"  {nombre:<25} {res['AUC-ROC']:>8.4f} {res['AUC±']:>6.4f} "
              f"{res['F1']:>8.4f} {res['Precision']:>10.4f} {res['Recall']:>8.4f}")

    # 4. Ensemble LR+RF (soft-voting)
    print(f"\n  Evaluando Ensemble LR+RF (soft-voting)...", end="\r")
    lr_pipe = algoritmos["Logistic Regression"]
    rf_pipe = algoritmos["Random Forest"]
    ensemble = VotingClassifier(
        estimators=[("lr", lr_pipe), ("rf", rf_pipe)],
        voting="soft",
    )
    ens_res = evaluar_algoritmo(ensemble, X, y, g, cv)
    resultados["Ensemble LR+RF"] = ens_res
    print(f"  {'Ensemble LR+RF':<25} {ens_res['AUC-ROC']:>8.4f} {ens_res['AUC±']:>6.4f} "
          f"{ens_res['F1']:>8.4f} {ens_res['Precision']:>10.4f} {ens_res['Recall']:>8.4f}")

    print(f"{'─'*65}")

    # 5. Ordenar por AUC y destacar ganador
    df_res = pd.DataFrame(resultados).T.sort_values("AUC-ROC", ascending=False)
    ganador = df_res.index[0]
    print(f"\n  >> Ganador por AUC-ROC: {ganador} ({df_res.loc[ganador, 'AUC-ROC']:.4f})")

    # 6. Guardar CSV
    out_path = Path(__file__).parent / "resultados_comparacion.csv"
    df_res.to_csv(out_path)
    print(f"\n  Resultados guardados → {out_path}")
    print(f"\n{'='*65}\n")

    return df_res


if __name__ == "__main__":
    main()
