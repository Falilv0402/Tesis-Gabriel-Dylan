# -*- coding: utf-8 -*-
"""
reestructurar_cp_v2.py -- Segunda mitad de la reestructuración: reconstruye
LISTA CP y cada pestaña individual siguiendo el mismo mapeo HU viejo->nuevo
que ya escribió reestructurar_hu_cp_v2.py en docs/_hu_mapping.json.

- Los CP de las 5 HU eliminadas (HU009/010/021/022/026 viejas) se eliminan.
- Los CP conservados se COPIAN tal cual (copy_worksheet, mismo formato) y
  solo se renumeran -- ni el contenido de sus pasos ni su Precondiciones
  cambia, salvo el propio ID en el encabezado (celda A1) y la columna HU.
- Se agregan 9 CP nuevos (2+3+2+2) para las 4 HU nuevas.

Parte de v1.4 y guarda como v1.5.
"""
import json
import re
import openpyxl

CP_SRC = r"C:\Users\Usuario\Downloads\P20261012_Casos de Prueba v1.4.xlsx"
CP_OUT_DL = r"C:\Users\Usuario\Downloads\P20261012_Casos de Prueba v1.5.xlsx"
CP_OUT_REPO = r"C:\Users\Usuario\OneDrive\Escritorio\TesisDG-ML\PROYECTO-TESIS-DG\docs\excel\P20261012_Casos de Prueba v1.5.xlsx"
MAPPING_PATH = r"C:\Users\Usuario\OneDrive\Escritorio\TesisDG-ML\PROYECTO-TESIS-DG\docs\_hu_mapping.json"

with open(MAPPING_PATH, encoding="utf-8") as f:
    mapping = json.load(f)
old_to_new_hu = mapping["old_to_new_hu"]
new_hu_key_to_new_id = mapping["new_hu_key_to_new_id"]
DROP_HU = set(mapping["drop_hu"])

# reverse: new_hu_id -> ("OLD", old_hu_id) | ("NEW", key)
reverse = {}
for old, new in old_to_new_hu.items():
    reverse[new] = ("OLD", old)
for key, new in new_hu_key_to_new_id.items():
    reverse[new] = ("NEW", key)
assert len(reverse) == 35

# ═══════════════════════════════════════════════════════════════════════════
# 1) Definir los 9 CP nuevos (mismo orden de escenario que su HU)
# ═══════════════════════════════════════════════════════════════════════════
# Reemplazo de contenido para un CP CONSERVADO: el viejo CP021 (2do CP de la
# vieja HU008 "visualizar nivel de riesgo") probaba el escenario genérico
# "Sin resultados" -- pero ese esc2 de la HU se reemplazó por el rescatado
# de HU022 ("Sin modelo propio configurado", ver reestructurar_hu_cp_v2.py),
# así que su CP también debe reflejar ESE escenario real, no el viejo.
REPLACE_CP = {
    "CP021": {
        "nombre": "Sin modelo propio configurado",
        "descripcion": "Validar que el sistema muestre el estado 'Sin modelo propio configurado' cuando el colegio aún no tiene modelo propio entrenado",
        "autor": "Coordinador Académico",
        "precondiciones": "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Colegio sin modelo propio entrenado todavía",
        "pasos": [
            ("Usuario esta loggeado como Coordinador", "Aplicación muestra el menú principal"),
            ("Usuario accede al panel de niveles de riesgo", "Aplicación muestra el estado \"Sin modelo propio configurado\" en vez del panel de niveles"),
            ("Usuario selecciona el acceso directo a \"Datos\"", "Aplicación lo lleva a la pantalla para subir el Excel del colegio"),
        ],
        "tipo": "Manual", "prioridad": "Media",
        "requerimientos": "Cuenta Coordinador, colegio sin modelo propio entrenado",
        "postcondiciones": "Sistema no muestra ningún nivel de riesgo hasta que el colegio tenga un modelo propio entrenado",
    },
}

NEW_CP = {
    "DIRECTOR_ROL": [
        {
            "nombre": "Cambio exitoso dentro del colegio",
            "descripcion": "Validar que un Director pueda cambiar el rol de una cuenta de su mismo colegio entre Director y Coordinador",
            "autor": "Director",
            "precondiciones": "La aplicacion esta instalada y operativa. Se esta loggeado como Director. Existe otra cuenta (Director o Coordinador) en el mismo colegio",
            "pasos": [
                ("Usuario esta loggeado como Director", "Aplicación muestra \"Mi equipo\" con las cuentas de su colegio"),
                ("Usuario selecciona un nuevo rol en el selector de esa cuenta", "Aplicación actualiza el rol"),
                ("Usuario revisa la auditoría", "Aplicación muestra el cambio de rol registrado"),
            ],
            "tipo": "Manual", "prioridad": "Media",
            "requerimientos": "Cuenta Director, otra cuenta del mismo colegio",
            "postcondiciones": "Sistema actualiza el rol de la cuenta seleccionada y lo deja registrado en auditoría",
        },
        {
            "nombre": "Bloqueo fuera de su alcance",
            "descripcion": "Validar que un Director no pueda cambiar el rol de una cuenta de otro colegio o de un Admin/Superadmin",
            "autor": "Director",
            "precondiciones": "La aplicacion esta instalada y operativa. Se esta loggeado como Director. Existe una cuenta Admin o de otro colegio",
            "pasos": [
                ("Usuario esta loggeado como Director", "Aplicación no muestra selector de rol para esas cuentas"),
                ("Usuario intenta forzar el cambio (ej. una petición directa a la base de datos)", "La política de la base de datos (RLS) rechaza la operación"),
            ],
            "tipo": "Manual", "prioridad": "Alta",
            "requerimientos": "Cuenta Director",
            "postcondiciones": "Sistema no modifica ninguna fila fuera del colegio o rol permitido",
        },
    ],
    "EDITAR_PERFIL": [
        {
            "nombre": "Foto de perfil actualizada",
            "descripcion": "Validar que el sistema suba y muestre de inmediato una foto de perfil válida",
            "autor": "Cualquier usuario autenticado",
            "precondiciones": "La aplicacion esta instalada y operativa. Usuario loggeado. Tiene una imagen JPG/PNG de menos de 3MB",
            "pasos": [
                ("Usuario abre \"Editar perfil\"", "Aplicación muestra el formulario con su foto actual"),
                ("Usuario selecciona una imagen válida", "Aplicación sube la foto de inmediato"),
                ("Usuario revisa su avatar", "Aplicación muestra la nueva foto"),
            ],
            "tipo": "Manual", "prioridad": "Baja",
            "requerimientos": "Cuenta activa",
            "postcondiciones": "Sistema guarda la foto en el perfil del usuario y la refleja en su avatar",
        },
        {
            "nombre": "Archivo inválido rechazado",
            "descripcion": "Validar que el sistema rechace un archivo que no es imagen o pesa más de 3MB al subir la foto de perfil",
            "autor": "Cualquier usuario autenticado",
            "precondiciones": "La aplicacion esta instalada y operativa. Usuario loggeado",
            "pasos": [
                ("Usuario abre \"Editar perfil\"", "Aplicación muestra el formulario"),
                ("Usuario selecciona un archivo que no es imagen o supera 3MB", "Aplicación rechaza el archivo e indica el motivo"),
            ],
            "tipo": "Manual", "prioridad": "Media",
            "requerimientos": "Cuenta activa",
            "postcondiciones": "Sistema no modifica la foto de perfil actual",
        },
        {
            "nombre": "Datos guardados",
            "descripcion": "Validar que el sistema guarde los cambios de nombre, apellidos y materia del perfil",
            "autor": "Cualquier usuario autenticado",
            "precondiciones": "La aplicacion esta instalada y operativa. Usuario loggeado",
            "pasos": [
                ("Usuario abre \"Editar perfil\"", "Aplicación muestra el formulario con sus datos actuales"),
                ("Usuario edita nombre, apellidos y/o materia", "Aplicación habilita \"Guardar cambios\""),
                ("Usuario selecciona \"Guardar cambios\"", "Aplicación actualiza el perfil y confirma con un mensaje de éxito"),
            ],
            "tipo": "Manual", "prioridad": "Baja",
            "requerimientos": "Cuenta activa",
            "postcondiciones": "Sistema guarda los nuevos datos en el perfil del usuario",
        },
    ],
    "NOTIFICACIONES": [
        {
            "nombre": "Notificación recibida",
            "descripcion": "Validar que el resto del equipo del colegio reciba una notificación cuando alguien anota o agenda un hito",
            "autor": "Director / Coordinador",
            "precondiciones": "La aplicacion esta instalada y operativa. Dos cuentas (Director/Coordinador) activas en el mismo colegio",
            "pasos": [
                ("Coordinador A registra una anotación o hito sobre un alumno", "Aplicación guarda la anotación/hito"),
                ("Coordinador B revisa la campana de notificaciones", "Aplicación muestra la notificación en tiempo real"),
            ],
            "tipo": "Manual", "prioridad": "Media",
            "requerimientos": "Dos cuentas del mismo colegio",
            "postcondiciones": "Sistema crea una notificación para cada Director/Coordinador activo del colegio, menos el autor",
        },
        {
            "nombre": "Marcar como leída no afecta a los demás",
            "descripcion": "Validar que marcar una notificación como leída no afecte la copia de los demás destinatarios",
            "autor": "Director / Coordinador",
            "precondiciones": "La aplicacion esta instalada y operativa. Dos cuentas con la misma notificación sin leer",
            "pasos": [
                ("Coordinador B marca la notificación como leída", "Aplicación actualiza solo su copia"),
                ("Coordinador C (otro destinatario) revisa su campana", "Aplicación sigue mostrando esa notificación como no leída"),
            ],
            "tipo": "Manual", "prioridad": "Baja",
            "requerimientos": "Dos cuentas del mismo colegio con la misma notificación",
            "postcondiciones": "Sistema actualiza el estado de lectura de forma independiente por destinatario",
        },
    ],
    "RESPALDO_MODELO": [
        {
            "nombre": "Respaldo automático",
            "descripcion": "Validar que el sistema respalde el modelo anterior antes de sobrescribirlo con un reentrenamiento",
            "autor": "Administrador del Sistema",
            "precondiciones": "La aplicacion esta instalada y operativa. El colegio ya tiene un modelo entrenado",
            "pasos": [
                ("Usuario sube un nuevo Excel de notas/conducta", "Aplicación reentrena el modelo"),
                ("Sistema guarda una copia del modelo anterior antes de sobrescribirlo", "Aplicación deja disponible el respaldo con su fecha"),
            ],
            "tipo": "Automática", "prioridad": "Alta",
            "requerimientos": "Colegio con modelo previo entrenado",
            "postcondiciones": "Sistema guarda el modelo anterior como respaldo antes de aplicar el nuevo",
        },
        {
            "nombre": "Restauración exitosa",
            "descripcion": "Validar que el sistema restaure el modelo al respaldo más reciente",
            "autor": "Administrador del Sistema",
            "precondiciones": "La aplicacion esta instalada y operativa. Hay un respaldo disponible para el colegio",
            "pasos": [
                ("Usuario ve el aviso de respaldo disponible en \"Datos\"", "Aplicación muestra la fecha del respaldo"),
                ("Usuario selecciona \"Restaurar modelo anterior\"", "Aplicación revierte el modelo y confirma la fecha restaurada"),
            ],
            "tipo": "Manual", "prioridad": "Alta",
            "requerimientos": "Respaldo disponible para el colegio",
            "postcondiciones": "Sistema revierte el modelo del colegio al estado del respaldo restaurado",
        },
    ],
}

# ═══════════════════════════════════════════════════════════════════════════
# 2) Leer LISTA CP vieja, agrupada por HU vieja (orden original preservado)
# ═══════════════════════════════════════════════════════════════════════════
wb_cp = openpyxl.load_workbook(CP_SRC)
lst = wb_cp["LISTA CP"]

cps_by_old_hu = {}
row = 3
while row <= lst.max_row:
    cp_id = lst.cell(row=row, column=2).value
    if cp_id:
        hu_id = lst.cell(row=row, column=4).value
        cps_by_old_hu.setdefault(hu_id, []).append({
            "old_id": cp_id,
            "descripcion": lst.cell(row=row, column=3).value,
            "numero": lst.cell(row=row, column=5).value,
            "nombre": lst.cell(row=row, column=6).value,
        })
    row += 1

total_old_cp = sum(len(v) for v in cps_by_old_hu.values())
assert total_old_cp == 77, f"esperaba 77 CP viejos, hay {total_old_cp}"

# ═══════════════════════════════════════════════════════════════════════════
# 3) Armar la lista final de acciones CP en el orden de las 35 HU nuevas
# ═══════════════════════════════════════════════════════════════════════════
actions = []  # {"new_cp_id","new_hu_id","kind":"COPY"/"NEW", ...}
counter = 1
for hu_num in range(1, 36):
    new_hu_id = f"HU{hu_num:03d}"
    kind, ref = reverse[new_hu_id]
    if kind == "OLD":
        for cp in cps_by_old_hu[ref]:
            new_cp_id = f"CP{counter:03d}"
            if cp["old_id"] in REPLACE_CP:
                content = REPLACE_CP[cp["old_id"]]
                actions.append({
                    "new_cp_id": new_cp_id, "new_hu_id": new_hu_id, "kind": "NEW",
                    "numero": cp["numero"], "nombre": content["nombre"],
                    "descripcion": content["descripcion"], "content": content,
                })
            else:
                actions.append({
                    "new_cp_id": new_cp_id, "new_hu_id": new_hu_id, "kind": "COPY",
                    "old_id": cp["old_id"], "descripcion": cp["descripcion"],
                    "numero": cp["numero"], "nombre": cp["nombre"],
                })
            counter += 1
    else:
        for i, cp in enumerate(NEW_CP[ref], start=1):
            new_cp_id = f"CP{counter:03d}"
            actions.append({
                "new_cp_id": new_cp_id, "new_hu_id": new_hu_id, "kind": "NEW",
                "numero": i, "nombre": cp["nombre"], "descripcion": cp["descripcion"],
                "content": cp,
            })
            counter += 1

TOTAL_CP = counter - 1
print(f"CP finales: {TOTAL_CP}")
assert TOTAL_CP == 76, f"esperaba 76 CP finales, salieron {TOTAL_CP}"

# Ningún HU quedó sin sus CP eliminado por error, y ninguna HU eliminada aportó CPs.
copied_old_ids = {a["old_id"] for a in actions if a["kind"] == "COPY"}
for dropped in DROP_HU:
    assert dropped not in cps_by_old_hu or not (set(c["old_id"] for c in cps_by_old_hu[dropped]) & copied_old_ids)

# ═══════════════════════════════════════════════════════════════════════════
# 4) Reescribir "LISTA CP"
# ═══════════════════════════════════════════════════════════════════════════
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

# ═══════════════════════════════════════════════════════════════════════════
# 5) Reconstruir las pestañas individuales
# ═══════════════════════════════════════════════════════════════════════════
copy_actions = [a for a in actions if a["kind"] == "COPY"]
new_actions = [a for a in actions if a["kind"] == "NEW"]

# Fase 1: copiar cada pestaña conservada a un nombre temporal único.
for a in copy_actions:
    tmp_ws = wb_cp.copy_worksheet(wb_cp[a["old_id"]])
    tmp_ws.title = f"TMP_{a['old_id']}"

# Fase 2: borrar TODAS las pestañas CPxxx originales.
for name in list(wb_cp.sheetnames):
    if re.fullmatch(r"CP\d{3}", name):
        del wb_cp[name]

# Fase 3: renombrar cada temporal a su ID nuevo y parchar el encabezado (A1).
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


# Fase 4: crear las pestañas nuevas.
for a in new_actions:
    crear_pestana_cp(wb_cp, a["new_cp_id"], a["content"])

# ═══════════════════════════════════════════════════════════════════════════
# 6) Verificaciones finales antes de guardar
# ═══════════════════════════════════════════════════════════════════════════
cp_sheet_names = sorted(n for n in wb_cp.sheetnames if re.fullmatch(r"CP\d{3}", n))
expected_names = sorted(a["new_cp_id"] for a in actions)
assert cp_sheet_names == expected_names, "las pestañas CP no cuadran con LISTA CP"
assert not any(n.startswith("TMP_") for n in wb_cp.sheetnames), "quedaron pestañas temporales sin renombrar"

wb_cp.save(CP_OUT_DL)
wb_cp.save(CP_OUT_REPO)
print("guardado:", CP_OUT_DL)
print(f"Pestañas CP finales: {len(cp_sheet_names)}")
