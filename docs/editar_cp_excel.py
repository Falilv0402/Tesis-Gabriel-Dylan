# -*- coding: utf-8 -*-
"""
Edita en sitio (preservando formato) el excel de Casos de Prueba:
1) Elimina las pestañas CP064/CP065 (HU030, descartada) y renumera
   CP066..CP077 -> CP064..CP075.
2) Actualiza "LISTA CP" (elimina 2 filas, renumera CP/HU de las filas
   siguientes) y corrige la descripción desalineada de paso.
3) Redefine la redacción de los casos ambiguos para que coincidan con lo que
   el sistema realmente hace hoy.
Guarda como v1.2 en Downloads y también una copia en docs/excel del repo.
"""
import openpyxl

SRC = r"C:\Users\Usuario\Downloads\P20261012_Casos de Prueba v.1.1.xlsx"
OUT_DOWNLOADS = r"C:\Users\Usuario\Downloads\P20261012_Casos de Prueba v1.2.xlsx"
OUT_REPO = r"C:\Users\Usuario\OneDrive\Escritorio\TesisDG-ML\PROYECTO-TESIS-DG\docs\excel\P20261012_Casos de Prueba v1.2.xlsx"

wb = openpyxl.load_workbook(SRC)

# ══════════════════════════════════════════════════════════════════════════
# 1) Eliminar pestañas CP064/CP065 y renumerar CP066..CP077 -> CP064..CP075
# ══════════════════════════════════════════════════════════════════════════
del wb["CP064"]
del wb["CP065"]

rename_map = [(f"CP{n:03d}", f"CP{n-2:03d}") for n in range(66, 78)]
for old_name, new_name in rename_map:
    ws_cp = wb[old_name]
    ws_cp.title = new_name
    a1 = ws_cp["A1"].value or ""
    ws_cp["A1"].value = a1.replace(old_name, new_name, 1)

print("Pestañas CP tras renombrar:", [n for n in wb.sheetnames if n.startswith("CP")][-15:])

# ══════════════════════════════════════════════════════════════════════════
# 2) LISTA CP: quitar filas de CP064/CP065 (HU030) y renumerar el resto
# ══════════════════════════════════════════════════════════════════════════
lst = wb["LISTA CP"]

# Copiar filas 68-79 (CP066-CP077/HU031-036) dos filas hacia arriba (66-77).
# Esta hoja NO tiene celdas combinadas en el rango de datos (solo el título en
# B1:F1), así que es una copia de valores directa, fila por fila.
for old_row in range(68, 80):
    new_row = old_row - 2
    for col in range(2, 8):  # B..G
        lst.cell(row=new_row, column=col).value = lst.cell(row=old_row, column=col).value
for row in (78, 79):
    for col in range(2, 8):
        lst.cell(row=row, column=col).value = None

# Renumerar los IDs de CP en las filas que se recorrieron (fila 66 = antes
# tenía CP066 en la fila 68; ahora debe decir CP064; y así sucesivamente).
for row in range(66, 78):
    lst.cell(row=row, column=2).value = f"CP{row - 2:03d}"
for row, new_hu in [(66, "HU030"), (67, "HU030"), (68, "HU031"), (69, "HU031"),
                     (70, "HU032"), (71, "HU032"), (72, "HU033"), (73, "HU033"),
                     (74, "HU034"), (75, "HU034"), (76, "HU035"), (77, "HU035")]:
    lst.cell(row=row, column=4).value = new_hu

print("LISTA CP: fila 79 tras limpiar ->", [lst.cell(row=79, column=c).value for c in range(2, 8)])

# ══════════════════════════════════════════════════════════════════════════
# 3) Redefinir Descripción (C) / Criterio (F) en LISTA CP, y el contenido de
#    las pestañas individuales, para los casos ambiguos identificados.
#    (La columna "Descripción" del archivo original venía desalineada para
#    un tramo de filas -- esto además corrige ese defecto de origen.)
# ══════════════════════════════════════════════════════════════════════════
def set_lista(row, descripcion=None, criterio=None):
    if descripcion is not None:
        lst.cell(row=row, column=3).value = descripcion
    if criterio is not None:
        lst.cell(row=row, column=6).value = criterio


def set_tab(name, updates):
    """updates: dict coordinate -> new value, aplicado a la pestaña individual CPxxx."""
    ws_cp = wb[name]
    for coord, val in updates.items():
        ws_cp[coord].value = val


# ---- CP003 (HU001 esc3) ----
set_lista(5, descripcion="Validar que el sistema muestre el primer error de validación encontrado (no todos los campos a la vez) cuando el formulario tiene datos inválidos")
set_tab("CP003", {
    "C10": 'Aplicación muestra el primer error de validación encontrado (ej. "Ingresa tu nombre completo.", "Selecciona tu distrito.", requisitos de contraseña, o dominio de correo no institucional)',
    "A14": "Postcondiciones:\nSistema muestra un mensaje de validación a la vez, por el primer campo inválido detectado",
})

# ---- CP011 (HU005 esc1) ----
set_lista(13, descripcion="Validar que el administrador pueda crear un nuevo usuario, asignándole la contraseña inicial directamente en el formulario")
set_tab("CP011", {
    "A14": "Postcondiciones:\nSistema registra al usuario con la contraseña definida por el administrador y lo asocia a su colegio/distrito; Supabase envía el correo de confirmación estándar\n",
})

# ---- CP014 (HU005 esc4) ----
set_lista(16, descripcion="Validar que el administrador pueda crear una cuenta de Coordinador, asignarle colegio y una contraseña inicial")
set_tab("CP014", {
    "A14": "Postcondiciones:\nSistema crea la cuenta con la contraseña definida por el administrador, la asocia al colegio seleccionado, y Supabase envía el correo de confirmación estándar al coordinador\n",
})

# ---- CP018 (HU007 esc2) ----
set_lista(20, descripcion="Validar que, si el colegio no tiene los 4 bimestres cargados, el sistema avise que está operando en modo descriptivo en vez de bloquear el análisis")
set_tab("CP018", {
    "C10": 'Aplicación muestra el aviso "Este colegio todavía no tiene los 4 bimestres cargados — el modelo está operando con datos limitados" y opera en modo descriptivo',
    "A14": "Postcondiciones:\nSistema opera en modo descriptivo (no predictivo) y lo advierte en el dashboard\n",
})

# ---- CP019 (HU007 esc3) ----
set_lista(21, descripcion="Validar que el sistema muestre un aviso de error de conexión cuando el servidor de análisis no responde")
set_tab("CP019", {
    "C10": "Aplicación muestra un aviso de error de conexión con el servidor de análisis",
    "A14": "Postcondiciones:\nSistema muestra un aviso de error de conexión\n\n",
})

# ---- CP027 (HU011 esc2) ----
set_lista(29, descripcion="Validar que, si falla el entrenamiento, el sistema muestre el mensaje de error técnico devuelto por el proceso")
set_tab("CP027", {
    "C9": "Aplicación muestra el mensaje de error técnico devuelto por el proceso de entrenamiento\n",
    "A13": "Postcondiciones:\nSistema muestra el error técnico del proceso de entrenamiento (sin traducir a lenguaje de negocio)",
})

# ---- CP028 (HU012 esc1) ----
set_lista(30, descripcion="Validar que el sistema muestre los factores de riesgo del estudiante: SHAP en EM2022, desglose de notas por área en el modelo propio del colegio")
set_tab("CP028", {
    "A14": "Postcondiciones:\nEn EM2022 muestra los factores con mayor peso vía SHAP; en el modelo propio del colegio muestra el desglose de notas por área como proxy\n",
})

# ---- CP029 (HU012 esc2) ----
set_lista(31, descripcion="Validar que, mientras se calculan los factores de un alumno recién seleccionado, el sistema muestre un estado de carga")
set_tab("CP029", {
    "B10": "Usuario accede al perfil del estudiante justo después de seleccionarlo",
    "C10": 'Aplicación muestra "Cargando análisis de factores..." mientras se calcula\n',
    "A14": "Postcondiciones:\nSistema muestra el estado de carga (la predicción ya se ejecuta automáticamente, no requiere un paso manual previo)\n",
})

# ---- CP039 (HU017 esc2) -- renombrado ----
wb["CP039"]["A1"].value = "Caso de Prueba: CP039: Alumno con análisis aún cargando"
set_lista(41, descripcion="Validar que, si el análisis de un alumno recién seleccionado aún no está listo, el sistema muestre un estado de carga en vez de fallar",
          criterio="Alumno con análisis aún cargando")
set_tab("CP039", {
    "A3": "Precondiciones: La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Alumno recién cargado, seleccionado desde la lista",
    "B8": "Usuario selecciona un alumno recién cargado, antes de que termine el análisis",
    "C8": 'Aplicación muestra "Cargando análisis de factores..." (los alumnos siempre se eligen de una lista ya cargada; no hay búsqueda libre por ID que pueda no existir)',
    "A12": "Postcondiciones:\nSistema muestra el estado de carga hasta que el análisis está listo\n",
})

# ---- CP045 (HU020 esc2) -- renombrado ----
wb["CP045"]["A1"].value = "Caso de Prueba: CP045: Recomendación siempre disponible"
set_lista(47, descripcion="Validar que el sistema siempre muestre una recomendación para un estudiante en riesgo, ya que las reglas están incorporadas en el sistema",
          criterio="Recomendación siempre disponible")
set_tab("CP045", {
    "C9": "Aplicación siempre muestra una sugerencia (las reglas de recomendación están incorporadas en el sistema, no dependen de un catálogo externo)\n",
    "A13": "Postcondiciones:\nSistema siempre muestra una recomendación\n",
})

# ---- CP047 (HU021 esc2) -- renombrado ----
wb["CP047"]["A1"].value = "Caso de Prueba: CP047: Orden estable ante empate"
set_lista(49, descripcion="Validar que, ante un empate exacto de probabilidad de riesgo, el sistema mantenga un orden estable (aún no hay un segundo criterio de desempate)",
          criterio="Orden estable ante empate")
set_tab("CP047", {
    "C9": "Aplicación ordena por probabilidad de riesgo descendente; ante un empate exacto, mantiene el orden de llegada (aún no hay un segundo criterio como promedio o asistencia)\n\n",
    "A13": "Postcondiciones:\nSistema mantiene un orden estable ante empates (sin segundo criterio todavía)\n",
})

# ---- CP048 (HU022 esc1) ----
set_lista(50, descripcion="Validar que el sistema segmente por tipo de riesgo en EM2022, y solo por nivel (ALTO/MEDIO/BAJO) en el modelo propio del colegio")
set_tab("CP048", {
    "C9": "Aplicación segmenta por tipo específico en el modelo nacional (EM2022); en el modelo propio del colegio solo segmenta por nivel (ALTO/MEDIO/BAJO)\n",
    "A13": "Postcondiciones:\nSistema segmenta por tipo en EM2022; solo por nivel en el modelo propio del colegio",
})

# ---- CP049 (HU022 esc2) ----
set_lista(51, descripcion="Validar que, en el modelo propio del colegio (sin campo de tipo de riesgo), el sistema solo pueda segmentar por nivel")
set_tab("CP049", {
    "C9": "Aplicación (colegio propio, sin campo de tipo de riesgo) solo segmenta por nivel, no por tipo específico\n",
    "A13": "Postcondiciones:\nSistema solo segmenta por nivel en el modelo propio del colegio",
})

# ---- CP051 (HU023 esc2) -- renombrado ----
wb["CP051"]["A1"].value = "Caso de Prueba: CP051: Registro bloqueado sin alumno seleccionado"
set_lista(53, descripcion="Validar que el botón 'Registrar' permanezca deshabilitado mientras no se haya seleccionado un alumno",
          criterio="Registro bloqueado sin alumno seleccionado")
set_tab("CP051", {
    "B9": "Usuario no selecciona ningún alumno en el formulario",
    "C9": 'Aplicación mantiene el botón "Registrar" deshabilitado',
    "A13": "Postcondiciones:\nSistema no permite guardar hasta que se seleccione un alumno (el resto de campos ya tiene valores por defecto)\n",
})

# ---- CP054 (HU025 esc1) -- pasos reescritos: la funcionalidad real es el
#      historial de versiones del modelo en CSV, no un PDF por estudiante ----
set_lista(56, descripcion="Validar que el sistema exporte en CSV el historial de versiones del modelo (evolución del riesgo por reentrenamiento)")
set_tab("CP054", {
    "A3": "Precondiciones: La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Debe haber al menos un reentrenamiento registrado",
    "B8": 'Usuario accede al panel "Histórico de reentrenamientos"',
    "C8": "Aplicación muestra el gráfico de evolución de riesgo por versión del modelo",
    "B9": 'Usuario selecciona "Exportar CSV"',
    "C9": "Aplicación descarga el archivo CSV con el historial",
    "B10": "Usuario abre el archivo descargado",
    "C10": "Archivo contiene fecha, versión y niveles de riesgo (ALTO/MEDIO/BAJO) por versión",
    "A14": "Postcondiciones:\nSistema exporta el historial de versiones del modelo en CSV\n",
})

# ---- CP057 (HU026 esc2) -- renombrado, pasos reescritos ----
wb["CP057"]["A1"].value = "Caso de Prueba: CP057: Comparación sobre todo el histórico disponible"
set_lista(59, descripcion="Validar que el gráfico de histórico siempre muestre todo el rango disponible, ya que no existe un selector manual de periodos",
          criterio="Comparación sobre todo el histórico disponible")
set_tab("CP057", {
    "A3": "Precondiciones: La aplicacion esta instalada y operativa. Se esta loggeado como Coordinador. Debe haber al menos dos versiones del modelo registradas",
    "B8": 'Usuario accede al panel "Histórico de reentrenamientos"',
    "C8": "Aplicación muestra el gráfico de evolución de riesgo por versión del modelo",
    "B9": "Usuario visualiza el gráfico completo",
    "C9": "Aplicación muestra siempre todo el histórico disponible (no hay un selector de periodo A-vs-B que pueda recibir una selección inválida)",
    "A13": "Postcondiciones:\nSistema muestra siempre la comparación de todo el histórico disponible",
})

# ---- CP059 (HU027 esc2) -- renombrado ----
wb["CP059"]["A1"].value = "Caso de Prueba: CP059: Exportación con lista vacía"
set_lista(61, descripcion="Validar que, al exportar con la lista filtrada vacía, el sistema genere igual el archivo (solo con encabezados) en vez de fallar",
          criterio="Exportación con lista vacía")
set_tab("CP059", {
    "B9": 'Usuario selecciona "Estudiantes en Riesgo" y el filtro no arroja resultados',
    "C9": "Aplicación muestra la lista vacía",
    "B10": 'Usuario selecciona "Exportar"',
    "C10": "Aplicación genera igual el archivo, solo con encabezados",
    "A14": "Postcondiciones:\nSistema genera el archivo aun sin filas de datos (la exportación es local, no depende de la red)",
})

# ---- CP060 (HU028 esc1) ----
set_lista(62, descripcion="Validar que el sistema combine el dataset nacional (EM2022) con las notas del colegio (Excel) en el mismo selector de colegios")
set_tab("CP060", {
    "B8": "Usuario selecciona un colegio en el dashboard",
    "C8": "Aplicación muestra los datos combinando EM2022 y las notas propias del colegio",
    "A13": "Postcondiciones:\nSistema combina ambas fuentes en el mismo selector (no hay integración en vivo vía APIs externas)",
})

# ---- CP061 (HU028 esc2) ----
set_lista(63, descripcion="Validar que, si el backend (FastAPI) está desconectado, el sistema muestre un aviso genérico sin identificar la fuente específica")
set_tab("CP061", {
    "B8": "Backend (FastAPI) desconectado",
    "C8": "Aplicación no puede cargar la lista de colegios",
    "B9": "Usuario intenta continuar",
    "C9": 'Aplicación muestra un aviso genérico de "backend desconectado" (no identifica cuál fuente específica falló)\n',
    "A13": "Postcondiciones:\nSistema muestra un aviso genérico de backend desconectado",
})

# ---- CP067 nuevo (antes CP069), HU031 nuevo esc2 "Sin errores" ----
set_lista(69, descripcion="Validar que, al no haber advertencias tras una carga, el sistema no muestre ningún bloque de advertencias (confirmación implícita)")
set_tab("CP067", {
    "C10": 'Aplicación no muestra ningún bloque de advertencias tras el detalle de la carga (la ausencia de avisos confirma que todo se procesó bien)',
    "A14": "Postcondiciones:\nSistema no muestra advertencias cuando no hay errores (confirmación implícita)",
})

# ---- CP068 nuevo (antes CP070), HU032 nuevo esc1 "Ajuste exitoso" ----
set_lista(70, descripcion="Validar que los nuevos umbrales ALTO/MEDIO se apliquen de inmediato sobre las probabilidades ya calculadas")
set_tab("CP068", {
    "C10": "Aplicación aplica los nuevos umbrales de inmediato sobre los resultados ya calculados",
    "A14": "Postcondiciones:\nSistema aplica de inmediato los nuevos umbrales (son umbrales de clasificación, no hiperparámetros del entrenamiento)",
})

# ---- CP069 nuevo (antes CP071), HU032 nuevo esc2 "Parámetro inválido" ----
set_lista(71, descripcion="Validar que los controles deslizantes de umbral tengan un rango mínimo/máximo fijo, de modo que no se pueda ingresar un valor fuera de rango")
set_tab("CP069", {
    "B10": "Usuario intenta mover el control fuera del rango permitido",
    "C10": "Aplicación no lo permite: el control tiene un rango mínimo/máximo fijo en la interfaz",
    "A14": "Postcondiciones:\nSistema impide físicamente un valor fuera de rango (prevención en el control, no validación posterior)",
})

# ---- CP071 nuevo (antes CP073), HU033 nuevo esc2 "Datos insuficientes" ----
set_lista(73, descripcion="Validar que, con pocos datos para entrenar, el sistema reentrene igual en modo descriptivo, con aviso, en vez de bloquear el reentrenamiento")
set_tab("CP071", {
    "C9": 'Aplicación reentrena igual, cae a modo descriptivo (menos preciso) y lo advierte en el dashboard',
    "A13": "Postcondiciones:\nSistema no bloquea el reentrenamiento; lo degrada a modo descriptivo con aviso",
})

# ---- CP072 nuevo (antes CP074), HU034 nuevo esc1 "Importancia disponible" ----
set_lista(74, descripcion="Validar que el ranking global de variables (SHAP) esté disponible en EM2022; el modelo propio del colegio no lo expone por el tamaño de su muestra")
set_tab("CP072", {
    "A13": "Postcondiciones:\nEn EM2022 muestra el ranking global de variables (SHAP); el modelo propio del colegio no lo expone, por el tamaño reducido de su muestra",
})

# ---- CP075 nuevo (antes CP077), HU035 nuevo esc2 -- renombrado ----
wb["CP075"]["A1"].value = "Caso de Prueba: CP075: Fecha visible sin alerta de antigüedad"
set_lista(77, descripcion="Validar que el sistema siempre muestre la fecha exacta de la última actualización del modelo (aún no hay un umbral de antigüedad que dispare una alerta)",
          criterio="Fecha visible sin alerta de antigüedad")
set_tab("CP075", {
    "C9": 'Aplicación siempre muestra la fecha exacta de la última actualización (aún no existe un umbral de "antigüedad máxima" configurado)',
    "A13": "Postcondiciones:\nSistema no dispara todavía una alerta automática de modelo desactualizado; solo expone la fecha",
})

# ── Descripciones que quedaron desalineadas del defecto original del
#    archivo del cliente (la columna "Descripción" venía corrida respecto a
#    su propio Criterio/HU para este subconjunto de filas -- no forman parte
#    de los casos "ambiguos" de la auditoría, pero siguen siendo incorrectas).
set_lista(24, descripcion="Validar que el sistema ejecute el análisis de predicción automáticamente al cargar los datos")
set_lista(25, descripcion="Validar que el sistema muestre un error de validación cuando los datos cargados son inconsistentes")
set_lista(26, descripcion="Validar que el botón único de predicción genere los resultados y los almacene correctamente")
set_lista(30, descripcion="Validar que el sistema muestre correctamente los indicadores (KPIs) del colegio")
set_lista(31, descripcion="Validar que el sistema muestre una advertencia cuando no hay datos procesados para los indicadores (KPIs)")
set_lista(32, descripcion="Validar que el sistema muestre a los estudiantes ordenados por riesgo de forma descendente")
set_lista(33, descripcion="Validar que el sistema muestre un mensaje de ausencia de datos cuando no hay estudiantes cargados")
set_lista(34, descripcion="Validar que el sistema filtre correctamente a los estudiantes por grado o sección")
set_lista(35, descripcion="Validar que el sistema muestre una lista vacía con mensaje cuando el filtro no tiene coincidencias")
set_lista(58, descripcion="Validar que el sistema genere correctamente el archivo CSV o PDF con el listado de estudiantes en riesgo")
set_lista(64, descripcion="Validar que el sistema procese el archivo cargado y reporte la cantidad de datos procesados")
set_lista(65, descripcion="Validar que el sistema rechace un archivo inválido mostrando el detalle del error")

wb.save(OUT_DOWNLOADS)
wb.save(OUT_REPO)
print("guardado:", OUT_DOWNLOADS)
print("guardado:", OUT_REPO)
