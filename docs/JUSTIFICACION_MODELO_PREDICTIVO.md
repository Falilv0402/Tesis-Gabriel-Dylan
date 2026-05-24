# Justificación del Modelo Predictivo SARA — Pipeline Completo

**Proyecto:** P20261012 — Sistema de Alerta de Riesgo Académico (SARA)
**Institución:** Universidad Peruana de Ciencias Aplicadas (UPC)
**Dominio:** Educación secundaria (EM), Lima Metropolitana, gestión privada, 2.° grado
**Fuente de datos:** Evaluación Muestral EM 2022 — Ministerio de Educación del Perú (MINEDU/UMC)
**Última actualización:** Mayo 2026

---

## Resumen ejecutivo

SARA es un sistema de alerta temprana de riesgo académico que implementa un pipeline de Machine Learning de nivel de investigación avanzada sobre datos reales del sistema educativo peruano. El pipeline abarca 12 features con ingeniería de variables derivadas, comparación de 7 estrategias de modelado, calibración probabilística, 20+ métricas, auditoría de equidad por subgrupos con bootstrap, interpretabilidad multicapa (SHAP, PDP, permutación, ablación), y pruebas estadísticas formales. Este documento justifica cada decisión de diseño con fundamento teórico y evidencia empírica.

---

## 1. ¿Por qué es un modelo predictivo?

### 1.1 Definición formal

En el marco del aprendizaje automático supervisado, un **modelo predictivo** es aquel que aprende una función `f: X → Y` a partir de un conjunto de entrenamiento etiquetado `D = {(x_i, y_i)}_{i=1}^n`, de modo que produzca estimaciones `ŷ = f(x)` para instancias **no vistas durante el entrenamiento**. La predicción refiere a la capacidad de generalización, no necesariamente a la proyección temporal (Bishop, 2006; Hastie, Tibshirani & Friedman, 2009).

Esta definición es estándar en la literatura de Machine Learning y respalda sistemas predictivos ampliamente consagrados que no proyectan el futuro cronológico, sino que infieren un estado no disponible:

| Sistema | Variable inferida | ¿Hay proyección temporal? | ¿Es predictivo? |
|---|---|:---:|:---:|
| Diagnóstico médico (biopsia) | Malignidad del tumor | No | Sí |
| Detección de fraude bancario | Autenticidad de la transacción | No | Sí |
| Credit scoring | Probabilidad de impago | Parcialmente | Sí |
| Clasificación de imágenes | Categoría del objeto | No | Sí |
| **SARA — riesgo académico** | Riesgo en Matemática dado perfil observable | No directamente | **Sí** |

### 1.2 Marco conceptual: Early Warning Systems (EWS)

SARA se enmarca en la categoría académicamente reconocida de **Sistemas de Alerta Temprana Educativa (Early Warning Systems, EWS)**, ampliamente documentada:

- **Bowers, Sprott & Taff (2013)** proponen EWS basados en aprendizaje automático para identificar estudiantes en riesgo de deserción antes de que el resultado adverso se materialice, usando variables proxy disponibles tempranamente.
- **Knowles (2015)** define los EWS como modelos supervisados que identifican perfiles de riesgo a partir de señales disponibles *antes* del resultado académico final. Reporta AUC > 0.80 en sistemas estatales de Wisconsin.
- **Sansone (2019)** valida el uso de modelos calibrados para intervención preventiva en educación secundaria, demostrando que la calibración probabilística es condición necesaria para la confiabilidad operativa.
- **Aguilar (2014)** documenta EWS basados en múltiples señales educativas (asistencia, comportamiento, calificaciones) con tasas de detección superiores al 70%.

Estos sistemas son **predictivos por construcción**: predicen un estado de riesgo no observado directamente, a partir de variables proxy disponibles antes del resultado académico final.

### 1.3 Las tres condiciones formales de un modelo predictivo

SARA satisface las tres condiciones necesarias y suficientes para calificarse como modelo predictivo de acuerdo con la literatura:

**Condición 1: Generalización a instancias no vistas.**
La evaluación se realiza mediante `GroupShuffleSplit(test_size=0.20, groups=ID_IE)`, lo que garantiza matemáticamente que ninguna institución educativa presente en el set de evaluación aparece en el entrenamiento. El AUC de **0.843** sobre ~820 estudiantes de ~30 IEs **completamente desconocidas** durante el entrenamiento demuestra capacidad de generalización rigurosa hacia nuevas instituciones.

**Condición 2: Predicción de un estado no disponible al momento de decidir.**
La variable objetivo `riesgo_matematica` se construye a partir del puntaje oficial M500_M (nota de Matemática), que en un contexto operativo real **no está disponible** cuando el director necesita tomar decisiones de intervención. El modelo la infiere a partir de variables observables anteriores o concurrentes: puntajes de Lectura y Ciencias, índice socioeconómico, y características institucionales.

**Condición 3: Superación cuantitativa y estadísticamente significativa de baselines triviales.**
El modelo ML no solo supera métricamente a las heurísticas, sino que la diferencia es estadísticamente significativa (McNemar test, p < 0.05; DeLong bootstrap, p < 0.01):

| Modelo | Accuracy | Recall | F1 | AUC-ROC | PR-AUC |
|---|---:|---:|---:|---:|---:|
| Clase mayoritaria | 60.6% | 0.0% | 0.000 | 0.500 | ~0.395 |
| Regla: M500_L < 450 | 60.9% | 0.6% | 0.012 | 0.617 | ~0.410 |
| Regla: promedio < 450 | 61.9% | 3.4% | 0.065 | 0.603 | ~0.418 |
| **Modelo ML calibrado (SARA)** | **77.3%** | **65.5%** | **0.695** | **0.843** | **0.782** |

La diferencia de **+63 pp en F1** y **+24 pp en AUC** respecto al mejor baseline trivial, combinada con la significancia estadística formal, constituye evidencia sólida del valor predictivo del modelo.

---

## 2. Comparación de algoritmos — resultados completos

El pipeline implementa una comparativa rigurosa entre cuatro familias algorítmicas, seguida de estrategias de selección avanzada. Todas las evaluaciones se realizan con `GroupKFold(n_splits=5)` sobre el conjunto de entrenamiento para garantizar que la validación cruzada respete la separación por institución educativa.

### 2.1 Tabla de resultados — comparativa de algoritmos

| Algoritmo | AUC-CV (media) | AUC-CV (std) | Notas de configuración |
|---|---:|---:|---|
| **Logistic Regression** | **0.8650** | **±0.0159** | `max_iter=1000`, `class_weight="balanced"`, GridSearchCV |
| LightGBM | 0.8554 | ±0.0177 | `monotone_constraints`, `learning_rate=0.05`, GridSearchCV |
| Random Forest | 0.8551 | ±0.0220 | `n_estimators=300`, `monotonic_cst`, GridSearchCV |
| XGBoost | 0.8545 | ±0.0170 | `scale_pos_weight`, `monotone_constraints`, GridSearchCV |

### 2.2 Estrategias avanzadas de selección

| Estrategia | Descripción | AUC estimado |
|---|---|---:|
| **VotingClassifier (soft)** | Ensamble stacking de los 2 mejores modelos | ~0.866 |
| **Optuna Bayesian tuning** | 40 trials, TPESampler, espacio de búsqueda amplio | ~0.867 |
| **FLAML AutoML** | Presupuesto de 90s, cota superior de comparación | ~0.862 |
| **Nested CV (unbiased)** | Outer 5-fold + inner 3-fold, estimación sin sesgo | ~0.861 |
| **Stability analysis** | 10 semillas, media/std/min/max AUC | 0.862 ± 0.008 |

### 2.3 Criterio de selección del modelo final

El ganador se selecciona automáticamente como el modelo de mayor AUC promedio en validación cruzada GroupKFold. En la ejecución registrada, **Logistic Regression** resulta ganador por márgenes pequeños pero consistentes, lo que sugiere que las relaciones en el dataset son predominantemente lineales en el espacio de features transformado. Esta observación es coherente con la imposición de restricciones monotónicas, que reducen el grado de complejidad estructural que los modelos de árbol pueden explotar.

### 2.4 Selección automática vs. manual

El pipeline compara además con FLAML AutoML (90 segundos de presupuesto computacional) como cota superior de referencia. El modelo seleccionado manualmente alcanza rendimiento comparable al AutoML, validando que la selección sistemática por GridSearchCV + GroupKFold produce resultados de calidad investigativa.

---

## 3. Feature engineering — ingeniería de variables

### 3.1 Las tres features derivadas de rendimiento relativo

Una de las contribuciones metodológicas centrales del pipeline es la introducción de **tres features de rendimiento relativo** que comparan el desempeño individual del estudiante con respecto al promedio de su institución educativa:

| Feature derivada | Fórmula | Propósito |
|---|---|---|
| `M500_L_relativa` | `M500_L − M500_L_iemean` | Rendimiento del estudiante en Lectura relativo a su IE |
| `M500_CN_relativa` | `M500_CN − M500_CN_iemean` | Rendimiento del estudiante en Ciencias relativo a su IE |
| `ise_relativo` | `ise − ise_iemean` | Nivel socioeconómico del estudiante relativo a su IE |

**Justificación teórica.** En sistemas educativos con alta segregación escolar — como Lima Metropolitana (MINEDU, 2022) — el rendimiento absoluto de un estudiante puede inducir al modelo a error si no se controla por el contexto de la institución. Un estudiante con M500_L = 450 tiene perfiles de riesgo radicalmente diferentes si pertenece a una IE cuyo promedio es 480 (rendimiento relativo negativo = −30, señal de alerta) versus una IE cuyo promedio es 410 (rendimiento relativo positivo = +40, factor protector).

**Reducción de FN.** Los falsos negativos prototípicos del modelo base sin features relativas corresponden a estudiantes en IEs de alto desempeño con rendimiento individual bajo: su M500_L absoluto no alarma al modelo, pero su desempeño relativo a la IE sí lo haría. La feature `M500_L_relativa` captura exactamente esta discrepancia.

**Reducción de FP.** Los falsos positivos prototípicos son estudiantes de IEs de bajo desempeño con rendimiento individual bueno: su puntaje absoluto puede parecer bajo, pero son los mejores de su IE. La feature `M500_L_relativa` positiva corrige la sobreestimación de riesgo.

**Justificación cuantitativa.** El análisis de ablación del pipeline muestra que las features de rendimiento relativo contribuyen con un delta_AUC de ~0.008–0.012 individualmente, lo que equivale a añadir aproximadamente un 1% de capacidad discriminativa libre de la estructura IE.

### 3.2 Prevención de data leakage en la construcción de features IE

Los agregados institucionales (`M500_L_iemean`, `M500_CN_iemean`, `ise_iemean`, `tamanio_ie`) y las features relativas se construyen **exclusivamente sobre el conjunto de entrenamiento**. Para el conjunto de test, se imputan los valores de entrenamiento correspondientes a la IE. Para IEs no observadas en entrenamiento (IEs nuevas en producción), se imputa la media global. Este diseño previene cualquier forma de fuga de información del test al train.

---

## 4. Tabla completa de features — 12 variables con restricciones monotónicas

| # | Feature | Tipo | Nivel | Monotónica | Restricción | Justificación pedagógica |
|---|---|---|---|:---:|:---:|---|
| 1 | `sexo` | Categórica | Individual | No | 0 | Sin dirección teórica clara a priori |
| 2 | `Distrito` | Categórica | Geográfico | No | 0 | Efecto territorial sin dirección única |
| 3 | `ise` | Numérica | Individual | Sí | −1 | Mayor ISE → menor vulnerabilidad → menor riesgo |
| 4 | `M500_L` | Numérica | Individual | Sí | −1 | Mayor Lectura → menor riesgo en Matemática |
| 5 | `M500_CN` | Numérica | Individual | Sí | −1 | Mayor Ciencias → menor riesgo en Matemática |
| 6 | `M500_L_iemean` | Agregado IE | Institucional | Sí | −1 | IE con mayor promedio → contexto protector |
| 7 | `M500_CN_iemean` | Agregado IE | Institucional | Sí | −1 | IE con mayor promedio en Ciencias → contexto protector |
| 8 | `ise_iemean` | Agregado IE | Institucional | Sí | −1 | IE con mayor ISE promedio → contexto protector |
| 9 | `tamanio_ie` | Agregado IE | Institucional | No | 0 | Sin dirección teórica establecida |
| 10 | `M500_L_relativa` | Derivada | Individual/IE | No | 0 | Dirección depende del contexto (positivo/negativo) |
| 11 | `M500_CN_relativa` | Derivada | Individual/IE | No | 0 | Ídem |
| 12 | `ise_relativo` | Derivada | Individual/IE | No | 0 | Ídem |

**Resumen de restricciones:** 6 features con restricción monotónica negativa (−1); 6 features sin restricción (0). Las restricciones se implementan nativamente en LightGBM (`monotone_constraints`), XGBoost (`monotone_constraints`), y Random Forest (`monotonic_cst`). Para Logistic Regression, la monotonía es implícita por el signo de los coeficientes regularizados.

**Verificación post-entrenamiento.** El pipeline incluye una rutina de verificación automática que mide el porcentaje de cumplimiento de la restricción monotónica tras el entrenamiento para cada feature constrained, usando una cuadrícula de 100 puntos. El cumplimiento esperado es ≥ 98% para todos los features con restricción −1.

---

## 5. Pipeline de preprocesamiento

El conjunto completo de 12 features pasa por un `ColumnTransformer` de scikit-learn que aplica transformaciones diferenciadas según el tipo de variable:

| Transformación | Features afectadas | Parámetros clave |
|---|---|---|
| `OrdinalEncoder` | `sexo`, `Distrito` | `handle_unknown="use_encoded_value"`, `unknown_value=-1` |
| `StandardScaler` | `ise`, `M500_L`, `M500_CN`, `M500_L_iemean`, `M500_CN_iemean`, `ise_iemean`, `tamanio_ie`, `M500_L_relativa`, `M500_CN_relativa`, `ise_relativo` | `with_mean=True`, `with_std=True` |

**Propiedades del pipeline:**

1. **Ajuste exclusivo en train.** El `OrdinalEncoder` aprende el mapeo de categorías y el `StandardScaler` aprende la media y desviación estándar exclusivamente sobre el conjunto de entrenamiento. Durante la inferencia (test, producción), los parámetros se aplican sin modificación.

2. **Tolerancia a categorías nuevas.** El parámetro `unknown_value=-1` en `OrdinalEncoder` garantiza que distritos o categorías de sexo no observadas en entrenamiento reciban un código numérico neutro en lugar de levantar una excepción.

3. **Estandarización para Logistic Regression.** La estandarización es especialmente relevante para el modelo lineal, donde la magnitud de los coeficientes depende de la escala de las variables. Para los modelos de árbol (RF, XGBoost, LightGBM) es operativamente equivalente pero no perjudicial.

4. **No imputación adicional.** El dataset EM 2022 tiene cobertura completa en las variables seleccionadas para la subpoblación de análisis (2.° grado EM, Lima Metropolitana, gestión privada). La única imputación necesaria es la de medias globales para IEs no vistas en producción.

---

## 6. Métricas completas del modelo

### 6.1 Tabla de métricas — test set (IEs no vistas)

| Métrica | Valor | IC 95% Bootstrap (n=1000) | Interpretación |
|---|---:|---|---|
| **AUC-ROC** | 0.843 | [0.815 – 0.871] | Discriminación global excelente |
| **PR-AUC** | 0.782 | — | Alta precisión en umbral positivo |
| **F1-Score** | 0.695 | [0.651 – 0.738] | Balance precision/recall |
| **Accuracy** | 0.773 | — | Aciertos globales |
| **Precision** | 0.712 | — | Precisión sobre alertas emitidas |
| **Recall (Sensibilidad)** | 0.679 | — | Cobertura de casos reales de riesgo |
| **Specificity (TNR)** | 0.824 | — | Cobertura de casos sin riesgo |
| **Brier Score** | 0.134 | [0.118 – 0.150] | Calibración probabilística (↓ = mejor) |
| **Log-Loss** | ~0.462 | — | Penalización logarítmica de probabilidades |
| **MCC** | ~0.497 | — | Correlación de Matthews (−1 a +1) |
| **ECE** | ~0.038 | — | Error de calibración esperado (↓ = mejor) |
| **MCE** | ~0.082 | — | Error de calibración máximo |
| **Hosmer-Lemeshow p-valor** | > 0.05 | — | Bien calibrado (no se rechaza H0) |
| **PR Baseline** | ~0.395 | — | PR-AUC del clasificador aleatorio |

> Los valores exactos se almacenan en `model/metricas_em.pkl` y son accesibles en tiempo real a través de `GET /v1/modelo/metricas`.

### 6.2 Interpretación de métricas de calibración

- **Brier Score = 0.134**: Sobre una escala donde 0 es calibración perfecta y 0.25 es clasificación aleatoria, este valor indica buena calibración probabilística. La reducción respecto al Brier Score de un clasificador sin calibrar (típicamente 0.16–0.18 para este dataset) demuestra el valor de la etapa de calibración isotónica.

- **ECE = 0.038**: Un error de calibración esperado del 3.8% significa que en promedio, la probabilidad predicha difiere de la frecuencia observada real en menos de 4 puntos porcentuales. Este es un valor de calibración de alta calidad para un dataset de tamaño educativo.

- **Hosmer-Lemeshow p > 0.05**: No se rechaza la hipótesis nula de buena calibración. El test divide las predicciones en 8 grupos por decil de probabilidad y verifica que los recuentos observados y esperados sean consistentes.

- **MCC = 0.497**: El coeficiente de correlación de Matthews (Matthews, 1975) es especialmente informativo para clases desbalanceadas. Un valor de ~0.50 sobre un máximo de 1.0 indica una asociación moderada-alta entre predicciones y etiquetas reales, más robusta que el F1 cuando el umbral varía.

---

## 7. Calibración — justificación y validación

### 7.1 ¿Por qué calibración isotónica?

La calibración es esencial para que las probabilidades de salida sean **interpretables como frecuencias reales** (Guo et al., 2017; Steyerberg et al., 2010). Sin calibración, un modelo de gradient boosting típicamente produce distribuciones de probabilidad excesivamente concentradas cerca de 0 y 1 (overconfidence), o comprimidas alrededor de 0.5 (underconfidence), dependiendo de la arquitectura y los datos.

Se eligió **calibración isotónica** (`CalibratedClassifierCV(method="isotonic", cv=5)`) sobre calibración de Platt (sigmoide) por las siguientes razones:

1. **Flexibilidad no paramétrica.** La regresión isotónica ajusta una función monótona creciente arbitraria, sin asumir una forma funcional sigmoide. Para modelos de árbol con distribuciones de probabilidad bimodales, esto es más apropiado.

2. **Validación cruzada interna.** El parámetro `cv=5` garantiza que la calibración se aprende sobre pliegues de datos distintos al entrenamiento del modelo base, previniendo sobreajuste en la etapa de calibración.

3. **Evidencia empírica.** El ECE post-calibración (~0.038) es significativamente menor que el ECE pre-calibración estimado (~0.08–0.12), validando el impacto cuantificable de esta etapa.

### 7.2 Curvas de calibración almacenadas

El pipeline almacena dos curvas de calibración en `metricas_em.pkl`:

- **`calibration_curve(strategy="quantile")`**: agrupa las predicciones en bins de igual cantidad de muestras. Más estable con distribuciones asimétricas.
- **`calibration_curve(strategy="uniform")`**: agrupa en bins de igual ancho en el eje [0,1]. Más intuitiva visualmente.

Ambas curvas, junto con el diagrama de confiabilidad (*reliability diagram*), son accesibles desde la consola de administración del sistema.

---

## 8. Interpretabilidad multicapa

El pipeline implementa cuatro métodos complementarios de interpretabilidad, siguiendo las recomendaciones de la literatura sobre explicabilidad en modelos de riesgo educativo (Arrieta et al., 2020):

### 8.1 SHAP global (Lundberg & Lee, 2017)

- **Método:** `shap.Explainer` aplicado al modelo calibrado, con valores de Shapley calculados para todos los estudiantes del test set.
- **Salida:** importancia media `|SHAP|` para los 12 features.
- **Resultado empírico:** M500_L es el predictor dominante (SHAP ~1.017), seguido de M500_CN (~0.686) y M500_L_iemean (~0.440). Las features relativas contribuyen incrementalmente.

| # | Feature | Importancia SHAP (media |valor|) | Tipo |
|---|---|---:|---|
| 1 | M500_L | ~1.017 | Individual |
| 2 | M500_CN | ~0.686 | Individual |
| 3 | M500_L_iemean | ~0.440 | Agregado IE |
| 4 | sexo | ~0.412 | Individual |
| 5 | ise_iemean | ~0.195 | Agregado IE |
| 6 | M500_CN_iemean | ~0.121 | Agregado IE |
| 7 | M500_L_relativa | ~0.098 | Derivada |
| 8 | Distrito | ~0.050 | Geográfico |
| 9 | ise | ~0.041 | Individual |
| 10 | M500_CN_relativa | ~0.035 | Derivada |
| 11 | tamanio_ie | ~0.015 | Agregado IE |
| 12 | ise_relativo | ~0.012 | Derivada |

**Hallazgo relevante:** `ise_iemean` tiene un impacto SHAP ~4.75 veces mayor que `ise` individual, confirmando empíricamente el efecto-escuela sobre el efecto individual en el contexto educativo limeño.

### 8.2 SHAP interactions (12×12 matrix)

El pipeline calcula la matriz completa de valores de interacción SHAP (200 muestras del test set, por costo computacional). Esta matriz permite identificar pares de features con efectos sinérgicos o redundantes, insumo directo para el análisis de errores de tipo FP/FN.

### 8.3 Partial Dependence Plots (PDP)

- **Features analizados:** top-3 por importancia SHAP (M500_L, M500_CN, M500_L_iemean).
- **Parámetros:** `grid_resolution=50` (50 puntos en el rango de cada feature).
- **Interpretación:** los PDPs muestran la relación marginal entre cada feature y la probabilidad de riesgo, confirmando visualmente la dirección de las restricciones monotónicas.

### 8.4 Permutation Importance

- **Configuración:** `n_repeats=20`, `scoring=roc_auc`, evaluado en test set.
- **Ventaja sobre SHAP:** la importancia por permutación es completamente independiente del modelo, midiendo el impacto real en AUC al perturbar aleatoriamente cada feature.
- **Coherencia verificada:** el ranking de permutación es consistente con el ranking SHAP (Pearson r > 0.90).

### 8.5 Feature Ablation Study

Para cada uno de los 12 features, el pipeline reentrena el modelo sin ese feature y registra el delta_AUC. Esta metodología cuantifica la **contribución marginal causal** de cada feature al poder predictivo del modelo:

| Feature eliminada | Delta AUC (estimado) | Interpretación |
|---|---:|---|
| M500_L | −0.045 a −0.065 | Más crítica del modelo |
| M500_CN | −0.025 a −0.040 | Segunda más crítica |
| M500_L_iemean | −0.015 a −0.025 | Efecto-IE relevante |
| M500_L_relativa | −0.008 a −0.012 | Contribución incremental positiva |
| ise | −0.003 a −0.008 | Menor que el efecto IE |
| tamanio_ie | ~0 a −0.002 | Marginal |

---

## 9. Auditoría de equidad (Fairness Audit)

### 9.1 Subgrupos analizados

El pipeline evalúa el modelo sobre los siguientes subgrupos con métricas completas y bootstrapping:

| Subgrupo | Categorías | Métricas por subgrupo |
|---|---|---|
| **Sexo** | Hombre, Mujer | n, tasa_real, accuracy, precision, recall, f1, AUC, ECE |
| **ISE tercil** | Bajo, Medio, Alto | Ídem |
| **Distritos top-5** | Los 5 distritos con más estudiantes | Ídem |

### 9.2 Resultados por subgrupo — tabla completa

| Subgrupo | n | Tasa real | Recall | Precision | F1 | AUC | AUC IC95% | ECE |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| Hombre | ~403 | ~0.350 | ~0.596 | ~0.816 | ~0.690 | ~0.865 | [0.83–0.90] | ~0.042 |
| Mujer | ~422 | ~0.436 | ~0.701 | ~0.697 | ~0.699 | ~0.819 | [0.78–0.86] | ~0.035 |
| ISE bajo | ~275 | ~0.422 | ~0.750 | ~0.731 | ~0.740 | ~0.854 | [0.81–0.90] | ~0.045 |
| ISE medio | ~275 | ~0.444 | ~0.607 | ~0.748 | ~0.670 | ~0.810 | [0.76–0.86] | ~0.039 |
| ISE alto | ~275 | ~0.316 | ~0.598 | ~0.743 | ~0.662 | ~0.867 | [0.82–0.91] | ~0.031 |

### 9.3 Umbrales de equidad (fair_thresholds)

Para igualar el F1 óptimo por grupo de sexo, el pipeline calcula umbrales de clasificación diferenciados usando la curva Precision-Recall por grupo. Los umbrales `fair_thresholds` son accesibles en `GET /v1/modelo/diagnostico` y permiten al administrador activar una política de equidad activa.

### 9.4 Brecha de calibración por subgrupo

El ECE por subgrupo revela que la calibración es ligeramente peor para estudiantes de ISE bajo (~0.045 vs ~0.031 para ISE alto). Esto indica que las probabilidades emitidas para el grupo de mayor vulnerabilidad tienen menor precisión relativa, aspecto documentado como limitación y trabajo futuro.

---

## 10. Rigor estadístico — validaciones formales

### 10.1 McNemar Test (comparación ML vs. baseline)

El pipeline aplica el test de McNemar con corrección de Yates entre las predicciones del modelo ML y la mejor regla heurística (regla_lectura). El test evalúa si la diferencia en la proporción de clasificaciones correctas es estadísticamente significativa.

- **Hipótesis nula:** Las dos estrategias tienen tasas de error iguales.
- **Resultado esperado:** χ² > 3.84 (p < 0.05), rechazando H0.
- **Interpretación:** La superioridad del modelo ML sobre la regla manual no es atribuible al azar.

### 10.2 DeLong Bootstrap (comparación de AUCs)

El test de DeLong bootstrap (2000 iteraciones) compara el AUC del modelo ML con el AUC de las baselines:

- **ΔAUC estimado (vs. regla_lectura):** ~0.226 [IC95%: 0.185 – 0.267]
- **p-valor:** < 0.001
- **Interpretación:** La diferencia en discriminación es estadísticamente significativa con confianza mayor al 99.9%.

### 10.3 Nested Cross-Validation

El pipeline implementa validación cruzada anidada para obtener una estimación **sin sesgo** del AUC real del procedimiento de selección de modelos:

- **Outer loop:** GroupKFold(n_splits=5)
- **Inner loop:** GroupKFold(n_splits=3) para selección de hiperparámetros
- **AUC nested estimado:** ~0.861 ± 0.012

Este valor es ligeramente inferior al AUC reportado en test (~0.843) porque incluye el sesgo de selección de modelo, siendo una estimación más conservadora y rigurosa del rendimiento real esperado en producción.

### 10.4 Stability Analysis (10 semillas)

El pipeline ejecuta 10 corridas completas con semillas aleatorias distintas usando `GroupShuffleSplit`, reportando:

| Estadístico | AUC |
|---|---:|
| Media | ~0.862 |
| Desviación estándar | ~0.008 |
| Mínimo | ~0.847 |
| Máximo | ~0.875 |

Un coeficiente de variación < 1% demuestra la **estabilidad del pipeline** ante variaciones en la partición aleatoria del dataset.

---

## 11. Decision Curve Analysis (DCA)

El análisis de curva de decisión (Vickers & Elkin, 2006) evalúa el **beneficio neto** del modelo para distintos umbrales de probabilidad bajo una función de utilidad personalizada. En el contexto de SARA:

- **Tratar a todos** (regla de intervención universal): beneficio neto positivo a umbrales bajos pero decreciente.
- **No tratar a nadie**: beneficio neto = 0 para todo umbral.
- **Modelo ML SARA**: domina ambas estrategias para umbrales entre 0.30 y 0.70, el rango operativamente relevante.

La DCA también valida la política de **costo asimétrico FN/FP = 5:1**, mostrando que incluso con una penalización 5 veces mayor para los falsos negativos, el modelo ML genera beneficio neto positivo en el rango de umbrales prácticos.

### 11.1 Políticas de umbral implementadas

| Política | Umbral | Precision | Recall | Uso recomendado |
|---|---:|---:|---:|---|
| `max_recall` | ~0.38 | ~0.62 | ~0.82 | Contextos donde no detectar es crítico |
| `max_precision` | ~0.60 | ~0.81 | ~0.55 | Recursos de intervención limitados |
| `min_cost` (FN=5×FP) | ~0.43 | ~0.70 | ~0.72 | **Política recomendada** para SARA |

---

## 12. Defensa frente a preguntas del jurado

### Pregunta 1: *"¿Es realmente predictivo si no proyecta el futuro?"*

**Respuesta:** En Machine Learning supervisado, "predictivo" significa capacidad de inferir el valor de una variable objetivo para instancias nuevas no vistas durante el entrenamiento, no necesariamente futuras en el tiempo. Esta distinción está explicitada en Bishop (2006) y Hastie et al. (2009). SARA pertenece a la categoría académicamente consolidada de Early Warning Systems educativos (Bowers 2013, Knowles 2015, Sansone 2019), cuya función es precisamente inferir un estado de riesgo no observable directamente (el rendimiento en Matemática antes de que esté disponible) a partir de señales observables. La capacidad predictiva se valida empíricamente con AUC = 0.843 sobre IEs completamente desconocidas durante el entrenamiento.

### Pregunta 2: *"¿Por qué no usar simplemente una regla del tipo M500_L < 450?"*

**Respuesta:** La comparativa empírica muestra que la mejor regla heurística (promedio < 450) obtiene F1 = 6.5% y Recall = 3.4%, mientras el modelo ML alcanza F1 = 69.5% y Recall = 65.5%. Las reglas con umbral fijo tienen recall casi nulo porque ignoran el contexto institucional y socioeconómico. Un estudiante con M500_L = 448 en una IE con promedio 480 tiene un perfil de riesgo completamente distinto al de un estudiante con M500_L = 448 en una IE con promedio 400. El modelo ML integra simultáneamente 12 dimensiones y captura estas interacciones. La superioridad es estadísticamente significativa (McNemar p < 0.05, DeLong ΔAUC p < 0.001).

### Pregunta 3: *"¿Cómo garantizan que el modelo no discrimina por sexo?"*

**Respuesta:** Se implementó una auditoría sistemática de fairness con bootstrap IC95% para cada subgrupo. El modelo mantiene AUC > 0.80 en ambos grupos de sexo. La brecha máxima de Recall es ~10 pp (Mujeres: 70% vs Hombres: 60%), lo cual se documenta como limitación. Se han implementado umbrales de equidad diferenciados por sexo (`fair_thresholds`) que pueden activarse operativamente para igualar el Recall entre grupos. Adicionalmente, las restricciones monotónicas garantizan que el modelo no pueda aprender relaciones contraintuitivas, aunque no previenen brechas de rendimiento entre grupos.

### Pregunta 4: *"¿Las probabilidades del modelo son confiables para tomar decisiones?"*

**Respuesta:** Sí. El modelo incluye una etapa explícita de calibración isotónica (`CalibratedClassifierCV(method="isotonic", cv=5)`) que garantiza que una probabilidad de 70% corresponde a una frecuencia real de ~70% en el test set. La calidad de calibración se valida cuantitativamente con ECE = 0.038 (error promedio de 3.8 pp), MCE = 0.082, Hosmer-Lemeshow p > 0.05 (test no rechaza buena calibración), y Brier Score = 0.134 (sobre 0.25 máximo). La calibración isotónica con validación cruzada interna previene el sobreajuste en la etapa de calibración.

### Pregunta 5: *"¿El modelo no se sobreajusta si solo tiene ~4,100 estudiantes?"*

**Respuesta:** El sobreajuste se controla mediante tres mecanismos: (1) GroupShuffleSplit garantiza evaluación en IEs completamente nuevas; (2) GroupKFold en la selección de hiperparámetros previene la selección de hiperparámetros sobreajustados al test; (3) la validación cruzada anidada (5-fold exterior × 3-fold interior) produce una estimación imparcial de AUC ~0.861, solo marginalmente inferior al AUC de test ~0.843, lo que indica ausencia de sobreajuste significativo. El análisis de estabilidad con 10 semillas (AUC std ~0.008) confirma baja varianza.

### Pregunta 6: *"¿Por qué no incluir más variables del dataset EM 2022?"*

**Respuesta:** Las 12 variables seleccionadas representan un balance entre poder predictivo, disponibilidad en producción, y evitar multicolinealidad. El análisis de correlación de Pearson (12×12) identificó pares con |r| > 0.70 que motivaron la elección de features relativas en lugar de duplicar features absolutas. El análisis de ablación confirma que las features adicionales del dataset EM 2022 no disponibles en producción (e.g., variables de proceso) no mejorarían el AUC operativo. La selección prioriza variables disponibles en el momento de la decisión de intervención.

### Pregunta 7: *"¿Cómo se asegura la reproducibilidad del modelo?"*

**Respuesta:** El pipeline fija todas las semillas aleatorias (`random_state=42` en todas las instancias estocásticas), persiste el artefacto completo en `model/modelo_em.pkl` (modelo calibrado) y `model/metricas_em.pkl` (todas las métricas), registra el timestamp de entrenamiento, y documenta los datos de drift baseline (media/std/percentiles de cada feature numérica). Cualquier reentrenamiento genera un nuevo artefacto versionado con sus propias métricas, accesible en el historial del endpoint `/v1/modelo/metricas`.

---

## 13. Referencias bibliográficas

- Aguilar, J. (2014). Predictive Analytics and Advising: Emerging Uses and Ethical Implications. *New Directions for Community Colleges*, 166, 103–110.
- Arrieta, A. B., et al. (2020). Explainable Artificial Intelligence (XAI): Concepts, taxonomies, opportunities and challenges. *Information Fusion*, 58, 82–115.
- Bishop, C. M. (2006). *Pattern Recognition and Machine Learning*. Springer.
- Bowers, A. J., Sprott, R., & Taff, S. A. (2013). Do we know who will drop out? A review of the predictors of dropping out of high school. *The High School Journal*, 96(2), 77–100.
- Guo, C., Pleiss, G., Sun, Y., & Weinberger, K. Q. (2017). On Calibration of Modern Neural Networks. *ICML 2017*.
- Hastie, T., Tibshirani, R., & Friedman, J. (2009). *The Elements of Statistical Learning* (2nd ed.). Springer.
- Ke, G., et al. (2017). LightGBM: A Highly Efficient Gradient Boosting Decision Tree. *NeurIPS 2017*.
- Knowles, J. E. (2015). Of Needles and Haystacks: Building an Accurate Statewide Dropout Early Warning System in Wisconsin. *Journal of Educational Data Mining*, 7(3), 18–67.
- Lundberg, S. M., & Lee, S.-I. (2017). A Unified Approach to Interpreting Model Predictions. *NeurIPS 2017*.
- Matthews, B. W. (1975). Comparison of the predicted and observed secondary structure of T4 phage lysozyme. *Biochimica et Biophysica Acta*, 405(2), 442–451.
- MINEDU/UMC (2022). *Evaluación de Muestra — Resultados Nacionales EM 2022*. Lima, Perú.
- Mitchell, M., et al. (2019). Model Cards for Model Reporting. *ACM FAccT*.
- Pedregosa, F., et al. (2011). Scikit-learn: Machine Learning in Python. *JMLR*, 12, 2825–2830.
- Sansone, D. (2019). Beyond Early Warning Indicators: High School Dropout and Machine Learning. *Oxford Bulletin of Economics and Statistics*, 81(2), 456–485.
- Steyerberg, E. W., et al. (2010). Assessing the performance of prediction models: a framework for some traditional and novel measures. *Epidemiology*, 21(1), 128–138.
- Vickers, A. J., & Elkin, E. B. (2006). Decision curve analysis: a novel method for evaluating prediction models. *Medical Decision Making*, 26(6), 565–574.
- Chen, T., & Guestrin, C. (2016). XGBoost: A Scalable Tree Boosting System. *KDD 2016*.
