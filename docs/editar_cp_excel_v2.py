# -*- coding: utf-8 -*-
"""
Segunda ronda de correcciones sobre el excel de Casos de Prueba.

Dos problemas distintos, corregidos juntos porque varios CP tenían ambos:

1) BUG REAL encontrado al re-auditar: el script anterior (editar_cp_excel.py,
   líneas ~294-305) usó `set_lista(numero_de_CP, ...)` en vez de
   `set_lista(numero_de_CP + 2, ...)` para 12 correcciones -- cada una
   terminó escrita 2 filas antes de donde debía. Eso dejó 19 filas de
   "LISTA CP" con la Descripción de OTRO caso de prueba (una cadena: CP022
   tenía el texto de CP024, CP024 tenía el de CP026, etc.). Las pestañas
   individuales NO se tocaron entonces y siguen siendo confiables -- esta
   corrección solo re-escribe la columna Descripción de "LISTA CP" a partir
   del Criterio/HU real de cada fila (ya verificado en el excel de HU v1.4).

2) EM2022 apagado: 5 CP (028, 048, 049, 060, 072) describían el modelo
   nacional -- se redefinen para reflejar solo el modelo propio del colegio,
   igual que ya se hizo en el excel de HU. Estos SÍ tienen pestaña individual
   propia y se actualiza también.

Parte de v1.2 (no del original del cliente) y guarda como v1.3.
"""
import openpyxl

SRC = r"C:\Users\Usuario\Downloads\P20261012_Casos de Prueba v1.2.xlsx"
OUT_DOWNLOADS = r"C:\Users\Usuario\Downloads\P20261012_Casos de Prueba v1.3.xlsx"
OUT_REPO = r"C:\Users\Usuario\OneDrive\Escritorio\TesisDG-ML\PROYECTO-TESIS-DG\docs\excel\P20261012_Casos de Prueba v1.3.xlsx"

wb = openpyxl.load_workbook(SRC)
lst = wb["LISTA CP"]


def set_lista(cp_num, descripcion=None, criterio=None):
    """cp_num es el NÚMERO del caso de prueba (ej. 28 para CP028) -- la fila
    real en LISTA CP es cp_num+2 (fila 1=título, fila 2=encabezados, CP001
    empieza en la fila 3). Esta vez con la aritmética verificada dos veces."""
    row = cp_num + 2
    assert lst.cell(row=row, column=2).value == f"CP{cp_num:03d}", \
        f"fila {row} no es CP{cp_num:03d}, es {lst.cell(row=row, column=2).value}"
    if descripcion is not None:
        lst.cell(row=row, column=3).value = descripcion
    if criterio is not None:
        lst.cell(row=row, column=6).value = criterio


def set_tab(name, updates):
    ws_cp = wb[name]
    for coord, val in updates.items():
        ws_cp[coord].value = val


# ══════════════════════════════════════════════════════════════════════════
# 1) Arreglo del bug de desfase -- 19 descripciones que quedaron con el
#    texto de otro CP. Recalculadas desde cero contra el Criterio/HU real
#    de cada fila (ver docs/editar_hu_excel_v2.py y el excel de HU v1.4).
# ══════════════════════════════════════════════════════════════════════════
set_lista(22, descripcion="Validar que el sistema agrupe automáticamente a los estudiantes por nivel de riesgo tras ejecutar la predicción")
set_lista(23, descripcion="Validar que el sistema actualice la clasificación de riesgo al ejecutar una nueva predicción con datos nuevos")
set_lista(24, descripcion="Validar que el sistema ejecute el análisis de predicción automáticamente al cargar los datos, sin pasos manuales intermedios")
set_lista(25, descripcion="Validar que el sistema muestre un error de validación cuando los datos cargados son inconsistentes")
set_lista(26, descripcion="Validar que el botón único de predicción genere los resultados y los almacene correctamente")
# 28 se corrige en la sección 2 (además tenía EM2022)
set_lista(29, descripcion="Validar que, mientras se calculan los factores de un alumno recién seleccionado, el sistema muestre un estado de carga")
set_lista(30, descripcion="Validar que el sistema muestre correctamente los indicadores (KPIs) del colegio")
set_lista(31, descripcion="Validar que el sistema muestre una advertencia cuando no hay datos procesados para los indicadores (KPIs)")
set_lista(32, descripcion="Validar que el sistema muestre a los estudiantes ordenados por riesgo de forma descendente")
set_lista(33, descripcion="Validar que el sistema muestre un mensaje de ausencia de datos cuando no hay estudiantes cargados")
set_lista(34, descripcion="Validar que el sistema filtre correctamente a los estudiantes por grado o sección")
set_lista(35, descripcion="Validar que el sistema muestre una lista vacía con mensaje cuando el filtro no tiene coincidencias")
set_lista(56, descripcion="Validar que el sistema muestre la comparación de riesgo entre distintos periodos (versiones del modelo)")
set_lista(58, descripcion="Validar que el sistema genere correctamente el archivo CSV o PDF con el listado de estudiantes en riesgo")
set_lista(62, descripcion="Validar que el sistema corrija inconsistencias en los datos cargados y reporte los cambios realizados")
set_lista(63, descripcion="Validar que el sistema reporte los errores encontrados cuando los datos son corruptos o incompatibles")
set_lista(64, descripcion="Validar que el sistema procese el archivo cargado y reporte la cantidad de datos procesados")
set_lista(65, descripcion="Validar que el sistema rechace un archivo inválido (formato incorrecto o columnas faltantes) mostrando el detalle del error")

# ══════════════════════════════════════════════════════════════════════════
# 2) EM2022 apagado -- redefinición hacia el modelo propio del colegio,
#    incluyendo la pestaña individual de cada uno.
# ══════════════════════════════════════════════════════════════════════════

# ---- CP028 (HU012 esc1) ----
set_lista(28, descripcion="Validar que el sistema muestre las 3 áreas académicas con el promedio más bajo (Bimestre 1-3) como los factores que más elevan el riesgo del alumno")
set_tab("CP028", {
    "C10": "Aplicación muestra las 3 áreas con el promedio más bajo como los factores que más elevan su riesgo",
    "A14": "Postcondiciones:\nSistema muestra las 3 áreas académicas con el promedio más bajo (Bimestre 1-3) como factores de riesgo\n",
})

# ---- CP048 (HU022 esc1) ----
set_lista(48, descripcion="Validar que el sistema agrupe a los estudiantes por nivel de riesgo (ALTO/MEDIO/BAJO)")
set_tab("CP048", {
    "C9": "Aplicación agrupa a los estudiantes por nivel de riesgo (ALTO/MEDIO/BAJO)\n",
    "A13": "Postcondiciones:\nSistema segmenta a los estudiantes por nivel de riesgo",
})

# ---- CP049 (HU022 esc2, rediseñado: "Colegio sin modelo propio") ----
wb["CP049"]["A1"].value = "Caso de Prueba: CP049: Colegio sin modelo propio"
set_lista(49, descripcion="Validar que, si el colegio no tiene modelo propio entrenado, el sistema muestre 'Sin modelo propio configurado' en vez de cualquier segmentación",
          criterio="Colegio sin modelo propio")
set_tab("CP049", {
    "A3": "Precondiciones: La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Colegio sin modelo propio entrenado todavía",
    "B9": "Usuario intenta ver la segmentación de estudiantes",
    "C9": "Aplicación muestra el estado 'Sin modelo propio configurado', con acceso directo a Datos para subir el Excel\n",
    "A13": "Postcondiciones:\nSistema muestra el estado vacío en vez de cualquier segmentación",
})

# ---- CP060 (HU028 esc1) ----
set_lista(60, descripcion="Validar que el sistema combine notas y conducta del colegio en un mismo modelo, aunque lleguen en archivos separados")
set_tab("CP060", {
    "B8": "Usuario sube los archivos de notas y de conducta del colegio",
    "C8": "Aplicación recibe ambos archivos por separado",
    "B9": "Usuario entrena el modelo",
    "C9": "Aplicación combina notas y conducta en un mismo modelo",
    "A13": "Postcondiciones:\nSistema combina ambas fuentes (notas y conducta) en un solo modelo",
})

# ---- CP072 (HU034 esc1) ----
set_lista(72, descripcion="Validar que el sistema muestre un ranking global de variables (Random Forest) para el modelo propio de cada colegio")
set_tab("CP072", {
    "C9": "Aplicación muestra el ranking global de variables (Random Forest) del modelo propio del colegio\n",
    "A13": "Postcondiciones:\nSistema muestra el ranking global de variables del modelo propio de ese colegio",
})

wb.save(OUT_DOWNLOADS)
wb.save(OUT_REPO)
print("guardado:", OUT_DOWNLOADS)
print("guardado:", OUT_REPO)
