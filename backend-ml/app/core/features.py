"""
Configuración de features compartida entre el pipeline de entrenamiento
y el servicio de inferencia. Única fuente de verdad para feature engineering.
"""
from __future__ import annotations
import pandas as pd

# ── Columnas por tipo ──────────────────────────────────────────────────────────
FEATURES_CAT     = ["sexo", "Distrito"]
FEATURES_NUM     = ["ise", "M500_L", "M500_CN"]
FEATURES_IE      = ["M500_L_iemean", "M500_CN_iemean", "ise_iemean", "tamanio_ie"]
FEATURES_DERIVED = ["M500_L_relativa", "M500_CN_relativa", "ise_relativo"]
ALL_FEATURES     = FEATURES_CAT + FEATURES_NUM + FEATURES_IE + FEATURES_DERIVED

GROUP_COL = "ID_IE"

# ── Restricciones monotónicas (mismo orden que ALL_FEATURES) ──────────────────
MONOTONIC_CONSTRAINTS = [0, 0, -1, -1, -1, -1, -1, -1, 0, 0, 0, 0]


def compute_ie_aggregates(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calcula agregados por IE (colegio) y los une al DataFrame.
    Versión de inferencia: usa todos los datos disponibles (no hay train/test split).
    """
    agg = (
        df.groupby(GROUP_COL)
        .agg(
            M500_L_iemean=(  "M500_L", "mean"),
            M500_CN_iemean=( "M500_CN", "mean"),
            ise_iemean=(     "ise", "mean"),
            tamanio_ie=(     GROUP_COL, "count"),
        )
        .reset_index()
    )
    df = df.merge(agg, on=GROUP_COL, how="left")
    return _add_derived(df)


def _add_derived(df: pd.DataFrame) -> pd.DataFrame:
    """Agrega features derivadas de rendimiento relativo a la IE."""
    df["M500_L_relativa"]  = df["M500_L"]  - df["M500_L_iemean"]
    df["M500_CN_relativa"] = df["M500_CN"] - df["M500_CN_iemean"]
    df["ise_relativo"]     = df["ise"]     - df["ise_iemean"]
    return df


def apply_derived_from_means(df: pd.DataFrame, ie_means: dict) -> pd.DataFrame:
    """
    Aplica features IE y derivadas usando medias globales pre-calculadas.
    Para predicciones individuales (sin acceso al dataset completo).
    """
    for feat, val in ie_means.items():
        df[feat] = val
    return _add_derived(df)
