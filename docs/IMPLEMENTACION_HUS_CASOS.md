# Implementacion alineada a HUs y casos de prueba

Este monorepo toma como fuente funcional los archivos:

- `docs/excel/P20261012_HUs_v3 (1).xlsx`
- `docs/excel/P20261012_Product_Backlog_v3.xlsx`
- `docs/excel/Casos de prueba (1).xlsx`

## Cobertura por capa

| Epica | Cobertura inicial en monorepo | Carpeta |
|---|---|---|
| EP01 - Acceso y Seguridad | Base Supabase Auth, roles, RLS y frontend preparado para login | `supabase/`, `frontend/` |
| EP02 - Prediccion y Clasificacion | API ML con `/predecir`, `/predecir-dataset` y niveles ALTO/MEDIO/BAJO | `backend-ml/` |
| EP03 - Analisis y Visualizacion | Frontend base y modelo de dashboard listo para implementar KPIs/graficos | `frontend/` |
| EP04 - Priorizacion e Intervencion | Tabla `intervenciones` y relacion con estudiante/prediccion | `supabase/` |
| EP05 - Historico y Reportes | Tablas por periodo y predicciones versionadas | `supabase/` |
| EP06 - Gestion de Datos | Tablas academicas, Storage previsto y dataset heredado preservado | `supabase/`, `legacy-streamlit/data/` |
| EP07 - Mantenimiento ML | `/metricas`, `/importancia`, `/reentrenar` y artefactos versionables | `backend-ml/`, `legacy-streamlit/model/` |

## Casos de prueba que guian el primer incremento

| Grupo CP | Enfoque | Implementacion base |
|---|---|---|
| CP001-CP010 | Registro, login, logout y recuperacion | Supabase Auth + frontend |
| CP011-CP020 | Gestion, auditoria y prediccion | RLS, audit_log, FastAPI ML |
| CP021-CP040 | Dashboard, filtros, ranking y visualizaciones | Next.js + API ML |
| CP041-CP060 | Intervenciones, historico y reportes | Supabase + modulo frontend |
| CP061-CP077 | Datos, mantenimiento del modelo, fecha de actualizacion y validaciones integrales | Migraciones + endpoints ML + matriz frontend |

## Criterio tecnico inmediato

El primer corte queda aceptado cuando:

- `legacy-streamlit` corre como demo funcional.
- `backend-ml` responde health, metricas, importancia y predicciones.
- `supabase/migrations/0001_init.sql` crea las 7 tablas base con RLS.
- `frontend` compila y muestra matriz de cumplimiento para HU001-HU036 y CP001-CP077.
