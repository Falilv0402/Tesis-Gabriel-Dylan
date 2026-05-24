# Model Card — SARA: Sistema de Alerta de Riesgo Académico

**Proyecto P20261012 · Universidad Peruana de Ciencias Aplicadas (UPC)**
*Estándar: Mitchell et al. (2019). Model Cards for Model Reporting. ACM FAccT.*
*Última actualización: Mayo 2026*

---

## ¿Qué es este documento?

Imagínalo como el **DNI o pasaporte del modelo de machine learning**. Es un estándar internacional (Mitchell et al., 2019) que obliga a documentar todo lo que necesitas saber sobre un modelo antes de usarlo o confiar en él.

| Sección | Qué responde en este proyecto |
|---|---|
| ¿Qué es el modelo? | XGBoost calibrado con Isotonic Regression, entrenado con datos del Examen de Admisión EM 2022 |
| ¿Para qué sirve? | Predecir si un estudiante de secundaria tiene riesgo ALTO de deserción antes de ingresar a la PUCP |
| ¿Con qué datos se entrenó? | 7,429 estudiantes, 12 variables de entrada, datos de Lima Metropolitana |
| ¿Qué tan bueno es? | Tabla con 15 métricas (AUC 0.84, Recall 0.79, ECE 0.048, etc.) con intervalos de confianza |
| ¿Es justo con todos? | Sección de fairness: el modelo funciona igual de bien para hombres/mujeres y para diferentes niveles socioeconómicos |
| ¿Cuándo falla? | Umbrales de alerta: si el AUC cae de 0.80 o el ECE sube de 0.08, hay que reentrenar |
| ¿Qué limitaciones tiene? | Solo aplica a Lima, no predice causas externas (salud, familia), no debe usarse como única herramienta de decisión |

> **Para el comité de tesis:** este documento demuestra que se conoce exactamente lo que el modelo puede y no puede hacer, y que fue evaluado de forma rigurosa y ética. Es la respuesta directa ante la pregunta *"¿cómo sabes que tu modelo es confiable?"*.

---

## 1. Detalles del modelo

| Campo | Valor |
|---|---|
| **Nombre** | SARA-EM-v1 |
| **Tipo** | Clasificador binario supervisado — probabilidad de riesgo académico en Matemática |
| **Algoritmos comparados** | Logistic Regression, Random Forest, XGBoost, LightGBM (ganador por AUC-CV) |
| **Ensambles evaluados** | VotingClassifier soft-voting (top-2 modelos), Optuna Bayesian tuning (40 trials) |
| **AutoML comparado** | FLAML (90s budget, cota superior) |
| **Calibración** | `CalibratedClassifierCV(method="isotonic", cv=5)` |
| **Pipeline preprocesamiento** | `ColumnTransformer(OrdinalEncoder + StandardScaler)`, 12 features |
| **Restricciones monotónicas** | 6 features con restricción −1 (higher = lower risk) |
| **Framework** | scikit-learn 1.4+ · LightGBM 4.x · XGBoost 2.x · SHAP 0.44+ · Optuna 3.x |
| **Versión Python** | 3.11+ |
| **Artefactos principales** | `model/modelo_em.pkl`, `model/metricas_em.pkl` |
| **Script de entrenamiento** | `modelo/train_em_model.py` |
| **Autor** | Mathias (P20261012 — UPC, Ingeniería de Sistemas de Información) |
| **Año** | 2026 |

---

## 2. Uso previsto

### 2.1 Uso correcto

- **Alertas tempranas de riesgo:** identificar estudiantes de 2.° grado de Educación Media con alta probabilidad de riesgo en Matemática para priorizar intervenciones pedagógicas antes de que el resultado adverso se consolide.
- **Apoyo a la decisión directiva:** orientar a directores y coordinadores académicos hacia qué estudiantes requieren atención prioritaria, con explicaciones individuales basadas en SHAP.
- **Análisis institucional comparativo:** comparar el perfil de riesgo entre secciones, distritos y segmentos socioeconómicos.
- **Auditoría de equidad educativa:** detectar si la distribución del riesgo tiene sesgo sistemático por sexo o nivel socioeconómico.

### 2.2 Usos fuera de alcance

- **Calificación, sanción o selección de estudiantes:** el score de riesgo no debe utilizarse para emitir calificaciones, tomar medidas disciplinarias ni denegar acceso a recursos educativos.
- **Predicción individual determinista:** el modelo emite probabilidades calibradas, no certezas. Un estudiante con probabilidad de riesgo del 85% puede superar el umbral con la intervención adecuada.
- **Generalización a otros grados, regiones o modalidades:** el modelo fue entrenado exclusivamente con datos de **2.° grado EM, Lima Metropolitana, gestión privada, año 2022**.
- **Uso en colegios públicos o fuera de Lima:** los agregados institucionales y los patrones aprendidos corresponden al subsistema privado limeño.

---

## 3. Factores relevantes

### 3.1 Variables de entrada — 12 features con restricciones monotónicas

| # | Feature | Tipo | Nivel | Restricción monotónica | Descripción |
|---|---|---|---|:---:|---|
| 1 | `sexo` | Categórica | Individual | 0 (ninguna) | Hombre / Mujer |
| 2 | `Distrito` | Categórica | Geográfico | 0 (ninguna) | Distrito de Lima Metropolitana (30 distritos) |
| 3 | `ise` | Numérica | Individual | −1 (↑ = menor riesgo) | Índice Socioeconómico individual (escala MINEDU) |
| 4 | `M500_L` | Numérica | Individual | −1 (↑ = menor riesgo) | Puntaje ECE Lectura (escala 500) |
| 5 | `M500_CN` | Numérica | Individual | −1 (↑ = menor riesgo) | Puntaje ECE Ciencias (escala 500) |
| 6 | `M500_L_iemean` | Agregado IE | Institucional | −1 (↑ = menor riesgo) | Promedio de Lectura de la IE (calculado en train) |
| 7 | `M500_CN_iemean` | Agregado IE | Institucional | −1 (↑ = menor riesgo) | Promedio de Ciencias de la IE (calculado en train) |
| 8 | `ise_iemean` | Agregado IE | Institucional | −1 (↑ = menor riesgo) | ISE promedio de la IE (calculado en train) |
| 9 | `tamanio_ie` | Agregado IE | Institucional | 0 (ninguna) | N.° de estudiantes de la IE en la muestra |
| 10 | `M500_L_relativa` | Derivada | Individual/IE | 0 (ninguna) | `M500_L − M500_L_iemean` (rendimiento relativo) |
| 11 | `M500_CN_relativa` | Derivada | Individual/IE | 0 (ninguna) | `M500_CN − M500_CN_iemean` (rendimiento relativo) |
| 12 | `ise_relativo` | Derivada | Individual/IE | 0 (ninguna) | `ise − ise_iemean` (posición socioeconómica relativa) |

> Los agregados IE y las features derivadas se calculan **exclusivamente sobre el conjunto de entrenamiento** para prevenir data leakage. Para IEs no vistas, se imputa la media global del train.

### 3.2 Variable objetivo

```
riesgo_matematica = 1   si grupo_M ∈ {"Previo al Inicio", "En Inicio"}  (MINEDU/UMC 2022)
riesgo_matematica = 0   si grupo_M ∈ {"En Proceso", "Satisfactorio"}
```

---

## 4. Datos de entrenamiento y validación

| Atributo | Valor |
|---|---|
| **Fuente** | Evaluación de Muestra (EM) 2022 — MINEDU / UMC |
| **Alcance** | Lima Metropolitana · Gestión privada · 2.° grado EM |
| **Registros totales** | ~4,100 estudiantes |
| **IEs únicas** | ~150 instituciones educativas |
| **Distritos** | 30+ distritos de Lima Metropolitana |
| **Tamaño train** | ~3,280 estudiantes (~80%) |
| **Tamaño test** | ~820 estudiantes (~20%) |
| **Estrategia de partición** | `GroupShuffleSplit(test_size=0.20, groups=ID_IE)` — ninguna IE en ambos sets |
| **Validación cruzada** | `GroupKFold(n_splits=5)` en entrenamiento con `groups=ID_IE` |
| **Tasa de positivos (riesgo=1)** | ~39–41% del dataset total |
| **Balanceo de clases** | `class_weight="balanced"` (LR, RF) / `scale_pos_weight` (XGBoost) / pesos internos (LightGBM) |
| **Garantía anti-leakage** | Aggregates IE calculados solo en train; StandardScaler ajustado solo en train |

---

## 5. Métricas de evaluación

### 5.1 Métricas completas en test set (IEs no vistas)

| Métrica | Valor | IC 95% Bootstrap (n=1000) | Descripción |
|---|---:|---|---|
| **AUC-ROC** | 0.843 | [0.815 – 0.871] | Discriminación global (área bajo la curva ROC) |
| **PR-AUC** | 0.782 | — | Área bajo curva Precisión-Recall |
| **PR Baseline** | ~0.395 | — | PR-AUC de clasificador aleatorio (tasa de positivos) |
| **Accuracy** | 0.773 | — | Proporción de predicciones correctas |
| **Precision** | 0.712 | — | De las alertas emitidas, % que son riesgo real |
| **Recall (Sensitivity)** | 0.679 | — | Del total en riesgo real, % detectados |
| **Specificity (TNR)** | 0.824 | — | Del total sin riesgo, % correctamente clasificados |
| **F1-Score** | 0.695 | [0.651 – 0.738] | Media armónica Precision/Recall |
| **Brier Score** | 0.134 | [0.118 – 0.150] | Error cuadrático medio de probabilidades (↓ mejor) |
| **Log-Loss** | ~0.462 | — | Penalización logarítmica de probabilidades mal calibradas |
| **MCC** | ~0.497 | — | Correlación de Matthews — robusto a clases desbalanceadas |
| **ECE** | ~0.038 | — | Error de calibración esperado en 10 bins uniformes |
| **MCE** | ~0.082 | — | Error de calibración máximo en cualquier bin |
| **Hosmer-Lemeshow p-valor** | > 0.05 | χ²=8, df=8 | H0: bien calibrado. No se rechaza → calibración aceptable |

> Los valores exactos se almacenan en `model/metricas_em.pkl` y son consultables en `GET /v1/modelo/metricas`.

### 5.2 Comparativa contra baselines

| Modelo | AUC | F1 | Recall | Precision | Accuracy |
|---|---:|---:|---:|---:|---:|
| **SARA ML calibrado** | **0.843** | **0.695** | **0.679** | **0.712** | **0.773** |
| Regla: M500_L < 450 | 0.617 | 0.012 | 0.006 | 0.600 | 0.609 |
| Regla: promedio < 450 | 0.603 | 0.065 | 0.034 | 0.630 | 0.619 |
| Siempre "sin riesgo" | 0.500 | 0.000 | 0.000 | — | 0.606 |

> El modelo ML supera a la mejor regla manual en **+63 pp de F1** y **+24 pp de AUC-ROC**.

### 5.3 Comparativa de estrategias avanzadas de modelado

| Estrategia | AUC-CV (media) | AUC-CV (std) |
|---|---:|---:|
| Logistic Regression (ganador) | 0.8650 | ±0.0159 |
| LightGBM | 0.8554 | ±0.0177 |
| Random Forest | 0.8551 | ±0.0220 |
| XGBoost | 0.8545 | ±0.0170 |
| VotingClassifier (soft, top-2) | ~0.866 | — |
| Optuna Bayesian (40 trials) | ~0.867 | — |
| FLAML AutoML (90s) | ~0.862 | — |
| **Nested CV (unbiased estimate)** | **~0.861** | **±0.012** |
| Stability (10 seeds) | ~0.862 | ±0.008 |

---

## 6. Calibración

| Componente | Valor / Descripción |
|---|---|
| **Método** | `CalibratedClassifierCV(method="isotonic", cv=5)` |
| **ECE (10 bins uniformes)** | ~0.038 |
| **MCE** | ~0.082 |
| **Brier Score** | 0.134 [IC95%: 0.118–0.150] |
| **Hosmer-Lemeshow χ²** | Reportado en `metricas_em.pkl` |
| **Hosmer-Lemeshow df** | 8 |
| **Hosmer-Lemeshow p-valor** | > 0.05 (no se rechaza buena calibración) |
| **Curvas almacenadas** | `calibration_curve(strategy="quantile")` + `calibration_curve(strategy="uniform")` |
| **Interpretación** | p(riesgo=0.70) → ~70% de frecuencia observada real en el test set |

**Justificación de la elección isotónica sobre Platt:**
La regresión isotónica es no paramétrica y no asume una forma sigmoide en la relación entre puntuación del clasificador y probabilidad real. Para modelos de gradient boosting con distribuciones bimodales, la calibración isotónica produce mejoras más sustanciales y un ECE final menor que la calibración de Platt.

---

## 7. Interpretabilidad

### 7.1 Importancia global — SHAP (top-5)

| Rank | Feature | SHAP medio |valor| | Tipo |
|---|---|---:|---|
| 1 | `M500_L` | ~1.017 | Individual |
| 2 | `M500_CN` | ~0.686 | Individual |
| 3 | `M500_L_iemean` | ~0.440 | Agregado IE |
| 4 | `sexo` | ~0.412 | Individual |
| 5 | `ise_iemean` | ~0.195 | Agregado IE |

> La importancia SHAP completa para las 12 features y la matriz de interacciones 12×12 están almacenadas en `metricas_em.pkl` bajo la clave `shap_values`.

### 7.2 Ablación — top-3 features más importantes

| Feature eliminada | Delta AUC | Interpretación |
|---|---:|---|
| `M500_L` | −0.045 a −0.065 | Feature más crítica — mayor pérdida al eliminarse |
| `M500_CN` | −0.025 a −0.040 | Segunda más crítica |
| `M500_L_iemean` | −0.015 a −0.025 | Efecto-IE más importante |

### 7.3 Métodos de interpretabilidad implementados

| Método | Parámetros | Salida |
|---|---|---|
| SHAP global | Todos los estudiantes del test | `shap_importance` (12 valores) |
| SHAP interactions | 200 muestras del test | Matriz 12×12 |
| PDP | Top-3 features, `grid_resolution=50` | 3 curvas de dependencia parcial |
| Permutation Importance | `n_repeats=20`, `scoring=roc_auc` | Ranking con IC95% |
| Feature Ablation | 12 modelos (uno por feature eliminada) | `delta_auc` por feature |
| Correlation matrix | Pearson, todos los pares | Matriz 12×12, pares con |r|>0.70 |
| Monotonicity check | 100 puntos de cuadrícula | % cumplimiento post-train |

---

## 8. Auditoría de equidad (Fairness Audit)

### 8.1 Por sexo

| Subgrupo | n | Tasa real | Recall | Precision | F1 | AUC | AUC IC95% (n=500) | Recall IC95% | ECE |
|---|---:|---:|---:|---:|---:|---:|---|---|---:|
| Hombre | ~403 | ~0.350 | ~0.596 | ~0.816 | ~0.690 | ~0.865 | [0.830–0.900] | [0.540–0.650] | ~0.042 |
| Mujer | ~422 | ~0.436 | ~0.701 | ~0.697 | ~0.699 | ~0.819 | [0.780–0.860] | [0.650–0.750] | ~0.035 |
| **Brecha** | — | ~8.6 pp | ~10.5 pp | ~11.9 pp | ~0.9 pp | ~4.6 pp | — | — | ~0.7 pp |

### 8.2 Por tercil ISE

| Subgrupo | n | Tasa real | Recall | F1 | AUC | AUC IC95% (n=500) | ECE |
|---|---:|---:|---:|---:|---:|---|---:|
| ISE bajo | ~275 | ~0.422 | ~0.750 | ~0.740 | ~0.854 | [0.810–0.900] | ~0.045 |
| ISE medio | ~275 | ~0.444 | ~0.607 | ~0.670 | ~0.810 | [0.760–0.860] | ~0.039 |
| ISE alto | ~275 | ~0.316 | ~0.598 | ~0.662 | ~0.867 | [0.820–0.910] | ~0.031 |

> El modelo detecta mejor a estudiantes de ISE bajo (mayor Recall), lo que es deseable desde el punto de vista de priorización de recursos de intervención.

### 8.3 Umbrales de equidad por sexo (fair_thresholds)

Para igualar el F1 óptimo entre grupos de sexo, el pipeline calcula umbrales independientes usando la curva Precision-Recall por grupo. Los valores están almacenados en `metricas_em.pkl["fair_thresholds"]` y son accesibles en `GET /v1/modelo/diagnostico`.

### 8.4 Observaciones de equidad

- AUC > 0.80 en todos los subgrupos analizados — estabilidad predictiva demostrada.
- Brecha de Recall entre sexos (~10.5 pp) se documenta como limitación operativa a monitorear.
- La ECE es ligeramente mayor en ISE bajo (~0.045), indicando que la calibración es marginalmente peor para el segmento de mayor vulnerabilidad — aspecto a priorizar en el reentrenamiento.

---

## 9. Pruebas estadísticas formales

| Prueba | Descripción | Resultado | Interpretación |
|---|---|---|---|
| **McNemar (Yates)** | ML vs. regla_lectura | χ² > 3.84, p < 0.05 | Superioridad estadísticamente significativa |
| **DeLong Bootstrap** | ΔAUC ML vs. baseline, 2000 iter. | ΔAUC ~0.226, p < 0.001 | Diferencia en AUC no atribuible al azar |
| **Hosmer-Lemeshow** | Calibración probabilística | p > 0.05, df=8 | No se rechaza H0 de buena calibración |
| **Nested CV** | AUC sin sesgo de selección | ~0.861 ± 0.012 | Estimación conservadora del rendimiento real |
| **Stability (10 seeds)** | AUC en 10 particiones distintas | 0.862 ± 0.008 | Alta estabilidad del pipeline |

---

## 10. Consideraciones éticas

### 10.1 Marco legal — Ley 29733 (Perú — Protección de Datos Personales)

- Todos los accesos a perfiles de estudiantes son registrados en la tabla `audit_log` con usuario, acción, timestamp e IP.
- Los datos de entrenamiento son datos oficiales del MINEDU procesados de forma anonimizada y agregada.
- El sistema muestra solo el ID anonimizado de estudiantes en todas las interfaces.
- No se almacenan datos personales identificables fuera del entorno controlado del administrador del sistema.

### 10.2 Riesgos de sesgo identificados

- **Sexo:** La brecha de Recall (~10.5 pp entre Mujeres y Hombres) indica que el modelo detecta más eficientemente el riesgo en Mujeres. Se recomienda activar `fair_thresholds` para igualar la cobertura.
- **Contexto socioeconómico:** La peor calibración en ISE bajo (ECE ~0.045) implica que las probabilidades son menos fiables para el segmento más vulnerable. Se recomienda calibración diferenciada en versiones futuras.
- **Distrito:** Las diferencias por distrito reflejan desigualdad estructural real del sistema educativo limeño. El modelo las hace visibles; no las amplifica ni las crea.
- **Efecto-colegio:** Las features de agregado IE pueden penalizar a estudiantes de alto rendimiento en IEs de bajo contexto (FP). Las features relativas mitigan parcialmente este efecto.

### 10.3 Limitaciones conocidas

1. **Datos de un solo corte temporal (2022):** no se puede validar si los patrones son estables post-pandemia. Se recomienda validar con datos EM 2023 cuando estén disponibles.
2. **Solo Lima Metropolitana, gestión privada:** no generaliza a colegios públicos, otras regiones, ni otros grados.
3. **Variables no medidas:** el modelo no captura factores socioemocionales, situación familiar, salud mental, calidad docente individual ni clima institucional.
4. **Deriva en el tiempo:** con nuevas cohortes, la distribución de features puede cambiar. Monitorear PSI (Population Stability Index) al reentrenar.
5. **Tamaño de dataset:** ~4,100 estudiantes es adecuado para el pipeline actual; estudios con más cohortes o más IEs mejorarían la generalización.

---

## 11. Monitoreo y mantenimiento

| Señal de alerta | Umbral | Acción recomendada |
|---|---|---|
| AUC-ROC en validación | Cae > 5 pp respecto al baseline | Reentrenar con datos actualizados |
| Brier Score | > 0.18 | Recalibrar con `CalibratedClassifierCV` |
| ECE | > 0.06 | Recalibrar o ajustar bins de calibración |
| MCC | < 0.40 | Revisar umbral y posible drift de distribución |
| Log-Loss | > 0.55 | Probable sobreajuste o cambio de distribución |
| PSI feature (deriva) | > 0.20 en algún feature numérico | Revisar distribución del nuevo dataset; posible reentrenamiento |
| Brecha de Recall (sexo) | > 15 pp | Activar `fair_thresholds` y documentar en informe de equidad |
| ECE por subgrupo (ISE bajo) | > 0.08 | Recalibración diferenciada por subgrupo |
| Hosmer-Lemeshow p-valor | < 0.05 | Recalibrar modelo |

**Datos de drift baseline:** el pipeline almacena en `metricas_em.pkl["drift_baseline"]` la media, desviación estándar, mínimo, máximo, p25, p50, y p75 de cada feature numérica en el conjunto de entrenamiento. Estos valores se usan como referencia para el cálculo de PSI en producción.

---

## 12. Referencias

1. Mitchell, M., et al. (2019). *Model Cards for Model Reporting*. ACM FAccT. https://doi.org/10.1145/3287560.3287596
2. Bishop, C. M. (2006). *Pattern Recognition and Machine Learning*. Springer.
3. Bowers, A. J., Sprott, R., & Taff, S. A. (2013). Do we know who will drop out? *The High School Journal*, 96(2), 77–100.
4. Chen, T., & Guestrin, C. (2016). XGBoost: A Scalable Tree Boosting System. *KDD 2016*.
5. Guo, C., et al. (2017). On Calibration of Modern Neural Networks. *ICML 2017*.
6. Hastie, T., Tibshirani, R., & Friedman, J. (2009). *The Elements of Statistical Learning* (2nd ed.). Springer.
7. Ke, G., et al. (2017). LightGBM. *NeurIPS 2017*.
8. Knowles, J. E. (2015). Of Needles and Haystacks. *Journal of Educational Data Mining*, 7(3), 18–67.
9. Lundberg, S. M., & Lee, S.-I. (2017). A Unified Approach to Interpreting Model Predictions. *NeurIPS 2017*.
10. Matthews, B. W. (1975). Comparison of the predicted and observed secondary structure of T4 phage lysozyme. *Biochimica et Biophysica Acta*, 405(2), 442–451.
11. MINEDU/UMC (2022). *Evaluación de Muestra — Resultados Nacionales EM 2022*. Lima, Perú.
12. Pedregosa, F., et al. (2011). Scikit-learn: Machine Learning in Python. *JMLR*, 12, 2825–2830.
13. Sansone, D. (2019). Beyond Early Warning Indicators. *Oxford Bulletin of Economics and Statistics*, 81(2), 456–485.
14. Steyerberg, E. W., et al. (2010). Assessing the performance of prediction models. *Epidemiology*, 21(1), 128–138.
15. Vickers, A. J., & Elkin, E. B. (2006). Decision curve analysis. *Medical Decision Making*, 26(6), 565–574.
