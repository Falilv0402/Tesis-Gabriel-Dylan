"""
migrar_a_seudonimos.py — Quita los nombres reales de una carpeta de Excel que ya existe (migración única).

Para cada archivo .xls/.xlsx de la carpeta:
  1. lo reescribe EN EL MISMO LUGAR con "Estudiante 000123" en vez del nombre (un .xls pasa a .xlsx y se borra);
  2. conserva la fecha del archivo (el parser decide la "versión más reciente" por ella);
  3. borra los `colegio_*_procesado.csv` de la carpeta (llevaban los nombres).
Y escribe el libro de claves (código ↔ nombre ↔ salón ↔ N.° de lista), UNA fila por alumno, en un CSV aparte, para
entregárselo al colegio. Ese CSV es lo único que conserva los nombres: guárdalo fuera del servidor y del repo.

Con --verificar comprueba, a partir de ese libro, que no quedó ningún nombre en la carpeta.

Uso (dentro del contenedor del backend o en local):
    python migrar_a_seudonimos.py --ie 831305 --carpeta /app/modelo/data/colegio_831305_upload --libro /tmp/libro_831305.csv
    python migrar_a_seudonimos.py --ie 831305 --carpeta ... --libro /tmp/libro_831305.csv --verificar
Después hay que reentrenar (train_colegio_model.py) y borrar los respaldos viejos del modelo, que también llevan nombres.
"""
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

import pandas as pd

from anonimizar import anonimizar_libro, libro_unico
from seudonimos import Seudonimizador, normalizar_nombre


def migrar(carpeta: Path, ie: str, ruta_mapa: Path, ruta_libro: Path) -> dict:
    mapper = Seudonimizador(ruta_mapa)
    archivos = sorted(p for p in carpeta.iterdir() if p.suffix.lower() in (".xls", ".xlsx"))
    libro: list[dict] = []
    convertidos = 0
    with mapper.sesion():
        for f in archivos:
            tipo = "conducta" if "conducta" in f.name.lower() else "notas"
            destino = f.with_suffix(".xlsx")
            libro += anonimizar_libro(f, destino, mapper, tipo)
            if f.suffix.lower() == ".xls":
                f.unlink()              # el .xls original llevaba los nombres
                convertidos += 1
    borrados = [p.name for p in carpeta.glob("colegio_*_procesado.csv")]
    for nombre in borrados:
        (carpeta / nombre).unlink()

    filas = libro_unico(libro)
    ruta_libro.parent.mkdir(parents=True, exist_ok=True)
    with open(ruta_libro, "w", encoding="utf-8-sig", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["codigo", "nombre", "salon", "n_lista"])
        w.writerows([[r["codigo"], r["nombre"], r["salon"], r["n_alumno"]] for r in filas])
    return {"archivos": len(archivos), "xls_convertidos": convertidos, "csv_borrados": borrados,
            "alumnos_en_el_libro": len(filas), "codigos": mapper.total}


def verificar(carpeta: Path, ruta_libro: Path) -> list[str]:
    """Nombres del libro que SIGUEN apareciendo en alguna celda de la carpeta (debe devolver [])."""
    with open(ruta_libro, encoding="utf-8-sig", newline="") as fh:
        nombres = {normalizar_nombre(r["nombre"]) for r in csv.DictReader(fh)}
    nombres = {n for n in nombres if len(n) > 6}
    texto = ""
    for f in carpeta.iterdir():
        if f.suffix.lower() in (".xls", ".xlsx"):
            for df in pd.read_excel(f, sheet_name=None, header=None, dtype=str).values():
                texto += " " + " ".join(df.fillna("").astype(str).to_numpy().ravel())
        elif f.suffix.lower() == ".csv":
            texto += " " + f.read_text(encoding="utf-8", errors="ignore")
    texto = normalizar_nombre(texto)
    return sorted(n for n in nombres if n in texto)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ie", required=True, help="Código IE (sin ceros a la izquierda)")
    ap.add_argument("--carpeta", required=True, type=Path)
    ap.add_argument("--libro", required=True, type=Path, help="CSV de salida con el libro de claves")
    ap.add_argument("--mapa", type=Path, default=None,
                    help="Mapa de seudónimos (por defecto modelo/model/colegio_{ie}_seudonimos.json)")
    ap.add_argument("--verificar", action="store_true", help="Solo comprobar que no quedan nombres del libro en la carpeta")
    a = ap.parse_args()
    if a.verificar:
        restos = verificar(a.carpeta, a.libro)
        print(f"{'OK: ningún nombre del libro queda en' if not restos else f'ATENCIÓN: {len(restos)} nombres siguen en'} {a.carpeta}")
        sys.exit(0 if not restos else 1)
    ie = a.ie.lstrip("0") or a.ie
    mapa = a.mapa or (Path(__file__).resolve().parents[1] / "model" / f"colegio_{ie}_seudonimos.json")
    resumen = migrar(a.carpeta, ie, mapa, a.libro)
    print("Migración lista:", resumen)
    print(f"Libro de claves → {a.libro}  (guárdalo fuera del servidor y del repo)")
