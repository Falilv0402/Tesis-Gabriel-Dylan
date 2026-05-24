# Plan de Ejecucion Actualizado - Proyecto P20261012
## Sistema de Alerta Temprana de Riesgo Academico

**Ultima revision:** 2026-05-14  
**Ruta base:** `C:\Users\Usuario\OneDrive\Escritorio\TesisDG-ML\PROYECTO-TESIS-DG`

---

## 1. Estado actual del proyecto

El proyecto ya cuenta con un stack completo funcional. El modelo fue migrado del
prototipo Random Forest sobre dataset sintetico al modelo final con datos reales MINEDU.

| Componente | Estado | Detalle |
|---|---|---|
| Dataset | Listo | `modelo/data/em_2022_lima_privado.csv` — 3 629 estudiantes, Lima Metro, privado |
| Script de entrenamiento | Listo | `modelo/train_em_model.py` — pipeline completo con GroupKFold |
| Artefactos ML | Listos | `modelo/model/modelo_em.pkl`, `preprocessor_em.pkl`, `metricas_em.pkl` |
| Backend FastAPI | Operativo | `backend-ml/` — 8 endpoints, Swagger en `/docs` |
| Frontend Next.js | Operativo | `frontend/` — TypeScript + Tailwind, roles admin/director |
| Documentacion del modelo | Actualizada | `modelo/README.md` |
| Documentacion del repo | Actualizada | `README.md` en raiz |

---

## 2. Modelo ML — Resultado final

| Parametro | Valor |
|---|---|
| Algoritmo | Logistic Regression (calibracion isotonica) |
| Dataset | EM 2022 MINEDU — Lima Metro, privado |
| Estudiantes en entrenamiento | 3 629 (84 IEs, 30 distritos) |
| Target | `riesgo_matematica = 1` si `grupo_M in {Previo al inicio, En inicio}` |
| Balance del target | 40.6% positivos |
| Validacion | GroupKFold(5) por ID_IE — sin leakage por colegio |
| AUC CV (train) | 0.8650 +/- 0.016 |
| AUC test | 0.8431 (17 IEs nunca vistas) |
| F1 test | 0.6949 |
| Features | 9 (sexo, ise, Distrito, M500_L, M500_CN + 4 agregados IE) |

---

## 3. Arquitectura del sistema

| Capa | Tecnologia | Estado |
|---|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS | Operativo |
| Backend ML | FastAPI, scikit-learn, joblib, pandas | Operativo |
| Modelo | Logistic Regression calibrada + SHAP | Entrenado |
| Base de datos | Supabase (Auth + Postgres) | Pendiente de integracion |
| DevOps | Vercel (frontend), Railway/Render (backend) | Pendiente de despliegue |

---

## 4. Estructura del repositorio

```text
PROYECTO-TESIS-DG/
  frontend/
    src/app/          Dashboard Next.js
    src/lib/          demoData.ts, tipos, utilidades
    src/components/   Componentes UI
    package.json

  backend-ml/
    app/
      main.py
      api/router.py
      core/config.py
      schemas.py
      services/model_service.py
    requirements.txt

  modelo/
    data/em_2022_lima_privado.csv     Dataset limpio
    model/modelo_em.pkl               Modelo final
    model/preprocessor_em.pkl         Pipeline preprocesamiento
    model/metricas_em.pkl             Metricas, SHAP, comparativa
    notebooks/modelo_riesgo_academico_v2.ipynb
    train_em_model.py                 Script activo
    train_model.py                    DEPRECADO (RF sintetico, no usar)
    app.py                            Dashboard Streamlit de referencia

  supabase/
    migrations/
    functions/

  docs/
    excel/            HUs v3, backlog, casos de prueba CP001-CP077
    word/
    diagrams/
```

---

## 5. Endpoints FastAPI disponibles

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/health` | Estado del servicio y modelo cargado |
| POST | `/predecir` | Prediccion individual |
| POST | `/predecir-dataset` | Prediccion batch con filtros (nivel, distrito, sexo) |
| GET | `/dataset-resumen` | KPIs y distribucion con filtros |
| GET | `/metricas` | Accuracy, F1, AUC, modelo ganador |
| GET | `/importancia` | Importancia SHAP global (9 features) |
| GET | `/evaluacion` | Matriz de confusion, curva ROC, comparativa de modelos |
| POST | `/reentrenar` | Reentrenamiento desde train_em_model.py |

---

## 6. Trabajo completado (pre-Sprint final)

- [x] Dataset institucional filtrado y limpio (EM 2022 MINEDU)
- [x] Pipeline ML con GroupKFold — sin leakage por colegio
- [x] Comparativa de 4 modelos (LR, RF, XGBoost, LightGBM)
- [x] Calibracion isotonica del modelo ganador
- [x] SHAP global y local integrado en metricas
- [x] Backend FastAPI con 8 endpoints operativos
- [x] Frontend Next.js con dashboard, KPIs, ranking y filtros
- [x] Roles diferenciados: admin y director/coordinador
- [x] Filtros actualizados a variables reales: nivel, distrito, sexo
- [x] Artefactos .pkl generados y verificados
- [x] Carpeta renombrada de legacy-streamlit a modelo/
- [x] Documentacion del modelo y del repo actualizada
- [x] train_model.py marcado como DEPRECADO

---

## 7. Sprint final — Integracion, despliegue y sustentacion

**Objetivo:** conectar Supabase real, desplegar stack y cerrar evidencias para las 35 HUs.

| Dia | Trabajo principal | HU relacionada | Responsable |
|---|---|---|---|
| D1 | Migracion inicial Supabase (7 tablas) | EP01, EP02, EP06 | Gabriel |
| D2 | Supabase Auth con roles admin/director | HU001-HU004 | Mathias |
| D3 | RLS y auditoria audit_log | HU005-HU006 | Mathias |
| D4 | Conectar frontend a Supabase Auth (reemplazar demo login) | HU001-HU003 | Mathias |
| D5 | Carga CSV/XLSX real y validacion de errores | HU028-HU032 | Gabriel |
| D6 | Registro e historial de intervenciones | HU023-HU024 | Mathias |
| D7 | Alertas email e in-app para riesgo ALTO | HU019 | Mathias |
| D8 | Reportes PDF y exportacion CSV | HU025-HU027 | Mathias |
| D9 | Despliegue frontend en Vercel | Deploy | Mathias |
| D10 | Despliegue backend ML en Railway/Render | Deploy | Dylan |
| D11 | Pruebas de integracion y regresion (CP001-CP077) | QA | Gabriel |
| D12 | Demo final, video de respaldo y matriz de cumplimiento HUs | Sustentacion | Todos |

---

## 8. Checklist de validacion por entrega

### Modelo ML
- [x] Dataset real MINEDU cargado y limpio
- [x] GroupKFold por colegio — sin leakage
- [x] Comparativa de modelos documentada
- [x] AUC test >= 0.84
- [x] SHAP integrado en backend

### Backend
- [x] `/health` responde OK con modelo cargado
- [x] `/predecir` procesa prediccion individual
- [x] `/predecir-dataset` devuelve batch con filtros
- [x] `/metricas` devuelve F1, AUC y modelo ganador
- [x] `/importancia` devuelve SHAP por feature
- [x] `/reentrenar` dispara train_em_model.py

### Supabase
- [ ] 7 tablas con migracion inicial aplicada
- [ ] RLS activo
- [ ] Login/logout funcionan con roles reales
- [ ] Carga CSV/XLSX valida errores por fila

### Frontend
- [x] Dashboard con KPIs, ranking, filtros y detalle por estudiante
- [x] Roles diferenciados admin/director
- [x] Visualizaciones SHAP y distribucion de riesgo
- [ ] Login conectado a Supabase Auth (actualmente en modo demo)
- [ ] Exportacion CSV/PDF
- [ ] Responsive desktop/tablet/mobile verificado

### Final
- [ ] 35/35 HUs con evidencia cerrada
- [ ] CP001-CP077 ejecutados y documentados
- [ ] URLs productivas activas
- [ ] Demo grabada

---

## 9. Distribucion por integrante

| Integrante | Foco | HUs principales |
|---|---|---|
| Mathias | Frontend, auth, intervenciones, reportes, despliegue frontend | HU001-HU006, HU019, HU023-HU027 |
| Dylan | Backend ML, prediccion, visualizaciones, despliegue backend | HU007-HU018, HU020-HU022, HU033-HU036 |
| Gabriel | Datos, backlog, pruebas, carga de archivos, documentacion | HU028-HU032, casos de prueba CP001-CP077 |

---

## 10. Riesgos vigentes

| Riesgo | Probabilidad | Impacto | Mitigacion |
|---|---|---|---|
| Integracion Supabase se retrasa | Media | Alto | Mantener modo demo como respaldo de presentacion |
| Despliegue falla cerca de la entrega | Media | Alto | Primer deploy tecnico lo antes posible, no al final |
| Variables de EM 2022 no representan el contexto escolar real actual | Media | Medio | Documentar limitacion y enmarcarla como prototipo institucional |
| Cobertura de HUs insuficiente para sustentacion | Media | Alto | Priorizar evidencia visual sobre implementacion perfecta |
