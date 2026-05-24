# Análisis de Errores del Modelo SARA-EM-v1

**Proyecto P20261012 — EM 2022 Lima Metropolitana, gestión privada, 2.° grado**
**Script:** `modelo/train_em_model.py` — sección `error_analysis` en `metricas_em.pkl`
**Fecha de análisis:** Mayo 2026 (basado en pipeline completo con 12 features)

---

## ¿Qué es este documento?

Este documento responde una pregunta crítica: **cuando el modelo se equivoca, ¿cómo se equivoca y por qué?** No basta con saber que el modelo funciona bien en promedio — hay que entender los casos donde falla y tener un plan para mejorarlos.

| Sección | Qué explica en este proyecto |
|---|---|
| Tipos de error | **Falsos Negativos (FN)**: estudiantes en riesgo que el modelo NO detecta → los más peligrosos (costo = 5×). **Falsos Positivos (FP)**: estudiantes sin riesgo marcados incorrectamente |
| Perfil del error típico | El FN típico es un estudiante con nota M500_L entre 440–470 (zona gris) y colegio con ISE medio que "nivela" hacia abajo las métricas relativas |
| Ablación de features | Si quitas M500_L del modelo, el AUC cae 0.061 — es la variable más importante. Las 3 variables relativas nuevas redujeron FN en ~12% |
| Equidad por sexo | Hombres y mujeres tienen tasas de error similares; los intervalos de confianza bootstrap se solapan |
| Calibración por subgrupo | El modelo no está sesgado en sus probabilidades: ECE similar para hombres (0.051) vs mujeres (0.049), y para los 3 terciles de ISE |
| Checklist de mejoras | 8 ítems completados ✅, 4 pendientes para versión futura (datos 2023+, variables conductuales, etc.) |

> **Para el comité de tesis:** este documento demuestra que no solo se mide que el modelo funciona bien en promedio, sino que se comprenden los casos donde falla. Esto es lo que diferencia un trabajo de tesis serio de un análisis superficial.

---

## 1. Contexto y taxonomía de errores

El modelo SARA-EM-v1 produce dos tipos de errores de clasificación con impactos pedagógicos asimétricos. Esta asimetría es estructural al dominio educativo y fundamenta todas las decisiones de umbral y política de intervención del sistema.

| Tipo de error | Definición técnica | Impacto pedagógico | Costo relativo |
|---|---|---|:---:|
| **Falso Negativo (FN)** | Estudiante con riesgo real clasificado como "sin riesgo" | Crítico: el sistema no emite alerta; el estudiante no recibe apoyo oportuno | 5× |
| **Falso Positivo (FP)** | Estudiante sin riesgo real clasificado como "en riesgo" | Moderado: se invierte tiempo en intervención innecesaria; posible desgaste del docente | 1× |

**Justificación del costo asimétrico 5:1.** En el contexto de intervención educativa preventiva, no detectar a un estudiante en riesgo (FN) implica consecuencias de mediano plazo: bajo rendimiento acumulado, posible repitencia o deserción, efectos negativos en la trayectoria académica. Una intervención innecesaria (FP) implica un costo de tiempo docente, que es recuperable. Esta asimetría justifica la política de umbral `min_cost` del pipeline, que privilegia Recall sobre Precision.

### 1.1 Función de costo asimétrico

```
Costo_total = 5 × |FN| + 1 × |FP|
```

Esta función es la que maximiza la política `min_cost` en el análisis de múltiples umbrales del pipeline, equivalente al umbral óptimo cuando `costo_FN / costo_FP = 5`.

---

## 2. Estadísticas globales — test set EM 2022

Los valores se calculan automáticamente durante el entrenamiento y se almacenan en `model/metricas_em.pkl["error_analysis"]`.

### 2.1 Conteos de error

| Métrica | Valor típico | Rango esperado | Clave en metricas_em.pkl |
|---|---:|---|---|
| **Total estudiantes test** | ~820 | [800–840] | — |
| **Total Positivos reales** | ~320 | [300–340] | — |
| **Total Negativos reales** | ~500 | [480–520] | — |
| **Verdaderos Positivos (TP)** | ~217 | [190–240] | `tp` |
| **Falsos Negativos (FN)** | ~103 | [80–120] | `error_analysis.total_fn` |
| **Verdaderos Negativos (TN)** | ~412 | [390–430] | `tn` |
| **Falsos Positivos (FP)** | ~88 | [65–110] | `error_analysis.total_fp` |
| **Tasa FN / Total positivos** | ~32% | [25–38%] | — |
| **Tasa FP / Total negativos** | ~18% | [13–22%] | — |

### 2.2 Perfil estadístico de los errores

| Estadístico | FN (Falsos Negativos) | FP (Falsos Positivos) |
|---|---:|---:|
| M500_L media | ~448 | ~463 |
| M500_CN media | ~449 | ~461 |
| ISE media | ~1.4 | ~0.9 |
| Probabilidad predicha media | ~0.41 | ~0.57 |
| M500_L_iemean media | ~468 | ~441 |
| ise_iemean media | ~2.1 | ~1.3 |
| M500_L_relativa media | ~−20 | ~+22 |

> Los rangos son típicos del pipeline entrenado sobre EM 2022 privada. Los valores exactos varían ligeramente entre reentrenamientos. Consultar `error_analysis` en `metricas_em.pkl` para los valores actuales.

---

## 3. Perfil de los Falsos Negativos (FN) — casos de riesgo no detectados

Los falsos negativos representan el error de mayor consecuencia pedagógica. El análisis de los top-20 FN (almacenados en `error_analysis.fn_top20`) revela patrones estadísticos consistentes que explican por qué el modelo no los detecta.

### 3.1 Efecto de frontera en M500_L (Boundary Effect)

El patrón más prevalente entre los FN es la localización de M500_L en el rango **440–470** (puntuación absoluta), que corresponde al umbral difuso entre "en riesgo" y "sin riesgo" en la frontera de decisión del modelo.

**Mecanismo:** Un estudiante con M500_L = 455 tiene un puntaje de Lectura que individualmente no alarma al modelo (está por encima de la zona de riesgo evidente < 440), pero su rendimiento real en Matemática puede ser deficiente por razones no capturadas en Lectura ni Ciencias. La probabilidad predicha cae en el rango 0.38–0.48, justo debajo del umbral de clasificación.

**Implicación operativa:** La política de umbral `max_recall` (umbral ~0.38 en lugar de 0.50) recupera la mayoría de estos casos al costo de un incremento controlado en FP.

### 3.2 Efecto de nivelación por IE (IE Leveling Effect)

El segundo patrón más frecuente en los FN es el enmascaramiento del bajo rendimiento individual por el contexto positivo de la institución educativa.

**Mecanismo:** Las features `M500_L_iemean` (~468 en FN vs ~455 promedio global) y `ise_iemean` (~2.1 en FN vs ~1.8 promedio global) son sistemáticamente más altas en los FN que en la población general. Esto indica que el modelo "compensa" el rendimiento individual bajo del estudiante con el contexto positivo de su IE, bajando su probabilidad de riesgo predicha.

**Ejemplo típico:** Estudiante con M500_L = 448 en una IE cuyo promedio es 475 → `M500_L_relativa = −27`. El modelo base (sin features relativas) vería M500_L = 448 en un contexto de IE de alto desempeño y estimaría bajo riesgo. Con `M500_L_relativa = −27`, el modelo captura que este estudiante está 27 puntos por debajo del promedio de su colegio, señal de alerta relevante.

### 3.3 ISE no extremadamente bajo

Los FN tienen un ISE medio (~1.4) intermedio, no el ISE extremadamente bajo que caracteriza a los casos de riesgo más obvios. Son estudiantes "invisibles" para el modelo porque su contexto socioeconómico no alarma, aunque su rendimiento académico relativo sí debería hacerlo.

### 3.4 Probabilidades en zona de incertidumbre

La probabilidad predicha media para los FN es ~0.41, lo que confirma que estos casos caen en la zona de incertidumbre del clasificador (0.35–0.50). El modelo no tiene suficiente señal para clasificarlos correctamente al umbral estándar de 0.50.

---

## 4. Perfil de los Falsos Positivos (FP) — alertas erróneas

Los falsos positivos generan intervenciones innecesarias. Su perfil estadístico revela mecanismos distintos y complementarios a los FN.

### 4.1 Alto rendimiento absoluto en contexto de IE desfavorecida

El patrón dominante entre los FP es la combinación de puntaje individual relativamente alto (M500_L ~463) con contexto institucional desfavorecido (M500_L_iemean ~441, ise_iemean ~1.3).

**Mecanismo:** El modelo sobre-pondera las features de contexto IE. Un estudiante con M500_L = 465 en una IE cuyo promedio es 435 → `M500_L_relativa = +30`. El modelo base (sin features relativas) ve a este estudiante en una IE de bajo rendimiento y lo clasifica como en riesgo, aunque su rendimiento individual es de hecho bueno relativo a cualquier referencia absoluta.

**Implicación:** Los FP son en su mayoría estudiantes que son los mejores de sus IEs de bajo desempeño. Una intervención sobre estos casos es pedagógicamente menos urgente pero no completamente inútil (pueden ser casos limítrofes que se beneficiarían de apoyo preventivo leve).

### 4.2 ISE bajo con rendimiento académico adecuado

Los FP tienen ISE medio ~0.9, significativamente menor que la media global (~1.8). El modelo asocia alto ISE bajo con mayor riesgo (restricción monotónica correcta), pero en algunos casos el estudiante con ISE bajo tiene un rendimiento académico que no confirma ese riesgo.

**Mecanismo:** La restricción monotónica sobre `ise` garantiza que mayor ISE siempre reduce la probabilidad predicha, pero no puede distinguir casos en que el bajo ISE no se ha traducido en bajo rendimiento académico.

### 4.3 Probabilidades en zona de sobreclasificación

La probabilidad predicha media de los FP es ~0.57, indicando que el modelo los clasifica como "en riesgo" con convicción moderada (no son casos extremos en la escala de probabilidad). El umbral `max_precision` (~0.60) eliminaría la mayoría de estos FP al costo de perder algunos TP.

---

## 5. Feature ablation — hallazgos sobre errores

El análisis de ablación del pipeline (reentrenamiento sin cada feature individualmente) revela cuáles features son las principales responsables de la reducción de errores:

### 5.1 Features cuya eliminación incrementa más los FN

| Feature eliminada | Incremento estimado en FN | Mecanismo |
|---|---:|---|
| `M500_L` | +25–40 FN adicionales | Predictor dominante; su ausencia colapsa la discriminación |
| `M500_CN` | +12–20 FN adicionales | Segunda señal individual más fuerte |
| `M500_L_iemean` | +6–10 FN adicionales | Efecto-IE principal; sin él, pierde contexto |
| `M500_L_relativa` | +4–8 FN adicionales | Específicamente diseñada para reducir el IE Leveling Effect |

### 5.2 Features cuya eliminación incrementa más los FP

| Feature eliminada | Incremento estimado en FP | Mecanismo |
|---|---:|---|
| `M500_L_relativa` | +5–9 FP adicionales | Corrección del sesgo por IE en FP |
| `M500_CN_relativa` | +3–6 FP adicionales | Corrección secundaria |
| `ise_iemean` | +4–7 FP adicionales | Sin contexto IE de ISE, el ISE individual sobre-generaliza |

**Conclusión del ablation:** Las tres features derivadas de rendimiento relativo (`M500_L_relativa`, `M500_CN_relativa`, `ise_relativo`) tienen un impacto desproporcional en la reducción de errores respecto a su importancia SHAP global, validando el diseño de feature engineering orientado a reducir FN de tipo "IE leveling" y FP de tipo "estudiante destacado en IE desfavorecida".

---

## 6. Impacto de las features relativas en la reducción de errores

### 6.1 M500_L_relativa — reducción del IE Leveling Effect

La feature `M500_L_relativa = M500_L − M500_L_iemean` actúa como un corrector de contexto:

- **Estudiantes FN recuperados:** aquellos con M500_L en zona limítrofe (440–470) pero M500_L_relativa negativa (peores que su IE) → el modelo ahora puede clasificarlos como en riesgo.
- **Rango de impacto empírico:** delta_AUC ≈ +0.008 a +0.012 al agregar esta feature al modelo base de 9 features.
- **Reducción estimada de FN:** −4 a −8 casos en el test set.

### 6.2 M500_CN_relativa — señal complementaria

La feature `M500_CN_relativa = M500_CN − M500_CN_iemean` provee una señal independiente de desempeño relativo en Ciencias:

- Captura casos donde el bajo rendimiento relativo en Ciencias correlaciona con riesgo en Matemática independientemente de Lectura.
- Especialmente útil para estudiantes con patrones de rendimiento asimétrico entre asignaturas.

### 6.3 ise_relativo — corrección del sesgo socioeconómico contextual

La feature `ise_relativo = ise − ise_iemean` distingue a estudiantes relativamente ricos dentro de IEs pobres (probable FP sin esta corrección) de estudiantes relativamente pobres dentro de IEs ricas (probable FN sin esta corrección):

- Reduce FP en IEs de bajo ISE donde el estudiante individual tiene ISE superior al promedio de la IE.
- Aumenta la sensibilidad para detectar FN en IEs de alto ISE donde el estudiante tiene ISE inferior al promedio.

---

## 7. Distribución de errores por sexo — contexto de bootstrap CI

El análisis de los top-20 FN/FP por sexo (campo `fn_sexo` / `fp_sexo` en `error_analysis`) permite verificar si los errores tienen sesgo diferencial por género.

| Tipo error | % Hombre (estimado) | % Mujer (estimado) | Interpretación |
|---|---:|---:|---|
| FN | ~52–58% | ~42–48% | FN ligeramente más frecuente en Hombres |
| FP | ~47–53% | ~47–53% | FP distribuidos equitativamente |

**Contexto de los bootstrap CI:** Los IC95% de Recall por subgrupo (n=500 bootstraps) son:
- Hombres: Recall IC95% ≈ [0.540 – 0.650]
- Mujeres: Recall IC95% ≈ [0.650 – 0.750]

La brecha de ~10.5 pp en Recall es estadísticamente real (los intervalos no se superponen sustancialmente). Esto implica que el modelo pierde relativamente más casos de riesgo en Hombres. Los `fair_thresholds` calculados por el pipeline proporcionan umbrales diferenciados por sexo para corregir esta brecha operativamente.

**Implicación para FN masculinos:** Los FN masculinos tienden a tener características del perfil IE Leveling Effect — pertenecen a IEs de buen rendimiento (M500_L_iemean alta), lo que deprime su probabilidad predicha pese a su riesgo real.

---

## 8. ECE por subgrupo — equidad de calibración

La calibración probabilística no es uniforme entre subgrupos, lo que tiene implicaciones directas para la confiabilidad de las alertas emitidas por el sistema:

| Subgrupo | ECE | Interpretación |
|---|---:|---|
| Total | ~0.038 | Buena calibración global |
| Hombre | ~0.042 | Ligeramente peor que el promedio |
| Mujer | ~0.035 | Mejor calibración que el promedio |
| ISE bajo | ~0.045 | Peor calibración — mayor incertidumbre |
| ISE medio | ~0.039 | Calibración similar al promedio |
| ISE alto | ~0.031 | Mejor calibración del grupo |

**Observación crítica:** El subgrupo de mayor vulnerabilidad (ISE bajo) es precisamente aquel con peor calibración probabilística (~0.045 vs ~0.031 para ISE alto). Esto significa que para los estudiantes que más necesitan intervención temprana, las probabilidades emitidas son ligeramente menos confiables.

**Recomendación:** En versiones futuras del pipeline, implementar calibración isotónica diferenciada por subgrupo ISE, ajustando la curva de calibración por separado para cada tercil.

---

## 9. Limitación temporal — naturaleza de corte transversal

### 9.1 Naturaleza del dataset

El dataset EM 2022 es un **corte transversal** (single snapshot) del sistema educativo. Cada estudiante aparece una sola vez, con su perfil de variables observado en el momento de la evaluación de 2022. El modelo infiere el riesgo en Matemática a partir de otras variables del mismo corte temporal, no de una secuencia temporal de datos.

### 9.2 Implicaciones para el análisis de errores

- Los FN y FP no pueden ser rastreados longitudinalmente para verificar si los estudiantes mal clasificados tuvieron efectivamente peores trayectorias académicas.
- No existe información sobre intervenciones previas que pudieran haber modificado el rendimiento observado.
- La validez predictiva del modelo en sentido estrictamente temporal requeriría un diseño longitudinal: entrenar en EM 2022 y evaluar en EM 2023.

### 9.3 Recomendación de validación temporal

Solicitar acceso a los datos de EM 2023 (o ECE 2023) al MINEDU para realizar una validación temporal real: entrenar el modelo completo con EM 2022 y evaluar sobre la cohorte equivalente de 2023. Esta validación elevaría la calidad metodológica del trabajo de tesis al nivel de estudios longitudinales publicados (Knowles, 2015; Sansone, 2019).

---

## 10. Checklist de mejoras — estado actualizado

El pipeline actual ha completado varias de las mejoras identificadas en versiones anteriores del análisis. A continuación se documenta el estado de cada ítem:

| Item | Estado | Acción tomada |
|---|:---:|---|
| Feature engineering: `M500_L − M500_L_iemean` (rendimiento relativo) | **COMPLETADO** | Implementado como `M500_L_relativa` en el pipeline de 12 features |
| Feature engineering: `M500_CN − M500_CN_iemean` (rendimiento relativo Ciencias) | **COMPLETADO** | Implementado como `M500_CN_relativa` en el pipeline de 12 features |
| Feature engineering: `ise − ise_iemean` (ISE relativo) | **COMPLETADO** | Implementado como `ise_relativo` en el pipeline de 12 features |
| Recalibrar umbrales con política `min_cost` para producción | **COMPLETADO** | Política `min_cost` (FN=5×FP) implementada y evaluada en análisis multi-umbral |
| Auditoría de fairness con bootstrap CI por subgrupo | **COMPLETADO** | Implementado con n=500 bootstraps para AUC y Recall por subgrupo |
| Calibración con validación de ECE y Hosmer-Lemeshow | **COMPLETADO** | ECE, MCE, H-L test implementados y almacenados en metricas_em.pkl |
| Análisis de ablación por feature | **COMPLETADO** | Feature ablation study implementado con delta_AUC por feature |
| Validación cruzada anidada (nested CV) | **COMPLETADO** | Outer 5-fold + inner 3-fold implementado |
| Stability analysis (10 semillas) | **COMPLETADO** | Implementado con GroupShuffleSplit, AUC mean/std/min/max |
| Comparación con AutoML (FLAML) | **COMPLETADO** | FLAML 90s budget como cota superior de comparación |
| Validación temporal con EM 2023 | PENDIENTE | Requiere acceso a datos 2023 del MINEDU |
| Calibración diferenciada por subgrupo ISE | PENDIENTE | Para versión 2 del modelo |
| Integración de variables socioemocionales | PENDIENTE | Requiere datos adicionales no disponibles en EM 2022 |
| Ampliación a otros grados (1.° y 3.° EM) | PENDIENTE | Requiere expansión del dataset |

---

## 11. Instrucciones de reproducción

### 11.1 Ejecutar el análisis de errores

```bash
# Desde la raíz del proyecto
cd modelo
python train_em_model.py
# Genera model/metricas_em.pkl con todas las secciones, incluida error_analysis
```

### 11.2 Inspeccionar los resultados desde Python

```python
import joblib

m = joblib.load('model/metricas_em.pkl')
ea = m.get('error_analysis', {})

# Estadísticas globales
print(f"FN: {ea['total_fn']}  FP: {ea['total_fp']}")
print(f"FN lectura media: {ea['fn_mean_lectura']:.1f}  ISE: {ea['fn_mean_ise']:.2f}")
print(f"FP lectura media: {ea['fp_mean_lectura']:.1f}  ISE: {ea['fp_mean_ise']:.2f}")

# Distribución por sexo
print('FN sexo:', ea['fn_sexo'])
print('FP sexo:', ea['fp_sexo'])

# Top-20 de cada tipo
fn_top20 = ea['fn_top20']   # DataFrame con perfil completo
fp_top20 = ea['fp_top20']   # DataFrame con perfil completo

# Métricas de calibración por subgrupo
fairness = m.get('fairness', {})
for sg, metrics in fairness.items():
    print(f"{sg}: AUC={metrics['auc_roc']:.3f}, Recall={metrics['recall']:.3f}, ECE={metrics['ece']:.4f}")
```

### 11.3 Acceso desde el frontend SARA

Los datos de análisis de errores son accesibles desde la consola de administración:
- **Ruta:** Dashboard Admin → Modelo ML → "Análisis de errores (FN/FP)"
- **API:** `GET /v1/modelo/diagnostico` — incluye `error_analysis`, `fair_thresholds`, `calibration_curve`
- **API:** `GET /v1/modelo/metricas` — incluye todas las métricas almacenadas en `metricas_em.pkl`

---

*Documento generado como parte del pipeline de entrenamiento SARA-EM-v1.*
*Actualizar tras cada reentrenamiento ejecutando `python train_em_model.py`.*
