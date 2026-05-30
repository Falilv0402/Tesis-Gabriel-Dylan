"""Predicciones individuales y consultas paginadas sobre el dataset."""
from __future__ import annotations
import threading
from typing import Any

import pandas as pd

from app.core.features import (
    ALL_FEATURES, GROUP_COL,
    compute_ie_aggregates, apply_derived_from_means,
)
from app.schemas import PredictionRequest


def clasificar_nivel(probabilidad: float) -> str:
    if probabilidad >= 0.70:
        return "ALTO"
    if probabilidad >= 0.45:
        return "MEDIO"
    return "BAJO"


class PredictionService:
    def __init__(self, loader) -> None:  # loader: ModelLoader
        self._loader = loader
        self._cached_predictions: list[dict[str, Any]] | None = None
        self._cached_df: "pd.DataFrame | None" = None  # Fix #14: evita releer CSV en SHAP
        self._cache_lock = threading.Lock()  # Fix #5: previene doble-build bajo concurrencia

    def _ensure_loaded(self) -> None:
        if self._loader.model is None:
            self._loader.load()

    def invalidate_cache(self) -> None:
        self._cached_predictions = None
        self._cached_df = None  # Fix #14

    def predict(self, request: PredictionRequest) -> list[dict[str, Any]]:
        self._ensure_loaded()
        rows = [item.model_dump() for item in request.estudiantes]
        df = pd.DataFrame(rows)
        df = apply_derived_from_means(df, self._loader._global_ie_means)
        probs = self._loader.model.predict_proba(df[ALL_FEATURES])[:, 1]
        preds = (probs >= 0.50).astype(int)
        results: list[dict[str, Any]] = []
        for idx, row in df.iterrows():
            prob = float(probs[idx])
            results.append({
                "indice":              int(idx),
                "sexo":                row["sexo"],
                "ise":                 float(row["ise"]),
                "distrito":            row["Distrito"],
                "M500_L":              float(row["M500_L"]),
                "M500_CN":             float(row["M500_CN"]),
                "prediccion_riesgo":   int(preds[idx]),
                "probabilidad_riesgo": prob,
                "nivel_riesgo":        clasificar_nivel(prob),
            })
        return results

    def get_cached_df(self) -> pd.DataFrame:
        """Fix #14: DataFrame procesado cacheado para que SHAP no relea el CSV en cada request."""
        if self._cached_df is None:
            self._ensure_dataset_predictions()
        return self._cached_df  # type: ignore[return-value]

    def _ensure_dataset_predictions(self) -> list[dict[str, Any]]:
        if self._cached_predictions is not None:
            return self._cached_predictions
        with self._cache_lock:  # Fix #5: double-checked locking
            if self._cached_predictions is not None:
                return self._cached_predictions
            self._ensure_loaded()
        df = self._loader.load_dataset_raw()
        df = compute_ie_aggregates(df)
        self._cached_df = df.reset_index(drop=True)  # Fix #14: guardar para SHAP
        probs = self._loader.model.predict_proba(df[ALL_FEATURES])[:, 1]
        preds = (probs >= 0.50).astype(int)
        results: list[dict[str, Any]] = []
        for pos, (_, row) in enumerate(df.iterrows()):
            prob = float(probs[pos])
            results.append({
                "indice":              pos,
                "id_estudiante":       str(row.get("ID_estudiante", pos + 1)),
                "sexo":                row.get("sexo"),
                "ise":                 float(row["ise"]),
                "distrito":            row.get("Distrito"),
                "id_ie":               str(row.get("ID_IE", "")),
                "M500_L":              float(row["M500_L"]),
                "M500_CN":             float(row["M500_CN"]),
                "M500_L_iemean":       float(row["M500_L_iemean"]),
                "M500_CN_iemean":      float(row["M500_CN_iemean"]),
                "ise_iemean":          float(row["ise_iemean"]),
                "M500_M":              float(row["M500_M"]) if pd.notna(row.get("M500_M")) else None,
                "grupo_m_real":        row.get("grupo_M"),
                "prediccion_riesgo":   int(preds[pos]),
                "probabilidad_riesgo": prob,
                "nivel_riesgo":        clasificar_nivel(prob),
            })
        results.sort(key=lambda r: r["probabilidad_riesgo"], reverse=True)
        self._cached_predictions = results
        return results

    @staticmethod
    def _apply_filters(rows, nivel=None, distrito=None, sexo=None, id_ie=None):
        def norm(v): return str(v or "").strip().upper()
        filtered = rows
        if nivel:    filtered = [r for r in filtered if norm(r.get("nivel_riesgo")) == norm(nivel)]
        if distrito: filtered = [r for r in filtered if norm(r.get("distrito"))     == norm(distrito)]
        if sexo:     filtered = [r for r in filtered if norm(r.get("sexo"))         == norm(sexo)]
        if id_ie:    filtered = [r for r in filtered if str(r.get("id_ie") or "")   == str(id_ie)]
        return filtered

    def query_dataset(self, limit=1000, offset=0, nivel=None, distrito=None, sexo=None, id_ie=None):
        rows     = self._ensure_dataset_predictions()
        filtered = self._apply_filters(rows, nivel=nivel, distrito=distrito, sexo=sexo, id_ie=id_ie)
        total    = len(filtered)
        page     = filtered[offset:] if limit is None else filtered[offset: offset + limit]
        return total, page

    def get_dataset_summary(self, nivel=None, distrito=None, sexo=None, id_ie=None):
        rows     = self._ensure_dataset_predictions()
        filtered = self._apply_filters(rows, nivel=nivel, distrito=distrito, sexo=sexo, id_ie=id_ie)
        def counts(field):
            result: dict[str, int] = {}
            for r in filtered:
                key = str(r.get(field) or "Sin dato")
                result[key] = result.get(key, 0) + 1
            return dict(sorted(result.items()))
        risk_counts = {"ALTO": 0, "MEDIO": 0, "BAJO": 0}
        for r in filtered:
            lvl = str(r.get("nivel_riesgo") or "")
            if lvl in risk_counts:
                risk_counts[lvl] += 1
        return {"total": len(filtered), "risk_counts": risk_counts,
                "facets": {"distrito": counts("distrito"), "sexo": counts("sexo"), "nivel": counts("nivel_riesgo")}}

    def get_colegios(self):
        if not self._loader.dataset_path.exists():
            return []
        df = self._loader.load_dataset_raw()
        result = (
            df.groupby(["Distrito", "ID_IE"]).size()
            .reset_index(name="total_estudiantes")
            .sort_values(["Distrito", "ID_IE"])
        )
        return result.rename(columns={"Distrito": "distrito", "ID_IE": "id_ie"}).to_dict(orient="records")

    def get_distritos(self):
        if not self._loader.dataset_path.exists():
            return []
        df = self._loader.load_dataset_raw()
        return sorted(df["Distrito"].dropna().unique().tolist())
