# -*- coding: utf-8 -*-
"""
Fuente única de verdad para la auditoria HU/CP -- generar_auditoria_excel.py
y generar_auditoria_word.py importan ESTE modulo para no duplicar datos.

Estados de CP: "OK" (cumple), "PARCIAL", "NO" (no cumple)
"""

EPICAS = {
    "EP01": "Acceso y Seguridad",
    "EP02": "Predicción y Clasificación de Riesgo",
    "EP03": "Análisis y Visualización de Estudiantes",
    "EP04": "Priorización e Intervención",
    "EP05": "Seguimiento Histórico y Reportes",
    "EP06": "Gestión de Datos",
    "EP07": "Mantenimiento del Modelo ML",
}

HU_EPICA = {}
for n in range(1, 7): HU_EPICA[f"HU{n:03d}"] = "EP01"
for n in range(7, 12): HU_EPICA[f"HU{n:03d}"] = "EP02"
for n in range(12, 19): HU_EPICA[f"HU{n:03d}"] = "EP03"
for n in range(19, 24): HU_EPICA[f"HU{n:03d}"] = "EP04"
for n in range(24, 28): HU_EPICA[f"HU{n:03d}"] = "EP05"
for n in range(28, 33): HU_EPICA[f"HU{n:03d}"] = "EP06"
for n in range(33, 37): HU_EPICA[f"HU{n:03d}"] = "EP07"

# ── Cada HU: (rol, "quiere...", "para...", [ (cp_id, criterio, resultado_esperado, estado, evidencia) ]) ──
HUS = [
("HU001", "Administrador del Sistema", "registrarme en el sistema con mis datos", "acceder y comenzar a gestionar la plataforma", [
    ("CP001", "Registro exitoso", "Sistema crea la cuenta y redirige al login", "OK",
     "Formulario de registro (AuthView) + Supabase Auth signUp; auto-login inmediato tras crear la cuenta."),
    ("CP002", "Email duplicado", "Sistema muestra mensaje 'El correo ya está en uso'", "OK",
     "Corregido en esta ronda de QA: Supabase no lanza error cuando el correo ya existe (anti-enumeración) -- se detecta vía identities:[] y se muestra 'Este correo ya tiene una cuenta registrada.' de inmediato."),
    ("CP003", "Datos inválidos", "Sistema muestra errores de validación por campo", "PARCIAL",
     "Sí valida (nombre vacío, distrito no seleccionado, contraseña sin mayúscula/número/símbolo/8+ caracteres, dominio de correo no institucional) con mensajes específicos -- pero se muestra un mensaje a la vez, no errores simultáneos por cada campo."),
]),
("HU002", "Administrador del Sistema", "iniciar sesión con mis credenciales", "acceder a las funcionalidades correspondientes a mi rol", [
    ("CP004", "Login exitoso", "Sistema autentica y redirige al dashboard según rol", "OK",
     "signInWithPassword + carga de perfil (rol/colegio/distrito) antes de renderizar contenido."),
    ("CP005", "Credenciales inválidas", "Sistema muestra mensaje de error genérico", "OK",
     "'Correo o contraseña incorrectos.' -- mensaje genérico, no revela cuál de los dos es incorrecto."),
    ("CP006", "Cuenta desactivada", "Sistema muestra mensaje 'Cuenta inactiva'", "NO",
     "Verificado en el código (useAuth.ts): el login NO consulta el campo activo antes de autenticar. Un usuario desactivado por un admin SÍ puede iniciar sesión con Supabase Auth con éxito -- el bloqueo de 'activo' solo se usa para RLS de otras tablas, no para impedir el login en sí."),
]),
("HU003", "Administrador del Sistema", "cerrar mi sesión de forma segura", "proteger los datos sensibles del sistema", [
    ("CP007", "Cierre voluntario", "Sistema invalida el token y redirige al login", "OK",
     "Botón 'Salir' -> signOut()."),
    ("CP008", "Cierre por inactividad", "Sistema cierra sesión automáticamente", "OK",
     "Implementado esta sesión: 30 minutos sin mousemove/keydown/click/touch/scroll -> logout automático con motivo registrado en auditoría."),
]),
("HU004", "Administrador del Sistema", "recuperar mi contraseña en caso de olvido", "recobrar el acceso al sistema sin asistencia técnica", [
    ("CP009", "Email registrado", "Sistema envía enlace de recuperación al correo", "OK",
     "resetPasswordForEmail con redirectTo a la propia app."),
    ("CP010", "Email no registrado", "Sistema muestra mensaje genérico (no expone cuentas)", "OK",
     "Comportamiento nativo de Supabase Auth: responde igual exista o no la cuenta, sin filtrar información."),
]),
("HU005", "Administrador del Sistema", "gestionar los usuarios del sistema (alta, baja, roles) y asignar colegios a coordinadores", "controlar quién accede y con qué nivel de permisos", [
    ("CP011", "Crear usuario nuevo", "Sistema registra usuario y envía email de invitación", "PARCIAL",
     "Crea el usuario y le asigna colegio/distrito correctamente. La 'invitación' no es un flujo dedicado: la contraseña la define el propio admin en el formulario (debe comunicarla aparte) y el único correo automático es la confirmación estándar de Supabase (si esa opción está activa en el proyecto)."),
    ("CP012", "Desactivar usuario", "Sistema bloquea el acceso del usuario", "PARCIAL",
     "El registro queda marcado activo=false y RLS bloquea la mayoría de sus lecturas/escrituras -- pero (ver CP006) el login en sí no lo detiene: puede autenticarse igual, solo se queda sin poder ver datos."),
    ("CP013", "Cambiar rol de usuario", "Sistema actualiza permisos y registra el cambio en auditoría", "OK",
     "Implementado esta sesión: select editable de rol en UsuariosView + insertAudit."),
    ("CP014", "Crear cuenta de Coordinador y asignar colegio", "Sistema crea la cuenta, la asocia al colegio seleccionado y envía email de invitación", "PARCIAL",
     "Misma observación que CP011: crea y asocia correctamente, pero sin un flujo de invitación dedicado."),
]),
("HU006", "Administrador del Sistema", "auditar los accesos al sistema", "cumplir con la normativa de protección de datos de menores", [
    ("CP015", "Consultar log de accesos", "Sistema muestra histórico de accesos", "OK",
     "Tabla audit_log + panel de auditoría en UsuariosView."),
    ("CP016", "Filtrar por usuario o fecha", "Sistema muestra resultados filtrados", "OK",
     "Implementado esta sesión: filtros de usuario y rango de fechas (desde/hasta) en AuditPanel."),
]),
("HU007", "Coordinador Académico", "identificar estudiantes con riesgo de bajo rendimiento", "intervenir oportunamente", [
    ("CP017", "Predicción exitosa", "Sistema muestra lista de estudiantes en riesgo", "OK",
     "Dashboard EM2022 y de colegio propio muestran el ranking de riesgo con datos reales."),
    ("CP018", "Sin datos suficientes", "Sistema muestra mensaje 'Datos insuficientes'", "PARCIAL",
     "El sistema maneja el caso técnicamente sin caerse (cae a modo descriptivo o marca 'sin varianza' en el entrenamiento), pero no le muestra al coordinador ese mensaje literal en el dashboard."),
    ("CP019", "Error de procesamiento", "Sistema muestra mensaje de error", "PARCIAL",
     "Hay manejo de errores de conexión al backend (toast, indicador de estado), pero no un mensaje específico y distinto para 'el modelo falló' vs. 'no hay conexión'."),
]),
("HU008", "Coordinador Académico", "visualizar el nivel de riesgo de los estudiantes", "facilitar la toma de decisiones", [
    ("CP020", "Visualización correcta", "Sistema muestra niveles: alto, medio, bajo", "OK",
     "Badges de color ALTO/MEDIO/BAJO en ambos dashboards, consistentes en toda la app."),
    ("CP021", "Sin resultados", "Sistema muestra 'No hay datos disponibles'", "OK",
     "Patrón EmptyState usado de forma consistente en toda la app para este caso."),
]),
("HU009", "Coordinador Académico", "clasificar a los estudiantes según su nivel de riesgo", "priorizar intervenciones", [
    ("CP022", "Clasificación automática", "Sistema agrupa estudiantes por nivel de riesgo", "OK",
     "Clasificación automática vía umbrales de probabilidad calibrada (70%/45%)."),
    ("CP023", "Actualización de clasificación", "Sistema actualiza la clasificación", "OK",
     "Al recargar Excel/CSV, se reentrena y la clasificación se recalcula por completo."),
]),
("HU010", "Coordinador Académico", "automatizar el análisis del rendimiento estudiantil", "reducir el trabajo manual de revisión", [
    ("CP024", "Análisis automático", "Sistema ejecuta predicción automáticamente", "OK",
     "El pipeline de ETL + entrenamiento corre automático al cargar el archivo, sin pasos manuales intermedios."),
    ("CP025", "Error en datos", "Sistema muestra error de validación", "OK",
     "advertencias_carga captura hojas/filas problemáticas y las reporta en la UI."),
]),
("HU011", "Administrador del Sistema", "ejecutar el modelo predictivo con un solo botón", "simplificar la operación periódica del sistema", [
    ("CP026", "Ejecución exitosa", "Sistema genera resultados y los almacena", "OK",
     "Botón único 'Seleccionar Excel de notas y conducta' dispara todo el flujo end-to-end."),
    ("CP027", "Error de ejecución", "Sistema muestra advertencia con causa específica", "PARCIAL",
     "Si el entrenamiento falla, se muestra el error técnico crudo del proceso (stderr), no una advertencia traducida a lenguaje de negocio."),
]),
("HU012", "Coordinador Académico", "conocer los factores específicos que elevan el riesgo de un estudiante", "diseñar estrategias de intervención personalizadas", [
    ("CP028", "Factores visibles por estudiante", "Sistema muestra los 3 factores que más impactan su riesgo", "PARCIAL",
     "Completo en EM2022 (SHAP por estudiante, ShapBar muestra la contribución de cada factor). En colegio propio no hay SHAP -- se explica con el desglose de notas por área como proxy, sin cuantificar 'los 3 que más impactan'."),
    ("CP029", "Estudiante sin predicción", "Sistema indica que debe ejecutarse la predicción primero", "PARCIAL",
     "Se muestra 'Cargando análisis de factores...' mientras carga, pero no un mensaje explícito de 'ejecuta la predicción primero' cuando no existe ninguna."),
]),
("HU013", "Coordinador Académico", "visualizar indicadores globales del colegio", "evaluar el desempeño institucional", [
    ("CP030", "Visualización correcta", "Sistema muestra KPIs", "OK",
     "Grids de KPI (alumnos, en riesgo, alto/medio/bajo) en ambos dashboards."),
    ("CP031", "Sin datos", "Sistema muestra advertencia", "OK",
     "Paneles dedicados 'Sin colegio asignado' / 'Sin datos' para admin/director/coordinador sin modelo cargado."),
]),
("HU014", "Coordinador Académico", "ver un ranking de estudiantes según nivel de riesgo", "identificar rápidamente los casos más críticos", [
    ("CP032", "Ranking descendente correcto", "Sistema muestra estudiantes ordenados por riesgo", "OK",
     "Tabla ordenada por probabilidad descendente en ambos dashboards."),
    ("CP033", "Sin datos disponibles", "Sistema muestra mensaje de ausencia de datos", "OK",
     "EmptyState 'No hay alumnos con el filtro seleccionado.'"),
]),
("HU015", "Coordinador Académico", "filtrar estudiantes por grado o sección", "analizar grupos específicos", [
    ("CP034", "Filtro por grado correcto", "Sistema muestra estudiantes filtrados", "OK",
     "Filtros de grado y sección (colegio propio) / distrito y sexo (EM2022), aplicados en tiempo real."),
    ("CP035", "Filtro sin coincidencias", "Sistema muestra lista vacía con mensaje", "OK",
     "Mismo patrón EmptyState."),
]),
("HU016", "Coordinador Académico", "visualizar la distribución de estudiantes por nivel de riesgo", "tener una visión general rápida", [
    ("CP036", "Gráfico correcto", "Sistema muestra gráfico de distribución", "OK",
     "Gráfico de dona (Recharts) con ALTO/MEDIO/BAJO en ambos dashboards."),
    ("CP037", "Datos insuficientes", "Sistema muestra advertencia", "OK",
     "EmptyState 'Sin datos para el filtro seleccionado.'"),
]),
("HU017", "Coordinador Académico", "ver una explicación simple del riesgo por estudiante", "justificar decisiones ante docentes y padres", [
    ("CP038", "Explicación generada", "Sistema muestra explicación clara en lenguaje natural", "OK",
     "Funciones recommendation()/recommendationFromShap() generan texto en español simple, no jerga técnica."),
    ("CP039", "Estudiante no encontrado", "Sistema muestra error 'Estudiante no existe'", "PARCIAL",
     "El diseño actual no permite buscar por un ID libre que pueda no existir -- los alumnos siempre se eligen de una lista ya cargada, así que este escenario no aplica tal como está redactado (no es un bug, es un supuesto que no calza con el flujo real)."),
]),
("HU018", "Coordinador Académico", "ver el historial académico de un estudiante en un solo lugar", "analizar su evolución completa", [
    ("CP040", "Historial completo", "Sistema muestra historial integrado", "OK",
     "ColegioEstudianteView (trayectoria por bimestre, gráfico de línea) y EstudianteView (resumen, anotaciones, plan) en una sola pantalla."),
    ("CP041", "Historial inexistente", "Sistema muestra advertencia", "OK",
     "EmptyState 'No hay alumno seleccionado.'"),
]),
("HU019", "Coordinador Académico", "recibir alertas de estudiantes en riesgo", "tomar medidas rápidamente", [
    ("CP042", "Alerta generada", "Sistema envía alerta por canal configurado", "OK",
     "Implementado esta sesión: alerta automática por correo (Resend vía Edge Function) al detectar nuevos casos ALTO tras un reentrenamiento."),
    ("CP043", "Sin estudiantes en riesgo", "No se generan alertas", "OK",
     "El código solo dispara el envío si nuevos_alto > 0."),
]),
("HU020", "Coordinador Académico", "recibir recomendaciones de acciones de intervención", "mejorar el rendimiento académico", [
    ("CP044", "Recomendación generada", "Sistema muestra acciones sugeridas", "OK",
     "recommendation()/recommendationFromShap() como texto sugerido al registrar una intervención."),
    ("CP045", "Sin recomendaciones disponibles", "Sistema muestra 'Sin recomendaciones disponibles'", "NO",
     "Las reglas de recomendación están fijas en el código (no son un catálogo configurable), así que siempre generan alguna sugerencia -- el estado 'sin reglas configuradas' no existe en el diseño actual."),
]),
("HU021", "Coordinador Académico", "priorizar estudiantes según urgencia de intervención", "actuar primero sobre los casos más críticos", [
    ("CP046", "Priorización correcta", "Sistema ordena por urgencia", "OK",
     "Banner 'Resumen ejecutivo' y tablas ordenadas por probabilidad de riesgo descendente."),
    ("CP047", "Empate de prioridad", "Sistema ordena por criterio secundario (promedio o asistencia)", "NO",
     "No existe un criterio de desempate explícito -- si dos alumnos tienen exactamente la misma probabilidad, mantienen el orden en que llegaron del backend, no un segundo criterio intencional."),
]),
("HU022", "Coordinador Académico", "segmentar estudiantes por tipo de riesgo", "aplicar estrategias específicas a cada segmento", [
    ("CP048", "Segmentación exitosa", "Sistema agrupa por tipo de riesgo", "PARCIAL",
     "Completo en EM2022 (campo tipo_riesgo con filtro dedicado: 'Bajo en Lectura', 'Rendimiento múltiple', etc.). El modelo de colegio propio solo segmenta por nivel (ALTO/MEDIO/BAJO), no por tipo específico."),
    ("CP049", "Datos incompletos", "Sistema muestra segmentación parcial", "PARCIAL",
     "Mismo límite: aplica solo donde existe tipo_riesgo (EM2022)."),
]),
("HU023", "Coordinador Académico", "registrar las intervenciones realizadas a estudiantes", "hacer seguimiento a las acciones tomadas", [
    ("CP050", "Registro exitoso", "Sistema almacena correctamente", "OK",
     "Formulario 'Registrar' guarda en la tabla intervenciones, ahora correctamente scopeado por colegio/distrito (fuga de seguridad cerrada en esta ronda de QA)."),
    ("CP051", "Error en registro", "Sistema muestra error de validación", "PARCIAL",
     "Casi todos los campos tienen un valor por defecto (la descripción cae a la recomendación automática si se deja vacía), así que es difícil disparar realmente un error de validación -- no hay un caso claro de 'datos incompletos' bloqueado."),
]),
("HU024", "Coordinador Académico", "monitorear el riesgo académico en el tiempo", "evaluar la efectividad de las intervenciones", [
    ("CP052", "Seguimiento disponible", "Sistema muestra historial de riesgo por periodo", "OK",
     "Implementado esta sesión: panel 'Histórico de reentrenamientos' con gráfico de línea ALTO/MEDIO/BAJO por versión del modelo."),
    ("CP053", "Sin historial", "Sistema muestra 'Sin datos históricos'", "OK",
     "EmptyState 'Aún no hay versiones registradas...'"),
]),
("HU025", "Coordinador Académico", "generar reportes históricos del rendimiento estudiantil", "analizar tendencias en el tiempo", [
    ("CP054", "Reporte generado", "Sistema genera el informe en PDF", "PARCIAL",
     "El histórico de versiones se exporta en CSV, no PDF (sí existe generación de PDF para el reporte individual de un estudiante, pero es una función distinta)."),
    ("CP055", "Sin datos históricos", "Sistema muestra mensaje 'Sin datos históricos'", "OK",
     "Mismo EmptyState que CP053."),
]),
("HU026", "Coordinador Académico", "comparar el riesgo entre periodos académicos", "evaluar cambios en el desempeño institucional", [
    ("CP056", "Comparación correcta", "Sistema muestra comparación entre periodos", "OK",
     "El gráfico de línea del histórico permite comparar visualmente la distribución de riesgo entre reentrenamientos sucesivos."),
    ("CP057", "Periodos inválidos", "Sistema muestra advertencia", "NO",
     "No hay un selector manual de 'periodo A vs. periodo B' que pueda recibir una selección inválida -- el gráfico siempre muestra todo el histórico disponible; este escenario no aplica al diseño actual."),
]),
("HU027", "Coordinador Académico", "exportar listados de estudiantes en riesgo", "compartirlos con el equipo docente", [
    ("CP058", "Exportación exitosa", "Sistema genera el archivo CSV o PDF", "OK",
     "exportCsv/exportXlsx en el dashboard EM2022, más exportación en ReportesView."),
    ("CP059", "Error en exportación", "Sistema muestra error con causa", "PARCIAL",
     "No hay manejo visible de error específico si la generación del archivo falla (no se ha observado que falle, pero tampoco hay un mensaje preparado para ese caso)."),
]),
("HU028", "Administrador del Sistema", "integrar datos de distintas fuentes institucionales", "tener una visión completa del estudiante", [
    ("CP060", "Integración correcta", "Sistema consolida los datos", "PARCIAL",
     "El sistema combina el dataset nacional EM2022 (CSV) con las notas internas de cada colegio (Excel, 2 formatos distintos soportados) en un mismo selector de colegios -- es una integración real, aunque no vía APIs externas en vivo como sugiere la redacción original de la HU."),
    ("CP061", "Error en fuente", "Sistema muestra error con la fuente afectada", "PARCIAL",
     "Hay manejo genérico de 'backend desconectado', pero no identifica por nombre cuál fuente específica falló."),
]),
("HU029", "Administrador del Sistema", "limpiar y validar los datos automáticamente", "asegurar la calidad de la información", [
    ("CP062", "Limpieza exitosa", "Sistema corrige inconsistencias y reporta cambios", "OK",
     "Deduplicación por (salón, n° alumno) promediando notas repetidas; advertencias_carga reporta qué se omitió y por qué."),
    ("CP063", "Error en datos", "Sistema reporta los errores encontrados", "OK",
     "Manejo de valores no numéricos, columnas vacías (fallback a mediana o exclusión de la feature) sin romper el entrenamiento."),
]),
("HU030", "Administrador del Sistema", "actualizar periódicamente la base de datos de estudiantes", "mantener la información vigente", [
    ("CP064", "Actualización automática", "Sistema actualiza los datos", "NO",
     "scheduleFreq/saveSchedule/nextUpdate son controles de UI sin ningún cron real detrás -- es la única funcionalidad de las 36 HUs que queda pendiente de una decisión de producto (implementarla en serio o retirarla)."),
    ("CP065", "Fallo en actualización", "Sistema muestra alerta al administrador", "NO",
     "No aplica: no existe el proceso programado real que pueda fallar."),
]),
("HU031", "Administrador del Sistema", "cargar datos al sistema mediante archivos", "facilitar la actualización masiva de información", [
    ("CP066", "Carga exitosa", "Sistema procesa los datos y reporta cantidad cargada", "OK",
     "Tarjetas de resultado (alumnos procesados, en riesgo, % riesgo) tras cada carga. Disponible para superadmin, admin, director y coordinador (ampliado en esta ronda de QA)."),
    ("CP067", "Archivo inválido", "Sistema rechaza el archivo con detalle del error", "OK",
     "Validación de extensión (.xlsx/.xls) y tamaño máximo (20MB) agregada en esta ronda de QA, más las advertencias por hoja no reconocida."),
]),
("HU032", "Administrador del Sistema", "visualizar los errores en los datos cargados", "corregir inconsistencias rápidamente", [
    ("CP068", "Detección de errores", "Sistema muestra lista de filas con errores y la causa", "OK",
     "advertencias_carga lista hojas/archivos omitidos con el motivo."),
    ("CP069", "Sin errores", "Sistema confirma validación exitosa", "PARCIAL",
     "La ausencia de advertencias es implícita (no aparece ninguna) pero no hay un mensaje explícito de '0 errores, todo válido'."),
]),
("HU033", "Administrador del Sistema", "ajustar los parámetros del modelo predictivo", "adaptarlo al contexto específico del colegio", [
    ("CP070", "Ajuste exitoso", "Sistema guarda y aplica los cambios al próximo entrenamiento", "PARCIAL",
     "Los sliders de umbral ALTO/MEDIO (ModeloView) se aplican de inmediato sobre las probabilidades ya calculadas, no específicamente 'en el próximo entrenamiento' -- y son umbrales de clasificación, no hiperparámetros del algoritmo (decisión consciente: exponer eso a un usuario sin formación en ML es más riesgo que beneficio)."),
    ("CP071", "Parámetro inválido", "Sistema muestra error de validación", "OK",
     "Los sliders tienen mínimo/máximo fijos en la propia UI -- físicamente no se puede ingresar un valor fuera de rango."),
]),
("HU034", "Administrador del Sistema", "entrenar el modelo con nuevos datos institucionales", "mejorar la precisión de las predicciones", [
    ("CP072", "Entrenamiento exitoso", "Sistema reentrena y registra nueva versión del modelo", "OK",
     "Cada carga de Excel reentrena y registra la versión en modelos_versiones (implementado esta sesión)."),
    ("CP073", "Datos insuficientes", "Sistema muestra advertencia y no reentrena", "PARCIAL",
     "El sistema entrena igual pero cae a 'modo descriptivo' (menos preciso) o marca 'sin varianza' cuando los datos no alcanzan -- no bloquea el reentrenamiento, lo degrada con aviso."),
]),
("HU035", "Administrador del Sistema", "visualizar la importancia global de variables que aprende el modelo de ML", "validar que el modelo identifica correctamente los predictores académicos", [
    ("CP074", "Importancia disponible", "Sistema muestra ranking global de variables del modelo", "PARCIAL",
     "Completo en EM2022 (SHAP global en ModeloView). El modelo de colegio propio no expone importancia de variables -- misma limitación de escala que HU012/HU022 (muestras por colegio demasiado chicas para SHAP confiable)."),
    ("CP075", "Modelo no disponible", "Sistema muestra mensaje de error", "OK",
     "Manejo de 'sin modelo entrenado' generalizado en varias vistas."),
]),
("HU036", "Administrador del Sistema", "gestionar y exponer la fecha de última actualización del modelo (visible para Admin y Coordinador Académico)", "que ambos roles puedan asegurar que se trabaja con información vigente", [
    ("CP076", "Fecha visible", "Sistema muestra la fecha en dashboard de Admin y Coordinador Académico", "OK",
     "trained_at mostrado en el encabezado del colegio y en el panel de datos, visible para todos los roles con acceso."),
    ("CP077", "Sin actualización reciente", "Sistema muestra advertencia de modelo desactualizado", "NO",
     "Se muestra la fecha, pero no hay un umbral de 'antigüedad máxima' que dispare una advertencia automática de modelo desactualizado."),
]),
]
