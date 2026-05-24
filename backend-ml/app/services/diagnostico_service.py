"""Métricas de evaluación, diagnóstico avanzado y deriva del dataset."""
from __future__ import annotations
from typing import Any

import numpy as np

from app.core.features import compute_ie_aggregates


def _to_python(obj: Any) -> Any:
    """Convierte recursivamente tipos numpy a tipos Python nativos."""
    if isinstance(obj, dict):
        return {k: _to_python(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_python(v) for v in obj]
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


class DiagnosticoService:
    def __init__(self, loader) -> None:
        self._loader = loader

    def _ensure_loaded(self) -> None:
        if not self._loader.metrics:
            self._loader.load()

    def get_metrics(self) -> dict[str, Any]:
        self._ensure_loaded()
        m = self._loader.metrics
        return {
            "accuracy": m.get("accuracy"), "precision": m.get("precision"),
            "recall": m.get("recall"),     "f1_score": m.get("f1_score"),
            "auc_roc": m.get("auc_roc"),   "brier_score": m.get("brier_score"),
            "auc_ci_95": m.get("auc_ci_95"), "f1_ci_95": m.get("f1_ci_95"),
            "brier_ci_95": m.get("brier_ci_95"), "pr_auc": m.get("pr_auc"),
            "pr_baseline": m.get("pr_baseline"),
            "modelo_ganador": m.get("modelo_ganador"),
            "trained_at": m.get("trained_at"),
            "train_rows": m.get("train_rows"), "test_rows": m.get("test_rows"),
            "scope": m.get("scope"),
        }

    def get_importance(self) -> list[dict[str, Any]]:
        self._ensure_loaded()
        shap_data = self._loader.metrics.get("shap_importance", [])
        if shap_data:
            return [{"feature": e["feature"], "importancia": e["shap_mean"]} for e in shap_data]
        from app.core.features import ALL_FEATURES
        features    = self._loader.metrics.get("features", ALL_FEATURES)
        importances = self._loader.metrics.get("feature_importances", [])
        pairs = sorted(zip(features, importances), key=lambda x: x[1], reverse=True)
        return [{"feature": f, "importancia": float(v)} for f, v in pairs]

    def get_evaluation(self) -> dict[str, Any]:
        self._ensure_loaded()
        m = self._loader.metrics
        return {
            "confusion_matrix":      m.get("confusion_matrix", []),
            "roc_fpr":               m.get("roc_fpr", []),
            "roc_tpr":               m.get("roc_tpr", []),
            "cv_comparativa":        m.get("cv_comparativa", {}),
            "calibration_prob_true": m.get("calibration_prob_true", []),
            "calibration_prob_pred": m.get("calibration_prob_pred", []),
            "brier_score":           m.get("brier_score"),
        }

    def get_diagnostico(self) -> dict[str, Any]:
        self._ensure_loaded()
        m = self._loader.metrics
        return _to_python({
            "baselines":             m.get("baselines", {}),
            "group_metrics":         m.get("group_metrics", {}),
            "monotonic_constraints": m.get("monotonic_constraints", {}),
            "drift_baseline":        m.get("drift_baseline", {}),
            "drift_actual":          self._compute_current_drift(),
            "test_arrays":           m.get("test_arrays", {"y_true": [], "y_prob": []}),
            "target_definition":     m.get("target_definition", ""),
            "auc_ci_95":             m.get("auc_ci_95"),
            "f1_ci_95":              m.get("f1_ci_95"),
            "brier_ci_95":           m.get("brier_ci_95"),
            "fair_thresholds":       m.get("fair_thresholds", {}),
            "grid_resultados":       m.get("grid_resultados", {}),
            "pr_auc":                m.get("pr_auc"),
            "pr_baseline":           m.get("pr_baseline"),
            "pr_curve_precision":    m.get("pr_curve_precision", []),
            "pr_curve_recall":       m.get("pr_curve_recall", []),
            "perm_importance":       m.get("perm_importance", []),
            "mcnemar":               m.get("mcnemar", {}),
            "delong":                m.get("delong", {}),
            "learning_curve":        m.get("learning_curve", {}),
            "policies":              m.get("policies", {}),
            "error_analysis":        m.get("error_analysis", {}),
            "stacking_result":       m.get("stacking_result", {}),
            "optuna_result":         m.get("optuna_result", {}),
            # Advanced diagnostics (stored in pkl, missing from previous response)
            "nested_cv":             m.get("nested_cv", {}),
            "dca_curve":             m.get("dca_curve", {}),
            "pdp_data":              m.get("pdp_data", []),
            "shap_interactions":     m.get("shap_interactions", {}),
            "monotonicity_check":    m.get("monotonicity_check", {}),
            "stability":             m.get("stability", {}),
            "ablation_results":      m.get("ablation_results", []),
            "hosmer_lemeshow":       m.get("hosmer_lemeshow", {}),
            "ece":                   m.get("ece"),
            "mce":                   m.get("mce"),
            "ece_bin_data":          m.get("ece_bin_data", []),
            "log_loss":              m.get("log_loss"),
            "mcc":                   m.get("mcc"),
            "specificity":           m.get("specificity"),
            "cv_comparativa":        m.get("cv_comparativa", {}),
            "confusion_matrix":      m.get("confusion_matrix", []),
            "roc_fpr":               m.get("roc_fpr", []),
            "roc_tpr":               m.get("roc_tpr", []),
            "feature_corr_matrix":   m.get("feature_corr_matrix", {}),
            "calibration_prob_true": m.get("calibration_prob_true", []),
            "calibration_prob_pred": m.get("calibration_prob_pred", []),
        })

    def _compute_current_drift(self) -> dict[str, Any]:
        baseline = self._loader.metrics.get("drift_baseline", {})
        if not baseline or not self._loader.dataset_path.exists():
            return {}
        df = self._loader.load_dataset_raw()
        df = compute_ie_aggregates(df)
        drift: dict[str, Any] = {}
        for feat, base in baseline.items():
            if feat not in df.columns:
                continue
            current_mean = float(df[feat].mean())
            current_std  = float(df[feat].std())
            base_mean    = float(base.get("mean", 0))
            base_std     = float(base.get("std", 1))
            rel_shift    = abs(current_mean - base_mean) / max(base_std, 1e-6)
            drift[feat] = {
                "current_mean": current_mean, "current_std":  current_std,
                "baseline_mean": base_mean,   "baseline_std":  base_std,
                "rel_shift": rel_shift,
                "alerta": "alta" if rel_shift > 0.5 else ("media" if rel_shift > 0.25 else "ok"),
            }
        return drift
