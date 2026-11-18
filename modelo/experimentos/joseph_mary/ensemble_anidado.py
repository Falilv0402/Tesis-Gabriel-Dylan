from experiment import *
from sklearn.metrics import roc_curve
datos=joblib.load(OUT/"datos.joblib"); df,y=datos["df"],datos["y"]; N=len(y)
X=datos["sets"]["completo"].copy()
for n in (1,2,3): X[f"nota_{n}_english"]=df[f"b{n}_english"]
for s in sorted(df.salon.unique()): X[f"salon_{s}"]=(df.salon==s).astype(float)
ys=[(tm._serie_area(df,4,*n)<=13).astype(int).to_numpy() for n in (("matematica","mat_prim"),("comunicacion","lenguaje"))]
def variables(p1,p2):
    v=tm._features_transicion(df,p1,p2,False)
    for i,b in ((1,p1),(2,p2)):
        for area,nombres in {"mat":("matematica","mat_prim"),"com":("comunicacion","lenguaje"),"cta":("cta",),"social":("personal_social",),"english":("english",),"arte":("arte",),"ef":("ed_fisica",)}.items():
            s=tm._serie_area(df,b,*nombres)
            if s is not None: v[f"area_{i}_{area}"]=s
    for s in sorted(df.salon.unique()): v[f"salon_{s}"]=(df.salon==s).astype(float)
    return v
T4,T3=variables(3,2),variables(2,1)
cols=sorted(set(T4)|set(T3)); T4=T4.reindex(columns=cols); T3=T3.reindex(columns=cols); y3=tm._riesgo_bimestre(df,3)
def predecir(tr,te):
    ps=[]
    for yy in ys:
        m=make_pipeline(SimpleImputer(add_indicator=True),StandardScaler(),KNeighborsClassifier(n_neighbors=15,weights="distance",n_jobs=1))
        m.fit(X.iloc[tr],yy[tr]); ps.append(m.predict_proba(X.iloc[te])[:,1])
    knn=1-(1-ps[0])*(1-ps[1])
    ant=tr[y3.iloc[tr].notna().to_numpy()]
    m=HistGradientBoostingClassifier(max_iter=180,max_leaf_nodes=7,min_samples_leaf=10,l2_regularization=5,learning_rate=.04,random_state=42)
    m.fit(pd.concat([T4.iloc[tr],T3.iloc[ant]],ignore_index=True),np.r_[y[tr],y3.iloc[ant].astype(int)],sample_weight=np.r_[np.ones(len(tr)),np.full(len(ant),.25)])
    temporal=m.predict_proba(T4.iloc[te])[:,1]
    m=HistGradientBoostingClassifier(max_iter=150,max_leaf_nodes=7,min_samples_leaf=5,l2_regularization=1.,learning_rate=.04,random_state=42)
    m.fit(datos["sets"]["completo"].iloc[tr],y[tr]); hgb=m.predict_proba(datos["sets"]["completo"].iloc[te])[:,1]
    return np.array([knn,temporal,hgb]).T
def score(yy,p):
    order=np.argsort(-p,kind="stable"); pp=p[order]; k=np.arange(1,len(yy)+1); tp=np.cumsum(yy[order]); pos=yy.sum(); neg=len(yy)-pos
    pr=tp/k; rec=tp/pos; f1=2*tp/(k+pos); acc=(tp+neg-k+tp)/len(yy)
    s=np.minimum.reduce([pr,rec,f1,acc,np.full(len(yy),roc_auc_score(yy,p))]); s[~np.r_[pp[:-1]!=pp[1:],True]]=-1
    i=np.argmax(s); return float(s[i]),float(f1[i]),float(pp[i])
pesos=[np.eye(3)[i] for i in range(3)]
for a,b in ((0,1),(0,2),(1,2)):
    for w in (.25,.5,.75):
        z=np.zeros(3); z[a]=w; z[b]=1-w; pesos.append(z)
pesos.append(np.full(3,1/3))
p=np.zeros(N); pred=np.zeros(N,dtype=int); folds=[]; inicio=time.time()
for fold,(tr,te) in enumerate(StratifiedKFold(5,shuffle=True,random_state=42).split(X,y)):
    pin=np.zeros((len(tr),3))
    for itr,ite in StratifiedKFold(3,shuffle=True,random_state=100+fold).split(X.iloc[tr],y[tr]): pin[ite]=predecir(tr[itr],tr[ite])
    mejores=[(*score(y[tr],pin@w),w) for w in pesos]; mejor=max(mejores,key=lambda z:(z[0],z[1])); corte=mejor[2]; w=mejor[3]
    p[te]=predecir(tr,te)@w; pred[te]=p[te]>=corte
    info=dict(fold=fold+1,pesos=w.tolist(),corte=corte,metricas=metricas(y[te],p[te],corte),segundos=time.time()-inicio); folds.append(info); print(json.dumps(info),flush=True)
met=dict(auc=float(roc_auc_score(y,p)),accuracy=float(accuracy_score(y,pred)),precision=float(precision_score(y,pred)),recall=float(recall_score(y,pred)),f1=float(f1_score(y,pred)),matriz=confusion_matrix(y,pred).tolist())
r=dict(metricas=met,cumple=all(v>=.75 for k,v in met.items() if k!="matriz"),folds=folds,nota="Pesos, selección de expertos y umbral elegidos únicamente con entrenamiento interno; tres expertos escogidos tras la exploración de esta cohorte.")
referencia=json.loads((ROOT/"frontend/src/data/evaluacion-joseph-mary.json").read_text(encoding="utf-8"))["ensemble"]["metricas_clase_en_riesgo"]
for clave in ("auc","accuracy","precision","recall","f1"):
    np.testing.assert_allclose(met[clave],referencia[clave],rtol=0,atol=1e-12)
assert met["matriz"]==referencia["matriz"], "La evaluación reproducida debe coincidir con el informe"
fpr,tpr,_=roc_curve(y,p)
salones=[]
for salon in sorted(df.salon.unique()):
    mask=(df.salon==salon).to_numpy()
    salones.append(dict(salon=salon,total=int(mask.sum()),en_riesgo_predicho=int(pred[mask].sum()),sin_riesgo_predicho=int(mask.sum()-pred[mask].sum()),en_riesgo_real=int(y[mask].sum())))
r["graficos"]=dict(matriz_confusion=met["matriz"],roc=dict(fpr=fpr.tolist(),tpr=tpr.tolist(),auc=met["auc"]),clasificacion=dict(en_riesgo=int(pred.sum()),sin_riesgo=int(N-pred.sum()),total=N,en_riesgo_real=int(y.sum())),por_salon=salones)
joblib.dump(dict(y=y,probabilidades=p,predicciones=pred,folds=folds),OUT/"ensemble_predicciones_oof.joblib")
(OUT/"ensemble_anidado.json").write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding="utf-8"); print("RESULTADO",json.dumps(r),flush=True)
