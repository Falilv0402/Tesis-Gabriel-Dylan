import os
for k in ("OMP_NUM_THREADS","OPENBLAS_NUM_THREADS","MKL_NUM_THREADS","LOKY_MAX_CPU_COUNT"): os.environ[k]="1"
from experiment import *
from catboost import CatBoostClassifier
datos=joblib.load(OUT/"datos.joblib")
df,y=datos["df"],datos["y"]
sets={k:v.copy() for k,v in datos["sets"].items()}
for X in sets.values():
    for n in (1,2,3):
        X[f"english_{n}"]=df[f"b{n}_english"]
    X["salon_cat"]=df.salon.astype(str)
    X["grado_cat"]=df.salon.str.extract(r"(\d+)",expand=False).fillna("sin grado")
    for c in X.columns:
        if c not in ("salon_cat","grado_cat"): X[c]=X[c].fillna(-99)
cv=list(StratifiedKFold(5,shuffle=True,random_state=42).split(np.zeros(len(y)),y))
sets={"completo":sets["completo"]}
configuraciones=[dict(depth=3,l2_leaf_reg=5,iterations=200,learning_rate=.06),
    dict(depth=3,l2_leaf_reg=10,iterations=200,learning_rate=.06,auto_class_weights="Balanced"),
    dict(depth=4,l2_leaf_reg=10,iterations=200,learning_rate=.06,auto_class_weights="Balanced")]
previo=joblib.load(OUT/"catboost.joblib") if (OUT/"catboost.joblib").exists() else {}
resultados=previo.get("resultados",[]); probs=previo.get("probabilidades",{}); start=time.time()
for grupo,X in sets.items():
    for i,config in enumerate(configuraciones):
        p=np.zeros(len(y))
        for tr,te in cv:
            m=CatBoostClassifier(**config,loss_function="Logloss",random_seed=42,verbose=False,
                thread_count=1,allow_writing_files=False,cat_features=["salon_cat","grado_cat"])
            m.fit(X.iloc[tr],y[tr])
            p[te]=m.predict_proba(X.iloc[te])[:,1]
        mejor=max((metricas(y,p,t) for t in np.arange(.1,.801,.025)),key=lambda m:(min(m[k] for k in ("precision","recall","f1","accuracy","auc")),m["f1"]))
        nombre=f"catboost_rapido/{grupo}/{i}"
        mejor.update(modelo=nombre,config=config,segundos=round(time.time()-start,1),evaluacion="exploratoria OOF; umbral seleccionado con OOF")
        resultados.append(mejor); probs[nombre]=p
        print(json.dumps(mejor),flush=True)
        joblib.dump({"y":y,"probabilidades":probs,"resultados":resultados,"cv":cv},OUT/"catboost.joblib")
        pd.DataFrame(resultados).to_csv(OUT/"catboost.csv",index=False)
