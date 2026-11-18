import os
for k in ("OMP_NUM_THREADS","OPENBLAS_NUM_THREADS","MKL_NUM_THREADS","LOKY_MAX_CPU_COUNT"): os.environ[k]="1"
from experiment import *
from imblearn.pipeline import make_pipeline as imb_pipeline
from imblearn.over_sampling import SMOTE
from imblearn.combine import SMOTEENN
from imblearn.ensemble import BalancedRandomForestClassifier
datos=joblib.load(OUT/"datos.joblib"); df,y=datos["df"],datos["y"]
cv=list(StratifiedKFold(5,shuffle=True,random_state=42).split(np.zeros(len(y)),y))
resultados=[]; probs={}; inicio=time.time()

def guardar(nombre,p,extra=None):
    mejor=max((metricas(y,p,t) for t in np.arange(.1,.851,.025)),key=lambda m:(min(m[k] for k in ("precision","recall","f1","accuracy","auc")),m["f1"]))
    mejor.update(modelo=nombre,segundos=round(time.time()-inicio,1),evaluacion="exploratoria OOF; umbral seleccionado con OOF",**(extra or {}))
    resultados.append(mejor); probs[nombre]=p
    print(json.dumps(mejor),flush=True)
    joblib.dump({"y":y,"probabilidades":probs,"resultados":resultados,"cv":cv},OUT/"variantes_finales.joblib")
    pd.DataFrame(resultados).to_csv(OUT/"variantes_finales.csv",index=False)

for grupo,X in datos["sets"].items():
    candidatos=[]
    for proporcion in (.5,1.):
        candidatos.append((f"SMOTE_{proporcion}",imb_pipeline(SimpleImputer(add_indicator=True),SMOTE(sampling_strategy=proporcion,k_neighbors=3,random_state=42),HistGradientBoostingClassifier(max_iter=160,max_leaf_nodes=7,min_samples_leaf=10,l2_regularization=5,learning_rate=.04,random_state=42))))
    candidatos.append(("SMOTEENN",imb_pipeline(SimpleImputer(add_indicator=True),SMOTEENN(random_state=42),HistGradientBoostingClassifier(max_iter=160,max_leaf_nodes=7,min_samples_leaf=10,l2_regularization=5,learning_rate=.04,random_state=42))))
    candidatos.append(("BalancedRF",make_pipeline(SimpleImputer(add_indicator=True),BalancedRandomForestClassifier(n_estimators=200,max_depth=5,min_samples_leaf=2,n_jobs=1,random_state=42))))
    for nombre,m in candidatos:
        try:
            p=cross_val_predict(m,X,y,cv=cv,method="predict_proba",n_jobs=1)[:,1]
            guardar(f"{grupo}/{nombre}",p)
        except Exception as exc: print(json.dumps({"modelo":nombre,"error":str(exc)}),flush=True)

# Transiciones anteriores: solo los alumnos del bloque de entrenamiento.
def variables(prev1,prev2):
    X=tm._features_transicion(df,prev1,prev2,False)
    for relativo,bim in ((1,prev1),(2,prev2)):
        for area,nombres in {"mat":("matematica","mat_prim"),"com":("comunicacion","lenguaje"),"cta":("cta",),"social":("personal_social",),"english":("english",),"arte":("arte",),"ef":("ed_fisica",)}.items():
            s=tm._serie_area(df,bim,*nombres)
            if s is not None: X[f"area_{relativo}_{area}"]=s
    for s in sorted(df.salon.unique()): X[f"salon_{s}"]=(df.salon==s).astype(float)
    return X
X4=variables(3,2); X3=variables(2,1)
cols=sorted(set(X4.columns)|set(X3.columns)); X4=X4.reindex(columns=cols); X3=X3.reindex(columns=cols)
y3=tm._riesgo_bimestre(df,3)
modelos_t=[("HGB",HistGradientBoostingClassifier(max_iter=180,max_leaf_nodes=7,min_samples_leaf=10,l2_regularization=5,learning_rate=.04,random_state=42)),("LGB",LGBMClassifier(n_estimators=180,max_depth=3,num_leaves=8,min_child_samples=10,learning_rate=.04,reg_lambda=5,n_jobs=1,verbosity=-1,random_state=42))]
for peso in (.25,1.,2.):
    for nombre,m in modelos_t:
        p=np.zeros(len(y))
        for tr,te in cv:
            antiguos=tr[y3.iloc[tr].notna().to_numpy()]
            xx=pd.concat([X4.iloc[tr],X3.iloc[antiguos]],ignore_index=True)
            yy=np.r_[y[tr],y3.iloc[antiguos].astype(int).to_numpy()]
            ww=np.r_[np.ones(len(tr)),np.full(len(antiguos),peso)]
            modelo=clone(m).fit(xx,yy,sample_weight=ww)
            p[te]=modelo.predict_proba(X4.iloc[te])[:,1]
        guardar(f"transiciones/{nombre}/peso_{peso}",p)
