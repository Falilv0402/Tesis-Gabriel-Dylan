# -*- coding: utf-8 -*-
"""
reestructurar_hu_cp_v2.py -- Limpieza y ampliación de las HU/CP:

1) Elimina 5 HU duplicadas/ambiguas (con evidencia real en el código):
   HU009, HU010, HU021, HU022, HU026 -- y sus CP correspondientes.
2) Rescata el único caso útil de HU022 (esc2 "Colegio sin modelo propio")
   moviéndolo a HU008 como su nuevo esc2 (reemplaza el esc2 genérico
   "No hay datos disponibles").
3) Agrega 4 HU nuevas -- funcionalidades reales que ya existen en la app
   pero nunca se documentaron, más la de respaldo/restauración que se
   acaba de conectar a la API (ver colegio_propio.py):
     - Director gestiona el rol de su equipo   (EP01)
     - Editar mi perfil                         (EP01)
     - Notificaciones de equipo                 (EP04)
     - Respaldo y restauración del modelo       (EP07)
4) Renumera TODO secuencialmente (HU001..HU035, CP001..CP0NN) y reconstruye
   EPICAS, LISTA CP y cada pestaña individual de CP.

Parte de v1.5 (HU) / v1.4 (CP) y guarda como v1.6 / v1.5.
"""
import openpyxl
from openpyxl.utils import get_column_letter

HU_SRC = r"C:\Users\Usuario\Downloads\P20261012_Historias de Usuario y Criterios de Validacion v1.5.xlsx"
HU_OUT_DL = r"C:\Users\Usuario\Downloads\P20261012_Historias de Usuario y Criterios de Validacion v1.6.xlsx"
HU_OUT_REPO = r"C:\Users\Usuario\OneDrive\Escritorio\TesisDG-ML\PROYECTO-TESIS-DG\docs\excel\P20261012_Historias de Usuario y Criterios de Validacion v1.6.xlsx"

CP_SRC = r"C:\Users\Usuario\Downloads\P20261012_Casos de Prueba v1.4.xlsx"
CP_OUT_DL = r"C:\Users\Usuario\Downloads\P20261012_Casos de Prueba v1.5.xlsx"
CP_OUT_REPO = r"C:\Users\Usuario\OneDrive\Escritorio\TesisDG-ML\PROYECTO-TESIS-DG\docs\excel\P20261012_Casos de Prueba v1.5.xlsx"

DROP_HU = {"HU009", "HU010", "HU021", "HU022", "HU026"}

# ═══════════════════════════════════════════════════════════════════════════
# 1) Leer HU existentes
# ═══════════════════════════════════════════════════════════════════════════
wb_hu = openpyxl.load_workbook(HU_SRC)
ws_hu = wb_hu["HU"]


def leer_hus(ws):
    records = []
    row, cur = 3, None
    while row <= ws.max_row:
        id_val = ws.cell(row=row, column=2).value
        if id_val:
            cur = {
                "id": id_val,
                "rol": ws.cell(row=row, column=3).value,
                "quiere": ws.cell(row=row, column=4).value,
                "para": ws.cell(row=row, column=5).value,
                "esc": [],
            }
            records.append(cur)
        esc_num = ws.cell(row=row, column=6).value
        if esc_num:
            cur["esc"].append({
                "num": esc_num,
                "nombre": ws.cell(row=row, column=7).value,
                "dado": ws.cell(row=row, column=8).value,
                "cuando": ws.cell(row=row, column=9).value,
                "entonces": ws.cell(row=row, column=10).value,
            })
        row += 1
    return records


hu_records = leer_hus(ws_hu)
assert len(hu_records) == 36, f"esperaba 36 HU, hay {len(hu_records)}"
by_id = {r["id"]: r for r in hu_records}

# Rescate: HU022-esc2 -> nuevo esc2 de HU008 (reemplaza el genérico existente)
hu008_esc2 = next(e for e in by_id["HU008"]["esc"] if e["num"] == 2)
hu008_esc2["nombre"] = "Sin modelo propio configurado"
hu008_esc2["dado"] = "Colegio sin modelo propio entrenado todavía"
hu008_esc2["cuando"] = "Accede al panel de niveles de riesgo"
hu008_esc2["entonces"] = (
    "Sistema muestra el estado 'Sin modelo propio configurado' (con acceso "
    "directo a Datos para subir el Excel) en vez del panel de niveles"
)

# ═══════════════════════════════════════════════════════════════════════════
# 2) Leer EPICAS existentes (para conservar label/objetivo tal cual)
# ═══════════════════════════════════════════════════════════════════════════
epi_old = wb_hu["EPICAS"]
EPICA_ROWS = [(3, 8), (9, 13), (14, 20), (21, 25), (26, 30), (31, 34), (35, 38)]
epicas_old = []
for start, end in EPICA_ROWS:
    label = epi_old.cell(row=start, column=2).value
    obj = epi_old.cell(row=start, column=3).value
    hu_ids = [epi_old.cell(row=r, column=4).value for r in range(start, end + 1)]
    epicas_old.append({"label": label, "obj": obj, "hu_ids": hu_ids})

assert epicas_old[0]["hu_ids"][:2] == ["HU001", "HU002"]
assert epicas_old[4]["hu_ids"][-1] == "HU036"

# ═══════════════════════════════════════════════════════════════════════════
# 3) Definir las 4 HU nuevas
# ═══════════════════════════════════════════════════════════════════════════
NEW_HU = {
    "DIRECTOR_ROL": {
        "rol": "Director",
        "quiere": "cambiar el rol de mi equipo (Director ↔ Coordinador) dentro de mi propio colegio",
        "para": "no depender de un Administrador para cada ajuste",
        "esc": [
            {"num": 1, "nombre": "Cambio exitoso dentro del colegio",
             "dado": "Cuenta de Director o Coordinador de su mismo colegio seleccionada",
             "cuando": "Cambia el rol desde el selector en \"Mi equipo\"",
             "entonces": "Sistema actualiza el rol y registra el cambio en auditoría"},
            {"num": 2, "nombre": "Bloqueo fuera de su alcance",
             "dado": "Cuenta de otro colegio, o de un Admin/Superadmin",
             "cuando": "Intenta modificar ese rol (aunque el frontend no ofrezca el selector para esos casos)",
             "entonces": "La política de la base de datos (RLS) rechaza el cambio y no se modifica ninguna fila"},
        ],
    },
    "EDITAR_PERFIL": {
        "rol": "Cualquier usuario autenticado",
        "quiere": "personalizar mi cuenta (foto, nombre, materia que enseño, correo y contraseña)",
        "para": "mantener mis datos actualizados y ser más reconocible para el equipo",
        "esc": [
            {"num": 1, "nombre": "Foto de perfil actualizada",
             "dado": "Imagen válida (JPG/PNG) de hasta 3MB",
             "cuando": "Selecciona una foto en \"Editar perfil\"",
             "entonces": "Sistema la sube de inmediato y la refleja en su avatar"},
            {"num": 2, "nombre": "Archivo inválido rechazado",
             "dado": "Archivo que no es una imagen, o pesa más de 3MB",
             "cuando": "Intenta subirlo como foto de perfil",
             "entonces": "Sistema rechaza el archivo e indica el motivo, sin modificar la foto actual"},
            {"num": 3, "nombre": "Datos guardados",
             "dado": "Nombre, apellidos y/o materia editados",
             "cuando": "Selecciona \"Guardar cambios\"",
             "entonces": "Sistema actualiza el perfil y lo confirma con un mensaje de éxito"},
        ],
    },
    "NOTIFICACIONES": {
        "rol": "Director / Coordinador",
        "quiere": "enterarme cuando otro miembro de mi colegio anota o agenda un hito sobre un alumno",
        "para": "no tener que revisar cada alumno manualmente para estar al tanto",
        "esc": [
            {"num": 1, "nombre": "Notificación recibida",
             "dado": "Otro Director/Coordinador de su mismo colegio registra una anotación o un hito",
             "cuando": "Se guarda esa anotación o hito",
             "entonces": "Sistema crea una notificación para cada Director/Coordinador activo del colegio (menos el autor) y la campana la muestra en tiempo real"},
            {"num": 2, "nombre": "Marcar como leída no afecta a los demás",
             "dado": "Notificación sin leer en su propia bandeja",
             "cuando": "La marca como leída (una o todas)",
             "entonces": "Sistema actualiza solo su copia; la de los demás destinatarios sigue como estaba"},
        ],
    },
    "RESPALDO_MODELO": {
        "rol": "Administrador del Sistema",
        "quiere": "que el sistema respalde el modelo anterior antes de cada reentrenamiento, y poder restaurarlo",
        "para": "no perder un modelo bueno si un Excel con datos malos lo arruina",
        "esc": [
            {"num": 1, "nombre": "Respaldo automático",
             "dado": "El colegio ya tenía un modelo entrenado",
             "cuando": "Se sube un nuevo Excel y el sistema reentrena",
             "entonces": "Sistema guarda una copia con fecha del modelo anterior antes de sobrescribirlo"},
            {"num": 2, "nombre": "Restauración exitosa",
             "dado": "Hay al menos un respaldo disponible para el colegio",
             "cuando": "Selecciona \"Restaurar modelo anterior\" en Datos",
             "entonces": "Sistema revierte el modelo al respaldo más reciente y confirma la fecha restaurada"},
        ],
    },
}

# ═══════════════════════════════════════════════════════════════════════════
# 4) Armar el orden final de épicas/HU y asignar IDs nuevos secuenciales
# ═══════════════════════════════════════════════════════════════════════════
INSERCIONES = {0: ["DIRECTOR_ROL", "EDITAR_PERFIL"], 3: ["NOTIFICACIONES"], 6: ["RESPALDO_MODELO"]}

final_epicas = []
for i, ep in enumerate(epicas_old):
    kept = [h for h in ep["hu_ids"] if h not in DROP_HU]
    kept += INSERCIONES.get(i, [])
    final_epicas.append({"label": ep["label"], "obj": ep["obj"], "hu_ids": kept})

old_to_new_hu = {}
final_hu_order = []  # [(new_id, record)]
counter = 1
for ep in final_epicas:
    for hid in ep["hu_ids"]:
        new_id = f"HU{counter:03d}"
        rec = by_id[hid] if hid in by_id else NEW_HU[hid]
        if hid in by_id:
            old_to_new_hu[hid] = new_id
        final_hu_order.append((new_id, rec))
        counter += 1

TOTAL_HU = counter - 1
assert TOTAL_HU == 35, f"esperaba 35 HU finales, salieron {TOTAL_HU}"
print(f"HU finales: {TOTAL_HU}")

# ═══════════════════════════════════════════════════════════════════════════
# 5) Reescribir hoja "HU"
# ═══════════════════════════════════════════════════════════════════════════
# Limpiar filas de datos existentes (desde la 3) preservando estilos de header.
for m in list(ws_hu.merged_cells.ranges):
    if m.min_row >= 3:
        ws_hu.unmerge_cells(str(m))
for row in ws_hu.iter_rows(min_row=3, max_row=ws_hu.max_row):
    for cell in row:
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
    for i, esc in enumerate(rec["esc"]):
        r = start_row + i
        ws_hu.cell(row=r, column=6).value = esc["num"]
        ws_hu.cell(row=r, column=7).value = esc["nombre"]
        ws_hu.cell(row=r, column=8).value = esc["dado"]
        ws_hu.cell(row=r, column=9).value = esc["cuando"]
        ws_hu.cell(row=r, column=10).value = esc["entonces"]
    row = start_row + n_esc

LAST_HU_ROW = row - 1
print(f"HU sheet: filas 3..{LAST_HU_ROW}")

# ═══════════════════════════════════════════════════════════════════════════
# 6) Reescribir hoja "EPICAS"
# ═══════════════════════════════════════════════════════════════════════════
for m in list(epi_old.merged_cells.ranges):
    epi_old.unmerge_cells(str(m))
for row_ in epi_old.iter_rows(min_row=3, max_row=epi_old.max_row):
    for cell in row_:
        cell.value = None

row = 3
for ep in final_epicas:
    n = len(ep["hu_ids"])
    start_row = row
    end_row = start_row + n - 1
    epi_old.cell(row=start_row, column=2).value = ep["label"]
    epi_old.cell(row=start_row, column=3).value = ep["obj"]
    if n > 1:
        epi_old.merge_cells(start_row=start_row, start_column=2, end_row=end_row, end_column=2)
        epi_old.merge_cells(start_row=start_row, start_column=3, end_row=end_row, end_column=3)
    for i, hid in enumerate(ep["hu_ids"]):
        new_id = old_to_new_hu[hid] if hid in old_to_new_hu else None
        if new_id is None:
            # Es una de las HU nuevas: buscar su new_id ya asignado.
            new_id = next(nid for nid, rec in final_hu_order if rec is NEW_HU.get(hid))
        epi_old.cell(row=start_row + i, column=4).value = new_id
    row = end_row + 1

print(f"EPICAS: filas 3..{row - 1}")

wb_hu.save(HU_OUT_DL)
wb_hu.save(HU_OUT_REPO)
print("guardado:", HU_OUT_DL)

# ═══════════════════════════════════════════════════════════════════════════
# 7) Volcar el mapeo HU viejo->nuevo para que el script de CP lo reutilice
#    (evita reimplementar esta misma lógica dos veces y que se desincronicen).
# ═══════════════════════════════════════════════════════════════════════════
import json

new_hu_key_by_ref = {}
for nid, rec in final_hu_order:
    for key, val in NEW_HU.items():
        if val is rec:
            new_hu_key_by_ref[key] = nid

mapping_out = {
    "old_to_new_hu": old_to_new_hu,       # {"HU007": "HU009", ...} solo para HU viejas conservadas
    "new_hu_key_to_new_id": new_hu_key_by_ref,  # {"DIRECTOR_ROL": "HU007", ...}
    "drop_hu": sorted(DROP_HU),
}
with open(r"C:\Users\Usuario\OneDrive\Escritorio\TesisDG-ML\PROYECTO-TESIS-DG\docs\_hu_mapping.json", "w", encoding="utf-8") as f:
    json.dump(mapping_out, f, ensure_ascii=False, indent=2)
print("mapeo guardado en docs/_hu_mapping.json")
