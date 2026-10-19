"""Caché en memoria de los modelos de los colegios (app/services/artefactos.py)."""
import os
import sys
import time
from pathlib import Path

import joblib
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import artefactos  # noqa: E402


@pytest.fixture(autouse=True)
def _cache_limpia():
    artefactos.olvidar_artefactos()
    yield
    artefactos.olvidar_artefactos()


def test_la_segunda_lectura_sale_de_memoria(tmp_path):
    pkl = tmp_path / "colegio_1.pkl"
    joblib.dump({"nombre_colegio": "A", "predicciones": [1, 2, 3]}, pkl)
    primera = artefactos.cargar_artefacto(pkl)
    assert artefactos.cargar_artefacto(pkl) is primera                      # el mismo objeto: no se volvió a leer


def test_si_el_archivo_cambia_se_vuelve_a_leer(tmp_path):
    pkl = tmp_path / "colegio_1.pkl"
    joblib.dump({"nombre_colegio": "viejo"}, pkl)
    assert artefactos.cargar_artefacto(pkl)["nombre_colegio"] == "viejo"
    joblib.dump({"nombre_colegio": "nuevo y más largo"}, pkl)              # reentrenamiento: cambia tamaño y fecha
    assert artefactos.cargar_artefacto(pkl)["nombre_colegio"] == "nuevo y más largo"


def test_un_respaldo_restaurado_con_otra_fecha_tambien_se_detecta(tmp_path):
    pkl = tmp_path / "colegio_1.pkl"
    joblib.dump({"v": 1}, pkl)
    assert artefactos.cargar_artefacto(pkl)["v"] == 1
    joblib.dump({"v": 2}, pkl)
    antes = time.time() - 86_400 * 5
    os.utime(pkl, (antes, antes))                                         # como copy2 al restaurar un respaldo viejo
    assert artefactos.cargar_artefacto(pkl)["v"] == 2


def test_archivo_inexistente_falla_como_antes(tmp_path):
    with pytest.raises(FileNotFoundError):
        artefactos.cargar_artefacto(tmp_path / "no_existe.pkl")
