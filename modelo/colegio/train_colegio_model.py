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
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.metrics import roc_auc_score, f1_score, precision_score, recall_score, accuracy_score

from parse_excels import procesar_colegio

# ─── Enfoque predictivo: B1-B3 como features, B4/PP como target ──────────────
#
# El modelo usa los primeros 3 bimestres para predecir quién tendrá C
# en el 4.° bimestre (todavía hay tiempo de intervenir).
# Esto convierte el sistema en alerta TEMPRANA real, no descripción del pasado.
#
# Features disponibles (bimestres 1-3):
FEATURES_EARLY = [
    "b1_matematica",   "b2_matematica",   "b3_matematica",
    "b1_comunicacion", "b2_comunicacion", "b3_comunicacion",
    "b1_cta",          "b2_cta",          "b3_cta",
    "conducta_promedio",
]

# Si no hay suficientes bimestres, fallback al PP (modo descriptivo)
FEATURES_PP = [
    "pp_matematica", "pp_comunicacion", "pp_cta",
    "conducta_promedio", "n_materias_c", "promedio_materias",
    "tendencia_matematica", "tendencia_comunicacion",
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

    # ── 2. Construir features y target predictivos ────────────────────────────
    print("\n[2/4] Preparando features (modo predictivo B1-B3 → B4)...")

    # ── Target: riesgo en el 4.° bimestre (lo que queremos predecir) ──────────
    # Usamos B4 si está disponible, sino PP como fallback
    mat_b4  = next((c for c in ["b4_matematica","b4_mat_prim"] if c in df.columns), None)
    com_b4  = next((c for c in ["b4_comunicacion","b4_lenguaje"] if c in df.columns), None)
    mat_pp  = next((c for c in ["pp_matematica","pp_mat_prim"] if c in df.columns), None)
    com_pp  = next((c for c in ["pp_comunicacion","pp_lenguaje"] if c in df.columns), None)

    if mat_b4 and com_b4:
        # Modo predictivo genuino: target = C en bimestre 4
        df["riesgo_target"] = (
            (df[mat_b4].fillna(99) <= 13) | (df[com_b4].fillna(99) <= 13)
        ).astype(int)
        modo = "predictivo (B1-B3 → B4)"
        print("      Modo: PREDICTIVO — features B1-B3, target B4")
    else:
        # Fallback: target = PP anual
        df["riesgo_target"] = df["riesgo"].values
        modo = "descriptivo (PP anual)"
        print("      Modo: DESCRIPTIVO (fallback) — sin datos de B4")

    # ── Features: solo bimestres 1-3 (lo que se conoce ANTES del B4) ──────────
    early_available = [f for f in FEATURES_EARLY if f in df.columns
                       and df[f].notna().sum() >= 5]

    # Añadir tendencia temprana calculada aquí (B3 - B1)
    for materia in ["matematica", "comunicacion", "cta", "lenguaje", "mat_prim"]:
        b1 = f"b1_{materia}"
        b3 = f"b3_{materia}"
        tend = f"tend_temprana_{materia}"
        if b1 in df.columns and b3 in df.columns:
            df[tend] = df[b3].fillna(df[b1]) - df[b1].fillna(df[b3])
            if tend not in early_available:
                early_available.append(tend)

    if len(early_available) >= 3:
        available = early_available
    else:
        # Fallback a PP si no hay bimestres
        available = [f for f in FEATURES_PP if f in df.columns]
        modo = "descriptivo (sin bimestres suficientes)"

    print(f"      Features usadas ({len(available)}): {available}")
    print(f"      Modo de predicción: {modo}")

    # Filtrar solo alumnos con target conocido (tienen B4)
    mask_target = df["riesgo_target"].notna()
    df_model = df[mask_target].copy()
    X = df_model[available].copy()
    y = df_model["riesgo_target"].values
    print(f"      Alumnos con B4 conocido: {len(df_model)} / {len(df)}")

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
        auc_cv          = float("nan")
        auc_train       = float("nan")
        f1_train        = float("nan")
        precision_train = float("nan")
        recall_train    = float("nan")
        accuracy_train  = float("nan")
        n_splits_used   = 0
    else:
        class_weight = {0: 1.0, 1: max(1.0, neg / max(pos, 1))}

        pipe_lr = Pipeline([
            ("scaler", StandardScaler()),
            ("clf",    LogisticRegression(
                C=1.0, max_iter=1000, class_weight=class_weight, random_state=42
            )),
        ])
        pipe_rf = Pipeline([
            ("scaler", StandardScaler()),
            ("clf",    RandomForestClassifier(
                n_estimators=300, max_depth=6,
                class_weight=class_weight, random_state=42, n_jobs=-1
            )),
        ])
        pipe = VotingClassifier(
            estimators=[("lr", pipe_lr), ("rf", pipe_rf)],
            voting="soft",
        )

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
        auc_train       = float(roc_auc_score(y, y_prob))
        f1_train        = float(f1_score(y, y_pred, zero_division=0))
        precision_train = float(precision_score(y, y_pred, zero_division=0))
        recall_train    = float(recall_score(y, y_pred, zero_division=0))
        accuracy_train  = float(accuracy_score(y, y_pred))
        modelo    = pipe
        print(f"      AUC (train, referencia) : {auc_train:.4f}  "
              f"F1 (train): {f1_train:.4f}  "
              f"Precision: {precision_train:.4f}  Recall: {recall_train:.4f}")
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
            "modo_prediccion": modo,
            "n_alumnos":      len(df),
            "n_alumnos_modelo": len(X),
            "n_riesgo":       int(y.sum()),
            "pct_riesgo":     round(100 * float(y.mean()), 1),
            "auc_cv":         round(auc_cv, 4)         if not np.isnan(auc_cv)         else None,
            "auc_train":      round(auc_train, 4)      if not np.isnan(auc_train)      else None,
            "f1_train":       round(f1_train, 4)       if not np.isnan(f1_train)       else None,
            "precision_train": round(precision_train, 4) if not np.isnan(precision_train) else None,
            "recall_train":   round(recall_train, 4)   if not np.isnan(recall_train)   else None,
            "accuracy_train": round(accuracy_train, 4) if not np.isnan(accuracy_train) else None,
            "n_splits_cv":    n_splits_used,
            "nota_metodologica": (
                f"MODO PREDICTIVO: features B1-B3, target B4. "
                f"AUC CV {n_splits_used}-fold = {round(auc_cv,4) if not np.isnan(auc_cv) else 'N/A'}. "
                "El modelo predice quién tendrá C en el 4° bimestre usando solo los 3 primeros, "
                "permitiendo intervención oportuna. Validación real: comparar predicciones con "
                "resultados finales al cierre del año académico."
            ) if n_splits_used >= 3 else (
                "Modo descriptivo (fallback): pocos datos de B4. "
                "Actualizar cuando estén disponibles todos los bimestres."
            ),
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
