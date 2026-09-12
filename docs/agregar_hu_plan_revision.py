# -*- coding: utf-8 -*-
"""
agregar_hu_plan_revision.py -- Agrega la HU nueva del flujo "Coordinador
propone, Director aprueba" (pedido explícito de Mathias, 2026-09-12),
recién construido y verificado en vivo (respaldo/restauración de HU039 no
tiene relación; esta es la pestaña "Equipo" + estado del plan de hitos).

Se inserta al final de EP04 (Priorización e Intervención), después de la
HU de notificaciones -- misma familia temática (coordinación de equipo
alrededor de un alumno). Todo lo demás se renumera automáticamente.

Parte de v1.7 (HU) / v1.6 (CP) y guarda como v1.8 / v1.7.
"""
import openpyxl

HU_SRC = r"C:\Users\Usuario\Downloads\P20261012_Historias de Usuario y Criterios de Validacion v1.7.xlsx"
HU_OUT_DL = r"C:\Users\Usuario\Downloads\P20261012_Historias de Usuario y Criterios de Validacion v1.8.xlsx"
HU_OUT_REPO = r"C:\Users\Usuario\OneDrive\Escritorio\TesisDG-ML\PROYECTO-TESIS-DG\docs\excel\P20261012_Historias de Usuario y Criterios de Validacion v1.8.xlsx"

CP_SRC = r"C:\Users\Usuario\Downloads\P20261012_Casos de Prueba v1.6.xlsx"
CP_OUT_DL = r"C:\Users\Usuario\Downloads\P20261012_Casos de Prueba v1.7.xlsx"
CP_OUT_REPO = r"C:\Users\Usuario\OneDrive\Escritorio\TesisDG-ML\PROYECTO-TESIS-DG\docs\excel\P20261012_Casos de Prueba v1.7.xlsx"

NEW_HU = {
    "rol": "Coordinador Académico",
    "quiere": "enviar el plan de seguimiento (hitos) de un alumno a revisión de mi Director, para que lo apruebe o pida cambios antes de darlo por definitivo",
    "para": "tener la validación del Director antes de considerar el plan como definitivo",
    "esc": [
        {"num": 1, "nombre": "Envío exitoso",
         "dado": "Alumno con al menos un hito definido en su plan",
         "cuando": "Selecciona \"Enviar a revisión\"",
         "entonces": "Sistema marca el plan como \"En revisión\" y notifica a todo el equipo del colegio (Director y Coordinadores, menos quien lo envía)"},
        {"num": 2, "nombre": "Director aprueba",
         "dado": "Plan en revisión",
         "cuando": "El Director selecciona \"Aprobar\" (desde el detalle del alumno o desde la cola \"Planes a revisión\" en su pestaña \"Equipo\")",
         "entonces": "Sistema marca el plan como \"Aprobado\" y notifica puntualmente a quien lo envió"},
        {"num": 3, "nombre": "Director pide cambios",
         "dado": "Plan en revisión",
         "cuando": "El Director selecciona \"Pedir cambios\" y escribe un comentario",
         "entonces": "Sistema marca el plan como \"Rechazado\" con ese comentario visible, notifica puntualmente a quien lo envió, y vuelve a habilitar \"Enviar a revisión\" para que lo reenvíe"},
    ],
}

NEW_CP = [
    {
        "nombre": "Envío exitoso",
        "descripcion": "Validar que el sistema marque el plan como \"En revisión\" y notifique a todo el equipo del colegio",
        "autor": "Coordinador Académico",
        "precondiciones": "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Alumno con al menos un hito en su plan",
        "pasos": [
            ("Usuario esta loggeado como Coordinador y abre el Plan del alumno", "Aplicación muestra el botón \"Enviar a revisión\""),
            ("Usuario selecciona \"Enviar a revisión\"", "Aplicación marca el plan como \"En revisión\" y notifica al equipo del colegio"),
        ],
        "tipo": "Manual", "prioridad": "Alta", "requerimientos": "Cuenta Coordinador, alumno con hitos definidos",
        "postcondiciones": "Sistema deja el plan en estado \"En revisión\", visible para el Director en su cola de \"Planes a revisión\"",
    },
    {
        "nombre": "Director aprueba",
        "descripcion": "Validar que el Director pueda aprobar un plan en revisión y que se notifique a quien lo envió",
        "autor": "Director",
        "precondiciones": "La aplicacion esta instalada y operativa. Se esta loggeado como Director. Plan de un alumno en estado \"En revisión\"",
        "pasos": [
            ("Director abre \"Equipo\" o el detalle del alumno", "Aplicación muestra el plan en revisión con los botones \"Aprobar\" y \"Pedir cambios\""),
            ("Director selecciona \"Aprobar\"", "Aplicación marca el plan como \"Aprobado\" y notifica a quien lo envió"),
        ],
        "tipo": "Manual", "prioridad": "Alta", "requerimientos": "Cuenta Director, plan en revisión",
        "postcondiciones": "Sistema deja el plan en estado \"Aprobado\" y notifica al Coordinador que lo envió",
    },
    {
        "nombre": "Director pide cambios",
        "descripcion": "Validar que el Director pueda pedir cambios con un comentario y que el plan pueda reenviarse a revisión",
        "autor": "Director",
        "precondiciones": "La aplicacion esta instalada y operativa. Se esta loggeado como Director. Plan de un alumno en estado \"En revisión\"",
        "pasos": [
            ("Director selecciona \"Pedir cambios\"", "Aplicación muestra un campo de texto para el comentario"),
            ("Director escribe el comentario y selecciona \"Confirmar\"", "Aplicación marca el plan como \"Rechazado\" con ese comentario, notifica a quien lo envió, y vuelve a mostrar \"Enviar a revisión\""),
        ],
        "tipo": "Manual", "prioridad": "Media", "requerimientos": "Cuenta Director, plan en revisión",
        "postcondiciones": "Sistema deja el plan en estado \"Rechazado\" con el comentario visible, listo para que el Coordinador lo corrija y reenvíe",
    },
]

# ═══════════════════════════════════════════════════════════════════════════
# 1) HU + EPICAS
# ═══════════════════════════════════════════════════════════════════════════
wb_hu = openpyxl.load_workbook(HU_SRC)
ws_hu = wb_hu["HU"]


def leer_hus(ws):
    records, row, cur = [], 3, None
    while row <= ws.max_row:
        id_val = ws.cell(row=row, column=2).value
        if id_val:
            cur = {"id": id_val, "rol": ws.cell(row=row, column=3).value,
                   "quiere": ws.cell(row=row, column=4).value,
                   "para": ws.cell(row=row, column=5).value, "esc": []}
            records.append(cur)
        esc_num = ws.cell(row=row, column=6).value
        if esc_num:
            cur["esc"].append({
                "num": esc_num, "nombre": ws.cell(row=row, column=7).value,
                "dado": ws.cell(row=row, column=8).value,
                "cuando": ws.cell(row=row, column=9).value,
                "entonces": ws.cell(row=row, column=10).value,
            })
        row += 1
    return records


hu_old = leer_hus(ws_hu)
assert len(hu_old) == 32, f"esperaba 32 HU en v1.7, hay {len(hu_old)}"
by_id = {r["id"]: r for r in hu_old}

epi = wb_hu["EPICAS"]
epicas_old, row = [], 3
while row <= epi.max_row:
    label = epi.cell(row=row, column=2).value
    if label:
        start = row
        obj = epi.cell(row=row, column=3).value
        hu_ids = []
        r = row
        while r <= epi.max_row and (r == start or not epi.cell(row=r, column=2).value):
            hid = epi.cell(row=r, column=4).value
            if hid:
                hu_ids.append(hid)
            r += 1
        epicas_old.append({"label": label, "obj": obj, "hu_ids": hu_ids})
        row = r
    else:
        row += 1

assert sum(len(e["hu_ids"]) for e in epicas_old) == 32, "EPICAS no suman 32 HU"
ep04 = next(e for e in epicas_old if e["label"].startswith("EP04"))
assert ep04["hu_ids"][-1] == "HU020", f"esperaba que EP04 termine en HU020, termina en {ep04['hu_ids'][-1]}"
ep04["hu_ids"].append("__NEW__")

old_to_new_hu, final_hu_order, counter = {}, [], 1
for ep in epicas_old:
    for hid in ep["hu_ids"]:
        new_id = f"HU{counter:03d}"
        if hid == "__NEW__":
            rec = NEW_HU
        else:
            rec = by_id[hid]
            old_to_new_hu[hid] = new_id
        final_hu_order.append((new_id, rec))
        counter += 1

TOTAL_HU = counter - 1
assert TOTAL_HU == 33, f"esperaba 33 HU finales, salieron {TOTAL_HU}"
print(f"HU finales: {TOTAL_HU}")

for m in list(ws_hu.merged_cells.ranges):
    if m.min_row >= 3:
        ws_hu.unmerge_cells(str(m))
for row_ in ws_hu.iter_rows(min_row=3, max_row=ws_hu.max_row):
    for cell in row_:
        cell.value = None

row = 3
for new_id, rec in final_hu_order:
    n_esc = len(rec["esc"])
    start_row = row
    ws_hu.cell(row=start_row, column=2).value = new_id
    ws_hu.cell(row=start_row, column=3).value = rec["rol"]
    ws_hu.cell(row=start_row, column=4).value = rec["quiere"]
    ws_hu.cell(row=start_row, column=5).value = rec["para"]
    if n_esc > 1:
        end_row = start_row + n_esc - 1
        for col in (2, 3, 4, 5):
            ws_hu.merge_cells(start_row=start_row, start_column=col, end_row=end_row, end_column=col)
    for i, e in enumerate(rec["esc"]):
        r = start_row + i
        ws_hu.cell(row=r, column=6).value = e["num"]
        ws_hu.cell(row=r, column=7).value = e["nombre"]
        ws_hu.cell(row=r, column=8).value = e["dado"]
        ws_hu.cell(row=r, column=9).value = e["cuando"]
        ws_hu.cell(row=r, column=10).value = e["entonces"]
    row = start_row + n_esc
print(f"HU sheet: filas 3..{row - 1}")

for m in list(epi.merged_cells.ranges):
    epi.unmerge_cells(str(m))
for row_ in epi.iter_rows(min_row=3, max_row=epi.max_row):
    for cell in row_:
        cell.value = None

row = 3
for ep in epicas_old:
    n = len(ep["hu_ids"])
    start_row, end_row = row, row + n - 1
    epi.cell(row=start_row, column=2).value = ep["label"]
    epi.cell(row=start_row, column=3).value = ep["obj"]
    if n > 1:
        epi.merge_cells(start_row=start_row, start_column=2, end_row=end_row, end_column=2)
        epi.merge_cells(start_row=start_row, start_column=3, end_row=end_row, end_column=3)
    for i, hid in enumerate(ep["hu_ids"]):
        epi.cell(row=start_row + i, column=4).value = old_to_new_hu[hid] if hid != "__NEW__" else next(
            nid for nid, rec in final_hu_order if rec is NEW_HU)
    row = end_row + 1
print(f"EPICAS: filas 3..{row - 1}")

wb_hu.save(HU_OUT_DL)
wb_hu.save(HU_OUT_REPO)
print("guardado:", HU_OUT_DL)

# ═══════════════════════════════════════════════════════════════════════════
# 2) LISTA CP + pestañas
# ═══════════════════════════════════════════════════════════════════════════
wb_cp = openpyxl.load_workbook(CP_SRC)
lst = wb_cp["LISTA CP"]

cps_by_old_hu, row = {}, 3
while row <= lst.max_row:
    cp_id = lst.cell(row=row, column=2).value
    if cp_id:
        hid = lst.cell(row=row, column=4).value
        cps_by_old_hu.setdefault(hid, []).append({
            "old_id": cp_id, "descripcion": lst.cell(row=row, column=3).value,
            "numero": lst.cell(row=row, column=5).value, "nombre": lst.cell(row=row, column=6).value,
        })
    row += 1

total_old_cp = sum(len(v) for v in cps_by_old_hu.values())
assert total_old_cp == 71, f"esperaba 71 CP en v1.6, hay {total_old_cp}"

actions, counter = [], 1
for hu_num in range(1, TOTAL_HU + 1):
    new_hu_id = f"HU{hu_num:03d}"
    old_hid = next((h for h, n in old_to_new_hu.items() if n == new_hu_id), None)
    if old_hid is None:
        for e in NEW_CP:
            new_cp_id = f"CP{counter:03d}"
            actions.append({"new_cp_id": new_cp_id, "new_hu_id": new_hu_id, "kind": "NEW",
                             "numero": NEW_CP.index(e) + 1, "nombre": e["nombre"],
                             "descripcion": e["descripcion"], "content": e})
            counter += 1
    else:
        for cp in cps_by_old_hu[old_hid]:
            new_cp_id = f"CP{counter:03d}"
            actions.append({"new_cp_id": new_cp_id, "new_hu_id": new_hu_id, "kind": "COPY",
                             "old_id": cp["old_id"], "descripcion": cp["descripcion"],
                             "numero": cp["numero"], "nombre": cp["nombre"]})
            counter += 1

TOTAL_CP = counter - 1
print(f"CP finales: {TOTAL_CP}")
assert TOTAL_CP == 74, f"esperaba 74 CP finales, salieron {TOTAL_CP}"

for m in list(lst.merged_cells.ranges):
    if m.min_row >= 3:
        lst.unmerge_cells(str(m))
for row_ in lst.iter_rows(min_row=3, max_row=lst.max_row):
    for cell in row_:
        cell.value = None

for i, a in enumerate(actions):
    r = 3 + i
    lst.cell(row=r, column=2).value = a["new_cp_id"]
    lst.cell(row=r, column=3).value = a["descripcion"]
    lst.cell(row=r, column=4).value = a["new_hu_id"]
    lst.cell(row=r, column=5).value = a["numero"]
    lst.cell(row=r, column=6).value = a["nombre"]

import re
copy_actions = [a for a in actions if a["kind"] == "COPY"]
new_actions = [a for a in actions if a["kind"] == "NEW"]

for a in copy_actions:
    tmp_ws = wb_cp.copy_worksheet(wb_cp[a["old_id"]])
    tmp_ws.title = f"TMP_{a['old_id']}"
for name in list(wb_cp.sheetnames):
    if re.fullmatch(r"CP\d{3}", name):
        del wb_cp[name]
for a in copy_actions:
    ws = wb_cp[f"TMP_{a['old_id']}"]
    ws.title = a["new_cp_id"]
    old_prefix = f"Caso de Prueba: {a['old_id']}:"
    new_prefix = f"Caso de Prueba: {a['new_cp_id']}:"
    a1 = ws["A1"].value or ""
    assert a1.startswith(old_prefix), f"{a['old_id']}: encabezado inesperado: {a1!r}"
    ws["A1"].value = new_prefix + a1[len(old_prefix):]


def crear_pestana_cp(wb, nombre, contenido):
    ws_cp = wb.create_sheet(nombre)
    ws_cp["A1"] = f"Caso de Prueba: {nombre}: {contenido['nombre']}"
    ws_cp["A2"] = "Autor:"; ws_cp["B2"] = contenido["autor"]
    ws_cp["A3"] = f"Precondiciones: {contenido['precondiciones']}"
    ws_cp["A6"] = "#:"; ws_cp["B6"] = "Pasos:"; ws_cp["C6"] = "Resultados Esperados:"
    r = 7
    for i, (paso, resultado) in enumerate(contenido["pasos"], 1):
        ws_cp.cell(row=r, column=1).value = i
        ws_cp.cell(row=r, column=2).value = paso
        ws_cp.cell(row=r, column=3).value = resultado
        r += 1
    ws_cp.cell(row=r, column=1).value = "Tipo de ejecución:"; ws_cp.cell(row=r, column=2).value = contenido["tipo"]; r += 1
    ws_cp.cell(row=r, column=1).value = "Prioridad:"; ws_cp.cell(row=r, column=2).value = contenido["prioridad"]; r += 1
    ws_cp.cell(row=r, column=1).value = "Requerimientos"; ws_cp.cell(row=r, column=2).value = contenido["requerimientos"]; r += 1
    ws_cp.cell(row=r, column=1).value = f"Postcondiciones:\n{contenido['postcondiciones']}"
    return ws_cp


for a in new_actions:
    crear_pestana_cp(wb_cp, a["new_cp_id"], a["content"])

cp_sheet_names = sorted(n for n in wb_cp.sheetnames if re.fullmatch(r"CP\d{3}", n))
expected_names = sorted(a["new_cp_id"] for a in actions)
assert cp_sheet_names == expected_names, "pestañas CP no cuadran con LISTA CP"
assert not any(n.startswith("TMP_") for n in wb_cp.sheetnames)

hu_esc_count = {new_id: len(rec["esc"]) for new_id, rec in final_hu_order}
cp_count_by_hu = {}
for a in actions:
    cp_count_by_hu[a["new_hu_id"]] = cp_count_by_hu.get(a["new_hu_id"], 0) + 1
mismatches = [(hu, hu_esc_count[hu], cp_count_by_hu.get(hu, 0)) for hu in hu_esc_count if hu_esc_count[hu] != cp_count_by_hu.get(hu, 0)]
assert not mismatches, f"desbalance HU/CP: {mismatches}"

wb_cp.save(CP_OUT_DL)
wb_cp.save(CP_OUT_REPO)
print("guardado:", CP_OUT_DL)
print(f"Pestañas CP finales: {len(cp_sheet_names)}")
