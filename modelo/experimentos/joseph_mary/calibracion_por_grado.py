"""Ensemble generativo con calibración por grado; validación externa real."""
from augmentacion import *
from scipy.special import logit

def main():
    datos=joblib.load(OUT/"datos.joblib"); raw=historicos(datos["df"]); y=datos["y"]; X=features(raw)
    grado=X["grado"].to_numpy(); g=np.column_stack([(grado==i).astype(float) for i in (1,2,3,4,5,6)])
    def base(tr,te):
        salidas=[]
        for fam,gen in (("LR",False),("LR",True),("HGB",False)):
            rt=raw.iloc[tr].reset_index(drop=True); yy=y[tr]; w=np.ones(len(tr))
            if gen:
                syn,sy=sinteticos(rt,yy,"copula",1000,42)
                rt=pd.concat([rt,syn],ignore_index=True); yy=np.r_[yy,sy]; w=np.r_[w,np.full(len(sy),.25)]
            m=ajustar(modelo(fam),features(rt),yy,w)
            salidas.append(m.predict_proba(X.iloc[te])[:,1])
        return np.column_stack(salidas)
    def meta(p,ix):
        l=logit(np.clip(p,.001,.999))
        return np.column_stack([l,g[ix],*(l[:,j:j+1]*g[ix] for j in range(3))])
    pp=np.zeros(len(y)); pred=np.zeros(len(y),dtype=int); folds=[]; inicio=time.time()
    for fold,(tr,te) in enumerate(StratifiedKFold(5,shuffle=True,random_state=42).split(X,y)):
        pi=np.zeros((len(tr),3))
        for a,b in StratifiedKFold(3,shuffle=True,random_state=100+fold).split(X.iloc[tr],y[tr]): pi[b]=base(tr[a],tr[b])
        Z=meta(pi,tr); cal=make_pipeline(StandardScaler(),LogisticRegression(C=.1,max_iter=2000,random_state=42))
        ci=cross_val_predict(cal,Z,y[tr],cv=StratifiedKFold(3,shuffle=True,random_state=200+fold),method="predict_proba")[:,1]
        mejor=max((metricas(y[tr],ci,t) for t in np.arange(.15,.801,.025)),key=lambda z:(min(z[k] for k in ("auc","accuracy","precision","recall","f1")),z["f1"]))
        cal.fit(Z,y[tr]); pp[te]=cal.predict_proba(meta(base(tr,te),te))[:,1]; pred[te]=pp[te]>=mejor["corte"]
        f=dict(fold=fold+1,corte=mejor["corte"],metricas=metricas(y[te],pp[te],mejor["corte"]),segundos=time.time()-inicio); folds.append(f); print(json.dumps(f),flush=True)
    met=dict(auc=float(roc_auc_score(y,pp)),accuracy=float(accuracy_score(y,pred)),precision=float(precision_score(y,pred)),recall=float(recall_score(y,pred)),f1=float(f1_score(y,pred)),matriz=confusion_matrix(y,pred).tolist())
    r=dict(metricas=met,cumple=all(v>=.75 for k,v in met.items() if k!="matriz"),n_evaluados_reales=len(y),n_sinteticos_evaluados=0,folds=folds)
    carpeta=OUT/"augmentacion"; carpeta.mkdir(exist_ok=True)
    (carpeta/"calibracion_por_grado.json").write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding="utf-8")
    print("RESULTADO",json.dumps(r),flush=True)

if __name__=="__main__": main()
