# Joseph And Mery — evaluación del requisito del 75%

Fecha: 18 de noviembre de 2026. IE 249. Repositorio base: `6a961b5`.

**Resultado: NO CUMPLE.** No se encontró una variante que alcance simultáneamente 75% en AUC, accuracy, precisión, recall y F1 para anticipar B4 con B1–B3. El modelo activo no se sustituyó por un candidato que incumple el requisito.

## Datos y objetivo

Se utilizaron los 345 registros del artefacto incluido en Git. De ellos, 341 tienen resultado conocido de B4 y 75 están en riesgo. Los cuatro sin resultado no permiten medir un acierto o error; no se retiraron casos difíciles para mejorar métricas. El objetivo permanece en nota <=13 en Matemática o Comunicación en B4. Solo se usaron notas B1–B3 y grado/sección como entradas, sin promedios anuales ni conducta promedio que pudieran incluir B4. No se añadieron nombres ni números de lista como predictores. El usuario confirmó que no dispone de asistencia, tardanzas, tareas u otras señales adicionales.

El artefacto de Git fue entrenado el 18 de octubre de 2026. Los cambios del código y las cifras descritas en las fases 31/32 no están incorporados en ese archivo. Las métricas del artefacto no deben confundirse con las de un servicio de producción, que no fue consultado ni modificado.

## Resultados

| Métrica | Artefacto Git, OOF | Mezcla exploratoria | Selección anidada |
|---|---:|---:|---:|
| AUC | 86.98% | 91.87% | 91.70% |
| Accuracy | 80.06% | 87.98% | 85.34% |
| Precisión | 54.22% | 72.37% | 66.67% |
| Recall | 60.00% | 73.33% | 66.67% |
| F1 | 56.96% | 72.85% | 66.67% |

La columna exploratoria corresponde a UNA combinación equilibrada (no a máximos tomados de modelos distintos). Su umbral y combinación se seleccionaron usando las mismas predicciones OOF sobre las que se informa el resultado: no es una validación final. La selección anidada eligió modelo y umbral dentro de cada bloque de entrenamiento, mediante 3 particiones internas y 5 externas. Cada alumno externo quedó fuera de ambas elecciones. Las familias proceden de la exploración sobre esta misma cohorte; se necesita confirmar cualquier resultado en una cohorte futura. No se demuestra que sea matemáticamente imposible alcanzar 75%; se demuestra que estas pruebas no lo lograron.

Se completaron 175 configuraciones y 1.656 mezclas. Se probaron regresión logística, bosques, ExtraTrees, distintos tipos de boosting, SVM, vecinos, CatBoost y TabICL; variables históricas ampliadas, modelos separados de Matemática/Comunicación, datos auxiliares de otros colegios, sobremuestreo aplicado solo al entrenamiento y transiciones anteriores. Los casos sintéticos nunca se usaron como alumnos de evaluación. No se buscaron semillas que dieran una cifra favorable.

En la validación anidada hubo 50 verdaderos positivos, 25 falsos positivos, 25 falsos negativos y 241 verdaderos negativos. Para tener recall >=75% sobre estos 75 casos positivos se necesitan al menos 57 aciertos; con 57 aciertos, precisión >=75% permite como máximo 19 falsos positivos. Mover el umbral cambia ese equilibrio, pero no garantiza ambas condiciones.

## Archivos y reproducción

- `comparacion_candidatos.csv`: todas las configuraciones individuales completas; resultados exploratorios.
- `mezclas.csv`: mezclas exploratorias completas.
- `validacion_anidada.json`: métricas externas, decisiones internas y tamaños por partición.
- `resumen.json`: criterio, resultado y SHA-256 del artefacto de entrada.
- Código en `modelo/experimentos/joseph_mary/`.

Desde la raíz, con el entorno local ya preparado:

```powershell
.\.venv\Scripts\python.exe modelo/experimentos/joseph_mary/experiment.py
.\.venv\Scripts\python.exe modelo/experimentos/joseph_mary/validacion_anidada.py
```

El primer comando prepara los datos anonimizados y compara las familias base. El segundo reproduce la selección anidada. Los resultados intermedios se guardan en `.git/jym`, sin sobrescribir modelos activos. Los demás scripts amplían la búsqueda; CatBoost y TabICL son dependencias experimentales opcionales. TabICL descarga pesos públicos y ejecuta inferencia local; no envía los datos escolares a una API. Se ejecutó con Python 3.14, scikit-learn 1.9.1, pandas 3.1.1, NumPy 2.5.5, CatBoost 1.2.10 y TabICL 2.2.0/Torch 2.15.0+cpu. Los checkpoints y los datos por alumno no se añadieron a los informes.

Las configuraciones exactas de CatBoost están en su CSV. El script final prioriza tres configuraciones con variables ampliadas; las configuraciones base anteriores están registradas en el CSV y no se vuelven a ejecutar por defecto.

## Corrección y comprobaciones

Se corrigió el cierre de `pandas.ExcelFile` al enumerar hojas de notas y conducta. Dos pruebas que antes fallaban con WinError 32 al borrar/reemplazar un Excel pasaron después de corregirlo: 2 passed, 65 deselected. Esta corrección no cambia notas, etiquetas ni métricas. La revisión inicial ejecutó 134 pruebas del frontend y TypeScript sin errores; del backend pasaron 123 y fallaron esas dos, posteriormente corregidas y repetidas satisfactoriamente.

## Validación adicional del ensemble

Se hizo una última evaluación anidada de tres expertos: vecinos separados por asignatura, boosting con transiciones anteriores y boosting con variables ampliadas. Los pesos del combinado y el umbral se eligieron solamente con los alumnos internos de cada partición, manteniendo excluidos los alumnos externos. Los expertos fueron escogidos después de la exploración de esta misma cohorte; sigue pendiente confirmar cualquier mejora con una cohorte futura.

| Métrica | Ensemble, evaluación externa |
|---|---:|
| AUC | 92.21% |
| Accuracy | 86.22% |
| Precisión | 67.50% |
| Recall | 72.00% |
| F1 | 69.68% |

Es el mejor resultado de las dos evaluaciones anidadas realizadas. La matriz fue 54 verdaderos positivos, 26 falsos positivos, 21 falsos negativos y 240 verdaderos negativos. **También incumple el mínimo de 75%**. No se tomó solamente la quinta partición (donde todas las métricas superan el mínimo): se informa el conjunto completo de alumnos evaluables.

El detalle está en `ensemble_anidado.json`. Tras preparar los datos con `experiment.py`, se reproduce con:

```powershell
.\.venv\Scripts\python.exe modelo/experimentos/joseph_mary/ensemble_anidado.py
```

## Conclusión de aceptación

El requisito sigue pendiente. Con las señales disponibles no hay evidencia de un modelo aceptable bajo el mínimo solicitado. Mantener el mismo objetivo requiere mejorar la información de entrada o disponer de más cohortes reales para desarrollar y confirmar otra solución. No se modificaron resultados guardados ni la interfaz para aparentar que el mínimo se había alcanzado.
