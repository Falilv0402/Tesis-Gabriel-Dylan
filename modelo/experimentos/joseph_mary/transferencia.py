import os
for k in ("OMP_NUM_THREADS","OPENBLAS_NUM_THREADS","MKL_NUM_THREADS","LOKY_MAX_CPU_COUNT"): os.environ[k]="1"
from experiment import *

def preparar(ie, cuantizar=False):
    a=joblib.load(ROOT/f"modelo/model/colegio_{ie}.pkl")
    df=pd.DataFrame(a["predicciones"]).sort_values(["salon","n_alumno"]).reset_index(drop=True)
    mat=tm._serie_area(df,4,"matematica","mat_prim")
    com=tm._serie_area(df,4,"comunicacion","lenguaje")
    if mat is None and com is None: return None
    notas=pd.concat([s for s in (mat,com) if s is not None],axis=1)
    y=(notas<=13).any(axis=1).astype(float)
    y[notas.isna().all(axis=1)]=np.nan
    if cuantizar:
        for c in df.columns:
            if c.startswith(("b1_","b2_","b3_")):
                z=pd.to_numeric(df[c],errors="coerce")
                df[c]=pd.Series(np.select([z<=10,z<=13,z<=17,z>17],[10.,13.,16.,18.5],default=np.nan),index=df.index)
    X=tm._features_transicion(df,3,2,False,prev3=1)
    for n in (1,2,3):
        for area,nombres in {"mat":("matematica","mat_prim"),"com":("comunicacion","lenguaje"),"cta":("cta",),"social":("personal_social",),"english":("english",),"arte":("arte",),"ef":("ed_fisica",)}.items():
            s=tm._serie_area(df,n,*nombres)
            if s is not None: X[f"nota_{n}_{area}"]=s
    for escuela in (249,831305,864785,9001): X[f"colegio_{escuela}"]=float(ie==escuela)
    mask=y.notna()
    # Excluir fuentes que no tienen entradas históricas reales para pronosticar B4.
    if X.filter(regex="^nota_[123]_").notna().sum(axis=1).max()<2: return None
    return X.loc[mask].reset_index(drop=True),y[mask].astype(int).to_numpy()

resultados=[]; probs={}; start=time.time()
for cuantizar in (False,True):
    grupos={ie:preparar(ie,cuantizar) for ie in (249,831305,864785,9001)}
    grupos={ie:v for ie,v in grupos.items() if v is not None}
    print(json.dumps({"cuantizado":cuantizar,"fuentes":{str(k):{"n":len(v[1]),"riesgo":int(v[1].sum())} for k,v in grupos.items()}}),flush=True)
    X,y=grupos.pop(249)
    Xs=pd.concat([v[0] for v in grupos.values()],ignore_index=True)
    ys=np.concatenate([v[1] for v in grupos.values()])
    todas=sorted(set(X.columns)|set(Xs.columns)); X=X.reindex(columns=todas); Xs=Xs.reindex(columns=todas)
    cv=list(StratifiedKFold(5,shuffle=True,random_state=42).split(X,y))
    for peso in (.1,.5,1.):
        candidatos=[("HGB",HistGradientBoostingClassifier(max_iter=180,max_leaf_nodes=7,min_samples_leaf=10,l2_regularization=5,learning_rate=.04,random_state=42)),
            ("LGB",LGBMClassifier(n_estimators=180,max_depth=3,num_leaves=8,min_child_samples=10,learning_rate=.04,reg_lambda=5,n_jobs=1,verbosity=-1,random_state=42)),
            ("XGB",XGBClassifier(n_estimators=200,max_depth=3,min_child_weight=5,learning_rate=.04,reg_lambda=5,n_jobs=1,random_state=42))]
        for nombre,modelo in candidatos:
            p=np.zeros(len(y))
            for tr,te in cv:
                xt=pd.concat([X.iloc[tr],Xs],ignore_index=True)
                yt=np.concatenate([y[tr],ys]); wt=np.r_[np.ones(len(tr)),np.full(len(ys),peso)]
                m=clone(modelo).fit(xt,yt,sample_weight=wt)
                p[te]=m.predict_proba(X.iloc[te])[:,1]
            mejor=max((metricas(y,p,t) for t in np.arange(.1,.801,.025)),key=lambda m:(min(m[k] for k in ("precision","recall","f1","accuracy","auc")),m["f1"]))
            etiqueta=f"transferencia/{nombre}/cuantizar_{cuantizar}/peso_{peso}"
            mejor.update(modelo=etiqueta,segundos=round(time.time()-start,1),evaluacion="exploratoria OOF; umbral seleccionado con OOF")
            resultados.append(mejor); probs[etiqueta]=p
            print(json.dumps(mejor),flush=True)
            joblib.dump({"y":y,"probabilidades":probs,"resultados":resultados,"cv":cv},OUT/"transferencia.joblib")
            pd.DataFrame(resultados).to_csv(OUT/"transferencia.csv",index=False)
