# P20261012 — SATRA · Sistema de Alerta Temprana de Riesgo Académico

> Proyecto de tesis — UPC · Ingeniería de Sistemas de Información  
> Dataset: Evaluación Muestral 2022 MINEDU — Lima Metropolitana, gestión privada, 2.° de secundaria  
> Última actualización: Mayo 2026

---

## Tabla de contenidos

1. [El problema que resuelve](#1-el-problema-que-resuelve)
2. [Qué hace el sistema](#2-qué-hace-el-sistema)
3. [Arquitectura general](#3-arquitectura-general)
4. [Modelo predictivo ML](#4-modelo-predictivo-ml)
5. [Base de datos — Supabase](#5-base-de-datos--supabase)
6. [API REST — FastAPI](#6-api-rest--fastapi)
7. [Frontend — Next.js](#7-frontend--nextjs)
8. [Autenticación y roles](#8-autenticación-y-roles)
9. [Estructura del repositorio](#9-estructura-del-repositorio)
10. [Cómo ejecutar el proyecto](#10-cómo-ejecutar-el-proyecto)
11. [Credenciales de prueba](#11-credenciales-de-prueba)
12. [Estado de HUs](#12-estado-de-hus)
13. [Equipo](#13-equipo)

---

## 1. El problema que resuelve

En el Perú, la Evaluación Muestral (EM) 2022 del MINEDU revela que **más del 40% de estudiantes de 2.° de secundaria en colegios privados de Lima Metropolitana se encuentran en nivel "En inicio" o "Previo al inicio" en Matemática** — es decir, en riesgo académico severo.

Los directores y coordinadores académicos **no cuentan con una herramienta sistemática** para:
- Identificar a tiempo qué estudiantes están en riesgo antes de que sea demasiado tarde
- Priorizar intervenciones según urgencia real (no solo intuición)
- Documentar y dar seguimiento a las acciones tomadas
- Entender qué factores concretos explican el riesgo de cada estudiante

**SARA resuelve exactamente eso**: es un sistema de alerta temprana que usa Machine Learning para predecir el riesgo académico de cada estudiante y apoya al equipo directivo en la toma de decisiones de intervención.

---

## 2. Qué hace el sistema

- **Predice automáticamente** el riesgo de bajo rendimiento en Matemática para cada estudiante usando datos reales de la EM 2022 (3,629 estudiantes, 84 IEs, 30 distritos)
- **Muestra un ranking por urgencia** con probabilidad de riesgo calculada por el modelo ML (ALTO / MEDIO / BAJO)
- **Explica el riesgo de cada estudiante** con factores SHAP en lenguaje simple ("Su puntaje de Lectura es bajo comparado con su colegio")
- **Registra intervenciones** (tutoría, reunión familiar, derivación, seguimiento) con estado y bitácora
- **Permite anotar observaciones** por estudiante, persistidas en base de datos
- **Exporta reportes** en CSV, XLSX y PDF del listado filtrado
- **Gestiona usuarios** con roles diferenciados (admin / director) y auditoría completa
- **Muestra métricas del modelo** al administrador: AUC, F1, Brier, SHAP global, curvas ROC y calibración, diagnóstico avanzado

---

## 3. Arquitectura general

```
┌──────────────────────────────────────────────────────────────┐
│                        NAVEGADOR                             │
│           Next.js 14 · TypeScript · Tailwind CSS             │
│                  http://localhost:3000                        │
└────────────────┬───────────────────────┬─────────────────────┘
                 │ Supabase JS SDK        │ fetch REST
                 ▼                        ▼
┌─────────────────────────┐   ┌──────────────────────────────┐
│     Supabase Cloud      │   │    FastAPI  (backend-ml)     │
│  awudayejfwalvdfnqxlb   │   │    http://localhost:8000     │
│                         │   │                              │
│  · Auth JWT             │   │  · Predicciones ML           │
│  · PostgreSQL + RLS     │   │  · SHAP individual           │
│  · 7 tablas             │   │  · Métricas del modelo       │
│  · Trigger auto-perfil  │   │  · Diagnóstico avanzado      │
│                         │   │  · Reentrenamiento           │
└─────────────────────────┘   │  · Validación CSV            │
                              └──────────────┬───────────────┘
                                             │ joblib.load()
                                             ▼
                              ┌──────────────────────────────┐
                              │     modelo/model/*.pkl       │
                              │  modelo_em.pkl   (calibrado) │
                              │  metricas_em.pkl (stats)     │
                              └──────────────────────────────┘
```

---

## 4. Modelo predictivo ML

### Dataset

| Campo | Descripción |
|---|---|
| `M500_L` | Puntaje Lectura (escala ECE 500) |
| `M500_CN` | Puntaje Ciencias y Tecnología |
| `ise` | Índice Socioeconómico (0–5) |
| `sexo` | Sexo del estudiante |
| `Distrito` | Distrito de Lima Metropolitana (30 valores) |
| `ID_IE` | Código de institución educativa (84 IEs) |

**Variable objetivo:** `riesgo_matematica = 1` si el estudiante está en nivel *Previo al inicio* o *En inicio* en Matemática (EM 2022).

**Balance de clases:** 40.6% positivos (en riesgo).

### Features engineeradas (12 en total)

Además de las 5 features individuales, el pipeline agrega 4 variables a nivel IE (calculadas **solo desde train**, sin leakage):

| Feature | Descripción |
|---|---|
| `M500_L_iemean` | Promedio de Lectura del colegio |
| `M500_CN_iemean` | Promedio de Ciencias del colegio |
| `ise_iemean` | ISE promedio del colegio |
| `tamanio_ie` | Tamaño del colegio en la muestra |
| `M500_L_relativa` | Diferencia del estudiante vs su colegio en Lectura |
| `M500_CN_relativa` | Diferencia del estudiante vs su colegio en Ciencias |
| `ise_relativo` | Diferencia del estudiante vs ISE promedio de su colegio |

### Pipeline de entrenamiento

```
train_em_model.py  (orquestador ~130L)
├── pipeline/config.py          constantes, features, SEED
├── pipeline/preprocessing.py   feature engineering + ColumnTransformer
├── pipeline/training.py        CV, GridSearch, Stacking, calibración
├── pipeline/automl.py          FLAML (90s) + Optuna (40 trials)
├── pipeline/evaluation.py      22 funciones: SHAP, ECE, bootstrap CI, DCA...
└── pipeline/artifacts.py       build_metricas() + save_artifacts()
```

**Validación sin leakage:** `GroupShuffleSplit` y `GroupKFold` por `ID_IE` — ninguna IE aparece en train y test a la vez.

### Resultados

| Métrica | Valor |
|---|---|
| **AUC-ROC** | **0.843** (IC95%: 0.815 – 0.868) |
| **PR-AUC** | 0.782 |
| **F1-Score** | 0.695 |
| **Accuracy** | 77.3% |
| **Precision** | 71.2% |
| **Recall** | 67.9% |
| **Specificity** | 82.4% |
| **Brier Score** | 0.134 |
| **ECE** | 0.038 |
| **MCC** | 0.497 |
| Modelo ganador | Logistic Regression (calibración isotónica) |
| Train | ~2,900 estudiantes · 67 IEs |
| Test | ~730 estudiantes · 17 IEs (nunca vistas) |

### Niveles de riesgo y umbrales

| Probabilidad | Nivel | Acción recomendada |
|---|---|---|
| ≥ 70% | 🔴 **ALTO** | Intervención inmediata |
| 45% – 69% | 🟡 **MEDIO** | Monitoreo cercano |
| < 45% | 🟢 **BAJO** | Sin alerta activa |

Los umbrales son **ajustables en tiempo real** desde el panel admin.

### Variables más importantes (SHAP global)

1. `M500_L` — Puntaje Lectura individual (predictor dominante)
2. `M500_CN` — Puntaje Ciencias individual
3. `M500_L_iemean` — Efecto del colegio en Lectura
4. `sexo` — Hombres con mayor riesgo en Matemática
5. `ise_iemean` — Nivel socioeconómico del colegio

---

## 5. Base de datos — Supabase

**Proyecto:** `tesis-alerta-temprana` · ID: `awudayejfwalvdfnqxlb`

### Tablas (7)

| Tabla | Descripción |
|---|---|
| `profiles` | Perfil de usuario: rol, distrito, código IE, nombre, avatar |
| `predicciones` | Resultados ML por estudiante y periodo (estudiante_id TEXT) |
| `intervenciones` | Intervenciones registradas por directores (tutoría/reunión/derivación/seguimiento) |
| `anotaciones` | Notas libres del director sobre un estudiante específico |
| `plan_hitos` | Hitos de seguimiento con fecha objetivo y estado (completado/pendiente) |
| `modelos_versiones` | Historial de versiones del modelo con métricas |
| `audit_log` | Registro completo de acciones del sistema |

### Seguridad (Row Level Security)

- **Admins:** acceso total a todas las tablas
- **Directores:** gestionan solo sus propias anotaciones, hitos e intervenciones
- **Trigger `on_auth_user_created`:** crea el perfil automáticamente al registrarse
- **Trigger `set_updated_at`:** actualiza `updated_at` automáticamente en `plan_hitos`

---

## 6. API REST — FastAPI

Base URL: `http://localhost:8000`  
Documentación interactiva: `http://localhost:8000/docs`

### Health

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/v1/health` | Estado del servicio, modelo cargado, paths |

### Predicciones

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/v1/predicciones` | Predice riesgo para lista de estudiantes en el body |
| POST | `/v1/predicciones/dataset` | Predicciones paginadas del dataset EM 2022 con filtros |
| GET | `/v1/predicciones/resumen` | KPIs: total, conteos por nivel, facetas |
| GET | `/v1/predicciones/{id}/shap` | Explicación SHAP individual por estudiante |

### Modelo

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/v1/modelo/metricas` | AUC, F1, Brier, modelo ganador, fecha entrenamiento |
| GET | `/v1/modelo/importancia` | Importancia SHAP de cada variable |
| GET | `/v1/modelo/evaluacion` | Matriz de confusión, curva ROC |
| GET | `/v1/modelo/diagnostico` | Diagnóstico completo: fairness, drift, DCA, políticas |
| POST | `/v1/modelo/reentrenamiento` | Ejecuta el pipeline y recarga el modelo |

### Datos y Colegios

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/v1/datos/validar-csv` | Valida CSV académico contra el schema del modelo |
| GET | `/v1/colegios` | Lista de IEs con distrito y cantidad de estudiantes |
| GET | `/v1/colegios/distritos` | Lista de distritos únicos del dataset |

---

## 7. Frontend — Next.js

### Vista Director / Coordinador

| Tab | Funcionalidades |
|---|---|
| **Dashboard** | KPIs (total / alto / medio / bajo / ISE promedio), ranking por urgencia, filtros por nivel / distrito / sexo / tipo de riesgo, mapa de calor por distrito |
| **Estudiante** | Gauge de probabilidad, factores SHAP individuales con barras de contribución, recomendación personalizada, pestaña **Anotaciones** (persistidas en Supabase), pestaña **Plan** (hitos con fecha, completables) |
| **Intervenciones** | Registrar tutoría / reunión / derivación / seguimiento, bitácora con estado editable, alerta por email a equipo del distrito, estadísticas de intervenciones |
| **Reportes** | Equidad por ISE, distribución por distrito, exportar **CSV / XLSX / PDF** |

### Vista Administrador

| Tab | Funcionalidades |
|---|---|
| **Usuarios** | Crear usuarios con rol y distrito, desactivar, log de auditoría |
| **Datos** | Cargar y validar CSV académico, programar actualización periódica |
| **Modelo ML** | Métricas completas, curvas ROC y calibración, SHAP global, diagnóstico avanzado (fairness / DCA / drift / políticas), ajuste de umbrales, reentrenar |

### Funcionalidades transversales

- Onboarding al primer login (selección de distrito e IE)
- Auto-filtro del dashboard por distrito del director
- Toast notifications en todas las acciones
- Comparador de hasta 3 estudiantes simultáneos
- Perfil editable (nombre, apellidos, contraseña, avatar)
- Exportación PDF individual por estudiante con SHAP

---

## 8. Autenticación y roles

| Rol | Acceso |
|---|---|
| `admin` | Usuarios, datos, modelo ML |
| `director` | Dashboard, estudiante, intervenciones, reportes |

- Proveedor: **Supabase Auth** (JWT, email + contraseña)
- Recuperación de contraseña por email
- Cada login, logout e intervención queda registrado en `audit_log`

---

## 9. Estructura del repositorio

```
PROYECTO-TESIS-DG/
│
├── frontend/                        Next.js 14 · TypeScript
│   └── src/
│       ├── app/page.tsx             Orquestador principal de la UI
│       ├── views/                   Vistas por rol y tab
│       ├── hooks/                   useAuth, useStudents, useInterventions,
│       │                            useAnnotations, useProfile, useToast
│       ├── lib/                     supabase.ts, exports.ts, env.ts,
│       │                            studentPdfExport.ts, constants.ts
│       ├── components/ui/           Primitives, ShapBar, charts, mapa
│       └── types/index.ts           Student, RiskLevel, UserRole, Diagnostico
│
├── backend-ml/                      FastAPI · Python
│   └── app/
│       ├── main.py                  App + CORS + lifespan
│       ├── api/                     predicciones, modelo, datos, colegios
│       ├── services/                model_service, prediction_service,
│       │                            diagnostico_service, shap_service
│       └── core/                    config, features
│
├── modelo/                          Pipeline ML
│   ├── train_em_model.py            Orquestador (~130L)
│   ├── pipeline/                    config, preprocessing, training,
│   │                                automl, evaluation, artifacts
│   ├── data/em_2022_lima_privado.csv  Dataset real MINEDU EM 2022
│   └── model/                       modelo_em.pkl · metricas_em.pkl
│
├── supabase/migrations/             0001_init.sql · 0002_anotaciones.sql
│                                    0003_schema_realign.sql
└── docs/                            HUs, sprints, justificación del modelo
```

---

## 10. Cómo ejecutar el proyecto

### Requisitos

- Python 3.11+
- Node.js 18+
- Archivo `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://awudayejfwalvdfnqxlb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
NEXT_PUBLIC_ML_API_URL=http://localhost:8000
```

### Terminal 1 — Backend ML

```bash
cd backend-ml
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Espera ver `Application startup complete.` antes de abrir el frontend.

→ API: `http://localhost:8000`  
→ Swagger: `http://localhost:8000/docs`

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

→ `http://localhost:3000`

> **Nota:** si el puerto 3000 está ocupado, usa `npx next dev --turbo`.  
> Si el puerto 8000 está ocupado, en PowerShell: `netstat -ano | Select-String ":8000"` y `Stop-Process -Id <PID> -Force`.

### Reentrenar el modelo manualmente

```bash
cd modelo
python train_em_model.py
```

O usar el botón **Reentrenar** en la vista Modelo (requiere backend activo).

---

## 11. Credenciales de prueba

| Email | Contraseña | Rol | Ve |
|---|---|---|---|
| `director@tesis.pe` | `Tesis2026!` | director | Dashboard, estudiantes, intervenciones, reportes |
| `admin@tesis.pe` | `Tesis2026!` | admin | Modelo ML, usuarios, datos |

---

## 12. Estado de HUs

**35 historias de usuario · 7 épicas · 4 sprints**

| Estado | HUs | % |
|---|---|---|
| ✅ Completadas | 25 | 71% |
| ⚠️ Parciales | 6 | 17% |
| ❌ Pendientes | 4 | 12% |

Las 4 pendientes (HU017, HU023, HU025, HU029) requieren datos de múltiples periodos (EM 2023+) o Edge Functions con cron en Supabase — bloqueadas por disponibilidad de datos, no por implementación.

Ver detalle completo en [`docs/PLAN_SPRINTS_P20261012.md`](docs/PLAN_SPRINTS_P20261012.md).

---

## 13. Equipo

| Integrante | Foco |
|---|---|
| Dylan | Backend ML, predicción, visualizaciones |
| Gabriel | Datos, backlog, pruebas, documentación |

---

*Proyecto P20261012 — Taller de Proyectos I · UPC · 2026*
