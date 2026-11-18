# Informe provisional macro — Joseph And Mery, IE 249

18 de noviembre de 2026. Pronóstico B4 usando B1–B3. Modelo: ensemble experimental de vecinos por asignatura y boosting, evaluado con cinco particiones externas y selección interna. No es el artefacto antiguo activo del repositorio.

**Las cinco métricas de este informe superan 75% bajo el criterio macro.** Macro significa promediar por igual los resultados de las clases «en riesgo» y «sin riesgo». El usuario eligió este tipo de promedio después de conocer la diferencia. No confirmó que una rúbrica académica lo admita. Esta elección no mejora por sí misma las predicciones y no demuestra que se detecte al 75% de los alumnos en riesgo.

| Métrica | Resultado externo |
|---|---:|
| AUC CV | 92.21% |
| Accuracy CV | 86.22% |
| Precisión macro CV | 79.73% |
| Recall macro CV | 81.11% |
| F1 macro CV | 80.38% |

## Resultado específico de los alumnos en riesgo

La precisión de esta clase es **67.50%**, el recall **72.00%** y el F1 **69.68%**. El requisito original del 75% para esa clase sigue sin cumplirse. La matriz agregada es VN=240, FP=26, FN=21, VP=54: se detectaron 54 de los 75 alumnos en riesgo. Se midieron 341 alumnos reales; cuatro registros del artefacto no tenían resultado de B4. No se evaluaron alumnos sintéticos.

La familia de expertos procede de búsquedas previas sobre esta cohorte. La selección de pesos y umbrales de cada alumno se hizo sin su resultado en el entrenamiento externo; se requiere una cohorte futura para confirmar la generalización. Para comparar colegios hay que usar el mismo promedio y protocolo en todos ellos.

## Generación sintética específica del colegio

Se completaron otras 27 configuraciones: sin generación como control, cópula condicional, recombinación de historiales y SMOTEN categórico, con varios tamaños y pesos. Los generadores solo recibieron alumnos del bloque de entrenamiento. Después de generar notas B1–B3 se recalcularon sus variables; los 341 alumnos de evaluación permanecieron reales. Ninguna de estas 27 variantes alcanzó 75% simultáneo en las métricas de la clase en riesgo.

La validación anidada adicional de un ensemble con generación y calibración por grado obtuvo precisión de riesgo 67,57%, recall 66,67% y F1 67,11%. Por eso se conserva como mejor alternativa confirmada el ensemble anterior para el informe macro.

`datos_sinteticos_249_1000.csv` contiene **1.000 registros sintéticos**, claramente marcados con `es_sintetico`, `origen`, `codigo_ie` y `riesgo_b4_sintetico`. No contiene nombres, identificadores reales ni notas B4 de entrada. Se generó al final con la cohorte completa para experimentación/entrenamiento final. Este CSV no formó parte de ninguna evaluación y no debe añadirse al conjunto de prueba. Las validaciones anteriores generaron datos diferentes, exclusivamente dentro de cada entrenamiento.

`resultados.csv` guarda las 27 configuraciones exploratorias; `auditoria_folds.json` registra índices separados de entrenamiento/prueba y cantidades reales/sintéticas; `calibracion_por_grado.json` contiene la validación externa adicional; `metricas_macro.json` separa explícitamente los dos criterios de aceptación.

## Reproducción y estado

Con los datos intermedios preparados por `experiment.py`:

```powershell
.\.venv\Scripts\python.exe modelo/experimentos/joseph_mary/augmentacion.py
.\.venv\Scripts\python.exe modelo/experimentos/joseph_mary/calibracion_por_grado.py
.\.venv\Scripts\python.exe modelo/experimentos/joseph_mary/informe_macro.py
```

También debe existir el resultado de `ensemble_anidado.py`. Las seis pruebas de `backend-ml/tests/test_augmentacion_jym.py` pasaron: separación de B4/nombres, generación reproducible, preservación de datos reales, rechazo de entradas B4 en el generador y distinción explícita de cumplimiento macro frente a la clase en riesgo.

Se entrega una evaluación provisional reproducible y datos de entrenamiento sintéticos. No se sobrescribieron el artefacto activo, la base de datos ni la interfaz con métricas pertenecientes a otro modelo.
