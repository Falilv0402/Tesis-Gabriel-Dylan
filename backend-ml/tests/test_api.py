"""
Tests de integración para el backend ML de SARA — P20261012.
Ejecutar con:  pytest backend-ml/tests/ -v
Requiere:  pip install httpx pytest
El modelo debe estar entrenado (model/modelo_em.pkl debe existir).
"""

import os
import sys
from pathlib import Path

import pytest

# Aseguramos que el módulo de la app sea importable
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def client():
    """Cliente de prueba de FastAPI (httpx)."""
    from httpx import AsyncClient
    try:
        from httpx import Client as SyncClient
    except ImportError:
        pytest.skip("httpx no instalado")

    from app.main import app  # type: ignore
    from starlette.testclient import TestClient
    return TestClient(app)


# ─────────────────────────────────────────────────────────────────────────────
# Tests de salud y modelo
# ─────────────────────────────────────────────────────────────────────────────

class TestHealth:
    def test_health_ok(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"

    def test_health_model_loaded(self, client):
        r = client.get("/health")
        data = r.json()
        # El modelo debe haberse cargado en arranque
        assert data.get("model_loaded") is True or "trained_at" in data


class TestMetricas:
    def test_metricas_status_200(self, client):
        r = client.get("/v1/modelo/metricas")
        assert r.status_code == 200

    def test_metricas_campos_presentes(self, client):
        r = client.get("/v1/modelo/metricas")
        data = r.json()
        for campo in ["accuracy", "precision", "recall", "f1_score", "auc_roc"]:
            assert campo in data, f"Campo '{campo}' ausente en /metricas"
            assert data[campo] is not None

    def test_metricas_auc_en_rango(self, client):
        r = client.get("/v1/modelo/metricas")
        auc = r.json().get("auc_roc", 0)
        assert 0.5 <= auc <= 1.0, f"AUC fuera de rango: {auc}"

    def test_metricas_bootstrap_ci(self, client):
        r = client.get("/v1/modelo/metricas")
        data = r.json()
        # Bootstrap CI opcional — si está presente debe ser una lista de 2 floats
        for ci_field in ["auc_ci_95", "f1_ci_95", "brier_ci_95"]:
            if data.get(ci_field) is not None:
                ci = data[ci_field]
                assert isinstance(ci, list) and len(ci) == 2
                assert ci[0] <= ci[1], f"{ci_field}: límite inferior > superior"


class TestImportancia:
    def test_importancia_status_200(self, client):
        r = client.get("/v1/modelo/importancia")
        assert r.status_code == 200

    def test_importancia_lista_no_vacia(self, client):
        r = client.get("/v1/modelo/importancia")
        data = r.json()
        assert isinstance(data, list) and len(data) > 0

    def test_importancia_campos(self, client):
        r = client.get("/v1/modelo/importancia")
        for item in r.json():
            assert "feature" in item
            assert "importancia" in item
            assert isinstance(item["importancia"], (int, float))


# ─────────────────────────────────────────────────────────────────────────────
# Tests de predicciones
# ─────────────────────────────────────────────────────────────────────────────

class TestPredicciones:
    PAYLOAD_VALIDO = {
        "estudiantes": [
            {
                "sexo": "Hombre",
                "ise": 0.72,
                "Distrito": "SAN JUAN DE MIRAFLORES",
                "M500_L": 398,
                "M500_CN": 412,
            }
        ]
    }

    def test_prediccion_simple_200(self, client):
        r = client.post("/v1/predicciones", json=self.PAYLOAD_VALIDO)
        assert r.status_code == 200

    def test_prediccion_campos_respuesta(self, client):
        r = client.post("/v1/predicciones", json=self.PAYLOAD_VALIDO)
        data = r.json()
        assert "total" in data
        assert "resultados" in data
        assert len(data["resultados"]) == 1

    def test_prediccion_nivel_riesgo_valido(self, client):
        r = client.post("/v1/predicciones", json=self.PAYLOAD_VALIDO)
        nivel = r.json()["resultados"][0]["nivel_riesgo"]
        assert nivel in ("ALTO", "MEDIO", "BAJO")

    def test_prediccion_probabilidad_rango(self, client):
        r = client.post("/v1/predicciones", json=self.PAYLOAD_VALIDO)
        prob = r.json()["resultados"][0]["probabilidad_riesgo"]
        assert 0.0 <= prob <= 1.0

    def test_prediccion_payload_invalido_422(self, client):
        r = client.post("/v1/predicciones", json={"estudiantes": [{"sexo": "Otro"}]})
        assert r.status_code == 422

    def test_dataset_paginado(self, client):
        r = client.post("/v1/predicciones/dataset?limit=10&offset=0")
        assert r.status_code == 200
        data = r.json()
        assert "total" in data
        assert len(data["resultados"]) <= 10

    def test_dataset_filtro_nivel(self, client):
        r = client.post("/v1/predicciones/dataset?limit=50&nivel=ALTO")
        assert r.status_code == 200
        for est in r.json()["resultados"]:
            assert est["nivel_riesgo"] == "ALTO"

    def test_resumen_estructura(self, client):
        r = client.get("/v1/predicciones/resumen")
        assert r.status_code == 200
        data = r.json()
        assert "total" in data
        assert "risk_counts" in data


# ─────────────────────────────────────────────────────────────────────────────
# Tests de SHAP individual
# ─────────────────────────────────────────────────────────────────────────────

class TestShap:
    def _first_student_id(self, client) -> str:
        r = client.post("/v1/predicciones/dataset?limit=1&offset=0")
        return r.json()["resultados"][0]["id_estudiante"]

    def test_shap_status_200(self, client):
        sid = self._first_student_id(client)
        r = client.get(f"/v1/predicciones/{sid}/shap")
        assert r.status_code == 200

    def test_shap_campos_presentes(self, client):
        sid = self._first_student_id(client)
        r = client.get(f"/v1/predicciones/{sid}/shap")
        data = r.json()
        assert "id_estudiante" in data
        assert "probabilidad_riesgo" in data
        assert "contributions" in data
        assert len(data["contributions"]) > 0

    def test_shap_contribuciones_suman_aproximado(self, client):
        """La suma de contribuciones debe aproximarse a (prob_real - base_prob)."""
        sid = self._first_student_id(client)
        r = client.get(f"/v1/predicciones/{sid}/shap")
        data = r.json()
        total_contrib = sum(c["contribution"] for c in data["contributions"])
        expected = data["probabilidad_riesgo"] - data["base_probabilidad"]
        assert abs(total_contrib - expected) < 0.15, (
            f"Suma de contribuciones {total_contrib:.4f} ≠ esperada {expected:.4f}"
        )

    def test_shap_id_no_existe_404(self, client):
        r = client.get("/v1/predicciones/ID_INEXISTENTE_99999/shap")
        assert r.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# Tests de diagnóstico
# ─────────────────────────────────────────────────────────────────────────────

class TestDiagnostico:
    def test_diagnostico_200(self, client):
        r = client.get("/v1/modelo/diagnostico")
        assert r.status_code == 200

    def test_diagnostico_baselines_presentes(self, client):
        r = client.get("/v1/modelo/diagnostico")
        data = r.json()
        assert "baselines" in data
        assert "modelo_ml" in data.get("baselines", {})

    def test_diagnostico_test_arrays(self, client):
        r = client.get("/v1/modelo/diagnostico")
        data = r.json()
        ta = data.get("test_arrays", {})
        assert "y_true" in ta and "y_prob" in ta
        assert len(ta["y_true"]) == len(ta["y_prob"])
        assert len(ta["y_true"]) > 0

    def test_diagnostico_fair_thresholds(self, client):
        r = client.get("/v1/modelo/diagnostico")
        data = r.json()
        ft = data.get("fair_thresholds")
        if ft:  # puede ser None si el modelo no se reentrenó aún
            for grupo, thr in ft.items():
                assert 0.0 < thr < 1.0, f"Umbral de equidad {grupo}={thr} fuera de rango"


# ─────────────────────────────────────────────────────────────────────────────
# Tests de validación CSV
# ─────────────────────────────────────────────────────────────────────────────

class TestValidarCsv:
    def test_csv_valido(self, client, tmp_path):
        csv_content = "sexo,ise,Distrito,M500_L,M500_CN,ID_IE\nHombre,1.2,MIRAFLORES,520,510,1001\n"
        csv_file = tmp_path / "test.csv"
        csv_file.write_text(csv_content, encoding="utf-8")
        with open(csv_file, "rb") as f:
            r = client.post("/v1/datos/validar-csv", files={"file": ("test.csv", f, "text/csv")})
        assert r.status_code == 200
        data = r.json()
        assert data["total_filas"] == 1
        assert len(data["columnas_faltantes"]) == 0

    def test_csv_falta_columna(self, client, tmp_path):
        csv_content = "sexo,ise,M500_L\nHombre,1.2,520\n"   # Falta Distrito, M500_CN, ID_IE
        csv_file = tmp_path / "bad.csv"
        csv_file.write_text(csv_content, encoding="utf-8")
        with open(csv_file, "rb") as f:
            r = client.post("/v1/datos/validar-csv", files={"file": ("bad.csv", f, "text/csv")})
        assert r.status_code == 200
        data = r.json()
        assert len(data["columnas_faltantes"]) > 0
