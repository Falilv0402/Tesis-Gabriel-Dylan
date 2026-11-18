"""Informe explícito por promedio: conserva resultados de la clase en riesgo."""
from augmentacion import *
from sklearn.metrics import precision_recall_fscore_support

def resumen(metricas_fuente):
    tn,fp=metricas_fuente["matriz"][0]; fn,tp=metricas_fuente["matriz"][1]
    y=np.r_[np.zeros(tn+fp),np.ones(fn+tp)]
    pred=np.r_[np.zeros(tn),np.ones(fp),np.zeros(fn),np.ones(tp)]
    pr,re,f1,_=precision_recall_fscore_support(y,pred,average="macro",zero_division=0)
    macro=dict(auc_cv=metricas_fuente["auc"],accuracy_cv=accuracy_score(y,pred),precision_macro_cv=pr,recall_macro_cv=re,f1_macro_cv=f1)
    return dict(metricas_macro=macro,metricas_clase_en_riesgo=metricas_fuente,cumple_75_macro=all(v>=.75 for v in macro.values()),cumple_75_clase_en_riesgo=all(metricas_fuente[k]>=.75 for k in ("auc","accuracy","precision","recall","f1")),n_evaluados_reales=len(y),n_sinteticos_evaluados=0)

def main():
    destino=ROOT/"docs/experimentos/joseph_mary_20261118/segunda_ronda"
    destino.mkdir(parents=True,exist_ok=True)
    original=json.loads((OUT/"ensemble_anidado.json").read_text(encoding="utf-8"))
    generativo=json.loads((OUT/"augmentacion/calibracion_por_grado.json").read_text(encoding="utf-8"))
    r=dict(colegio="Joseph And Mery",codigo_ie="249",objetivo="B4 a partir de B1-B3",promedio="macro: media aritmética de las dos clases",seleccion="ensemble experimental; mayor resultado macro confirmado entre las dos alternativas comparadas",ensemble=resumen(original["metricas"]),generativo=resumen(generativo["metricas"]),modelo_activo_reemplazado=False,nota="La elección de promedios macro modifica el criterio del informe, no las predicciones ni el rendimiento de la clase en riesgo. No se ha confirmado que la rúbrica académica permita este promedio.")
    if "graficos" in original: r["ensemble"]["graficos"]=original["graficos"]
    (destino/"metricas_macro.json").write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding="utf-8")
    datos=joblib.load(OUT/"datos.joblib")
    s,sy=sinteticos(historicos(datos["df"]),datos["y"],"copula",1000,20261118)
    s["riesgo_b4_sintetico"]=sy; s["es_sintetico"]=True; s["codigo_ie"]="249"; s["origen"]="copula_condicional_20261118_entrenamiento"
    s.to_csv(destino/"datos_sinteticos_249_1000.csv",index=False)
    import shutil
    for nombre in ("resultados.csv","auditoria_folds.json","calibracion_por_grado.json"):
        shutil.copy2(OUT/"augmentacion"/nombre,destino/nombre)
    m=r["ensemble"]["metricas_macro"]; b=r["ensemble"]["metricas_clase_en_riesgo"]
    filas="\n".join(f"| {etiqueta} | {100*m[k]:.2f}% |" for etiqueta,k in (("AUC CV","auc_cv"),("Accuracy CV","accuracy_cv"),("Precisión macro CV","precision_macro_cv"),("Recall macro CV","recall_macro_cv"),("F1 macro CV","f1_macro_cv")))
    texto=f'''# Informe provisional macro — Joseph And Mery, IE 249

18 de noviembre de 2026. Pronóstico B4 usando B1–B3. Modelo: ensemble experimental de vecinos por asignatura y boosting, evaluado con cinco particiones externas y selección interna. No es el artefacto antiguo activo del repositorio.

**Las cinco métricas de este informe superan 75% bajo el criterio macro.** Macro significa promediar por igual los resultados de las clases «en riesgo» y «sin riesgo». El usuario eligió este tipo de promedio después de conocer la diferencia. No confirmó que una rúbrica académica lo admita. Esta elección no mejora por sí misma las predicciones y no demuestra que se detecte al 75% de los alumnos en riesgo.

| Métrica | Resultado externo |
|---|---:|
{filas}

## Resultado específico de los alumnos en riesgo

La precisión de esta clase es **{100*b['precision']:.2f}%**, el recall **{100*b['recall']:.2f}%** y el F1 **{100*b['f1']:.2f}%**. El requisito original del 75% para esa clase sigue sin cumplirse. La matriz agregada es VN=240, FP=26, FN=21, VP=54: se detectaron 54 de los 75 alumnos en riesgo. Se midieron 341 alumnos reales; cuatro registros del artefacto no tenían resultado de B4. No se evaluaron alumnos sintéticos.

La familia de expertos procede de búsquedas previas sobre esta cohorte. La selección de pesos y umbrales de cada alumno se hizo sin su resultado en el entrenamiento externo; se requiere una cohorte futura para confirmar la generalización. Para comparar colegios hay que usar el mismo promedio y protocolo en todos ellos.

## Generación sintética específica del colegio

Se completaron otras 27 configuraciones: sin generación como control, cópula condicional, recombinación de historiales y SMOTEN categórico, con varios tamaños y pesos. Los generadores solo recibieron alumnos del bloque de entrenamiento. Después de generar notas B1–B3 se recalcularon sus variables; los 341 alumnos de evaluación permanecieron reales. Ninguna de estas 27 variantes alcanzó 75% simultáneo en las métricas de la clase en riesgo.

La validación anidada adicional de un ensemble con generación y calibración por grado obtuvo precisión de riesgo 67,57%, recall 66,67% y F1 67,11%. Por eso se conserva como mejor alternativa confirmada el ensemble anterior para el informe macro.

`datos_sinteticos_249_1000.csv` contiene **1.000 registros sintéticos**, claramente marcados con `es_sintetico`, `origen`, `codigo_ie` y `riesgo_b4_sintetico`. No contiene nombres, identificadores reales ni notas B4 de entrada. Se generó al final con la cohorte completa para experimentación/entrenamiento final. Este CSV no formó parte de ninguna evaluación y no debe añadirse al conjunto de prueba. Las validaciones anteriores generaron datos diferentes, exclusivamente dentro de cada entrenamiento.

`resultados.csv` guarda las 27 configuraciones exploratorias; `auditoria_folds.json` registra índices separados de entrenamiento/prueba y cantidades reales/sintéticas; `calibracion_por_grado.json` contiene la validación externa adicional; `metricas_macro.json` separa explícitamente los dos criterios de aceptación.

## Reproducción y estado

Con los datos intermedios preparados por `experiment.py`:

```powershell
.\\.venv\\Scripts\\python.exe modelo/experimentos/joseph_mary/augmentacion.py
.\\.venv\\Scripts\\python.exe modelo/experimentos/joseph_mary/calibracion_por_grado.py
.\\.venv\\Scripts\\python.exe modelo/experimentos/joseph_mary/informe_macro.py
```

También debe existir el resultado de `ensemble_anidado.py`. Las seis pruebas de `backend-ml/tests/test_augmentacion_jym.py` pasaron: separación de B4/nombres, generación reproducible, preservación de datos reales, rechazo de entradas B4 en el generador y distinción explícita de cumplimiento macro frente a la clase en riesgo.

Se entrega una evaluación provisional reproducible y datos de entrenamiento sintéticos. No se sobrescribieron el artefacto activo, la base de datos ni la interfaz con métricas pertenecientes a otro modelo.
'''
    (destino/"README.md").write_text(texto,encoding="utf-8")
    print(json.dumps(dict(informe=str(destino),macro=m,sinteticos=len(s),cumple_macro=r["ensemble"]["cumple_75_macro"]),ensure_ascii=False))

if __name__=="__main__": main()
