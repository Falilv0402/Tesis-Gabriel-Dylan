# -*- coding: utf-8 -*-
"""Verifica las correcciones aplicadas por corregir_incidencias_hu_cp.py."""
from pathlib import Path

import openpyxl

DOCS = Path(__file__).resolve().parent
EXCEL_DIR = DOCS / "excel"
HU = EXCEL_DIR / "P20261012_Historias de Usuario y Criterios de Validacion v2.0.xlsx"
CP = EXCEL_DIR / "P20261012_Casos de Prueba v1.9.xlsx"

wb_hu = openpyxl.load_workbook(HU, data_only=True)
ws_hu = wb_hu["HU"]

last_id = None
rows = {}
for r in range(3, ws_hu.max_row + 1):
    hid = ws_hu.cell(r, 2).value
    if hid:
        last_id = hid
    esc = ws_hu.cell(r, 6).value
    rows[(last_id, esc)] = ws_hu.cell(r, 10).value

# --- HU018 ---
hu018 = rows[("HU018", 1)]
assert "EM2022" not in hu018, "HU018 todavia menciona el mensaje generico viejo"
assert "BAJO →" in hu018 and "MEDIO →" in hu018 and "ALTO" in hu018, "HU018 no enumera las reglas"
print("[OK] HU018-1 define la regla por nivel/tipo de riesgo")

# --- HU019 ---
hu019 = rows[("HU019", 1)]
assert "HU020" not in hu019, "HU019 sigue referenciando mal a HU020"
assert "HU018" in hu019, "HU019 deberia referenciar HU018"
assert "si la descripción quedó vacía, usa el texto" not in hu019, "HU019 sigue mezclando comportamientos"
print("[OK] HU019-1 ya no mezcla condiciones y referencia HU018 correctamente")

# --- HU021 / HU022 ---
hu021 = rows[("HU021", 1)]
hu022 = rows[("HU022", 1)]
for name, text in (("HU021", hu021), ("HU022", hu022)):
    assert "cualquier usuario autenticado" not in text, f"{name} sigue documentando la fuga de RLS"
    assert "mismo equipo" in text and "misma IE" in text, f"{name} no documenta el alcance real (equipo del colegio)"
    assert "queda la deja" not in text, f"{name} quedo con una frase rota (queda la deja visible)"
print("[OK] HU021-1 y HU022-1 documentan el alcance real (equipo del colegio, no cualquiera)")

assert ws_hu.max_row == 80, f"HU deberia tener 80 filas de datos, tiene {ws_hu.max_row}"
print("[OK] HU: 80 filas intactas (sin filas perdidas ni agregadas de mas)")

# ------------------------------------------------------------------
wb_cp = openpyxl.load_workbook(CP, data_only=True)
cp_tabs = [n for n in wb_cp.sheetnames if n.startswith("CP") and n != "LISTA CP"]
assert len(cp_tabs) == 78, f"Deberian ser 78 pestanas CP, hay {len(cp_tabs)}"
print(f"[OK] 78 pestanas CP presentes")

def get_field(ws, label_prefix, col_offset=0):
    for r in range(1, ws.max_row + 1):
        v = ws.cell(r, 1).value
        if v is not None and str(v).strip().startswith(label_prefix):
            return ws.cell(r, 1 + col_offset).value if col_offset else v
    return None

# --- Autor en las 78 pestanas ---
bad_autor = []
for name in cp_tabs:
    ws = wb_cp[name]
    autor = get_field(ws, "Autor:", col_offset=1)
    if autor != "Gabriel Torres":
        bad_autor.append((name, autor))
assert not bad_autor, f"Pestanas con Autor incorrecto: {bad_autor}"
print("[OK] Las 78 pestanas CP tienen Autor = 'Gabriel Torres'")

# --- LISTA CP descripciones ---
ws_lista = wb_cp["LISTA CP"]
desc_by_id = {}
for r in range(3, ws_lista.max_row + 1):
    cp_id = ws_lista.cell(r, 2).value
    if cp_id:
        desc_by_id[cp_id] = ws_lista.cell(r, 3).value
assert "EM2022" not in desc_by_id["CP042"], "LISTA CP / CP042 sigue con el texto generico viejo"
assert "HU020" not in desc_by_id["CP044"], "LISTA CP / CP044 sigue referenciando HU020"
print("[OK] LISTA CP: CP042 y CP044 actualizadas")

# --- Precondiciones concretas ---
concretas = {
    "CP024": "Bimestre 3",
    "CP025": "docker compose stop backend",
    "CP028": "831305",
    "CP029": "padron",
    "CP030": "831305",
}
for cp_id, needle in concretas.items():
    precond = get_field(wb_cp[cp_id], "Precondiciones:")
    assert needle in precond, f"{cp_id}: precondicion no tiene el dato concreto esperado ({needle!r})"
print("[OK] CP024/025/028/029/030: precondiciones con datos concretos y reproducibles")

# --- CP026: pasos corregidos ---
ws026 = wb_cp["CP026"]
pasos026 = " | ".join(str(ws026.cell(r, 2).value) for r in range(7, 10) if ws026.cell(r, 2).value)
resultados026 = " | ".join(str(ws026.cell(r, 3).value) for r in range(7, 10) if ws026.cell(r, 3).value)
assert "Predecir alumnos en riesgo" not in pasos026, "CP026 todavia tiene el flujo viejo"
assert "ingresar filtros" not in resultados026, "CP026 todavia describe el formulario de filtros viejo"
assert "ya calculado" in resultados026, "CP026 no describe el flujo real (niveles ya calculados)"
assert ws026.cell(10, 1).value is None, "CP026 deberia tener solo 3 pasos, quedo un rastro del paso 4 viejo"
print("[OK] CP026: pasos ya coinciden con el flujo real de HU010-1")

# --- CP042 / CP044 resultado concreto ---
res042 = None
ws042 = wb_cp["CP042"]
for r in range(1, ws042.max_row + 1):
    if ws042.cell(r, 1).value == 2:
        res042 = ws042.cell(r, 3).value
assert res042 and "Refuerzo en Matematica" in res042, "CP042 no tiene el texto concreto esperado"
print("[OK] CP042: resultado esperado con texto concreto")

# --- CP048 / CP050 postcondiciones ---
for cp_id in ("CP048", "CP050"):
    post = get_field(wb_cp[cp_id], "Postcondiciones:")
    assert "cualquier usuario autenticado" not in post, f"{cp_id} sigue documentando la fuga de RLS"
    assert "equipo de ese colegio" in post, f"{cp_id} no documenta el alcance real"
print("[OK] CP048 y CP050: postcondiciones ya reflejan el alcance real")

print("\nTODAS LAS VERIFICACIONES PASARON.")
