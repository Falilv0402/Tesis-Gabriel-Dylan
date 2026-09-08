# Matriz de cobertura de Historias de Usuario — Estado real

**Fuente:** `docs/excel/P20261012_HUs_v3 (1).xlsx` (36 HUs, 7 épicas) — este documento reemplaza la versión anterior (planificación temprana, referenciaba `legacy-streamlit` y funcionalidad "prevista") con el **estado real de implementación** verificado contra el código del monorepo.

**Última actualización:** Septiembre 2026

**Leyenda:** ✅ Implementado y desplegado en producción · 🟡 Parcial (implementado en un modelo/contexto pero no en el otro, o con alcance reducido a propósito) · ⭕ Pendiente

---

## Resumen

| Estado | Cantidad |
|---|---:|
| ✅ Implementado | 31 |
| 🟡 Parcial | 4 |
| ⭕ Pendiente | 1 |
| **Total** | **36** |

Las 4 HUs parciales (HU012, HU022, HU033, HU035) comparten un patrón: están completas para el **modelo EM 2022** (que tiene el pipeline de interpretabilidad más rico — ver `JUSTIFICACION_MODELO_PREDICTIVO.md`) pero reducidas o ausentes en el **modelo de colegio propio**, por la misma razón de escala explicada en ese documento (Sección 0.6). La única HU pendiente (HU030) es una decisión de producto abierta, no un olvido técnico.

---

## EP01 — Acceso y Seguridad

| HU | Quiere... | Estado | Evidencia |
|---|---|:---:|---|
| HU001 | Registrarse en el sistema | ✅ | `AuthView.tsx` (tab Registro) + Supabase Auth `signUp` |
| HU002 | Iniciar sesión con credenciales | ✅ | `AuthView.tsx` + Supabase Auth `signInWithPassword` |
| HU003 | Cerrar sesión de forma segura (incl. por inactividad) | ✅ | `useAuth.ts` — `handleLogout` + timeout de inactividad de 30 min (mousemove/keydown/scroll) |
| HU004 | Recuperar contraseña | ✅ | `useAuth.ts` — `supabase.auth.resetPasswordForEmail` + link "Recuperar contraseña" en `AuthView.tsx` |
| HU005 | Gestionar usuarios (alta/baja/roles) y asignar colegios a coordinadores | ✅ | `UsuariosView.tsx` — crear, `desactivarUsuario`/`activarUsuario`, `cambiarRolUsuario`; `newUserColegioIe` asigna IE a director/coordinador |
| HU006 | Auditar los accesos al sistema | ✅ | Tabla `audit_log` + `AuditPanel` (`UsuariosView.tsx`) con filtro por usuario y rango de fechas |

## EP02 — Predicción y Clasificación de Riesgo

| HU | Quiere... | Estado | Evidencia |
|---|---|:---:|---|
| HU007 | Identificar estudiantes con riesgo de bajo rendimiento | ✅ | Modelo EM 2022 (`backend-ml`) + modelo híbrido de colegio propio (`train_colegio_model.py`) |
| HU008 | Visualizar el nivel de riesgo de los estudiantes | ✅ | Badges ALTO/MEDIO/BAJO en `DashboardView.tsx` y `ColegioDashboardView.tsx` |
| HU009 | Clasificar estudiantes según nivel de riesgo | ✅ | Mismo mecanismo — umbrales de probabilidad calibrada (70%/45%) |
| HU010 | Automatizar el análisis del rendimiento estudiantil | ✅ | El pipeline de ETL + entrenamiento corre automáticamente al cargar el Excel/CSV, sin pasos manuales intermedios |
| HU011 | Ejecutar el modelo predictivo con un solo botón | ✅ | Botón "Seleccionar Excel de notas y conducta" (`DatosView.tsx`) dispara parseo + entrenamiento en un solo flujo; "Reentrenar" en `ModeloView.tsx` para EM 2022 |

## EP03 — Análisis y Visualización de Estudiantes

| HU | Quiere... | Estado | Evidencia |
|---|---|:---:|---|
| HU012 | Conocer los factores específicos que elevan el riesgo de un estudiante | 🟡 | **EM 2022**: completo, valores SHAP individuales por estudiante (`ShapBar`, `EstudianteView.tsx`). **Colegio propio**: sin SHAP — el desglose de notas por área (`ColegioEstudianteView.tsx`) actúa como proxy explicativo, pero no cuantifica contribución marginal |
| HU013 | Visualizar indicadores globales del colegio | ✅ | KPI grids en ambos dashboards |
| HU014 | Ver un ranking de estudiantes según nivel de riesgo | ✅ | `StudentTable` (EM 2022) y tabla "Alumnos por urgencia" (colegio propio), ordenadas por probabilidad |
| HU015 | Filtrar estudiantes por grado o sección | ✅ | Filtros de grado/sección/bimestre en `ColegioDashboardView.tsx`; distrito/sexo/tipo de riesgo en `DashboardView.tsx` |
| HU016 | Visualizar la distribución de estudiantes por nivel de riesgo | ✅ | Gráficos de dona (Recharts) en ambos dashboards |
| HU017 | Ver una explicación simple del riesgo por estudiante | ✅ | `recommendation()` / `recommendationFromShap()` (`lib/format.ts`) — texto en lenguaje simple, no jerga técnica |
| HU018 | Ver el historial académico de un estudiante en un solo lugar | ✅ | `ColegioEstudianteView.tsx` (trayectoria por bimestre, gráfico de línea) y `EstudianteView.tsx` (resumen, anotaciones, plan) |

## EP04 — Priorización e Intervención

| HU | Quiere... | Estado | Evidencia |
|---|---|:---:|---|
| HU019 | Recibir alertas de estudiantes en riesgo | ✅ | Alerta proactiva automática por correo al detectar nuevos casos ALTO tras un reentrenamiento (`_alertar_nuevos_alto`, `colegio_propio.py`) + envío manual desde `IntervencionesView.tsx` |
| HU020 | Recibir recomendaciones de acciones de intervención | ✅ | `recommendation()`/`recommendationFromShap()` como placeholder sugerido al registrar una intervención |
| HU021 | Priorizar estudiantes según urgencia de intervención | ✅ | Banner "Resumen ejecutivo" (`AttentionBanner.tsx`) al inicio de ambos dashboards, ordenado por probabilidad de riesgo, con acción "Intervenir" a un clic |
| HU022 | Segmentar estudiantes por tipo de riesgo | 🟡 | **EM 2022**: completo, campo `tipo_riesgo` con filtro dedicado. **Colegio propio**: solo segmenta por nivel (ALTO/MEDIO/BAJO), no por tipo de riesgo específico |
| HU023 | Registrar las intervenciones realizadas | ✅ | `IntervencionesView.tsx` / `ColegioIntervencionesView.tsx` — formulario + bitácora con estado (pendiente/en proceso/cerrada) |

## EP05 — Seguimiento Histórico y Reportes

| HU | Quiere... | Estado | Evidencia |
|---|---|:---:|---|
| HU024 | Monitorear el riesgo académico en el tiempo | ✅ | Panel "Histórico de reentrenamientos" (`DatosView.tsx`) — gráfico de línea ALTO/MEDIO/BAJO por versión del modelo |
| HU025 | Generar reportes históricos del rendimiento estudiantil | ✅ | Exportación CSV del histórico + `ReportesView.tsx`/`ColegioReportesView.tsx` |
| HU026 | Comparar el riesgo entre periodos académicos | ✅ | Mismo panel de histórico — cada fila de `modelos_versiones` es una foto de la distribución de riesgo en ese momento |
| HU027 | Exportar listados de estudiantes en riesgo | ✅ | `exportCsv`/`exportXlsx` (EM 2022), exportación en `ReportesView.tsx` |

## EP06 — Gestión de Datos

| HU | Quiere... | Estado | Evidencia |
|---|---|:---:|---|
| HU028 | Integrar datos de distintas fuentes institucionales | ✅ | Dataset nacional EM 2022 (CSV) + notas internas por colegio (Excel, dos formatos soportados: CUBICOL y Reporte consolidado) unificados en un mismo selector de colegios |
| HU029 | Limpiar y validar los datos automáticamente | ✅ | `csvValidation` (EM 2022) + `advertencias_carga` (colegio propio) — hojas/filas con error se reportan, no se descartan en silencio |
| HU030 | Actualizar periódicamente la base de datos de estudiantes | ⭕ | `scheduleFreq`/`saveSchedule`/`nextUpdate` existen en la UI pero no disparan ningún cron real — es código cosmético. **Decisión de producto pendiente**: implementar un cron real o retirar la funcionalidad |
| HU031 | Cargar datos al sistema mediante archivos | ✅ | Carga de Excel — superadmin (cualquier IE), y desde esta sesión también admin/director/coordinador (limitados a su propia IE) — `DatosView.tsx`, `require_admin_de_colegio` en `colegio_propio.py` |
| HU032 | Visualizar los errores en los datos cargados | ✅ | Tabla de errores de validación (CSV) + lista de `advertencias_carga` (Excel) visibles inmediatamente tras la carga |

## EP07 — Mantenimiento del Modelo ML

| HU | Quiere... | Estado | Evidencia |
|---|---|:---:|---|
| HU033 | Ajustar los parámetros del modelo predictivo | 🟡 | Sliders de umbral ALTO/MEDIO (`ModeloView.tsx`, `type="range"`) — ajustan el punto de corte de clasificación sobre la probabilidad calibrada. Decisión consciente de **no** exponer hiperparámetros del algoritmo (n_estimators, C, etc.) directamente al usuario final, por riesgo de que una persona sin formación en ML degrade el modelo sin darse cuenta |
| HU034 | Entrenar el modelo con nuevos datos institucionales | ✅ | Cada carga de Excel reentrena el modelo del colegio y registra la versión en `modelos_versiones` (`_registrar_version_modelo`) |
| HU035 | Visualizar la importancia global de variables | 🟡 | **EM 2022**: completo, SHAP global (`ModeloView.tsx`). **Colegio propio**: no expone importancia de variables — limitación reconocida (ver `JUSTIFICACION_MODELO_PREDICTIVO.md`, Sección 0.6) |
| HU036 | Gestionar y exponer la fecha de última actualización del modelo (Admin y Coordinador) | ✅ | `trained_at` mostrado en el encabezado del colegio (`colegio-hero`) y en `DatosView.tsx`, visible para todos los roles con acceso a esos datos |

---

## Notas metodológicas

- Este documento se construyó leyendo directamente el Excel fuente (`P20261012_HUs_v3 (1).xlsx`, hoja `HU`) para obtener el enunciado exacto de las 36 historias, y contrastando cada una contra el código real del monorepo (no contra intención o documentación de diseño) — evita el desfase que tenía la versión anterior de este archivo, escrita antes de la mayoría de estas funcionalidades.
- Los casos de prueba (`docs/excel/Casos de prueba (1).xlsx`, CP001-CP077) no se re-auditaron individualmente en esta pasada; la Fase 8 (QA final, ver `PLAN_EJECUCION_DESPLIEGUE_2026.md`) es donde corresponde ejecutarlos contra producción con cuentas reales de cada rol.
- Las 4 HUs marcadas 🟡 no son bugs — son el costo de diseño explícito de tener un modelo específico por colegio en vez de uno solo nacional (ver `JUSTIFICACION_MODELO_PREDICTIVO.md`, Sección 0.6). Cerrarlas para el modelo de colegio propio requeriría SHAP/interpretabilidad a nivel de muestras pequeñas, que no es estadísticamente confiable con los tamaños de colegio actuales (decenas a cientos de alumnos).
