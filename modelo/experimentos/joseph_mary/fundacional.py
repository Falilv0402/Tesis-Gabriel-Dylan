import os
for k in ("OMP_NUM_THREADS","OPENBLAS_NUM_THREADS","MKL_NUM_THREADS","LOKY_MAX_CPU_COUNT"): os.environ[k]="2"
os.environ["HF_HUB_DISABLE_TELEMETRY"]="1"
from experiment import *
import torch
from tabicl import TabICLClassifier
torch.set_num_threads(2)
datos=joblib.load(OUT/"datos.joblib"); df,y=datos["df"],datos["y"]
sets={"compacto":datos["sets"]["base"].copy(),"completo":datos["sets"]["completo"].copy()}
for X in sets.values():
    for n in (1,2,3): X[f"english_{n}"]=df[f"b{n}_english"]
    for a in ("cta","personal_social","arte","ed_fisica"):
        if f"b3_{a}" in df: X[f"area_actual_{a}"]=df[f"b3_{a}"]
    X["salon_cat"]=df.salon.astype(str)
cv=list(StratifiedKFold(5,shuffle=True,random_state=42).split(np.zeros(len(y)),y))
resultados=[]; probs={}; inicio=time.time()
for version in ("tabicl-classifier-v2-20260212.ckpt",):
    for grupo,X in sets.items():
        p=np.zeros(len(y)); nombre=f"TabICL/{version}/{grupo}"
        for i,(tr,te) in enumerate(cv):
            print(json.dumps({"iniciando":nombre,"fold":i+1,"n_features":len(X.columns)}),flush=True)
            modelo=TabICLClassifier(n_estimators=4,batch_size=4,device="cpu",n_jobs=2,random_state=42,
                checkpoint_version=version,model_path=OUT/"checkpoints"/version,verbose=False)
            modelo.fit(X.iloc[tr],y[tr]); p[te]=modelo.predict_proba(X.iloc[te])[:,1]
            print(json.dumps({"terminado":nombre,"fold":i+1,"segundos":round(time.time()-inicio,1)}),flush=True)
        mejor=max((metricas(y,p,t) for t in np.arange(.1,.851,.025)),key=lambda m:(min(m[k] for k in ("precision","recall","f1","accuracy","auc")),m["f1"]))
        mejor.update(modelo=nombre,segundos=round(time.time()-inicio,1),evaluacion="exploratoria OOF; umbral seleccionado con OOF",metricas_corte_05=metricas(y,p,.5))
        resultados.append(mejor); probs[nombre]=p
        print(json.dumps(mejor),flush=True)
        joblib.dump({"y":y,"probabilidades":probs,"resultados":resultados,"cv":cv},OUT/"fundacional.joblib")
        pd.DataFrame(resultados).to_csv(OUT/"fundacional.csv",index=False)
