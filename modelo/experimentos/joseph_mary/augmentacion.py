"""Generación sintética exclusiva de entrenamiento, evaluada con alumnos reales."""
from experiment import *
from scipy.stats import norm, rankdata
from sklearn.covariance import LedoitWolf
from imblearn.over_sampling import SMOTEN

AREAS={"mat":("matematica","mat_prim"),"com":("comunicacion","lenguaje"),"cta":("cta",),"social":("personal_social",),"english":("english",),"arte":("arte",),"ef":("ed_fisica",)}
def historicos(df):
    r=pd.DataFrame(index=df.index)
    for b in (1,2,3):
        for area,nombres in AREAS.items():
            s=tm._serie_area(df,b,*nombres)
            if s is not None: r[f"b{b}_{area}"]=s
    r["salon"]=df.salon.astype(str)
    return r.reset_index(drop=True)

def features(r):
    X=r.drop(columns="salon").copy()
    for b in (1,2,3):
        cols=[c for c in X if c.startswith(f"b{b}_")]
        v=r[cols]
        X[f"media_{b}"]=v.mean(axis=1); X[f"minimo_{b}"]=v.min(axis=1)
        X[f"bajas_{b}"]=(v<=13).sum(axis=1)
        mc=[f"b{b}_{a}" for a in ("mat","com") if f"b{b}_{a}" in r]
        X[f"min_mc_{b}"]=r[mc].min(axis=1)
        X[f"riesgo_{b}"]=(r[mc]<=13).any(axis=1).astype(float)
    for area in AREAS:
        cols=[f"b{b}_{area}" for b in (1,2,3)]
        if all(c in r for c in cols):
            X[f"media_{area}"]=r[cols].mean(axis=1)
            X[f"delta_{area}"]=r[cols[-1]]-r[cols[-2]]
            X[f"delta_total_{area}"]=r[cols[-1]]-r[cols[0]]
    X["grado"]=pd.to_numeric(r.salon.str.extract(r"(\d+)",expand=False),errors="coerce")
    X["primaria"]=r.salon.str.startswith("P").astype(float)
    for salon in ("1A","1B","2A","2B","3A","3B","4A","4B","5A","5B","P6A","P6B"):
        X[f"salon_{salon}"]=(r.salon==salon).astype(float)
    return X.astype(float)

def sinteticos(raw_train,y_train,metodo,n,seed=42):
    """Solo acepta el bloque de entrenamiento; no recibe alumnos de evaluación."""
    if any(c.startswith("b4_") for c in raw_train): raise ValueError("B4 no puede entrar en el generador")
    rng=np.random.default_rng(seed); raw_train=raw_train.reset_index(drop=True); y_train=np.asarray(y_train)
    numericas=[c for c in raw_train if c!="salon"]
    if metodo=="smoten":
        clases,cuentas=np.unique(y_train,return_counts=True)
        if len(clases)<2 or cuentas.min()==cuentas.max():
            return raw_train.iloc[:0].copy(),np.empty(0,dtype=y_train.dtype)
        z=raw_train.copy()
        for c in numericas: z[c]=z[c].fillna(-99).astype(str)
        sampler=SMOTEN(sampling_strategy=1.,k_neighbors=3,random_state=seed)
        xx,yy=sampler.fit_resample(z,y_train)
        s=xx.iloc[len(raw_train):].copy(); yy=np.asarray(yy)[len(raw_train):]
        for c in numericas: s[c]=pd.to_numeric(s[c]).replace(-99,np.nan)
        return s.reset_index(drop=True),yy
    anchors=rng.choice(len(raw_train),size=n,replace=True)
    s=raw_train.iloc[anchors].reset_index(drop=True).copy(); yy=y_train[anchors]
    for label in (0,1):
        for salon in sorted(raw_train.salon.unique()):
            dest=np.where((yy==label)&(s.salon==salon).to_numpy())[0]
            if not len(dest): continue
            src=np.where((y_train==label)&(raw_train.salon==salon).to_numpy())[0]
            if len(src)<4:
                grado=''.join(c for c in salon if c.isdigit())
                src=np.where((y_train==label)&raw_train.salon.str.contains(grado,regex=False).to_numpy())[0]
            if len(src)<4: src=np.where(y_train==label)[0]
            grupo=raw_train.iloc[src][numericas]
            if metodo=="copula":
                z=np.column_stack([norm.ppf((rankdata(grupo[c].fillna(grupo[c].median()).fillna(16))-.5)/len(grupo)) for c in numericas])
                cov=LedoitWolf().fit(z)
                draws=rng.multivariate_normal(cov.location_,cov.covariance_,size=len(dest))
                for j,c in enumerate(numericas):
                    vals=grupo[c].dropna().to_numpy()
                    if len(vals): s.loc[dest,c]=np.quantile(vals,norm.cdf(draws[:,j]),method="nearest")
            else:
                vecinos=rng.choice(src,size=len(dest),replace=True)
                v=raw_train.iloc[vecinos].reset_index(drop=True)
                cambios=rng.random((len(dest),len(numericas)))<.15
                for j,c in enumerate(numericas):
                    inds=dest[cambios[:,j]]; s.loc[inds,c]=v.loc[cambios[:,j],c].to_numpy()
    return s,yy

def modelo(nombre):
    if nombre=="HGB": return HistGradientBoostingClassifier(max_iter=180,max_leaf_nodes=7,min_samples_leaf=10,l2_regularization=5,learning_rate=.04,random_state=42)
    if nombre=="ET": return make_pipeline(SimpleImputer(add_indicator=True),ExtraTreesClassifier(n_estimators=200,min_samples_leaf=3,n_jobs=1,random_state=42))
    return make_pipeline(SimpleImputer(add_indicator=True),StandardScaler(),LogisticRegression(C=.3,max_iter=3000,random_state=42))

def ajustar(m,X,y,w):
    if hasattr(m,"steps"): return m.fit(X,y,**{m.steps[-1][0]+"__sample_weight":w})
    return m.fit(X,y,sample_weight=w)

def main():
    datos=joblib.load(OUT/"datos.joblib"); raw=historicos(datos["df"]); y=datos["y"]
    cv=list(StratifiedKFold(5,shuffle=True,random_state=42).split(raw,y))
    configs=[("ninguno",0,0.)]+[(met,n,w) for met in ("copula","recombinacion") for n,w in ((500,.25),(1500,.25),(1000,1.))]+[("smoten",0,.25),("smoten",0,1.)]
    resultados=[]; ps={}; inicio=time.time(); carpeta=OUT/"augmentacion"; carpeta.mkdir(exist_ok=True)
    for met,n,w in configs:
        for familia in ("HGB","ET","LR"):
            p=np.zeros(len(y)); audit=[]
            for fold,(tr,te) in enumerate(cv):
                rt=raw.iloc[tr].reset_index(drop=True); yt=y[tr]; weights=np.ones(len(tr)); ns=0
                if met!="ninguno":
                    syn,sy=sinteticos(rt,yt,met,n,42+fold); ns=len(sy)
                    if fold==0 and familia=="HGB":
                        export=syn.copy(); export["riesgo_b4_sintetico"]=sy; export["es_sintetico"]=True; export["codigo_ie"]="249"
                        export.to_csv(carpeta/f"muestra_{met}_{n}_{w}.csv",index=False)
                    rt=pd.concat([rt,syn],ignore_index=True); yt=np.r_[yt,sy]; weights=np.r_[weights,np.full(ns,w)]
                m=ajustar(modelo(familia),features(rt),yt,weights)
                p[te]=m.predict_proba(features(raw.iloc[te].reset_index(drop=True)))[:,1]
                audit.append(dict(fold=fold+1,n_reales_entrenamiento=len(tr),n_sinteticos=ns,n_evaluados_reales=len(te),train_indices=tr.tolist(),test_indices=te.tolist()))
            mejor=max((metricas(y,p,t) for t in np.arange(.1,.851,.025)),key=lambda z:(min(z[k] for k in ("auc","accuracy","precision","recall","f1")),z["f1"]))
            nombre=f"{met}/{n}/{w}/{familia}"; mejor.update(modelo=nombre,segundos=time.time()-inicio,evaluacion="exploratoria OOF; 341 alumnos reales; sintéticos solo en train")
            resultados.append(mejor); ps[nombre]=p
            print(json.dumps(mejor),flush=True)
            joblib.dump(dict(y=y,probabilidades=ps,resultados=resultados,cv=cv),carpeta/"resultados.joblib")
            pd.DataFrame(resultados).to_csv(carpeta/"resultados.csv",index=False)
            (carpeta/"auditoria_folds.json").write_text(json.dumps(audit),encoding="utf-8")

if __name__=="__main__": main()
