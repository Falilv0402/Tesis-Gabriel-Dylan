# -*- coding: utf-8 -*-
"""
Agrega la HU036 (nueva, real): exportar el reporte PDF individual de un
alumno del colegio propio -- funcionalidad que se acaba de conectar a la
app (antes solo existía para EM2022, que está apagado).

Parte de v1.4 (HU) / v1.3 (CP) y guarda como v1.5 / v1.4.
"""
import openpyxl

HU_SRC = r"C:\Users\Usuario\Downloads\P20261012_Historias de Usuario y Criterios de Validacion v1.4.xlsx"
HU_OUT_DL = r"C:\Users\Usuario\Downloads\P20261012_Historias de Usuario y Criterios de Validacion v1.5.xlsx"
HU_OUT_REPO = r"C:\Users\Usuario\OneDrive\Escritorio\TesisDG-ML\PROYECTO-TESIS-DG\docs\excel\P20261012_Historias de Usuario y Criterios de Validacion v1.5.xlsx"

CP_SRC = r"C:\Users\Usuario\Downloads\P20261012_Casos de Prueba v1.3.xlsx"
CP_OUT_DL = r"C:\Users\Usuario\Downloads\P20261012_Casos de Prueba v1.4.xlsx"
CP_OUT_REPO = r"C:\Users\Usuario\OneDrive\Escritorio\TesisDG-ML\PROYECTO-TESIS-DG\docs\excel\P20261012_Casos de Prueba v1.4.xlsx"

# ══════════════════════════════════════════════════════════════════════════
# 1) Excel de Historias de Usuario
# ══════════════════════════════════════════════════════════════════════════
wb_hu = openpyxl.load_workbook(HU_SRC)
ws = wb_hu["HU"]

# ── HU036 -- filas nuevas 78-79 (la hoja termina en 77) ─────────────────────
ws.cell(row=78, column=2).value = "HU036"                       # B: id
ws.cell(row=78, column=3).value = "Coordinador Académico"        # C: rol
ws.cell(row=78, column=4).value = "exportar el reporte PDF de un alumno de mi colegio"   # D: quiere
ws.cell(row=78, column=5).value = "Para compartirlo o imprimirlo en reuniones con el equipo o la familia"  # E: para
ws.merge_cells("B78:B79")
ws.merge_cells("C78:C79")
ws.merge_cells("D78:D79")
ws.merge_cells("E78:E79")

ws.cell(row=78, column=6).value = 1
ws.cell(row=78, column=7).value = "Reporte generado"
ws.cell(row=78, column=8).value = "Alumno del colegio propio seleccionado"
ws.cell(row=78, column=9).value = "Selecciona 'PDF' en el detalle del alumno"
ws.cell(row=78, column=10).value = "Sistema genera un PDF de 1 página con salón, notas por bimestre, conducta y los factores de riesgo de ese alumno"

ws.cell(row=79, column=6).value = 2
ws.cell(row=79, column=7).value = "Alumno sin notas de bimestre"
ws.cell(row=79, column=8).value = "Alumno sin ninguna nota de bimestre (B1-B4) cargada todavía"
ws.cell(row=79, column=9).value = "Selecciona 'PDF' en el detalle del alumno"
ws.cell(row=79, column=10).value = "Sistema genera igual el PDF, indicando que aún no hay notas para estimar los factores de riesgo, en vez de fallar"

# ── EPICAS: HU036 entra a EP05 (Seguimiento Histórico y Reportes) ───────────
# EP05 pasa de 4 a 5 HUs (filas 26-30 en vez de 26-29); EP06 y EP07 se corren
# una fila hacia abajo (antes 30-34/35-38, ahora 31-34/35-38... para no
# reacomodar EP07 dos veces, primero se leen sus valores actuales).
epi = wb_hu["EPICAS"]

ep06_label, ep06_obj = epi["B30"].value, epi["C30"].value
ep06_d = [epi.cell(row=r, column=4).value for r in range(30, 34)]  # HU028-031
ep07_label, ep07_obj = epi["B34"].value, epi["C34"].value
ep07_d = [epi.cell(row=r, column=4).value for r in range(34, 38)]  # HU032-035

epi.unmerge_cells("B26:B29"); epi.unmerge_cells("C26:C29")
epi.unmerge_cells("B30:B33"); epi.unmerge_cells("C30:C33")
epi.unmerge_cells("B34:B37"); epi.unmerge_cells("C34:C37")

epi.cell(row=26, column=4).value = "HU024"
epi.cell(row=27, column=4).value = "HU025"
epi.cell(row=28, column=4).value = "HU026"
epi.cell(row=29, column=4).value = "HU027"
epi.cell(row=30, column=4).value = "HU036"   # la nueva, al final de EP05

epi["B31"].value, epi["C31"].value = ep06_label, ep06_obj
for i, v in enumerate(ep06_d):
    epi.cell(row=31 + i, column=4).value = v   # filas 31-34 = HU028-031

epi["B35"].value, epi["C35"].value = ep07_label, ep07_obj
for i, v in enumerate(ep07_d):
    epi.cell(row=35 + i, column=4).value = v   # filas 35-38 = HU032-035

epi.merge_cells("B26:B30"); epi.merge_cells("C26:C30")   # EP05: 5 HUs
epi.merge_cells("B31:B34"); epi.merge_cells("C31:C34")   # EP06: 4 HUs
epi.merge_cells("B35:B38"); epi.merge_cells("C35:C38")   # EP07: 4 HUs

wb_hu.save(HU_OUT_DL)
wb_hu.save(HU_OUT_REPO)
print("guardado:", HU_OUT_DL)

# ══════════════════════════════════════════════════════════════════════════
# 2) Excel de Casos de Prueba
# ══════════════════════════════════════════════════════════════════════════
wb_cp = openpyxl.load_workbook(CP_SRC)
lst = wb_cp["LISTA CP"]

lst.cell(row=78, column=2).value = "CP076"
lst.cell(row=78, column=3).value = "Validar que el sistema genere un PDF de 1 página con salón, notas por bimestre, conducta y factores de riesgo del alumno"
lst.cell(row=78, column=4).value = "HU036"
lst.cell(row=78, column=5).value = 1
lst.cell(row=78, column=6).value = "Reporte generado"

lst.cell(row=79, column=2).value = "CP077"
lst.cell(row=79, column=3).value = "Validar que, si el alumno no tiene notas de bimestre cargadas, el sistema genere igual el PDF en vez de fallar"
lst.cell(row=79, column=4).value = "HU036"
lst.cell(row=79, column=5).value = 2
lst.cell(row=79, column=6).value = "Alumno sin notas de bimestre"

# ── Pestañas individuales CP076 / CP077 (plantilla estándar) ────────────────
def crear_pestana_cp(nombre, titulo, autor, precondiciones, pasos, tipo_ejec, prioridad, requerimientos, postcondiciones):
    ws_cp = wb_cp.create_sheet(nombre)
    ws_cp["A1"] = f"Caso de Prueba: {nombre}: {titulo}"
    ws_cp["A2"] = "Autor:"; ws_cp["B2"] = autor
    ws_cp["A3"] = f"Precondiciones: {precondiciones}"
    ws_cp["A6"] = "#:"; ws_cp["B6"] = "Pasos:"; ws_cp["C6"] = "Resultados Esperados:"
    r = 7
    for i, (paso, resultado) in enumerate(pasos, 1):
        ws_cp.cell(row=r, column=1).value = i
        ws_cp.cell(row=r, column=2).value = paso
        ws_cp.cell(row=r, column=3).value = resultado
        r += 1
    ws_cp.cell(row=r, column=1).value = "Tipo de ejecución:"; ws_cp.cell(row=r, column=2).value = tipo_ejec; r += 1
    ws_cp.cell(row=r, column=1).value = "Prioridad:"; ws_cp.cell(row=r, column=2).value = prioridad; r += 1
    ws_cp.cell(row=r, column=1).value = "Requerimientos"; ws_cp.cell(row=r, column=2).value = requerimientos; r += 1
    ws_cp.cell(row=r, column=1).value = f"Postcondiciones:\n{postcondiciones}"
    return ws_cp


crear_pestana_cp(
    "CP076", "Reporte generado", "Coordinador Académico",
    "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Colegio con modelo propio y alumno seleccionado",
    [
        ("Usuario esta loggeado como Coordinador", "Aplicación muestra el detalle del alumno"),
        ("Usuario selecciona el botón \"PDF\"", "Aplicación genera el PDF de 1 página"),
        ("Usuario abre el archivo descargado", "Archivo contiene salón, notas por bimestre, conducta y factores de riesgo del alumno"),
    ],
    "Manual", "Media", "Cuenta Coordinador, colegio con modelo propio",
    "Sistema genera el reporte PDF individual del alumno con sus datos reales",
)

crear_pestana_cp(
    "CP077", "Alumno sin notas de bimestre", "Coordinador Académico",
    "La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Alumno sin notas de bimestre (B1-B4) cargadas todavía",
    [
        ("Usuario esta loggeado como Coordinador", "Aplicación muestra el detalle del alumno"),
        ("Usuario selecciona el botón \"PDF\"", "Aplicación genera el PDF igual, sin fallar"),
        ("Usuario abre el archivo descargado", "Archivo indica que aún no hay notas para estimar los factores de riesgo, en vez de mostrar un error"),
    ],
    "Manual", "Baja", "Cuenta Coordinador, colegio con modelo propio",
    "Sistema no falla ante un alumno sin notas -- genera el PDF con el estado vacío correspondiente",
)

wb_cp.save(CP_OUT_DL)
wb_cp.save(CP_OUT_REPO)
print("guardado:", CP_OUT_DL)
