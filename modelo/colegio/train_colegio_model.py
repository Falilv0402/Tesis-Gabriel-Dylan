"""
train_colegio_model.py — Entrena un modelo de riesgo específico para un colegio.

Uso:
    python modelo/colegio/train_colegio_model.py --ie 0249 --carpeta .

Genera:
    modelo/model/colegio_{codigo_ie}.pkl  — predictor + metadatos
"""

import argparse
import json
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.metrics import roc_auc_score, f1_score

from parse_excels import procesar_colegio

# ─── Features que usa el modelo ──────────────────────────────────────────────
FEATURES = [
    "pp_matematica", "pp_comunicacion", "pp_cta",
    "conducta_promedio", "n_materias_c", "promedio_materias",
    "tendencia_matematica", "tendencia_comunicacion",
]

FEATURES_PRIM = [
    "pp_mat_prim", "pp_lenguaje", "pp_cta",
    "conducta_promedio", "n_materias_c", "promedio_materias",
    "tendencia_mat_prim", "tendencia_lenguaje",
]


def train(carpeta: str, codigo_ie: str) -> None:
    model_dir = Path(__file__).resolve().parents[1] / "model"
    model_dir.mkdir(exist_ok=True)
    output_path = model_dir / f"colegio_{codigo_ie}.pkl"

    print(f"\n{'='*60}")
    print(f"  MODELO DE RIESGO — IE {codigo_ie}")
    print(f"{'='*60}")

    # ── 1. ETL ────────────────────────────────────────────────────────────────
    print("\n[1/4] Procesando Excel del colegio...")
    df = procesar_colegio(carpeta, codigo_ie)

    # Guardar dataset limpio
    csv_path = Path(carpeta) / f"colegio_{codigo_ie}_procesado.csv"
    df.to_csv(csv_path, index=False)
    print(f"      Dataset guardado → {csv_path}")

    # ── 2. Seleccionar features disponibles ───────────────────────────────────
    print("\n[2/4] Preparando features...")
    # Intentar features de secundaria, luego primaria, luego las que haya
    for feat_list in [FEATURES, FEATURES_PRIM]:
        available = [f for f in feat_list if f in df.columns]
        if len(available) >= 3:
            break
    else:
        available = [f for f in df.columns
                     if f.startswith("pp_") or f in ("conducta_promedio", "n_materias_c", "promedio_materias")]

    print(f"      Features usadas: {available}")

    X = df[available].copy()
    y = df["riesgo"].values

    # Imputar nulos con mediana
    for col in X.columns:
        X[col] = X[col].fillna(X[col].median())

    print(f"      Alumnos totales: {len(X)}")
    print(f"      En riesgo (y=1): {y.sum()} ({100*y.mean():.1f}%)")

    # ── 3. Entrenar modelo ────────────────────────────────────────────────────
    print("\n[3/4] Entrenando modelo...")

    pos = y.sum()
    neg = len(y) - pos

    # Si no hay suficiente varianza, usar scoring puro (sin clasificador)
    if pos == 0 or neg == 0:
        print("      Sin varianza en target — usando score basado en promedio.")
        modelo    = None
        auc_cv    = float("nan")
        auc_train = float("nan")
        f1_train  = float("nan")
        n_splits_used = 0
    else:
        class_weight = {0: 1.0, 1: max(1.0, neg / max(pos, 1))}
        pipe = Pipeline([
            ("scaler", StandardScaler()),
            ("clf",    LogisticRegression(
                C=0.5, max_iter=1000, class_weight=class_weight, random_state=42
            )),
        ])

        # ── Cross-validation AUC (estimador insesgado) ────────────────────────
        # Con ~95 alumnos y ~15% positivos: 5-fold deja ~3 positivos por fold,
        # suficiente para calcular AUC. Si hay muy pocos, reducimos a 3-fold.
        n_splits = 5 if pos >= 10 else 3 if pos >= 5 else 0
        if n_splits >= 3:
            skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
            cv_aucs = cross_val_score(pipe, X, y, cv=skf, scoring="roc_auc")
            auc_cv  = float(cv_aucs.mean())
            print(f"      AUC CV ({n_splits}-fold) : {auc_cv:.4f}  "
                  f"(±{float(cv_aucs.std()):.4f}  por fold: {[round(a,3) for a in cv_aucs]})")
        else:
            auc_cv = float("nan")
            print("      Muy pocos positivos para CV — se omite AUC CV.")
        n_splits_used = n_splits

        # Entrenar sobre todos los datos para predicciones finales
        pipe.fit(X, y)
        y_prob    = pipe.predict_proba(X)[:, 1]
        y_pred    = (y_prob >= 0.5).astype(int)
        auc_train = float(roc_auc_score(y, y_prob))
        f1_train  = float(f1_score(y, y_pred, zero_division=0))
        modelo    = pipe
        print(f"      AUC (train, referencia) : {auc_train:.4f}  "
              f"F1 (train): {f1_train:.4f}")
        print("      NOTA: el AUC CV es el indicador válido; AUC train se reporta solo como referencia.")

    # ── 4. Generar predicciones y guardar ─────────────────────────────────────
    print("\n[4/4] Generando predicciones y guardando artefacto...")

    if modelo is not None:
        X_imp = X.copy()
        for col in X_imp.columns:
            X_imp[col] = X_imp[col].fillna(X_imp[col].median())
        df["prob_riesgo"] = modelo.predict_proba(X_imp)[:, 1]
    else:
        df["prob_riesgo"] = df["riesgo_score"]

    # Convertir a lista de dicts para el endpoint
    cols_out = [
        "n_alumno", "nombre", "salon", "codigo_ie",
        "nivel_riesgo", "prob_riesgo", "riesgo",
        "n_materias_c", "promedio_materias",
    ] + [c for c in df.columns if c.startswith("pp_") or c.startswith("b1_")]

    cols_out = [c for c in cols_out if c in df.columns]
    predicciones = df[cols_out].replace({np.nan: None}).to_dict(orient="records")

    nombre_colegio = df["nombre_colegio"].iloc[0] if "nombre_colegio" in df.columns else codigo_ie

    artefacto = {
        "codigo_ie":      codigo_ie,
        "nombre_colegio": nombre_colegio,
        "modelo":         modelo,
        "features":       available,
        "predicciones":   predicciones,
        "metricas": {
            "nombre_colegio": nombre_colegio,
            "n_alumnos":      len(df),
            "n_riesgo":       int(y.sum()),
            "pct_riesgo":     round(100 * float(y.mean()), 1),
            "auc_cv":         round(auc_cv, 4)    if not np.isnan(auc_cv)    else None,
            "auc_train":      round(auc_train, 4) if not np.isnan(auc_train) else None,
            "f1_train":       round(f1_train, 4)  if not np.isnan(f1_train)  else None,
            "n_splits_cv":    n_splits_used,
            "nota_metodologica": (
                f"AUC CV ({n_splits_used}-fold estratificado) es el indicador principal. "
                "AUC train se reporta solo para detectar sobreajuste."
            ) if n_splits_used >= 3 else "Pocos positivos — sin CV disponible.",
            "salones":        df["salon"].unique().tolist(),
        },
        "trained_at": pd.Timestamp.now().isoformat(timespec="seconds"),
    }

    joblib.dump(artefacto, output_path)
    print(f"  ✓ Artefacto guardado → {output_path}")
    print(f"\n  Distribución de riesgo:")
    for nivel in ["ALTO", "MEDIO", "BAJO"]:
        n = len(df[df.nivel_riesgo == nivel])
        print(f"    {nivel:5s}: {n:3d} alumnos")
    print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--ie",      default="0249", help="Código IE del colegio")
    parser.add_argument("--carpeta", default=".",    help="Carpeta con los Excel")
    args = parser.parse_args()
    train(args.carpeta, args.ie)
