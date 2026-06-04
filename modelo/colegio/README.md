# Modelo Colegio — Joseph And Mery (IE 249)

Predice qué estudiantes tendrán nota C en el 4.° bimestre,
usando solo los 3 primeros bimestres como entrada.
Sistema de alerta TEMPRANA genuino: intervención antes de que sea tarde.

**Dataset:** 95 alumnos, notas internas AD/A/B/C (sistema CUBICOL)
**Variables:** b1, b2, b3 por materia (Matemática, Comunicación, CTA) + tendencia + conducta
**Target:** C en bimestre 4 de Matemática o Comunicación
**Modelo:** Logistic Regression (AUC CV 5-fold = 0.90)

## Diferencias clave vs el modelo EM 2022

| Aspecto | EM 2022 | Este colegio |
|---|---|---|
| Fuente | MINEDU nacional | Notas internas del colegio |
| Escala | ECE 200-800 | AD/A/B/C → 10-18.5 |
| Grados | 2.° secundaria | 5.° sec + 6.° primaria |
| Predicción | Nivel en EM (evaluación pasada) | C en B4 (futuro cercano) |
| Validación | Test en 17 IEs no vistas | CV 5-fold estratificado |

## Archivos

| Archivo | Qué hace |
|---|---|
| `parse_excels.py` | ETL: lee Excel CUBICOL → DataFrame limpio |
| `train_colegio_model.py` | Entrena el modelo predictivo B1-B3 → B4 |

## Correr

```bash
cd modelo/colegio
python train_colegio_model.py --ie 0249 --carpeta ../../
```

## Artefacto generado

```
model/colegio_0249.pkl  — modelo + predicciones + métricas
```
