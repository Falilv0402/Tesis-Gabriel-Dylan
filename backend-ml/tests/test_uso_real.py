"""
Tests de las métricas de «uso real» (app/services/uso_real.py): cuántos de los alumnos marcados ALTO estaban de
verdad en riesgo y a cuántos llega el colegio si atiende solo al 30 % que el sistema pone primero.
Datos sintéticos (nada de alumnos reales).

Ejecutar con:  pytest backend-ml/tests/test_uso_real.py -v
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.uso_real import calcular_uso_real, MIN_ALUMNOS  # noqa: E402


def _alumno(prob, riesgo, nivel, b4=14.0):
    return {"prob_riesgo": prob, "riesgo": riesgo, "nivel_riesgo": nivel, "b4_matematica": b4}


def _artefacto(preds, tipo="cierre_anual"):
    return {"metricas": {"tipo_resultado": tipo}, "predicciones": preds}


def _colegio_de_100():
    """100 alumnos: 20 en riesgo. ALTO = 10 (9 en riesgo), MEDIO = 20 (7 en riesgo), BAJO = 70 (4 en riesgo)."""
    preds = []
    preds += [_alumno(0.90 - i * 0.001, 1 if i < 9 else 0, "ALTO") for i in range(10)]
    preds += [_alumno(0.60 - i * 0.001, 1 if i < 7 else 0, "MEDIO") for i in range(20)]
    preds += [_alumno(0.10 - i * 0.001, 1 if i < 4 else 0, "BAJO") for i in range(70)]
    return preds


def test_precision_del_nivel_alto_y_cobertura_con_datos_conocidos():
    r = calcular_uso_real(_artefacto(_colegio_de_100()))
    assert r["n_evaluados"] == 100 and r["n_en_riesgo"] == 20 and r["tasa_base"] == 0.2
    assert r["alto"] == {"n": 10, "en_riesgo": 9, "pct_en_riesgo": 0.9}
    assert r["medio"]["en_riesgo"] == 7 and r["medio"]["pct_en_riesgo"] == 0.35
    assert r["bajo"]["en_riesgo"] == 4
    # ALTO + MEDIO llegan a 16 de los 20 que sí estaban en riesgo
    assert r["cobertura_alto_medio"] == 0.8


def test_atender_a_los_primeros_k_y_comparacion_con_el_azar():
    r = calcular_uso_real(_artefacto(_colegio_de_100()))
    p = r["priorizado"]
    # K = 20 (tantos como los que terminaron en riesgo): los 10 ALTO (9 en riesgo) + los 10 primeros MEDIO (7) = 16
    assert p["n"] == 20 and p["en_riesgo"] == 16 and p["precision"] == 0.8
    # al azar se acertaría la tasa base (20 %): el sistema acierta 0.8 / 0.2 = 4 veces eso
    assert p["veces_mejor_que_azar"] == 4.0


def test_un_colegio_con_casi_todos_en_riesgo_no_sale_castigado():
    """Con 60 % de alumnos en riesgo, «atender al 30 %» nunca podría pasar del 50 %; con K = nº en riesgo, un sistema
    perfecto llega al 100 %."""
    preds = [_alumno(0.9 - i * 0.001, 1, "ALTO") for i in range(60)] + [_alumno(0.1 - i * 0.001, 0, "BAJO") for i in range(40)]
    r = calcular_uso_real(_artefacto(preds))
    assert r["priorizado"]["n"] == 60 and r["priorizado"]["precision"] == 1.0
    assert r["priorizado"]["veces_mejor_que_azar"] == round(1.0 / 0.6, 2)


def test_no_aplica_si_no_es_cierre_de_ano():
    assert calcular_uso_real(_artefacto(_colegio_de_100(), tipo="pronostico")) is None
    assert calcular_uso_real(_artefacto(_colegio_de_100(), tipo="descriptivo")) is None
    assert calcular_uso_real({}) is None


def test_no_aplica_con_pocos_alumnos_o_sin_variacion():
    assert calcular_uso_real(_artefacto(_colegio_de_100()[:MIN_ALUMNOS - 1])) is None
    todos_en_riesgo = [_alumno(0.8, 1, "ALTO") for _ in range(40)]
    ninguno_en_riesgo = [_alumno(0.1, 0, "BAJO") for _ in range(40)]
    assert calcular_uso_real(_artefacto(todos_en_riesgo)) is None
    assert calcular_uso_real(_artefacto(ninguno_en_riesgo)) is None


def test_los_alumnos_sin_notas_de_b4_no_cuentan_como_sin_riesgo():
    """Sin notas de B4 el riesgo guardado es 0 por omisión, no un resultado real: no debe inflar ni bajar nada."""
    con_b4 = _colegio_de_100()
    sin_b4 = [_alumno(0.95, 0, "ALTO", b4=None) for _ in range(5)]
    r = calcular_uso_real(_artefacto(con_b4 + sin_b4))
    assert r["n_evaluados"] == 100
    assert r["alto"]["n"] == 10
