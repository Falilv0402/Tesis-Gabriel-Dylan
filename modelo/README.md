# modelo/ — Motor ML del proyecto P20261012

Esta carpeta contiene el dataset oficial, los artefactos del modelo entrenado
y los scripts de entrenamiento del Sistema de Alerta Temprana de Riesgo Académico.

## Estructura

```
data/
  em_2022_lima_privado.csv   Dataset limpio (EM 2022, Lima Metro, privado)
  EM_2S_2022_alumnos_innominado.xlsx  Fuente original MINEDU

model/
  modelo_em.pkl              Modelo final calibrado
  preprocessor_em.pkl        Pipeline de preprocesamiento (OrdinalEncoder + StandardScaler)
  metricas_em.pkl            Métricas completas, SHAP, importancias, configuración

notebooks/
  modelo_riesgo_academico_v2.ipynb  EDA y análisis exploratorio

pipeline/                    Paquete modular del pipeline ML
  config.py                  Constantes: rutas, features, SEED, restricciones monotónicas
  preprocessing.py           Feature engineering + ColumnTransformer + evaluate_cv
  training.py                CV, GridSearch, Stacking, calibración, estabilidad
  automl.py                  FLAML AutoML + Optuna Bayesian tuning (opcionales)
  evaluation.py              Evaluación completa: SHAP, ECE, bootstrap CI, DCA, PDP...
  artifacts.py               build_metricas() + save_artifacts()

train_em_model.py            Orquestador principal (delega a pipeline/)
ver_pkl.py                   Utilidad para inspeccionar artefactos .pkl
```

## Dataset

- **Fuente:** Evaluación Muestral 2022, MINEDU (2.° de secundaria)
- **Filtro aplicado:** Lima Metropolitana + gestión No estatal (privada)
- **Filas:** 3,629 estudiantes | 84 IEs | 30 distritos
- **Target:** `riesgo_matematica = 1` si `grupo_M ∈ {Previo al inicio, En inicio}`
- **Balance:** 40.6% positivos

## Modelo

| Aspecto | Detalle |
|---|---|
| Ganador comparativa | Logistic Regression (AUC 0.8650 ± 0.016 en GroupKFold) |
| Calibración | Isotónica (5-fold) |
| Validación | GroupKFold(5) por `ID_IE` — sin leakage por colegio |
| AUC en test | 0.8431 (17 IEs nunca vistas durante entrenamiento) |
| F1 en test | 0.6949 |

### Features (9 en total)

| Feature | Tipo | Origen |
|---|---|---|
| `sexo` | Categórica | EM 2022 |
| `ise` | Numérica | EM 2022 (índice socioeconómico) |
| `Distrito` | Categórica (30 valores) | EM 2022 |
| `M500_L` | Numérica | Puntaje Lectura EM 2022 |
| `M500_CN` | Numérica | Puntaje Ciencia y Tecnología EM 2022 |
| `M500_L_iemean` | Numérica | Promedio Lectura del colegio (calculado en train) |
| `M500_CN_iemean` | Numérica | Promedio Ciencias del colegio (calculado en train) |
| `ise_iemean` | Numérica | ISE promedio del colegio (calculado en train) |
| `tamanio_ie` | Numérica | Número de alumnos en la muestra por IE |

### SHAP — Importancia global

1. `M500_L` (puntaje lectura del estudiante) — predictor dominante
2. `M500_CN` (puntaje ciencias del estudiante)
3. `M500_L_iemean` (efecto del colegio en lectura)
4. `sexo` (hombres con mayor riesgo en matemática)
5. `ise_iemean` (nivel socioeconómico del colegio)

## Reentrenar el modelo

```powershell
cd modelo
pip install -r requirements.txt
python train_em_model.py
```

El script genera automáticamente los tres `.pkl` en `model/` y reporta métricas en consola.
El backend FastAPI detecta los nuevos artefactos al reiniciarse o al llamar `POST /reentrenar`.

## Arquitectura del pipeline

`train_em_model.py` es un orquestador delgado (~130L) que importa y llama en secuencia
las funciones de `pipeline/`. Cada módulo exporta funciones puras con parámetros explícitos,
sin estado global compartido entre etapas.

| Módulo | Responsabilidad |
|---|---|
| `config.py` | Rutas, lista de features, SEED, restricciones monotónicas |
| `preprocessing.py` | `add_ie_features`, `build_preprocessor`, `make_pipeline`, `evaluate_cv` |
| `training.py` | Comparativa CV, Nested CV, GridSearch, Stacking, calibración, estabilidad |
| `automl.py` | FLAML (budget=90s) y Optuna (40 trials) — opcionales vía try-import |
| `evaluation.py` | 22 funciones: SHAP, ECE/MCE, bootstrap CI95%, DCA, PDP, ablación, drift... |
| `artifacts.py` | `build_metricas(**kwargs)` y `save_artifacts(model, prep, metrics)` |
