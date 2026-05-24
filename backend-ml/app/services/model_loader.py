"""Carga, estado de salud y reentrenamiento del modelo ML."""
from __future__ import annotations
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from app.core.config import get_settings
from app.core.features import compute_ie_aggregates, GROUP_COL


class ModelLoader:
    def __init__(self) -> None:
        settings = get_settings()
        self.model_path   = self._resolve(settings.model_path)
        self.metrics_path = self._resolve(settings.metrics_path)
        self.dataset_path = self._resolve(settings.dataset_path)
        self.model:   Any | None = None
        self.metrics: dict[str, Any] = {}
        self._global_ie_means: dict[str, float] = {}

    @staticmethod
    def _resolve(path: Path) -> Path:
        if path.is_absolute():
            return path
        return (Path(__file__).resolve().parents[2] / path).resolve()

    def load(self) -> None:
        missing = [str(p) for p in [self.model_path, self.metrics_path] if not p.exists()]
        if missing:
            raise FileNotFoundError(f"Artefactos ML no encontrados: {', '.join(missing)}")
        self.model   = joblib.load(self.model_path)
        self.metrics = joblib.load(self.metrics_path)
        self._cache_global_means()

    def _cache_global_means(self) -> None:
        if not self.dataset_path.exists():
            self._global_ie_means = {
                "M500_L_iemean": 490.0, "M500_CN_iemean": 490.0,
                "ise_iemean": 1.5,      "tamanio_ie": 47.0,
            }
            return
        df = self.load_dataset_raw()
        self._global_ie_means = {
            "M500_L_iemean":  float(df["M500_L"].mean()),
            "M500_CN_iemean": float(df["M500_CN"].mean()),
            "ise_iemean":     float(df["ise"].mean()),
            "tamanio_ie":     float(df.groupby(GROUP_COL).size().mean()),
        }

    def load_dataset_raw(self) -> pd.DataFrame:
        df = pd.read_csv(self.dataset_path)
        for col in ["M500_L", "M500_CN", "M500_M", "ise"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        return df.dropna(subset=["M500_L", "M500_CN", "ise"])

    def health(self) -> dict[str, Any]:
        return {
            "model_loaded": self.model is not None,
            "model_path":   str(self.model_path),
            "metrics_path": str(self.metrics_path),
            "dataset_path": str(self.dataset_path),
        }

    def retrain(self) -> str:
        train_script = self.dataset_path.parents[1] / "train_em_model.py"
        if not train_script.exists():
            raise FileNotFoundError(f"Script no encontrado: {train_script}")
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUTF8"] = "1"
        result = subprocess.run(
            [sys.executable, str(train_script)],
            cwd=str(train_script.parent),
            capture_output=True, text=True,
            encoding="utf-8", errors="replace",
            timeout=300, check=False, env=env,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr or result.stdout)
        self.model   = None
        self.metrics = {}
        self._cached_predictions: list | None = None  # type: ignore[attr-defined]
        self.load()
        return result.stdout
