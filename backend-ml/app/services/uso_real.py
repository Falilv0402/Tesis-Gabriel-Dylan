"""Cómo le fue al modelo de un colegio *en la práctica* (no en un solo número como el F1).

En el cierre de año el modelo ya tiene, para cada alumno, la probabilidad con la que habría anticipado el riesgo del
4.° bimestre (probabilidad de validación cruzada: el modelo no vio a ese alumno al calcularla) y se sabe qué pasó de
verdad. Con eso se responde lo que le importa a un colegio:

  · De los alumnos que el sistema marca con riesgo ALTO, ¿cuántos estaban de verdad en riesgo?
  · Si el colegio atiende a los primeros alumnos que el sistema pone en su lista, tantos como los que terminaron en
    riesgo, ¿cuántos de ellos estaban de verdad en riesgo? (Es una medida estándar —precisión en los primeros K— y,
    a diferencia de «atender al 30 %», es justa con colegios donde casi todos están en riesgo.)
  · ¿Cuánto mejor es eso que elegir esos mismos alumnos al azar?

Nada de esto cambia el modelo ni sus cortes: solo cuenta aciertos reales con las predicciones ya guardadas.
"""
from __future__ import annotations

MIN_ALUMNOS = 20             # con menos alumnos evaluados los porcentajes no dicen nada
_AREAS_B4 = ("b4_matematica", "b4_mat_prim", "b4_comunicacion", "b4_lenguaje")


def _tiene_b4(pred: dict) -> bool:
    return any(pred.get(c) is not None for c in _AREAS_B4)


def _tramo(filas: list[dict]) -> dict:
    n = len(filas)
    en_riesgo = sum(1 for p in filas if p["riesgo"] == 1)
    return {"n": n, "en_riesgo": en_riesgo, "pct_en_riesgo": round(en_riesgo / n, 4) if n else None}


def calcular_uso_real(art: dict) -> dict | None:
    """None si no aplica: solo hay «uso real» comparable cuando se cargaron los 4 bimestres (cierre de año), porque
    ahí la probabilidad guardada corresponde al mismo bimestre cuyo resultado ya se conoce."""
    m = art.get("metricas") or {}
    if m.get("tipo_resultado") != "cierre_anual":
        return None

    filas = [
        p for p in (art.get("predicciones") or [])
        if p.get("prob_riesgo") is not None and p.get("riesgo") is not None and _tiene_b4(p)
    ]
    n = len(filas)
    total_riesgo = sum(1 for p in filas if p["riesgo"] == 1)
    if n < MIN_ALUMNOS or total_riesgo == 0 or total_riesgo == n:
        return None

    por_nivel = {nv: [p for p in filas if p.get("nivel_riesgo") == nv] for nv in ("ALTO", "MEDIO", "BAJO")}
    alto, medio, bajo = (_tramo(por_nivel[nv]) for nv in ("ALTO", "MEDIO", "BAJO"))

    # K = tantos alumnos como los que de verdad terminaron en riesgo. Si el sistema fuera perfecto, los K primeros serían
    # justo esos; al azar, solo acertaría la tasa base.
    k = total_riesgo
    top = sorted(filas, key=lambda p: p["prob_riesgo"], reverse=True)[:k]
    aciertos = sum(1 for p in top if p["riesgo"] == 1)
    precision_k = aciertos / k

    tasa_base = total_riesgo / n
    return {
        "n_evaluados": n,
        "n_en_riesgo": total_riesgo,
        "tasa_base": round(tasa_base, 4),
        "alto": alto,
        "medio": medio,
        "bajo": bajo,
        "cobertura_alto_medio": round((alto["en_riesgo"] + medio["en_riesgo"]) / total_riesgo, 4),
        "priorizado": {
            "n": k,
            "en_riesgo": aciertos,
            "precision": round(precision_k, 4),
            "veces_mejor_que_azar": round(precision_k / tasa_base, 2),
        },
    }
