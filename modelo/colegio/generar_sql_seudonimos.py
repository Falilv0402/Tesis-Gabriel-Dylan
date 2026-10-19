"""
generar_sql_seudonimos.py — SQL para quitar los nombres de alumnos que ya quedaron guardados en Supabase.

Hay dos tablas que guardan `estudiante_nombre` (y un mensaje que lo menciona): `notificaciones` y `plan_estado`.
El SQL generado reemplaza ese nombre por el seudónimo del alumno ("Estudiante 000123") y deja el mensaje de las
notificaciones en un texto genérico; lo que no coincida con ningún alumno actual queda con un nombre genérico.

El SQL solo lleva seudónimos e identificadores del alumno (colegio-salón-N.° de lista), nunca nombres reales: se
puede pegar en el SQL Editor de Supabase sin que el historial de la consulta guarde nombres.

No toca los textos libres que escriben las personas (`anotaciones.contenido`, `plan_hitos.texto`, comentarios):
si ahí se escribió un nombre, hay que corregirlo a mano.

Uso:  python generar_sql_seudonimos.py --ie 831305 864785 9001 249 > limpiar_nombres.sql
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import joblib


def _sql(texto: str) -> str:
    return "'" + str(texto).replace("'", "''") + "'"


def generar_sql(model_dir: Path, ies: list[str]) -> str:
    filas: list[tuple[str, str]] = []
    for ie in ies:
        ie_archivo = ie.lstrip("0") or ie
        art = joblib.load(Path(model_dir) / f"colegio_{ie_archivo}.pkl")
        for p in art["predicciones"]:
            # mismo formato que `colegioStudentId` del front: "{codigo_ie}-{salón}-{N.° de lista}"
            filas.append((f"{p['codigo_ie']}-{p['salon']}-{p['n_alumno']}", p["nombre"]))
    if any(not str(seud).startswith("Estudiante ") for _, seud in filas):
        raise SystemExit("Hay alumnos sin seudónimo en el modelo: migra y reentrena antes de generar este SQL.")

    valores = ",\n  ".join(f"({_sql(i)}, {_sql(s)})" for i, s in filas)
    return f"""-- Limpieza de nombres de alumnos en Supabase (solo seudónimos). {len(filas)} alumnos de IE {', '.join(ies)}.
-- Pegar en Supabase > SQL Editor y ejecutar una vez. Es idempotente.

WITH m(id, seud) AS (VALUES
  {valores}
),
n AS (
  UPDATE public.notificaciones x
     SET estudiante_nombre = m.seud,
         mensaje = coalesce(x.autor_nombre, 'Alguien') || ' registró una actividad sobre ' || m.seud || '.'
    FROM m
   WHERE ltrim(x.estudiante_id, '0') = ltrim(m.id, '0')
  RETURNING 1
),
p AS (
  UPDATE public.plan_estado y
     SET estudiante_nombre = m.seud
    FROM m
   WHERE ltrim(y.estudiante_id, '0') = ltrim(m.id, '0')
  RETURNING 1
)
SELECT (SELECT count(*) FROM n) AS notificaciones_con_codigo, (SELECT count(*) FROM p) AS planes_con_codigo;

-- Lo que no corresponde a ningún alumno actual (alumnos que ya no están en el Excel) queda con un nombre genérico.
UPDATE public.notificaciones
   SET estudiante_nombre = 'Estudiante (sin código)',
       mensaje = coalesce(autor_nombre, 'Alguien') || ' registró una actividad sobre un alumno.'
 WHERE estudiante_nombre IS NOT NULL AND estudiante_nombre NOT LIKE 'Estudiante %';
UPDATE public.plan_estado
   SET estudiante_nombre = 'Estudiante (sin código)'
 WHERE estudiante_nombre IS NOT NULL AND estudiante_nombre NOT LIKE 'Estudiante %';

-- Comprobación: ambos conteos deben ser 0.
SELECT (SELECT count(*) FROM public.notificaciones WHERE estudiante_nombre IS NOT NULL AND estudiante_nombre NOT LIKE 'Estudiante%') AS notificaciones_con_nombre,
       (SELECT count(*) FROM public.plan_estado     WHERE estudiante_nombre IS NOT NULL AND estudiante_nombre NOT LIKE 'Estudiante%') AS planes_con_nombre;
"""


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ie", nargs="+", required=True)
    ap.add_argument("--modelos", type=Path, default=Path(__file__).resolve().parents[1] / "model")
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stdout.write(generar_sql(a.modelos, a.ie))
