import os
for k in ("OMP_NUM_THREADS","OPENBLAS_NUM_THREADS","MKL_NUM_THREADS","LOKY_MAX_CPU_COUNT"): os.environ[k]="1"
from experiment import *
datos=joblib.load(OUT/"datos.joblib"); X=datos["sets"]["completo"]; y=datos["y"]
candidatos=[(f"HGB_hoja_{hoja}",HistGradientBoostingClassifier(max_iter=150,max_leaf_nodes=7,min_samples_leaf=hoja,l2_regularization=1.,learning_rate=.04,random_state=42)) for hoja in (5,10,20)]
candidatos.append(("GradientBoosting_3",make_pipeline(SimpleImputer(add_indicator=True),GradientBoostingClassifier(n_estimators=150,max_depth=3,min_samples_leaf=5,learning_rate=.04,random_state=42))))
outer=list(StratifiedKFold(5,shuffle=True,random_state=42).split(X,y))
p=np.zeros(len(y)); pred=np.zeros(len(y),dtype=int); folds=[]; inicio=time.time()
for fold,(tr,te) in enumerate(outer):
    inner=list(StratifiedKFold(3,shuffle=True,random_state=100+fold).split(X.iloc[tr],y[tr]))
    mejor=None
    for nombre,m in candidatos:
        pi=cross_val_predict(m,X.iloc[tr],y[tr],cv=inner,method="predict_proba",n_jobs=1)[:,1]
        for t in np.arange(.15,.801,.025):
            met=metricas(y[tr],pi,t); score=min(met[k] for k in ("auc","accuracy","precision","recall","f1"))
            if mejor is None or (score,met["f1"])>(mejor["score"],mejor["interior"]["f1"]):
                mejor=dict(score=score,interior=met,nombre=nombre,modelo=m,corte=float(t))
    m=clone(mejor["modelo"]).fit(X.iloc[tr],y[tr]); p[te]=m.predict_proba(X.iloc[te])[:,1]; pred[te]=(p[te]>=mejor["corte"]).astype(int)
    info=dict(fold=fold+1,n_train=len(tr),n_test=len(te),modelo=mejor["nombre"],corte=mejor["corte"],metricas_internas=mejor["interior"],metricas_externas=metricas(y[te],p[te],mejor["corte"]),segundos=round(time.time()-inicio,1))
    folds.append(info); print(json.dumps(info),flush=True)
metricas_finales=dict(auc=float(roc_auc_score(y,p)),accuracy=float(accuracy_score(y,pred)),precision=float(precision_score(y,pred)),recall=float(recall_score(y,pred)),f1=float(f1_score(y,pred)),matriz=confusion_matrix(y,pred).tolist())
resultado=dict(criterio="Cinco métricas >= 0.75 en predicciones externas de validación anidada",n_alumnos=len(y),n_riesgo=int(y.sum()),entrada="B1-B3",objetivo="Matemática o Comunicación <=13 en B4",metricas=metricas_finales,cumple=all(v>=.75 for k,v in metricas_finales.items() if k!="matriz"),folds=folds,nota="Ningún alumno externo participa en la selección de modelo ni umbral de su fold. La familia de candidatos procede de una búsqueda exploratoria en esta misma cohorte; confirmar en una cohorte futura.")
(OUT/"validacion_anidada.json").write_text(json.dumps(resultado,ensure_ascii=False,indent=2),encoding="utf-8")
joblib.dump({"y":y,"p":p,"pred":pred,"resultado":resultado},OUT/"validacion_anidada.joblib")
print("RESULTADO",json.dumps(resultado,ensure_ascii=False),flush=True)
