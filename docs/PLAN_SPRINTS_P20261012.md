# Plan de Sprints — Proyecto P20261012
## Sistema de Alerta Temprana de Riesgo Académico (SARA)
**UPC · Taller de Proyectos I · Ingeniería de Sistemas de Información**
*Última actualización: Mayo 2026*

---

## 1. Información general

| Campo | Detalle |
|---|---|
| **Código del proyecto** | P20261012 |
| **Curso** | Taller de Proyectos I |
| **Carrera** | Ingeniería de Sistemas de Información |
| **Project Manager** | Torres Saldaña, Gabriel Alonso |
| **Scrum Manager** | Tong Barahona, Dylan |
| **Product Owner** | Jose Luis Santisteban Pazos |
| **Total de HUs** | 35 historias de usuario · 73 escenarios |
| **Épicas** | 7 (EP01 — EP07) |
| **Roles del sistema** | Administrador del Sistema · Director / Coordinador Académico |

---

## 2. Estructura de Sprints

| Sprint | Semanas UPC | Dailies | Foco temático |
|---|---|---|---|
| **Sprint 1** | Sem 4, 5, 6 | 9 daily scrums (3 por semana) | Fundamentos · Modelo ML · Diseño de arquitectura |
| **Sprint 2** | Sem 7, 8, 9 | 9 daily scrums | Backend ML (FastAPI) + Backend Principal (Supabase) |
| **Sprint 3** | Sem 10, 11, 12 | 9 daily scrums | Frontend Next.js + Vistas core (Director y Admin) |
| **Sprint 4** | Sem 13, 14, 15 | 9 daily scrums | Features avanzadas + Despliegue + Sustentación |

**Cadencia:** 3 daily scrums por semana × 3 semanas = 9 dailies por sprint.

---

## 3. Arquitectura objetivo (resumen)

| Capa | Stack | Responsabilidad |
|---|---|---|
| **Frontend** | Next.js 14 · TypeScript · Tailwind · shadcn/ui · Plotly.js | Vistas Admin y Director, intervenciones, reportes, visualizaciones |
| **Backend Principal** | Supabase (Auth, Storage, Edge Functions, Realtime) | Autenticación con roles, almacenamiento, lógica de negocio, notificaciones |
| **Backend ML** | FastAPI (Python) | Endpoints `/predecir`, `/reentrenar`, `/metricas`, `/importancia`, `/diagnostico` |
| **Capa ML** | scikit-learn · LightGBM · XGBoost · SHAP · Optuna · FLAML | Modelo predictivo, calibración, interpretabilidad, tuning, validación |
| **Base de Datos** | Postgres (Supabase) | 7 tablas: profiles, estudiantes, notas_periodos, predicciones, intervenciones, modelos_versiones, audit_log |
| **Cloud** | Vercel · Supabase Cloud · Railway/Render · Resend · GitHub Actions · Sentry | Despliegue, CI/CD, monitoreo, notificaciones email |

Referencia visual: [Arquitectura_P20261012.drawio](Arquitectura_P20261012.drawio) y [Arquitectura_Fisica_P20261012.drawio](Arquitectura_Fisica_P20261012.drawio).

---

## 4. Catálogo de Épicas y HUs

| Épica | Nombre | HUs incluidas |
|---|---|---|
| **EP01** | Acceso y Seguridad | HU001, HU002, HU003, HU004, HU005 |
| **EP02** | Predicción y Clasificación de Riesgo | HU006, HU007, HU008, HU009, HU010 |
| **EP03** | Análisis y Visualización de Estudiantes | HU011, HU012, HU013, HU014, HU015, HU016, HU017 |
| **EP04** | Priorización e Intervención | HU018, HU019, HU020, HU021, HU022 |
| **EP05** | Seguimiento Histórico y Reportes | HU023, HU024, HU025, HU026 |
| **EP06** | Gestión de Datos | HU027, HU028, HU029, HU030, HU031 |
| **EP07** | Mantenimiento del Modelo ML | HU032, HU033, HU034, HU035 |

---

# 5. SPRINT 1 — Semanas 4, 5, 6

## Sprint Goal

> *Tener el modelo ML (Logistic Regression / LightGBM / XGBoost / Random Forest con comparativa GroupKFold, calibración isotónica, SHAP, y métricas completas) entrenado sobre el dataset real EM 2022 Lima Metropolitana privada 2.° grado, con GroupShuffleSplit por IE, y documentado; dejando las bases listas para iniciar el desarrollo de back y front.*

## HUs comprometidas

| HU | Título | Épica | Justificación |
|---|---|---|---|
| **HU010** | Ejecutar el modelo predictivo con un solo botón | EP02 | Núcleo del modelo ML que se entrena en este sprint |
| **HU032** | Ajustar parámetros del modelo predictivo | EP07 | Tuning GridSearchCV + Optuna por algoritmo |
| **HU033** | Entrenar el modelo con nuevos datos institucionales | EP07 | Pipeline completo `train_em_model.py` con EM 2022 |
| **HU034** | Visualizar importancia global de variables | EP07 | SHAP global + permutation importance generados y persistidos |
| **HU035** | Gestionar fecha de última actualización del modelo | EP07 | Timestamp + métricas completas guardadas en `metricas_em.pkl` |

## Detalle por daily

| Sem | Daily | Fecha tentativa | Tarea | HU vinculada |
|---|---|---|---|---|
| **Sem 4** | D1 | Lunes Sem 4 | Kickoff, definición de roles, repositorio Git, convenciones | — |
| | D2 | Miércoles Sem 4 | Definición del problema, KPIs, criterios de éxito, Early Warning Systems | — |
| | D3 | Viernes Sem 4 | Diseño del dataset EM 2022 (12 features + target, GroupShuffleSplit) | HU033 |
| **Sem 5** | D4 | Lunes Sem 5 | EDA sobre EM 2022 (distribuciones, correlaciones, balance de clases, ~4100 registros) | HU033 |
| | D5 | Miércoles Sem 5 | Feature engineering: agregados IE + features relativas (M500_L_relativa, etc.) | HU033 |
| | D6 | Viernes Sem 5 | Comparativa 4 algoritmos con GroupKFold + GridSearchCV + restricciones monotónicas | HU032, HU033 |
| **Sem 6** | D7 | Lunes Sem 6 | Estrategias avanzadas: Stacking, Optuna (40 trials), FLAML (90s), Nested CV, Stability | HU032 |
| | D8 | Miércoles Sem 6 | Calibración isotónica + métricas completas (AUC, Brier, ECE, MCC, H-L) + SHAP + fairness | HU010, HU034, HU035 |
| | D9 | Viernes Sem 6 | Diseño esquema Postgres (7 tablas) + arquitectura lógica + arquitectura física | — |

## Entregables del Sprint 1

- `modelo/train_em_model.py` — pipeline completo de entrenamiento (EM 2022 real)
- `model/modelo_em.pkl` — modelo calibrado serializado
- `model/metricas_em.pkl` — todas las métricas, SHAP, fairness, error_analysis
- [JUSTIFICACION_MODELO_PREDICTIVO.md](JUSTIFICACION_MODELO_PREDICTIVO.md) — justificación completa del modelo
- [MODEL_CARD.md](MODEL_CARD.md) — tarjeta de modelo estándar Mitchell et al. 2019
- [ANALISIS_ERRORES.md](ANALISIS_ERRORES.md) — análisis FN/FP con features relativas
- [Arquitectura_P20261012.drawio](Arquitectura_P20261012.drawio) — arquitectura lógica
- [Arquitectura_Fisica_P20261012.drawio](Arquitectura_Fisica_P20261012.drawio) — arquitectura física
- Esquema SQL inicial de las 7 tablas

## Definition of Done — Sprint 1

- Pipeline entrena completamente en un solo comando: `python modelo/train_em_model.py`
- Dataset: EM 2022 real (~4,100 estudiantes, ~150 IEs, Lima Metropolitana privada 2.° grado)
- Partición: `GroupShuffleSplit(test_size=0.20, groups=ID_IE)` — ninguna IE en ambos conjuntos
- Validación cruzada: `GroupKFold(n_splits=5)` en train para selección de hiperparámetros
- 4 algoritmos comparados (LR, RF, XGBoost, LightGBM) con GridSearchCV
- Estrategias avanzadas ejecutadas: Stacking, Optuna (40 trials), FLAML (90s), Nested CV, Stability
- Calibración isotónica aplicada y validada (ECE < 0.05, H-L p > 0.05)
- 12 features implementadas incluyendo 3 features relativas y restricciones monotónicas
- Métricas almacenadas: AUC, PR-AUC, F1, Accuracy, Recall, Precision, Specificity, Brier, Log-Loss, MCC, ECE, MCE, H-L
- Bootstrap IC95% calculados para AUC, F1, Brier (n=1000)
- SHAP global (12 features) + SHAP interactions (12×12) + PDP (top-3) + permutation importance (n_repeats=20) + ablación
- Fairness audit: sexo, ISE tercil, top-5 distritos con bootstrap CI95% y ECE por subgrupo
- McNemar test y DeLong bootstrap ejecutados y p-valores reportados
- Error analysis: top-20 FN/FP perfilados con M500_L, M500_CN, ISE, prob predicha, sexo
- DCA: curvas de decisión para modelo vs treat-all vs treat-none
- Drift baseline: media/std/min/max/p25/p50/p75 por feature numérica almacenados
- Aprobación del Product Owner sobre calidad del modelo

---

# 6. SPRINT 2 — Semanas 7, 8, 9

## Sprint Goal

> *Levantar las dos capas de backend completamente funcionales: el servicio ML expuesto vía REST (FastAPI) y el backend principal con base de datos, autenticación y storage (Supabase), incluyendo carga masiva de datos.*

## HUs comprometidas

| HU | Título | Épica | Capa |
|---|---|---|---|
| **HU001** | Iniciar sesión con credenciales | EP01 | Auth |
| **HU002** | Cerrar sesión de forma segura | EP01 | Auth |
| **HU003** | Recuperar contraseña en caso de olvido | EP01 | Auth |
| **HU004** | Gestionar usuarios del sistema (alta, baja, roles) | EP01 | Auth |
| **HU005** | Auditar accesos al sistema | EP01 | DB + audit_log |
| **HU006** | Identificar estudiantes con riesgo de bajo rendimiento | EP02 | Endpoint `/predecir` |
| **HU009** | Automatizar el análisis del rendimiento estudiantil | EP02 | Edge Function + cron |
| **HU027** | Integrar datos de distintas fuentes institucionales | EP06 | Edge Function |
| **HU028** | Limpiar y validar los datos automáticamente | EP06 | Edge Function de validación |
| **HU029** | Actualizar periódicamente la base de datos | EP06 | Cron job en Edge Functions |
| **HU030** | Cargar datos al sistema mediante archivos CSV/XLSX | EP06 | Supabase Storage + Edge Function |
| **HU031** | Visualizar errores en datos cargados | EP06 | Endpoint de validación |

## Detalle por daily

| Sem | Daily | Fecha tentativa | Tarea | HU vinculada |
|---|---|---|---|---|
| **Sem 7** | D1 | Lunes Sem 7 | Setup proyecto FastAPI, estructura, carga del `.pkl` en memoria | HU010 (carry over) |
| | D2 | Miércoles Sem 7 | Endpoint `POST /predecir` (batch de estudiantes) | HU006 |
| | D3 | Viernes Sem 7 | Endpoints `GET /metricas`, `GET /importancia`, `GET /diagnostico` | HU034, HU035 |
| **Sem 8** | D4 | Lunes Sem 8 | Endpoint `POST /reentrenar` + versionado de modelos | HU033 |
| | D5 | Miércoles Sem 8 | Setup Supabase, migraciones SQL de las 7 tablas | — |
| | D6 | Viernes Sem 8 | Supabase Auth + roles (admin/director) + Row Level Security | HU001, HU002, HU003, HU004 |
| **Sem 9** | D7 | Lunes Sem 9 | Supabase Storage (CSV uploads, .pkl, reportes PDF) | HU030 |
| | D8 | Miércoles Sem 9 | Edge Functions: validación de schema, cron de actualización, audit_log | HU005, HU027, HU028, HU029, HU031 |
| | D9 | Viernes Sem 9 | Integración FastAPI ↔ Supabase + tests de endpoints + Edge Function automatización | HU009 |

## Entregables del Sprint 2

- API FastAPI desplegada localmente con 5+ endpoints funcionales y documentados (Swagger)
- Base de datos Postgres con migraciones aplicadas (7 tablas)
- Supabase Auth funcionando con 2 roles y RLS activo
- Carga masiva de CSV operativa (con validación y reporte de errores)
- Edge Functions desplegadas para validación, cron y notificaciones
- Tests de integración pasando (mínimo 80% de cobertura en endpoints críticos)

## Definition of Done — Sprint 2

- Endpoint `/predecir` responde en menos de 2 segundos para 300 estudiantes
- Login y logout funcionan con JWT y expiran a los 30 minutos de inactividad (HU002)
- RLS bloquea efectivamente accesos cruzados entre roles
- Carga de CSV inválido devuelve mensaje específico de error por fila (HU031)
- Cron de actualización corre y queda registrado en `audit_log` (HU005, HU029)

---

# 7. SPRINT 3 — Semanas 10, 11, 12

## Sprint Goal

> *Construir el frontend Next.js completo con autenticación, vista Director (KPIs, ranking, ficha de estudiante con factores SHAP y explicación) y vista Admin (dashboard del modelo con métricas completas: AUC, Brier, ECE, MCC, curvas de calibración, fairness, importancia), conectado al backend en tiempo real.*

## HUs comprometidas

| HU | Título | Épica |
|---|---|---|
| **HU007** | Visualizar el nivel de riesgo de los estudiantes | EP02 |
| **HU008** | Clasificar estudiantes según nivel de riesgo | EP02 |
| **HU011** | Conocer los factores específicos que elevan el riesgo | EP03 |
| **HU012** | Visualizar indicadores globales del colegio (KPIs) | EP03 |
| **HU013** | Ver ranking de estudiantes según nivel de riesgo | EP03 |
| **HU014** | Filtrar estudiantes por grado o sección | EP03 |
| **HU015** | Visualizar la distribución de estudiantes por nivel | EP03 |
| **HU016** | Ver explicación simple del riesgo por estudiante | EP03 |
| **HU017** | Ver historial académico del estudiante en un solo lugar | EP03 |
| **HU020** | Priorizar estudiantes según urgencia de intervención | EP04 |
| **HU021** | Segmentar estudiantes por tipo de riesgo | EP04 |

## Detalle por daily

| Sem | Daily | Fecha tentativa | Tarea | HU vinculada |
|---|---|---|---|---|
| **Sem 10** | D1 | Lunes Sem 10 | Setup Next.js 14 + Tailwind + shadcn/ui + sistema de diseño | — |
| | D2 | Miércoles Sem 10 | Pantalla Login + integración Supabase Auth + protección de rutas | HU001, HU002, HU003 (UI) |
| | D3 | Viernes Sem 10 | Layout base, sidebar oscuro, header con métricas del modelo (AUC, Brier, ECE) | HU035 |
| **Sem 11** | D4 | Lunes Sem 11 | Vista Director: KPIs globales (4 tarjetas Total/Alto/Medio/Bajo) | HU012, HU015 |
| | D5 | Miércoles Sem 11 | Vista Director: Ranking por urgencia + filtros (grado/sección/nivel) | HU007, HU008, HU013, HU014, HU020, HU021 |
| | D6 | Viernes Sem 11 | Vista Director: Ficha del estudiante (gauge + top 3 factores SHAP + explicación) | HU011, HU016, HU017 |
| **Sem 12** | D7 | Lunes Sem 12 | Vista Admin: Dashboard del modelo (AUC, F1, Brier, ECE, MCC, fecha actualización) | HU034, HU035 |
| | D8 | Miércoles Sem 12 | Visualizaciones Plotly.js (distribución, importancia SHAP, ROC, calibración, fairness) | HU015, HU034 |
| | D9 | Viernes Sem 12 | Realtime: WebSocket Supabase para actualizaciones en vivo + UI panel admin de usuarios | HU004 (UI) |

## Entregables del Sprint 3

- Aplicación Next.js desplegada localmente con login funcional
- Vista Director completa (KPIs, ranking, filtros, ficha con SHAP)
- Vista Administrador completa (gestión de usuarios, dashboard del modelo con métricas completas)
- Visualizaciones Plotly.js: ROC, calibración, importancia SHAP, fairness, DCA
- Conexión Realtime activa (cambios en BD se reflejan sin refresh)

## Definition of Done — Sprint 3

- Tiempo de carga inicial menor a 3 segundos
- 100% responsive (mobile, tablet, desktop) — breakpoints validados
- Cumple estándar de accesibilidad WCAG 2.1 nivel AA en componentes críticos
- Filtros aplican en menos de 200 ms sobre 300 estudiantes
- Estados de carga, error y vacío implementados en cada pantalla

---

# 8. SPRINT 4 — Semanas 13, 14, 15

## Sprint Goal

> *Cerrar las funcionalidades avanzadas (intervenciones, alertas email, reportes históricos en PDF), desplegar el sistema completo a la nube (Vercel + Supabase Cloud + Railway), establecer CI/CD y monitoreo, y preparar la sustentación final.*

## HUs comprometidas

| HU | Título | Épica |
|---|---|---|
| **HU018** | Recibir alertas de estudiantes en riesgo | EP04 |
| **HU019** | Recibir recomendaciones de acciones de intervención | EP04 |
| **HU022** | Registrar las intervenciones realizadas | EP04 |
| **HU023** | Monitorear el riesgo académico en el tiempo | EP05 |
| **HU024** | Generar reportes históricos del rendimiento estudiantil | EP05 |
| **HU025** | Comparar el riesgo entre periodos académicos | EP05 |
| **HU026** | Exportar listados de estudiantes en riesgo (CSV/PDF) | EP05 |

## Detalle por daily

| Sem | Daily | Fecha tentativa | Tarea | HU vinculada |
|---|---|---|---|---|
| **Sem 13** | D1 | Lunes Sem 13 | Módulo de Registro de Intervenciones (tutorías, reuniones, derivaciones) | HU022 |
| | D2 | Miércoles Sem 13 | Motor de recomendaciones de intervención + UI de visualización | HU019 |
| | D3 | Viernes Sem 13 | Notificaciones email (Resend/SendGrid) para riesgo ALTO + alertas in-app | HU018 |
| **Sem 14** | D4 | Lunes Sem 14 | Reportes históricos en PDF + comparación entre periodos | HU023, HU024, HU025 |
| | D5 | Miércoles Sem 14 | Exportación de listados (CSV / PDF) desde el frontend | HU026 |
| | D6 | Viernes Sem 14 | Despliegue Frontend a Vercel + FastAPI a Railway/Render + Supabase Cloud producción | — |
| **Sem 15** | D7 | Lunes Sem 15 | CI/CD con GitHub Actions + monitoreo Sentry (frontend + backend) | — |
| | D8 | Miércoles Sem 15 | QA integral, pruebas de usuario, ajustes finales, documentación | — |
| | D9 | Viernes Sem 15 | Preparación de sustentación: demo, slides, análisis de cumplimiento de HUs | — |

## Entregables del Sprint 4

- Sistema completo desplegado en producción (URLs públicas Vercel + Railway)
- Notificaciones email funcionando para estudiantes en riesgo ALTO
- Generación de PDFs y CSVs operativa
- Pipeline de CI/CD activo (push a `main` → deploy automático)
- Sentry capturando errores en producción
- Documentación final + análisis de cumplimiento de HUs
- Material de sustentación (slides + demo grabada de respaldo)

## Definition of Done — Sprint 4

- 35/35 HUs completadas y validadas con sus criterios de aceptación
- Despliegue accesible desde URL pública con HTTPS
- Notificación email llega en menos de 1 minuto tras detección de riesgo ALTO
- PDFs generados respetan branding del proyecto
- Cero errores críticos en Sentry durante la semana de sustentación

---

## 9. Mapeo completo: HU → Sprint

| HU | Título corto | Épica | Sprint asignado |
|---|---|---|---|
| HU001 | Iniciar sesión | EP01 | **Sprint 2** (back) + Sprint 3 (UI) |
| HU002 | Cerrar sesión segura | EP01 | **Sprint 2** (back) + Sprint 3 (UI) |
| HU003 | Recuperar contraseña | EP01 | **Sprint 2** (back) + Sprint 3 (UI) |
| HU004 | Gestionar usuarios | EP01 | **Sprint 2** (back) + Sprint 3 (UI) |
| HU005 | Auditar accesos | EP01 | **Sprint 2** |
| HU006 | Identificar estudiantes en riesgo | EP02 | **Sprint 2** |
| HU007 | Visualizar nivel de riesgo | EP02 | **Sprint 3** |
| HU008 | Clasificar según nivel | EP02 | **Sprint 3** |
| HU009 | Automatizar análisis | EP02 | **Sprint 2** |
| HU010 | Ejecutar modelo con un botón | EP02 | **Sprint 1** |
| HU011 | Conocer factores de riesgo | EP03 | **Sprint 3** |
| HU012 | Indicadores globales (KPIs) | EP03 | **Sprint 3** |
| HU013 | Ranking de estudiantes | EP03 | **Sprint 3** |
| HU014 | Filtrar por grado/sección | EP03 | **Sprint 3** |
| HU015 | Distribución por nivel | EP03 | **Sprint 3** |
| HU016 | Explicación simple del riesgo | EP03 | **Sprint 3** |
| HU017 | Historial académico | EP03 | **Sprint 3** |
| HU018 | Alertas de riesgo | EP04 | **Sprint 4** |
| HU019 | Recomendaciones de intervención | EP04 | **Sprint 4** |
| HU020 | Priorizar por urgencia | EP04 | **Sprint 3** |
| HU021 | Segmentar por tipo de riesgo | EP04 | **Sprint 3** |
| HU022 | Registrar intervenciones | EP04 | **Sprint 4** |
| HU023 | Monitoreo histórico | EP05 | **Sprint 4** |
| HU024 | Reportes históricos PDF | EP05 | **Sprint 4** |
| HU025 | Comparar entre periodos | EP05 | **Sprint 4** |
| HU026 | Exportar listados | EP05 | **Sprint 4** |
| HU027 | Integrar fuentes externas | EP06 | **Sprint 2** |
| HU028 | Limpieza y validación de datos | EP06 | **Sprint 2** |
| HU029 | Actualización periódica de BD | EP06 | **Sprint 2** |
| HU030 | Carga de datos por archivo | EP06 | **Sprint 2** |
| HU031 | Visualizar errores de carga | EP06 | **Sprint 2** |
| HU032 | Ajustar parámetros del modelo | EP07 | **Sprint 1** |
| HU033 | Entrenar con nuevos datos | EP07 | **Sprint 1** + Sprint 2 (endpoint) |
| HU034 | Importancia global de variables | EP07 | **Sprint 1** + Sprint 3 (UI) |
| HU035 | Fecha de última actualización | EP07 | **Sprint 1** + Sprint 3 (UI) |

---

## 10. Distribución de carga por sprint

| Sprint | HUs principales | HUs colaborativas | % del backlog |
|---|---|---|---|
| Sprint 1 | 5 (HU010, HU032–HU035) | — | 14 % |
| Sprint 2 | 12 (HU001–HU006, HU009, HU027–HU031) | HU033 (endpoint) | 34 % |
| Sprint 3 | 11 (HU007, HU008, HU011–HU017, HU020, HU021) | HU001–HU004 (UI), HU034, HU035 | 31 % |
| Sprint 4 | 7 (HU018, HU019, HU022, HU023–HU026) | — | 21 % |
| **Total** | **35 HUs** | — | **100 %** |

---

## 11. Eventos Scrum por sprint

| Evento | Frecuencia | Duración | Notas |
|---|---|---|---|
| **Sprint Planning** | 1 vez al inicio de cada sprint | 1 — 2 horas | Selección de HUs y estimación |
| **Daily Scrum** | 3 veces por semana | 15 minutos | ¿Qué hice? ¿Qué haré? ¿Bloqueos? |
| **Sprint Review** | 1 vez al final de cada sprint | 1 hora | Demo al Product Owner |
| **Sprint Retrospective** | 1 vez al final de cada sprint | 30 — 45 minutos | Mejoras de proceso |

**Total de daily scrums por sprint:** 9
**Total de daily scrums en el proyecto:** 36

---

## 12. Riesgos identificados y mitigación

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Deriva de distribución en el dataset (EM 2023 vs 2022) | Media | Alto | Monitorear PSI por feature; reentrenar con datos actualizados |
| Falsos negativos altos (estudiantes en riesgo no detectados) | Media | Alto | Política `min_cost` (FN=5×FP); umbral ~0.43 por defecto; `fair_thresholds` |
| Despliegue en cloud falla cerca de la sustentación | Baja | Alto | Deploys de prueba desde Sprint 3; demo local de respaldo |
| Atraso en backend bloquea el frontend del Sprint 3 | Media | Medio | Contratos de API definidos en Sprint 1; mocks en frontend si necesario |
| Notificaciones email no llegan (filtros antispam) | Media | Bajo | Configurar SPF/DKIM; notificación in-app como respaldo |
| Sobrecarga de HUs en Sprint 2 (12 HUs) | Alta | Medio | Mover HU027 a Sprint 4 si hay riesgo de capacidad |
| ECE alta en subgrupo ISE bajo — calibración inequitativa | Baja | Medio | Documentar como limitación; implementar calibración diferenciada en v2 |

---

## 13. Métricas y KPIs del modelo — objetivos actualizados

| Métrica | Objetivo | Valor alcanzado | Estado |
|---|---|---:|:---:|
| **AUC-ROC** | ≥ 0.83 | 0.843 | Cumplido |
| **PR-AUC** | ≥ 0.75 | ~0.782 | Cumplido |
| **F1-Score** | ≥ 0.65 | 0.695 | Cumplido |
| **Accuracy** | ≥ 0.75 | 0.773 | Cumplido |
| **Precision** | ≥ 0.65 | 0.712 | Cumplido |
| **Recall** | ≥ 0.65 | 0.679 | Cumplido |
| **Specificity** | ≥ 0.75 | ~0.824 | Cumplido |
| **Brier Score** | ≤ 0.16 | 0.134 | Cumplido |
| **ECE** | ≤ 0.05 | ~0.038 | Cumplido |
| **MCC** | ≥ 0.40 | ~0.497 | Cumplido |
| **Log-Loss** | ≤ 0.52 | ~0.462 | Cumplido |
| **Hosmer-Lemeshow p** | > 0.05 | > 0.05 | Cumplido |
| **Nested CV AUC** | ≥ 0.82 | ~0.861 | Cumplido |
| **Stability std (AUC)** | ≤ 0.015 | ~0.008 | Cumplido |
| **AUC IC95% lower bound** | ≥ 0.80 | 0.815 | Cumplido |
| **AUC subgrupo min** | ≥ 0.80 | ~0.819 (Mujer) | Cumplido |
| **McNemar p-valor** | < 0.05 vs regla heurística | < 0.05 | Cumplido |
| **DeLong ΔAUC** | > 0.20 vs baseline | ~0.226 | Cumplido |

**Niveles de riesgo y umbrales operativos:**
- ALTO — probabilidad >= 0.70 → intervención inmediata
- MEDIO — probabilidad 0.45 – 0.69 → monitoreo cercano
- BAJO — probabilidad < 0.45 → sin alerta activa

**Políticas de umbral disponibles:**

| Política | Umbral | Precision | Recall | Indicada cuando |
|---|---:|---:|---:|---|
| `max_recall` | ~0.38 | ~0.62 | ~0.82 | No detectar es inaceptable |
| `min_cost` (FN=5×FP) | ~0.43 | ~0.70 | ~0.72 | Política recomendada (default) |
| `max_precision` | ~0.60 | ~0.81 | ~0.55 | Recursos de intervención escasos |

---

## 14. Limitaciones declaradas (actualizadas)

- **Datos de un solo corte temporal (EM 2022):** el rendimiento puede haber cambiado post-pandemia. Validación temporal con EM 2023 pendiente.
- **Solo Lima Metropolitana, gestión privada, 2.° grado:** no generaliza a colegios públicos, otras regiones, otros grados ni otras asignaturas distintas de Matemática.
- **No incluye factores socioemocionales:** bullying, salud mental, situación familiar, calidad docente individual, clima institucional — variables no disponibles en EM 2022.
- **Sin integración en tiempo real con sistemas académicos preexistentes** de los colegios.
- **ECE marginalmente peor en ISE bajo (~0.045):** la calibración es menos precisa para el segmento de mayor vulnerabilidad.
- **El modelo es un MVP académico:** para producción real a escala nacional requeriría validación con datos multi-año, datos de colegios públicos, y auditoría externa de equidad.
- **Tamaño de dataset (~4,100 estudiantes):** adecuado para el pipeline actual; estudios con más cohortes mejorarían la generalización y reducirían la varianza de las estimaciones de subgrupo.

---

## 15. Estado actual del pipeline ML — inventario técnico completo

Esta sección documenta todos los componentes del pipeline `modelo/train_em_model.py` implementados a mayo 2026.

### 15.1 Dataset y partición

| Componente | Descripción | Estado |
|---|---|:---:|
| Dataset real EM 2022 | ~4,100 estudiantes, ~150 IEs, Lima Metropolitana privada 2.° grado | Implementado |
| GroupShuffleSplit | test_size=0.20, groups=ID_IE — ninguna IE en ambos sets | Implementado |
| Partición 80/20 | ~3,280 train / ~820 test | Implementado |
| Anti-leakage features IE | Aggregates calculados solo en train | Implementado |

### 15.2 Features (12 variables)

| Componente | Descripción | Estado |
|---|---|:---:|
| Features individuales (5) | sexo, Distrito, ise, M500_L, M500_CN | Implementado |
| Aggregates IE (4) | M500_L_iemean, M500_CN_iemean, ise_iemean, tamanio_ie | Implementado |
| Features relativas (3) | M500_L_relativa, M500_CN_relativa, ise_relativo | Implementado |
| Restricciones monotónicas (6) | ise, M500_L, M500_CN, M500_L_iemean, M500_CN_iemean, ise_iemean → -1 | Implementado |
| Verificación monotonía post-train | % cumplimiento por feature constrained | Implementado |

### 15.3 Preprocesamiento

| Componente | Descripción | Estado |
|---|---|:---:|
| OrdinalEncoder | sexo, Distrito; handle_unknown="use_encoded_value", unknown_value=-1 | Implementado |
| StandardScaler | 10 variables numéricas | Implementado |
| ColumnTransformer | Pipeline integrado, ajustado solo en train | Implementado |

### 15.4 Comparación de modelos

| Componente | Descripción | Estado |
|---|---|:---:|
| Logistic Regression | max_iter=1000, class_weight="balanced", GridSearchCV | Implementado |
| Random Forest | n_estimators=300, monotonic_cst, GridSearchCV | Implementado |
| XGBoost | monotone_constraints, scale_pos_weight, GridSearchCV | Implementado |
| LightGBM | monotone_constraints_method="basic", GridSearchCV | Implementado |
| GroupKFold (5-fold) | Validación cruzada respetando separación por IE | Implementado |

### 15.5 Selección avanzada de modelos

| Componente | Descripción | Estado |
|---|---|:---:|
| VotingClassifier soft | Ensamble stacking de top-2 modelos | Implementado |
| Optuna Bayesian | 40 trials, TPESampler | Implementado |
| FLAML AutoML | 90s budget, cota superior | Implementado |
| Nested CV | Outer 5-fold + inner 3-fold, AUC sin sesgo | Implementado |
| Stability analysis | 10 seeds, GroupShuffleSplit, AUC mean/std/min/max | Implementado |

### 15.6 Calibración

| Componente | Descripción | Estado |
|---|---|:---:|
| CalibratedClassifierCV | method="isotonic", cv=5 | Implementado |
| calibration_curve quantile | strategy="quantile" | Implementado |
| calibration_curve uniform | strategy="uniform" | Implementado |
| ECE (10 bins) | Expected Calibration Error, uniform bins | Implementado |
| MCE | Max Calibration Error | Implementado |
| Hosmer-Lemeshow test | χ², df=8, p-value | Implementado |
| Brier Score + Bootstrap | IC95%, n=1000 | Implementado |

### 15.7 Métricas completas

| Componente | Descripción | Estado |
|---|---|:---:|
| accuracy, precision, recall, f1, specificity | Métricas estándar | Implementado |
| auc_roc, pr_auc, pr_baseline | Métricas de discriminación | Implementado |
| brier_score, log_loss, mcc | Métricas de calibración y calidad | Implementado |
| ece, mce | Calibración por bins | Implementado |
| Bootstrap IC95% AUC, F1, Brier | n=1000 | Implementado |
| hosmer_lemeshow (chi2, p_value, df) | Test formal de calibración | Implementado |

### 15.8 Interpretabilidad

| Componente | Descripción | Estado |
|---|---|:---:|
| SHAP global | mean |SHAP| por feature, todos los 12 | Implementado |
| SHAP interactions | Matriz 12×12, 200 muestras | Implementado |
| PDP | Top-3 features por SHAP, grid_resolution=50 | Implementado |
| Permutation importance | n_repeats=20, scoring=roc_auc | Implementado |
| Feature correlation matrix | Pearson 12×12, pares |r|>0.70 | Implementado |
| Feature ablation study | Delta AUC por feature (12 modelos) | Implementado |
| Monotonicity verification | % cumplimiento post-train | Implementado |

### 15.9 Pruebas estadísticas

| Componente | Descripción | Estado |
|---|---|:---:|
| McNemar test | ML vs regla_lectura, corrección Yates | Implementado |
| DeLong bootstrap | 2000 iteraciones, ΔAUC, CI95%, p-value | Implementado |
| Hosmer-Lemeshow | Calibración (también en sección calibración) | Implementado |

### 15.10 Auditoría de equidad (Fairness)

| Componente | Descripción | Estado |
|---|---|:---:|
| Subgrupos sexo | Hombre/Mujer | Implementado |
| Subgrupos ISE tercil | bajo/medio/alto | Implementado |
| Subgrupos top-5 distritos | Los 5 distritos más representados | Implementado |
| Métricas por subgrupo | n, tasa_real, accuracy, precision, recall, f1, auc_roc | Implementado |
| Bootstrap IC95% por subgrupo | auc_ci_95, recall_ci_95 (n=500) | Implementado |
| ECE por subgrupo | Calibración equitativa | Implementado |
| Fair thresholds | Umbral óptimo F1 por grupo de sexo | Implementado |

### 15.11 Análisis de decisión

| Componente | Descripción | Estado |
|---|---|:---:|
| Decision Curve Analysis (DCA) | Net Benefit para umbral 0.0–1.0 | Implementado |
| Política max_recall | Umbral mínimo con mayor cobertura | Implementado |
| Política max_precision | Umbral máximo con mejor precisión | Implementado |
| Política min_cost (FN=5×FP) | Umbral óptimo asimétrico | Implementado |
| Baselines comparison | regla_lectura, regla_promedio, clase_mayoritaria, modelo_ml | Implementado |

### 15.12 Análisis de errores

| Componente | Descripción | Estado |
|---|---|:---:|
| FN/FP profiling top-20 | Perfil estadístico completo | Implementado |
| Estadísticas FN/FP | M500_L, M500_CN, ISE, prob predicha, sexo | Implementado |
| Patrones cualitativos | Boundary effect, IE leveling effect | Documentado |

### 15.13 Monitoreo y reproducibilidad

| Componente | Descripción | Estado |
|---|---|:---:|
| Learning curve | 8 puntos 10%–100% train, AUC train vs val | Implementado |
| Drift baseline | mean/std/min/max/p25/p50/p75 por feature numérica | Implementado |
| Artefactos serializados | modelo_em.pkl + metricas_em.pkl | Implementado |
| Timestamp trained_at | Registrado en metricas_em.pkl | Implementado |

**Total de componentes del pipeline: 30+ módulos implementados**

---

*Documento generado para el proyecto **P20261012** · UPC · Taller de Proyectos I*
*Última actualización: Mayo 2026*
