"""El generador de Joseph/Mary no usa resultados futuros ni modifica alumnos reales."""
import sys
from pathlib import Path
import numpy as np
import pandas as pd
import pytest

sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"modelo/experimentos/joseph_mary"))
from augmentacion import historicos,features,sinteticos

def datos():
    df=pd.DataFrame({f"b{b}_matematica":[10,13,16,18.5]*3 for b in (1,2,3,4)})
    for b in (1,2,3,4): df[f"b{b}_comunicacion"]=[13,16,18.5,10]*3
    df["salon"]=["1A"]*6+["2B"]*6
    df["nombre"]="NOMBRE QUE NO ES UN PREDICTOR"
    return df

def test_b4_y_nombres_no_modifican_las_entradas():
    df=datos(); original=features(historicos(df))
    df["b4_matematica"]=0; df["b4_comunicacion"]=20; df["nombre"]="OTRO"
    pd.testing.assert_frame_equal(original,features(historicos(df)))
    assert not any("b4" in c or "nombre" in c for c in original)

@pytest.mark.parametrize("metodo",["copula","recombinacion","smoten"])
def test_generacion_reproducible_y_sin_modificar_los_reales(metodo):
    raw=historicos(datos()); copia=raw.copy(deep=True); y=np.array([0,1]*6)
    s,sy=sinteticos(raw,y,metodo,40,123)
    s2,sy2=sinteticos(raw,y,metodo,40,123)
    pd.testing.assert_frame_equal(raw,copia)
    pd.testing.assert_frame_equal(s,s2)
    np.testing.assert_array_equal(sy,sy2)
    assert len(s)==len(sy)
    for c in s:
        assert set(s[c].dropna())<=set(raw[c].dropna())

def test_rechaza_b4_en_el_generador():
    raw=historicos(datos()); raw["b4_mat"]=13
    with pytest.raises(ValueError,match="B4"):
        sinteticos(raw,np.array([0,1]*6),"copula",40)

def test_el_informe_macro_no_declara_cumplimiento_de_la_clase_en_riesgo():
    from informe_macro import resumen
    r=resumen(dict(auc=.9220551378446116,accuracy=294/341,
        precision=54/80,recall=54/75,f1=108/155,matriz=[[240,26],[21,54]]))
    assert r["cumple_75_macro"] is True
    assert r["cumple_75_clase_en_riesgo"] is False
    assert r["metricas_macro"]["f1_macro_cv"]==pytest.approx((108/155+480/527)/2)
    assert r["metricas_clase_en_riesgo"]["recall"]==.72
    assert r["n_evaluados_reales"]==341 and r["n_sinteticos_evaluados"]==0
