"""
artefactos.py — Carga de los modelos .pkl de los colegios con caché en memoria.

Antes cada petición (/resumen, /predicciones, /v1/colegios…) volvía a leer y reconstruir el .pkl desde disco
(1,7 s en frío, 0,4 s en caliente, ×4 colegios en el listado), así que el dashboard tardaba más de 4 s en abrir.
Ahora el artefacto se guarda en memoria y se vuelve a leer solo cuando el archivo cambia (se reentrena, se sube un
Excel o se restaura un respaldo: cambia su fecha o su tamaño).

El objeto devuelto es COMPARTIDO: quien lo use debe tratarlo como solo lectura.
"""
from __future__ import annotations

import threading
from pathlib import Path

import joblib

_cache: dict[str, tuple[tuple[int, int], dict]] = {}
_candado = threading.Lock()


def cargar_artefacto(ruta: str | Path) -> dict:
    ruta = Path(ruta)
    st = ruta.stat()                                   # FileNotFoundError si no existe, igual que joblib.load
    firma = (st.st_mtime_ns, st.st_size)
    clave = str(ruta)
    with _candado:
        guardado = _cache.get(clave)
        if guardado and guardado[0] == firma:
            return guardado[1]
    artefacto = joblib.load(ruta)                      # fuera del candado: la lectura es lenta
    with _candado:
        _cache[clave] = (firma, artefacto)
    return artefacto


def olvidar_artefactos() -> None:
    """Vacía la caché (para pruebas)."""
    with _candado:
        _cache.clear()
