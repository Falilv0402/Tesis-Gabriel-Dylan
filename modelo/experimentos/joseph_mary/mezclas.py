from experiment import *
from scipy.stats import rankdata
import itertools,re

def evaluar(y,p):
    orden=np.argsort(-p,kind="stable"); s=p[orden]; n=len(y); pos=y.sum(); neg=n-pos
    k=np.arange(1,n+1); tp=np.cumsum(y[orden]); fp=k-tp; fn=pos-tp
    pr=tp/k; rec=tp/pos; f1=2*tp/(k+pos); acc=(tp+neg-fp)/n
    auc=roc_auc_score(y,p)
    puntuacion=np.minimum.reduce([pr,rec,f1,acc,np.full(n,auc)])
    validos=np.r_[s[:-1]!=s[1:],True]
    puntuacion[~validos]=-1
    ix=np.argmax(puntuacion)
    return dict(auc=float(auc),accuracy=float(acc[ix]),precision=float(pr[ix]),recall=float(rec[ix]),f1=float(f1[ix]),corte=float(s[ix]),minimo=float(puntuacion[ix]))

probs={}; filas={}; y=None
for archivo in ("busqueda","por_area","transferencia","catboost","variantes_finales","fundacional"):
    path=OUT/f"{archivo}.joblib"
    if not path.exists(): continue
    a=joblib.load(path)
    if y is None: y=a["y"]
    assert np.array_equal(y,a["y"])
    for nombre,p in a["probabilidades"].items():
        probs[nombre]=p; filas[nombre]=evaluar(y,p)

representantes={}
for nombre,m in filas.items():
    partes=nombre.split("/")
    familia="/".join(partes[:2]); familia=re.sub(r"_(C|\d|None).*","",familia)
    if "catboost" in nombre: familia="/".join(partes[:2])
    if familia not in representantes or m["minimo"]>filas[representantes[familia]]["minimo"]:
        representantes[familia]=nombre
elegidos=sorted(representantes.values(),key=lambda n:filas[n]["minimo"],reverse=True)[:24]
resultados=[]; mejores={}
for modo in ("probabilidades","rangos"):
    ps={k:(probs[k] if modo=="probabilidades" else rankdata(probs[k])/len(y)) for k in elegidos}
    for a,b in itertools.combinations(elegidos,2):
        for w in (.25,.5,.75):
            p=w*ps[a]+(1-w)*ps[b]; m=evaluar(y,p)
            m.update(modelo_a=a,modelo_b=b,peso_a=w,modo=modo,evaluacion="exploratoria; selección y umbral usan OOF")
            resultados.append(m)
            if not mejores or m["minimo"]>mejores["metricas"]["minimo"]: mejores={"metricas":m,"p":p,"y":y}
resultados.sort(key=lambda m:m["minimo"],reverse=True)
pd.DataFrame(resultados).to_csv(OUT/"mezclas.csv",index=False)
joblib.dump(mejores,OUT/"mejor_mezcla.joblib")
print(json.dumps({"n_modelos":len(probs),"n_mezclas":len(resultados),"mejores":resultados[:5]}),flush=True)
