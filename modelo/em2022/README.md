# Modelo EM 2022 — Evaluación Muestral MINEDU

Predice riesgo en Matemática para estudiantes de 2.° secundaria,
Lima Metropolitana, colegios privados.

**Dataset:** 3,629 estudiantes, 84 IEs, datos MINEDU 2022
**Variables:** M500_L, M500_CN, ISE, sexo, distrito + aggregates por IE
**Modelo ganador:** Logistic Regression (AUC test = 0.843)
**Comparativa:** LR vs Random Forest vs XGBoost vs LightGBM

## Archivos

| Archivo | Qué hace |
|---|---|
| `train.py` | Orquestador — corre el pipeline completo |
| `pipeline/config.py` | Constantes: features, paths, SEED, restricciones monotónicas |
| `pipeline/preprocessing.py` | Feature engineering + ColumnTransformer |
| `pipeline/training.py` | CV, GridSearch, Stacking, calibración isotónica |
| `pipeline/evaluation.py` | 22 funciones: SHAP, ECE, bootstrap CI, DCA... |
| `pipeline/automl.py` | FLAML (90s) + Optuna (40 trials) |
| `pipeline/artifacts.py` | Ensambla métricas y guarda .pkl |

## Correr

```bash
cd modelo
python -m em2022.train
```

## Artefactos generados

```
model/
  modelo_em.pkl      — modelo calibrado (Logistic Regression + isotonic)
  metricas_em.pkl    — métricas completas, SHAP, fairness, diagnóstico
```
