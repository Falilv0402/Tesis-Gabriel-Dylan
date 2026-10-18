"""
train_colegio_model.py — Entrena un modelo de riesgo específico para un colegio.

Uso:
    python modelo/colegio/train_colegio_model.py --ie 0249 --carpeta .

Genera:
    modelo/model/colegio_{codigo_ie}.pkl  — predictor + metadatos
"""

import argparse
import json
import shutil
import warnings
from datetime import datetime
from pathlib import Path

warnings.filterwarnings("ignore")

import joblib

# Cuántas copias de respaldo se conservan por colegio (la más vieja se borra
# al guardar una nueva) -- ver _respaldar_modelo_anterior().
MAX_BACKUPS_POR_COLEGIO = 5


def _respaldar_modelo_anterior(output_path: Path) -> None:
    """Antes de sobrescribir el .pkl de un colegio, guarda una copia con
    timestamp en modelo/model/backups/colegio_{ie}/. Sin esto, un Excel malo
    que produce un modelo peor (o roto) no tenía forma de revertirse: el
    histórico de modelos_versiones solo guarda MÉTRICAS para graficar, no el
    artefacto servible. Ver restaurar_backup_colegio.py para restaurar."""
    if not output_path.exists():
        return
    backup_dir = output_path.parent / "backups" / output_path.stem
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    shutil.copy2(output_path, backup_dir / f"{timestamp}.pkl")

    backups = sorted(backup_dir.glob("*.pkl"))
    for viejo in backups[:-MAX_BACKUPS_POR_COLEGIO]:
        viejo.unlink()
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    roc_auc_score, f1_score, precision_score, recall_score, accuracy_score,
    confusion_matrix, roc_curve,
)

from parse_excels import procesar_colegio, AREAS_ACADEMICAS, nombre_colegio_valido, limpiar_nombre_manual


def _resolver_nombre_colegio_con_origen(
    nombre_parseado, output_path: Path, codigo_ie: str, nombre_manual: str | None = None,
) -> tuple[str, str]:
    """(nombre, origen). Prioridad: el que escribió a mano quien subió los Excel ("manual"); el leído del
    encabezado del Excel ("excel", solo el formato CUBICOL lo trae); el que ya tenía el modelo anterior o sus
    respaldos ("modelo_anterior": el "Reporte consolidado" no trae nombre y sin esto cada carga por la web le
    cambiaba el nombre al colegio en todo el sistema); y como último recurso "Colegio {IE}" ("por_defecto")."""
    manual = limpiar_nombre_manual(nombre_manual)
    if manual:
        return manual, "manual"
    if nombre_colegio_valido(nombre_parseado):
        return str(nombre_parseado).strip(), "excel"
    respaldos = sorted((output_path.parent / "backups" / output_path.stem).glob("*.pkl"), reverse=True)
    for pkl in [output_path, *respaldos]:
        if not pkl.exists():
            continue
        try:
            previo = joblib.load(pkl).get("nombre_colegio")
        except Exception:
            continue
        if nombre_colegio_valido(previo):
            return str(previo).strip(), "modelo_anterior"
    return f"Colegio {codigo_ie}", "por_defecto"


def _resolver_nombre_colegio(nombre_parseado, output_path: Path, codigo_ie: str) -> str:
    return _resolver_nombre_colegio_con_origen(nombre_parseado, output_path, codigo_ie)[0]

# ─── Etiquetas legibles para las features, usadas en "Importancia de variables" ──
_ETIQUETAS_AREA = {
    "matematica": "Matemática", "comunicacion": "Comunicación", "cta": "Ciencia y Tecnología",
    "personal_social": "Personal Social", "english": "Inglés", "arte": "Arte y Cultura",
    "ed_fisica": "Educación Física", "lenguaje": "Comunicación", "mat_prim": "Matemática",
}


def _etiqueta_feature(nombre: str) -> str:
    if nombre == "conducta_promedio":
        return "Conducta (promedio)"
    # Features del pronóstico por transición (ver _features_transicion): se
    # nombran por posición relativa al bimestre a pronosticar, no por número.
    if nombre == "prev1_conducta":
        return "Conducta (bimestre anterior)"
    if nombre == "conducta_prom":
        return "Conducta (promedio)"
    if nombre == "riesgo_prev1":
        return "En riesgo en el bimestre anterior"
    if nombre == "riesgo_prev2":
        return "En riesgo dos bimestres atrás"
    for prefijo, texto in (("prev1_", "{} (bimestre anterior)"), ("prev2_", "{} (dos bimestres atrás)"), ("delta_", "Variación en {}")):
        if nombre.startswith(prefijo):
            area = nombre.removeprefix(prefijo)
            return texto.format(_ETIQUETAS_AREA.get(area, area.title()))
    if nombre in ("n_materias_c", "promedio_materias"):
        return {"n_materias_c": "N.º de cursos con C", "promedio_materias": "Promedio general"}[nombre]
    if nombre.startswith("tend_temprana_"):
        area = nombre.removeprefix("tend_temprana_")
        return f"Tendencia B1→B3 en {_ETIQUETAS_AREA.get(area, area.title())}"
    for prefijo, etiqueta_bimestre in (("b1_", "Bimestre 1"), ("b2_", "Bimestre 2"), ("b3_", "Bimestre 3"), ("pp_", "Promedio anual")):
        if nombre.startswith(prefijo):
            area = nombre.removeprefix(prefijo)
            return f"{_ETIQUETAS_AREA.get(area, area.title())} ({etiqueta_bimestre})"
    return nombre

# ─── Enfoque predictivo: B1-B3 como features, B4/PP como target ──────────────
#
# El modelo usa los primeros 3 bimestres para predecir quién tendrá C
# en el 4.° bimestre (todavía hay tiempo de intervenir).
# Esto convierte el sistema en alerta TEMPRANA real, no descripción del pasado.
#
# Features disponibles (bimestres 1-3): las 7 áreas académicas ponderadas
# (Matemática, Comunicación, Ciencia y Tecnología, Personal Social, English,
# Arte y Cultura, Educación Física — ver AREAS_PONDERADAS en parse_excels.py)
# más Conducta, que el colegio también evalúa como criterio de riesgo.
FEATURES_EARLY = [
    f"b{n}_{area}" for area in AREAS_ACADEMICAS for n in (1, 2, 3)
] + ["conducta_promedio"]

# Si no hay suficientes bimestres, fallback al PP (modo descriptivo).
# IMPORTANTE: pp_matematica y pp_comunicacion se EXCLUYEN a propósito — el
# target (riesgo_target) en este modo se define exactamente como
# "pp_matematica <= 13 OR pp_comunicacion <= 13" (ver calcular_riesgo en
# parse_excels.py), así que incluirlas como features es circular (el modelo
# predice su propia entrada, AUC ≈ 1.0 sin ningún valor real). El modelo
# predice riesgo en Matemática/Comunicación a partir de OTRAS señales.
FEATURES_PP = [
    f"pp_{area}" for area in AREAS_ACADEMICAS if area not in ("matematica", "comunicacion")
] + [
    "conducta_promedio", "n_materias_c", "promedio_materias",
]


# ─── Pronóstico por transición entre bimestres ───────────────────────────────
#
# El colegio sube las notas que tiene hasta hoy (B1..BK). Lo que se quiere es
# avisar quién está en riesgo en el SIGUIENTE bimestre (K+1), que todavía no
# existe -- no hay etiqueta para entrenar con él. Se aprende entonces la
# relación "cómo los dos bimestres previos anticipan el siguiente" con el
# último bimestre ya conocido (B(K-2), B(K-1) → BK) y se aplica un paso más
# adelante (B(K-1), BK → B(K+1)). Las variables se nombran por posición
# relativa (prev1/prev2), no por número de bimestre, para que sirvan en ambos
# momentos. Con los 4 bimestres cargados ya no queda futuro que pronosticar:
# esa misma transición se usa como validación retrospectiva.

NOTA_RIESGO = 13.0   # nota <= 13 (por debajo del logro esperado) en Matemática o Comunicación
MIN_CLASE = 5        # alumnos mínimos de cada clase (en riesgo / no) para entrenar un modelo


def _cols_mc(df, n: int):
    mat = next((c for c in (f"b{n}_matematica", f"b{n}_mat_prim") if c in df.columns), None)
    com = next((c for c in (f"b{n}_comunicacion", f"b{n}_lenguaje") if c in df.columns), None)
    return mat, com


def _riesgo_bimestre(df, n: int) -> pd.Series:
    """1 = nota <= 13 en Matemática o Comunicación en el bimestre n; 0 = no;
    NaN = ese alumno no tiene notas de ese bimestre."""
    cols = [c for c in _cols_mc(df, n) if c]
    if not cols:
        return pd.Series(np.nan, index=df.index)
    sub = df[cols]
    riesgo = (sub <= NOTA_RIESGO).any(axis=1).astype(float)
    riesgo[sub.isna().all(axis=1)] = np.nan
    return riesgo


def _bimestres_cargados(df) -> int:
    """Último bimestre con notas reales (>= 5 alumnos), contando solo los
    consecutivos desde B1 (un hueco corta la cuenta)."""
    k = 0
    for n in (1, 2, 3, 4):
        if any(c and df[c].notna().sum() >= 5 for c in _cols_mc(df, n)):
            k = n
        else:
            break
    return k


def _features_transicion(df, prev1: int, prev2: int | None, usar_conducta_prom: bool) -> pd.DataFrame:
    X = pd.DataFrame(index=df.index)
    for area in AREAS_ACADEMICAS + ["lenguaje", "mat_prim"]:
        c1 = f"b{prev1}_{area}"
        if c1 not in df.columns or df[c1].notna().sum() < 5:
            continue
        X[f"prev1_{area}"] = df[c1]
        if prev2:
            c2 = f"b{prev2}_{area}"
            if c2 in df.columns and df[c2].notna().sum() >= 5:
                X[f"prev2_{area}"] = df[c2]
                X[f"delta_{area}"] = df[c1] - df[c2]
    cc = f"b{prev1}_conducta"
    if cc in df.columns and df[cc].notna().sum() >= 5:
        X["prev1_conducta"] = df[cc]
    elif usar_conducta_prom and "conducta_promedio" in df.columns and df["conducta_promedio"].notna().sum() >= 5:
        X["conducta_prom"] = df["conducta_promedio"]
    X["riesgo_prev1"] = _riesgo_bimestre(df, prev1).fillna(0)
    if prev2:
        X["riesgo_prev2"] = _riesgo_bimestre(df, prev2).fillna(0)
    return X


def _construir_pipe(pos: int, neg: int):
    class_weight = {0: 1.0, 1: max(1.0, neg / max(pos, 1))}
    pipe_lr = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(C=0.3, max_iter=2000, class_weight=class_weight, random_state=42)),
    ])
    pipe_rf = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", RandomForestClassifier(
            n_estimators=300, max_depth=4, min_samples_leaf=3,
            class_weight=class_weight, random_state=42, n_jobs=-1,
        )),
    ])
    return VotingClassifier(estimators=[("lr", pipe_lr), ("rf", pipe_rf)], voting="soft"), class_weight


def _entrenar_calibrado(X: pd.DataFrame, y: np.ndarray) -> dict:
    """Ensemble LR + RF con probabilidades calibradas (Platt/sigmoid). Devuelve
    el modelo ya ajustado y la validación cruzada (probabilidades fuera de
    muestra) -- única medida honesta con tan pocos alumnos por colegio."""
    pos = int(y.sum())
    neg = len(y) - pos
    menor = min(pos, neg)
    pipe, class_weight = _construir_pipe(pos, neg)
    cal_cv = 5 if menor >= 25 else 3 if menor >= 10 else 2
    n_splits = 5 if menor >= 10 else 3

    oof = None
    try:
        skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
        oof = cross_val_predict(
            CalibratedClassifierCV(pipe, method="sigmoid", cv=cal_cv), X, y, cv=skf, method="predict_proba",
        )[:, 1]
    except Exception as e:  # muestra demasiado chica/desbalanceada para validar: se informa sin tumbar la carga
        print(f"      No se pudo calcular la validación cruzada: {e}")

    modelo = CalibratedClassifierCV(pipe, method="sigmoid", cv=cal_cv)
    modelo.fit(X, y)
    return {"modelo": modelo, "oof": oof, "n_splits": n_splits if oof is not None else 0, "class_weight": class_weight}


def train(carpeta: str, codigo_ie: str, distrito: str | None = None, nombre_manual: str | None = None) -> None:
    model_dir = Path(__file__).resolve().parents[1] / "model"
    model_dir.mkdir(exist_ok=True)
    # El archivo se guarda SIEMPRE sin ceros iniciales (misma normalización
    # que usa el frontend al llamar /v1/colegio/{ie}/procesar, que hace
    # String(parseInt(codigo_ie, 10))). Si esto no coincide, una carga vía
    # web y una vía CLI para el mismo colegio terminan en DOS archivos
    # distintos (p.ej. colegio_0864785.pkl y colegio_864785.pkl) y
    # _load_artefacto() en el backend sirve el que encuentra primero — que
    # puede no ser el más reciente. Pasó de verdad con La Victoria.
    codigo_ie_archivo = codigo_ie.lstrip("0") or codigo_ie
    output_path = model_dir / f"colegio_{codigo_ie_archivo}.pkl"

    print(f"\n{'='*60}")
    print(f"  MODELO DE RIESGO — IE {codigo_ie}")
    print(f"{'='*60}")

    # ── 1. ETL ────────────────────────────────────────────────────────────────
    print("\n[1/4] Procesando Excel del colegio...")
    df = procesar_colegio(carpeta, codigo_ie)

    # Guardar dataset limpio
    csv_path = Path(carpeta) / f"colegio_{codigo_ie}_procesado.csv"
    df.to_csv(csv_path, index=False)
    print(f"      Dataset guardado → {csv_path}")

    # ── 2. Qué se puede hacer con los bimestres cargados ──────────────────────
    k = _bimestres_cargados(df)
    bimestre_pron = k + 1 if k < 4 else None
    print(f"\n[2/4] Bimestres cargados: B1-B{k}" if k else "\n[2/4] Sin desglose por bimestre (solo promedio anual)")

    X_apply = None
    mask_todos = None
    if k >= 2:
        # Transición con etiqueta conocida: B(k-2), B(k-1) → Bk
        prev1 = k - 1
        prev2 = k - 2 if k - 2 >= 1 else None
        y_serie = _riesgo_bimestre(df, k)
        mask_todos = y_serie.notna().values
        X_all = _features_transicion(df, prev1, prev2, usar_conducta_prom=(k < 4))
        X = X_all[mask_todos].copy()
        y = y_serie[mask_todos].astype(int).values
        medianas = X.median().fillna(0)
        X = X.fillna(medianas)
        available = list(X.columns)
        if k < 4:
            X_apply = _features_transicion(df, k, k - 1 if k - 1 >= 1 and prev2 else None, usar_conducta_prom=True)
            X_apply = X_apply.reindex(columns=available).fillna(medianas)
        modo = (f"predictivo · pronóstico del {bimestre_pron}.° bimestre (a partir de B1-B{k})"
                if k < 4 else "cierre de año · validación retrospectiva (B1-B4 cargados)")
    else:
        # Sin bimestres suficientes: no hay forma de pronosticar. Solo modo
        # descriptivo (el objetivo es el promedio anual) y se avisa en la UI.
        df["riesgo_target"] = df["riesgo"].values
        early_available = [f for f in FEATURES_EARLY if f in df.columns and df[f].notna().sum() >= 5]
        if len(early_available) >= 3:
            available = early_available
            modo = "descriptivo (solo 1 bimestre cargado: aún no se puede pronosticar)"
        else:
            # pp_matematica y pp_comunicacion se excluyen a propósito: el
            # objetivo es exactamente "pp_matematica <= 13 OR pp_comunicacion
            # <= 13", incluirlas sería circular (AUC ≈ 1.0 sin valor real).
            available = [f for f in FEATURES_PP if f in df.columns and df[f].notna().sum() >= 5]
            modo = "descriptivo (PP anual)"
        mask_todos = df["riesgo_target"].notna().values
        X = df.loc[mask_todos, available].copy()
        y = df.loc[mask_todos, "riesgo_target"].astype(int).values
        for col in X.columns:
            X[col] = X[col].fillna(X[col].median())
        medianas = X.median().fillna(0)

    print(f"      Features usadas ({len(available)}): {available}")
    print(f"      Modo de predicción: {modo}")
    print(f"      Alumnos totales: {len(df)} | con resultado conocido para entrenar: {len(X)}")
    print(f"      En riesgo (y=1): {int(y.sum())} ({100*y.mean():.1f}%)" if len(y) else "      Sin alumnos para entrenar")

    # ── 3. Entrenar modelo ────────────────────────────────────────────────────
    print("\n[3/4] Entrenando modelo...")

    pos = int(y.sum())
    neg = len(y) - pos
    modelo = None
    oof = None
    auc_cv = precision_cv = recall_cv = f1_cv = float("nan")
    auc_train = f1_train = precision_train = recall_train = accuracy_train = float("nan")
    n_splits_used = 0
    cm_train = fpr_train = tpr_train = None
    importancia_variables = None

    if min(pos, neg) < MIN_CLASE:
        # Muestra insuficiente (pocos alumnos en riesgo o pocos sin riesgo):
        # un modelo aquí sería ruido. Se muestra el índice de notas y se avisa.
        print(f"      Muestra insuficiente (en riesgo={pos}, sin riesgo={neg}; mínimo {MIN_CLASE} de cada uno) — se usa el índice de notas.")
        if not modo.startswith("descriptivo"):
            modo = "descriptivo (muestra insuficiente para pronosticar)"
    else:
        res = _entrenar_calibrado(X, y)
        modelo, oof, n_splits_used = res["modelo"], res["oof"], res["n_splits"]
        class_weight = res["class_weight"]
        y_prob = modelo.predict_proba(X)[:, 1]
        y_pred = (y_prob >= 0.5).astype(int)
        auc_train       = float(roc_auc_score(y, y_prob))
        f1_train        = float(f1_score(y, y_pred, zero_division=0))
        precision_train = float(precision_score(y, y_pred, zero_division=0))
        recall_train    = float(recall_score(y, y_pred, zero_division=0))
        accuracy_train  = float(accuracy_score(y, y_pred))
        if oof is not None:
            y_pred_cv    = (oof >= 0.5).astype(int)
            auc_cv       = float(roc_auc_score(y, oof))
            precision_cv = float(precision_score(y, y_pred_cv, zero_division=0))
            recall_cv    = float(recall_score(y, y_pred_cv, zero_division=0))
            f1_cv        = float(f1_score(y, y_pred_cv, zero_division=0))
            print(f"      AUC validación cruzada ({n_splits_used}-fold): {auc_cv:.4f}  "
                  f"(precisión {precision_cv:.2f} · recall {recall_cv:.2f} · F1 {f1_cv:.2f})")
        print(f"      AUC (train, referencia) : {auc_train:.4f}  F1 (train): {f1_train:.4f}")
        print("      Modelo CALIBRADO (sigmoid). La validación cruzada es el indicador válido.")

        # Matriz de confusión y curva ROC (en muestra, igual referencia que las
        # demás métricas "train") para los gráficos del front.
        cm_train = confusion_matrix(y, y_pred).tolist()
        fpr_train, tpr_train, _ = roc_curve(y, y_prob)

        # Importancia global de variables: un Random Forest simple aparte (el
        # ensemble calibrado no expone una importancia única y SHAP por
        # instancia no es confiable con muestras tan chicas).
        pipe_rf_importancia = Pipeline([
            ("scaler", StandardScaler()),
            ("clf", RandomForestClassifier(
                n_estimators=300, max_depth=4, min_samples_leaf=3,
                class_weight=class_weight, random_state=42, n_jobs=-1,
            )),
        ])
        pipe_rf_importancia.fit(X, y)
        importancias = pipe_rf_importancia.named_steps["clf"].feature_importances_
        importancia_variables = sorted(
            (
                {"variable": _etiqueta_feature(f), "importancia": round(float(imp), 4)}
                for f, imp in zip(available, importancias)
            ),
            key=lambda d: d["importancia"], reverse=True,
        )
        print(f"      Importancia de variables (top 3): "
              f"{[(d['variable'], d['importancia']) for d in importancia_variables[:3]]}")

    # ── 4. Generar predicciones y guardar ─────────────────────────────────────
    print("\n[4/4] Generando predicciones y guardando artefacto...")

    # Bimestres en que cada alumno estuvo en riesgo (Matemática o Comunicación <= 13)
    en_riesgo_bim = [_riesgo_bimestre(df, n).fillna(0) for n in range(1, k + 1)]
    df["bimestres_en_riesgo"] = sum(en_riesgo_bim).astype(int) if en_riesgo_bim else 0
    df["bimestres_evaluados"] = k
    if k >= 1:
        # "riesgo" = en riesgo en el último bimestre cargado (antes salía del
        # promedio anual y, en formatos por bimestre, quedaba en 0 para todos).
        df["riesgo"] = _riesgo_bimestre(df, k).fillna(0).astype(int)

    if modelo is not None:
        if X_apply is not None:
            # Pronóstico: bimestre siguiente, aún sin resultado → fuera de muestra por definición
            df["prob_riesgo"] = modelo.predict_proba(X_apply)[:, 1]
        else:
            # Sin futuro que pronosticar (cierre de año, o modo descriptivo):
            # probabilidades de validación cruzada, no del modelo viendo la respuesta
            if k >= 2:
                X_todos = _features_transicion(df, k - 1, k - 2 if k - 2 >= 1 else None, usar_conducta_prom=False)
                X_todos = X_todos.reindex(columns=available).fillna(medianas)
            else:
                X_todos = df[available].copy()
                for col in X_todos.columns:
                    X_todos[col] = X_todos[col].fillna(medianas[col])
            probs = modelo.predict_proba(X_todos)[:, 1]
            if oof is not None:
                probs[np.where(mask_todos)[0]] = oof
            df["prob_riesgo"] = probs
    else:
        df["prob_riesgo"] = df["riesgo_score"]

    # ── Nivel de riesgo coherente con el modelo ───────────────────────────────
    # El badge ALTO/MEDIO/BAJO se deriva de la probabilidad CALIBRADA (umbral
    # 70%/45%, igual que el modelo nacional EM 2022), no del índice de notas.
    # El índice ponderado de notas (riesgo_score) se conserva como métrica
    # explicable secundaria (transparente: Mate 25%, Com 20%, ...).
    if modelo is not None:
        def _nivel_de_prob(p: float) -> str:
            if p >= 0.70: return "ALTO"
            if p >= 0.45: return "MEDIO"
            return "BAJO"
        df["nivel_riesgo"] = df["prob_riesgo"].apply(_nivel_de_prob)
        # Reordenar por probabilidad (la señal predictiva) en vez del índice.
        df = df.sort_values("prob_riesgo", ascending=False).reset_index(drop=True)
        print(f"      Nivel final (desde prob calibrada 70/45%): "
              f"ALTO={int((df.nivel_riesgo == 'ALTO').sum())} "
              f"MEDIO={int((df.nivel_riesgo == 'MEDIO').sum())} "
              f"BAJO={int((df.nivel_riesgo == 'BAJO').sum())}")

    # Convertir a lista de dicts para el endpoint.
    # Incluimos las notas de TODOS los bimestres (b1..b4) por materia, además
    # del promedio (pp_), para que el frontend pueda filtrar/mostrar por bimestre.
    cols_out = [
        "n_alumno", "nombre", "salon", "codigo_ie",
        "nivel_riesgo", "prob_riesgo", "riesgo",
        "bimestres_en_riesgo", "bimestres_evaluados",
        "n_materias_c", "promedio_materias", "conducta_promedio",
    ] + [
        c for c in df.columns
        if c.startswith("pp_")
        or c.startswith("b1_") or c.startswith("b2_")
        or c.startswith("b3_") or c.startswith("b4_")
    ]

    cols_out = [c for c in cols_out if c in df.columns]
    predicciones = df[cols_out].replace({np.nan: None}).to_dict(orient="records")

    nombre_colegio, nombre_origen = _resolver_nombre_colegio_con_origen(
        df["nombre_colegio"].iloc[0] if "nombre_colegio" in df.columns else None, output_path, codigo_ie,
        nombre_manual,
    )
    print(f"  Nombre del colegio: {nombre_colegio!r} (origen: {nombre_origen})")

    if modelo is None or k < 2:
        tipo_resultado = "descriptivo"
        if modelo is None:
            nota = (
                "Modo descriptivo: " + (
                    "con un solo bimestre cargado no se puede pronosticar; los porcentajes son un índice "
                    "de las notas actuales, no una predicción." if k <= 1 else
                    "no hay suficientes alumnos en riesgo y sin riesgo para entrenar un modelo; los "
                    "porcentajes son un índice de las notas actuales, no una predicción."
                ) + " Sube más bimestres para activar el pronóstico."
            )
        else:
            nota = (
                "Modo descriptivo: sin al menos 2 bimestres cargados no se puede pronosticar; el modelo se "
                "ajustó al promedio anual y los porcentajes describen la situación actual, no el futuro. "
                "Sube más bimestres para activar el pronóstico."
            )
    elif k < 4:
        tipo_resultado = "pronostico"
        nota = (
            f"PRONÓSTICO DEL {bimestre_pron}.° BIMESTRE: el modelo aprendió con este colegio cómo las notas "
            f"previas anticipan el bimestre siguiente (B{prev1}"
            + (f" y B{prev2}" if prev2 else "") + f" → B{k}) y lo aplica a B{k}"
            + (f" y B{k-1}" if prev2 else "") + f" para estimar quién estará en riesgo en B{bimestre_pron}, "
            f"cuando todavía hay tiempo de intervenir. Validación cruzada de esa transición: AUC "
            f"{round(auc_cv, 3) if not np.isnan(auc_cv) else 'N/A'}. Se confirma comparando con las notas reales "
            f"cuando se suba B{bimestre_pron}."
        )
    else:
        tipo_resultado = "cierre_anual"
        nota = (
            "CIERRE DE AÑO: los 4 bimestres ya están cargados, así que no queda un bimestre por pronosticar. "
            "El porcentaje es la probabilidad (de validación cruzada, fuera de muestra) con la que el modelo "
            "habría anticipado el riesgo en B4 a partir de B2-B3: mide qué tan consistente es el patrón de "
            "cada alumno. Junto a él se muestra en cuántos bimestres estuvo realmente en riesgo."
        )

    artefacto = {
        "codigo_ie":      codigo_ie,
        "nombre_colegio": nombre_colegio,
        "nombre_colegio_origen": nombre_origen,
        # Distrito opcional: permite que este colegio aparezca en el selector
        # "Colegio asignado" (crear usuario / autoregistro) aunque no forme
        # parte del dataset EM2022 — ver get_colegios() en prediction_service.py.
        "distrito":       distrito,
        "modelo":         modelo,
        "features":       available,
        "predicciones":   predicciones,
        "metricas": {
            "nombre_colegio": nombre_colegio,
            # De dónde salió el nombre: "manual" (lo escribió quien subió los Excel), "excel" (encabezado
            # del Excel), "modelo_anterior" (se conservó el ya registrado) o "por_defecto" ("Colegio {IE}").
            "nombre_colegio_origen": nombre_origen,
            "modo_prediccion": modo,
            "tipo_resultado": tipo_resultado,
            "bimestres_cargados": list(range(1, k + 1)),
            "bimestre_pronosticado": bimestre_pron if (modelo is not None and 2 <= k < 4) else None,
            "umbral_riesgo_nota": NOTA_RIESGO,
            "n_alumnos":      len(df),
            "n_alumnos_modelo": len(X),
            "n_riesgo":       int(y.sum()),
            "pct_riesgo":     round(100 * float(y.mean()), 1) if len(y) else 0.0,
            "auc_cv":         round(auc_cv, 4)         if not np.isnan(auc_cv)         else None,
            "precision_cv":   round(precision_cv, 4)   if not np.isnan(precision_cv)   else None,
            "recall_cv":      round(recall_cv, 4)      if not np.isnan(recall_cv)      else None,
            "f1_cv":          round(f1_cv, 4)          if not np.isnan(f1_cv)          else None,
            "auc_train":      round(auc_train, 4)      if not np.isnan(auc_train)      else None,
            "f1_train":       round(f1_train, 4)       if not np.isnan(f1_train)       else None,
            "precision_train": round(precision_train, 4) if not np.isnan(precision_train) else None,
            "recall_train":   round(recall_train, 4)   if not np.isnan(recall_train)   else None,
            "accuracy_train": round(accuracy_train, 4) if not np.isnan(accuracy_train) else None,
            "n_splits_cv":    n_splits_used,
            # Para los gráficos del front (mismos componentes que EM 2022:
            # ConfusionMatrix / RocMiniChart), calculados en muestra (train).
            "confusion_matrix": cm_train,
            "roc_fpr": fpr_train.tolist() if fpr_train is not None else None,
            "roc_tpr": tpr_train.tolist() if tpr_train is not None else None,
            "importancia_variables": importancia_variables,
            "nota_metodologica": nota,
            "salones":        df["salon"].unique().tolist(),
            # Hojas/archivos que se omitieron o fallaron al leer el Excel (p.ej.
            # muy pocos alumnos, formato no reconocido) — se muestran en la UI
            # del admin para que sepa qué no se cargó y por qué.
            "advertencias_carga": df.attrs.get("advertencias", []),
        },
        "trained_at": pd.Timestamp.now().isoformat(timespec="seconds"),
    }

    _respaldar_modelo_anterior(output_path)
    joblib.dump(artefacto, output_path)
    print(f"  ✓ Artefacto guardado → {output_path}")
    print(f"\n  Distribución de riesgo:")
    for nivel in ["ALTO", "MEDIO", "BAJO"]:
        n = len(df[df.nivel_riesgo == nivel])
        print(f"    {nivel:5s}: {n:3d} alumnos")
    print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--ie",       default="0249", help="Código IE del colegio")
    parser.add_argument("--carpeta",  default=".",    help="Carpeta con los Excel")
    parser.add_argument("--distrito", default=None,   help="Distrito (opcional, para el selector de colegios)")
    parser.add_argument("--nombre",   default=None,   help="Nombre del colegio indicado a mano (tiene prioridad sobre el del Excel)")
    args = parser.parse_args()
    train(args.carpeta, args.ie, args.distrito, args.nombre)
