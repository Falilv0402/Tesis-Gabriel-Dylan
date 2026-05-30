"""
Análisis de contribución de features por estudiante (Fix #6).

NOTA METODOLÓGICA para la tesis:
Este servicio implementa un análisis de contribución marginal (ICE — Individual
Conditional Expectation), NO el algoritmo SHAP de Lundberg & Lee (2017).
La diferencia:
  - SHAP real: valores de Shapley calculados sobre todas las coaliciones de features,
    garantizan que sum(contributions) = f(x) - E[f(x)].
  - Este método: para cada feature, mide Δp = p(x) - p(x con feature reemplazada por baseline),
    lo que ignora interacciones entre features.

Para la defensa: referirse a esto como "Análisis de Contribución de Features (ICE-based)",
no como "SHAP". La UI muestra "Factores de riesgo" para evitar ambigüedad técnica.
"""
from __future__ import annotations
from typing import Any

import pandas as pd

from app.core.features import ALL_FEATURES, FEATURES_CAT


class ShapService:
    def __init__(self, loader, prediction_service) -> None:
        self._loader = loader
        self._pred   = prediction_service

    def get_student_shap(self, id_estudiante: str) -> dict[str, Any]:
        if self._loader.model is None:
            self._loader.load()

        rows  = self._pred._ensure_dataset_predictions()
        match = next((r for r in rows if str(r.get("id_estudiante")) == str(id_estudiante)), None)
        if match is None:
            raise ValueError(f"Estudiante '{id_estudiante}' no encontrado.")

        original_pos = match["indice"]
        # Fix #14: usar DataFrame cacheado en lugar de releer el CSV desde disco
        df = self._pred.get_cached_df()

        if original_pos >= len(df):
            raise ValueError(f"Índice {original_pos} fuera del rango del dataset ({len(df)} filas).")

        student_df = df.iloc[[original_pos]][ALL_FEATURES].copy()

        # Baseline: media numérica / moda categórica
        baseline_row: dict[str, Any] = {}
        for feat in ALL_FEATURES:
            if feat in FEATURES_CAT:
                baseline_row[feat] = df[feat].mode(dropna=True)[0] if feat in df.columns else student_df[feat].values[0]
            else:
                baseline_row[feat] = float(df[feat].mean()) if feat in df.columns else float(student_df[feat].values[0])
        baseline_df = pd.DataFrame([baseline_row])

        actual_prob: float = match["probabilidad_riesgo"]
        base_prob: float   = float(self._loader.model.predict_proba(baseline_df[ALL_FEATURES])[:, 1][0])

        contributions: list[dict[str, Any]] = []
        for feat in ALL_FEATURES:
            modified = student_df.copy()
            modified[feat] = baseline_row[feat]
            prob_without = float(self._loader.model.predict_proba(modified[ALL_FEATURES])[:, 1][0])
            contribution = actual_prob - prob_without
            raw_val = student_df[feat].values[0]
            val:      float | str = str(raw_val)  if feat in FEATURES_CAT else float(raw_val)
            base_val: float | str = str(baseline_row[feat]) if feat in FEATURES_CAT else float(baseline_row[feat])
            contributions.append({
                "feature": feat, "value": val, "baseline": base_val,
                "contribution": round(contribution, 6),
                "abs_contribution": round(abs(contribution), 6),
            })

        contributions.sort(key=lambda x: x["abs_contribution"], reverse=True)
        return {
            "id_estudiante": str(id_estudiante),
            "probabilidad_riesgo": actual_prob,
            "nivel_riesgo": match["nivel_riesgo"],
            "base_probabilidad": round(base_prob, 6),
            "contributions": contributions[:8],
        }
