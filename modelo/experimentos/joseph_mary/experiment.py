"""Experimentos locales: no modifica modelos ni publica resultados."""
import os
for name in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "LOKY_MAX_CPU_COUNT"):
    os.environ[name] = "1"
import sys, json, warnings, time
from pathlib import Path
import numpy as np
import pandas as pd
import joblib
from sklearn.base import clone
from sklearn.pipeline import make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier, HistGradientBoostingClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / ".git" / "jym"
OUT.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / "modelo/colegio"))
import train_colegio_model as tm
warnings.filterwarnings("ignore")

def metricas(y, p, corte):
    z = p >= corte
    return dict(auc=float(roc_auc_score(y,p)), accuracy=float(accuracy_score(y,z)),
                precision=float(precision_score(y,z,zero_division=0)), recall=float(recall_score(y,z)),
                f1=float(f1_score(y,z)), corte=float(corte), matriz=confusion_matrix(y,z).tolist())

def cargar():
    a=joblib.load(ROOT / "modelo/model/colegio_249.pkl")
    df=pd.DataFrame(a["predicciones"]).sort_values(["salon","n_alumno"]).reset_index(drop=True)
    y_original=tm._riesgo_bimestre(df,4)
    mat=tm._serie_area(df,4,"matematica","mat_prim")
    com=tm._serie_area(df,4,"comunicacion","lenguaje")
    notas=pd.concat([mat,com],axis=1)
    y_correcto=(notas <= 13).any(axis=1).astype(float)
    y_correcto[notas.isna().all(axis=1)]=np.nan
    print(json.dumps({"alumnos":len(df),"evaluables_original":int(y_original.notna().sum()),
        "riesgo_original":int(y_original.sum()),"evaluables_unificado":int(y_correcto.notna().sum()),
        "riesgo_unificado":int(y_correcto.sum()),"diferencias_objetivo":int((y_original.fillna(-1)!=y_correcto.fillna(-1)).sum()),
        "columnas":list(df.columns)},ensure_ascii=False),flush=True)
    base=tm._features_transicion(df,3,2,False,prev3=1)
    full=base.copy()
    for n in (1,2,3):
        areas={"mat":("matematica","mat_prim"),"com":("comunicacion","lenguaje"),
               "cta":("cta",),"social":("personal_social",),"ingles":("ingles",),
               "arte":("arte",),"ef":("ed_fisica",),"conducta":("conducta",)}
        vals=[]
        for area,nombres in areas.items():
            serie=tm._serie_area(df,n,*nombres)
            if serie is not None and serie.notna().sum()>=5:
                full[f"nota_{n}_{area}"]=serie
                full[f"bajo_{n}_{area}"]=(serie<=13).where(serie.notna()).astype(float)
                vals.append(serie)
        if vals:
            v=pd.concat(vals,axis=1)
            full[f"min_{n}"]=v.min(axis=1)
            full[f"max_{n}"]=v.max(axis=1)
            full[f"prom_{n}"]=v.mean(axis=1)
            full[f"dispersion_{n}"]=v.std(axis=1)
            full[f"cantidad_bajas_{n}"]=(v<=13).sum(axis=1)
    grado=tm._variables_de_grado(df)
    if grado is not None:
        for g in range(1,7): full[f"grado_{g}"]=(grado.grado==g).astype(float)
    for seccion in ("A","B"):
        full[f"seccion_{seccion}"]=df.salon.str.endswith(seccion).astype(float)
    for area in ("mat","com"):
        cols=[f"nota_{n}_{area}" for n in (1,2,3)]
        if all(c in full for c in cols):
            v=full[cols]
            full[f"promedio_historico_{area}"]=v.mean(axis=1)
            full[f"peor_historico_{area}"]=v.min(axis=1)
            full[f"variacion_total_{area}"]=v[cols[2]]-v[cols[0]]
            full[f"cambio_reciente_{area}"]=v[cols[2]]-v[cols[1]]
    mask=y_correcto.notna()
    return df.loc[mask].reset_index(drop=True), y_correcto[mask].astype(int).to_numpy(), {
        "base":base.loc[mask].reset_index(drop=True),"completo":full.loc[mask].reset_index(drop=True)}

def modelos():
    for c in (.03,.1,.3,1,3,10):
        for cw in (None,"balanced"):
            yield f"LR_C{c}_{cw}",make_pipeline(SimpleImputer(add_indicator=True),StandardScaler(),LogisticRegression(C=c,class_weight=cw,max_iter=3000,random_state=42))
    for depth in (2,3,4,None):
        for cw in (None,"balanced"):
            yield f"RF_{depth}_{cw}",make_pipeline(SimpleImputer(add_indicator=True),RandomForestClassifier(n_estimators=150,max_depth=depth,min_samples_leaf=3,class_weight=cw,n_jobs=1,random_state=42))
    for leaf in (2,5,10):
        yield f"ET_{leaf}",make_pipeline(SimpleImputer(add_indicator=True),ExtraTreesClassifier(n_estimators=200,min_samples_leaf=leaf,class_weight="balanced",n_jobs=1,random_state=42))
    for leaf in (5,10,20):
        for l2 in (1.,10.):
            yield f"HGB_{leaf}_{l2}",HistGradientBoostingClassifier(max_iter=150,max_leaf_nodes=7,min_samples_leaf=leaf,l2_regularization=l2,learning_rate=.04,random_state=42)
    for depth in (1,2,3):
        yield f"GB_{depth}",make_pipeline(SimpleImputer(add_indicator=True),GradientBoostingClassifier(n_estimators=150,max_depth=depth,min_samples_leaf=5,learning_rate=.04,random_state=42))
        for weight in (1,2):
            yield f"XGB_{depth}_{weight}",XGBClassifier(n_estimators=200,max_depth=depth,min_child_weight=5,learning_rate=.035,reg_lambda=5,reg_alpha=.1,scale_pos_weight=weight,n_jobs=1,random_state=42)
            yield f"LGB_{depth}_{weight}",LGBMClassifier(n_estimators=180,max_depth=depth,num_leaves=2**depth,min_child_samples=10,learning_rate=.035,reg_lambda=5,scale_pos_weight=weight,n_jobs=1,verbosity=-1,random_state=42)
    for c in (.1,1,10):
        yield f"SVC_{c}",make_pipeline(SimpleImputer(add_indicator=True),StandardScaler(),SVC(C=c,class_weight="balanced",probability=True,random_state=42))
    for k in (5,15,35):
        yield f"KNN_{k}",make_pipeline(SimpleImputer(add_indicator=True),StandardScaler(),KNeighborsClassifier(n_neighbors=k,weights="distance",n_jobs=1))

def main():
    df,y,sets=cargar()
    joblib.dump({"df":df,"y":y,"sets":sets},OUT/"datos.joblib")
    cv=list(StratifiedKFold(5,shuffle=True,random_state=42).split(np.zeros(len(y)),y))
    resultados=[]; probs={}; start=time.time()
    for grupo,X in sets.items():
        for nombre,modelo in modelos():
            etiqueta=f"{grupo}/{nombre}"
            try:
                p=cross_val_predict(modelo,X,y,cv=cv,method="predict_proba",n_jobs=1)[:,1]
                opciones=[metricas(y,p,t) for t in np.arange(.1,.801,.025)]
                mejor=max(opciones,key=lambda m:(min(m[k] for k in ("precision","recall","f1","accuracy","auc")),m["f1"]))
                mejor.update(modelo=etiqueta,segundos=round(time.time()-start,1),evaluacion="exploratoria OOF; umbral seleccionado con OOF")
                resultados.append(mejor); probs[etiqueta]=p
                print(json.dumps(mejor,ensure_ascii=False),flush=True)
                joblib.dump({"y":y,"probabilidades":probs,"resultados":resultados,"cv":cv},OUT/"busqueda.joblib")
                pd.DataFrame(resultados).to_csv(OUT/"resultados.csv",index=False)
            except Exception as exc:
                print(json.dumps({"modelo":etiqueta,"error":str(exc)},ensure_ascii=False),flush=True)
    resultados.sort(key=lambda m:min(m[k] for k in ("precision","recall","f1","accuracy","auc")),reverse=True)
    (OUT/"resumen.json").write_text(json.dumps(resultados,ensure_ascii=False,indent=2),encoding="utf-8")
    print("MEJORES",json.dumps(resultados[:5],ensure_ascii=False),flush=True)

if __name__=="__main__": main()
