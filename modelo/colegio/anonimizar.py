"""
anonimizar.py — Reescribe un Excel de notas/conducta sin los nombres de los alumnos.

El archivo que queda en el servidor lleva "Estudiante 000123" en lugar del nombre; los nombres originales salen
solo en el "libro de claves" que devuelve la función (código ↔ nombre ↔ salón ↔ N.° de lista), pensado para
entregárselo al colegio y NO guardarlo en el sistema.

Reglas (las mismas que usa el parser para leer a los alumnos, ver parse_excels.py):
  * Una fila es de un alumno si su columna 0 (N°) es un número.
  * El nombre está en la columna del encabezado "APELLIDOS Y NOMBRES" (y, si la celda de encabezado de la columna
    contigua está vacía —formato CUBICOL, celdas combinadas—, también en esa).
  * Si la celda del nombre viene vacía no se toca (el parser usa "Alumno N" y el seudonimizador (salón, N.°)).

El archivo de salida es siempre .xlsx con las celdas como texto (el parser lee todo como texto, así que los
resultados son idénticos); se pierde el formato visual, que el modelo no usa. Los metadatos del libro (autor,
etc.) no se conservan.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

import pandas as pd

from parse_excels import (
    _detect_salon_from_content,
    _normalizar_salon,
    _salon_desde_reporte_consolidado,
)
from seudonimos import Seudonimizador, es_seudonimo

_TIENE_LETRAS = re.compile(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]")


def _es_numero(valor) -> bool:
    return str(valor).strip().replace(".", "", 1).isdigit()


def _parece_nombre(valor) -> bool:
    """Texto con letras y más de 2 caracteres (descarta notas literales AD/A/B/C y números)."""
    if valor is None or (isinstance(valor, float) and pd.isna(valor)):
        return False
    t = str(valor).strip()
    return len(t) >= 3 and bool(_TIENE_LETRAS.search(t)) and not _es_numero(t)


def _salon_de_hoja(df: pd.DataFrame, hoja: str, tipo: str) -> str:
    """El mismo salón que calcula el parser para esa hoja (clave del seudónimo: salón + alumno)."""
    if len(df) > 1 and str(df.iloc[0, 0]).strip().upper().startswith("REPORTE CONSOLIDADO"):
        return _salon_desde_reporte_consolidado(str(df.iloc[1, 0]))
    if tipo == "conducta":
        return _detect_salon_from_content(df.head(10))
    return _normalizar_salon(hoja.strip().upper())


def _columnas_de_nombre(df: pd.DataFrame) -> tuple[int, list[int]] | None:
    """(fila del encabezado, columnas donde viven los nombres) o None si la hoja no tiene lista de alumnos."""
    for i in range(min(15, len(df))):
        fila = df.iloc[i]
        for j, v in fila.items():
            if isinstance(v, str) and "APELLIDOS" in v.upper():
                cols = [int(j)]
                sig = int(j) + 1
                if sig < len(df.columns) and (pd.isna(fila.iloc[sig]) or str(fila.iloc[sig]).strip() == ""):
                    cols.append(sig)   # CUBICOL: el nombre puede caer en la celda contigua (combinadas)
                return i, cols
    return None


def anonimizar_libro(origen: str | Path, destino: str | Path, mapper: Seudonimizador, tipo: str = "notas") -> list[dict]:
    """Lee `origen` (.xls/.xlsx), escribe `destino` (.xlsx) sin nombres y devuelve el libro de claves de ese archivo.

    Debe llamarse dentro de `with mapper.sesion():`. Si algo falla no deja ningún archivo en `destino`.
    """
    origen, destino = Path(origen), Path(destino)
    tipo = "conducta" if tipo == "conducta" else "notas"
    st = origen.stat()   # fecha del original: se lee ANTES de escribir (origen puede ser igual a destino)
    hojas: list[tuple[str, pd.DataFrame]] = []
    libro: list[dict] = []

    # `with`: el libro original se cierra al terminar de leerlo (si no, queda abierto y no se puede borrar el
    # archivo temporal que contiene los nombres, sobre todo en Windows).
    with pd.ExcelFile(origen) as xl:
        for hoja in xl.sheet_names:
            df = pd.read_excel(xl, sheet_name=hoja, header=None, dtype=str)   # igual que el parser
            ubic = _columnas_de_nombre(df) if len(df) else None
            # Un archivo solo se guarda si se PUEDE garantizar que no lleva nombres: toda hoja con contenido debe
            # tener la columna "APELLIDOS Y NOMBRES" (así lee el parser a los alumnos). Las hojas "Worksheet N" que
            # trae CUBICOL sin usar el parser las ignora igual, así que se omiten; cualquier otra hoja con datos y
            # sin esa columna hace que se rechace el archivo en vez de guardarlo con nombres sin reemplazar.
            tiene_contenido = bool(len(df)) and bool(df.notna().to_numpy().any())
            if ubic is None and tiene_contenido:
                if "worksheet" in hoja.lower():
                    continue
                raise ValueError(
                    f"La hoja '{hoja}' no tiene la columna «APELLIDOS Y NOMBRES»: no se puede verificar que no lleve nombres de alumnos"
                )
            if ubic is not None:
                inicio, cols = ubic
                salon = _salon_de_hoja(df, hoja, tipo)
                for i in range(inicio + 1, len(df)):
                    num = str(df.iloc[i, 0]).strip()
                    if not _es_numero(num):
                        continue
                    n_lista = int(float(num))
                    for c in cols:
                        valor = df.iloc[i, c]
                        if _parece_nombre(valor) and not es_seudonimo(valor):
                            nombre = str(valor).strip()
                            seudonimo = mapper.seudonimo(nombre, salon, n_lista)
                            df.iloc[i, c] = seudonimo
                            libro.append({"codigo": seudonimo, "nombre": nombre, "salon": salon,
                                          "n_alumno": n_lista, "archivo": origen.name})
                            break
            hojas.append((hoja, df))

    tmp = destino.with_name(destino.stem + ".anonimizando.tmp")
    try:
        with pd.ExcelWriter(tmp, engine="openpyxl") as w:
            for hoja, df in hojas:
                df.to_excel(w, sheet_name=hoja[:31], header=False, index=False)
        os.replace(tmp, destino)
        # El parser se queda con la versión más reciente por (salón, bimestre) según la fecha del archivo:
        # la copia anonimizada hereda la del original (en una subida nueva, la del momento de subirlo).
        os.utime(destino, (st.st_atime, st.st_mtime))
    finally:
        if tmp.exists():
            tmp.unlink()
    return libro


def anonimizar_subida(temporal: str | Path, carpeta_destino: str | Path, nombre_original: str,
                      mapper: Seudonimizador) -> tuple[Path, list[dict]]:
    """Convierte un archivo recién subido (guardado en una ruta TEMPORAL fuera de la carpeta del colegio) en su
    versión anonimizada dentro de `carpeta_destino` y devuelve (ruta final, libro de claves).

    El nombre final es el original con extensión .xlsx (un .xls se convierte); el tipo (notas/conducta) se deduce
    del nombre, igual que hace el parser.
    """
    base = Path(nombre_original).name
    tipo = "conducta" if "conducta" in base.lower() else "notas"
    destino = Path(carpeta_destino) / (Path(base).stem + ".xlsx")
    libro = anonimizar_libro(temporal, destino, mapper, tipo)
    return destino, libro


def libro_unico(libro: list[dict]) -> list[dict]:
    """Una fila por alumno para entregar al colegio: el mismo alumno sale en los archivos de varios bimestres, y si
    cambió de N.° de lista gana el de la última aparición. Ordenado por salón y N.° de lista."""
    por_codigo: dict[str, dict] = {}
    for r in libro:
        por_codigo[r["codigo"]] = {k: r[k] for k in ("codigo", "nombre", "salon", "n_alumno")}
    return sorted(por_codigo.values(), key=lambda r: (str(r["salon"]), int(r["n_alumno"])))
