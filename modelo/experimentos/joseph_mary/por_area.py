import os
for k in ("OMP_NUM_THREADS","OPENBLAS_NUM_THREADS","MKL_NUM_THREADS","LOKY_MAX_CPU_COUNT"): os.environ[k]="1"
from experiment import *

datos=joblib.load(OUT/"datos.joblib")
df,y=datos["df"],datos["y"]
X=datos["sets"]["completo"].copy()
for n in (1,2,3):
    if f"b{n}_english" in df:
        X[f"nota_{n}_english"]=df[f"b{n}_english"]
for s in sorted(df.salon.unique()): X[f"salon_{s}"]=(df.salon==s).astype(float)
objetivos={a:(tm._serie_area(df,4,*n)<=13).astype(int).to_numpy() for a,n in (("mat",("matematica","mat_prim")),("com",("comunicacion","lenguaje")))}
cv=list(StratifiedKFold(5,shuffle=True,random_state=42).split(X,y))
elegidos=[(n,m) for n,m in modelos() if n in ("LR_C0.1_None","LR_C1_None","LR_C3_None","RF_4_None","RF_None_None","ET_2","ET_5","HGB_10_1.0","HGB_20_10.0","GB_2","XGB_2_1","XGB_3_1","LGB_2_1","LGB_3_1","SVC_1","KNN_15")]
resultados=[]; probs={}; start=time.time()
for nombre,modelo in elegidos:
    ps=[]
    for area,target in objetivos.items():
        ps.append(cross_val_predict(modelo,X,target,cv=cv,method="predict_proba",n_jobs=1)[:,1])
    for modo,p in (("union",1-(1-ps[0])*(1-ps[1])),("max",np.maximum(*ps))):
        opciones=[metricas(y,p,t) for t in np.arange(.1,.851,.025)]
        mejor=max(opciones,key=lambda m:(min(m[k] for k in ("precision","recall","f1","accuracy","auc")),m["f1"]))
        nombre_final=f"por_area/{nombre}/{modo}"
        mejor.update(modelo=nombre_final,segundos=round(time.time()-start,1),evaluacion="exploratoria OOF; umbral seleccionado con OOF")
        resultados.append(mejor); probs[nombre_final]=p
        print(json.dumps(mejor,ensure_ascii=False),flush=True)
        joblib.dump({"y":y,"probabilidades":probs,"resultados":resultados,"cv":cv},OUT/"por_area.joblib")
        pd.DataFrame(resultados).to_csv(OUT/"por_area.csv",index=False)
