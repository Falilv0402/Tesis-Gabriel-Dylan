"""
evaluation.py — All post-training evaluation:
  baselines · subgroup fairness · calibration metrics · bootstrap CI ·
  SHAP · PDP · feature interactions · correlation · ablation ·
  permutation importance · statistical tests · learning curve ·
  threshold policies · DCA · error analysis · extra metrics
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.compose import ColumnTransformer
from sklearn.inspection import permutation_importance as perm_imp_fn
from sklearn.metrics import (
    accuracy_score, average_precision_score, brier_score_loss,
    confusion_matrix, f1_score, log_loss, matthews_corrcoef,
    precision_recall_curve, precision_score, recall_score, roc_auc_score, roc_curve,
)
from sklearn.model_selection import GroupKFold, cross_validate, learning_curve as lc_fn
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder, StandardScaler
from sklearn.utils import resample as sklearn_resample
from scipy.stats import chi2 as chi2_dist
from lightgbm import LGBMClassifier

from .config import (
    SEED, ALL_FEATURES, FEATURES_CAT, FEATURES_NUM, FEATURES_IE, FEATURES_DERIVED,
    GROUP_COL, TARGET,
)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _ci95(arr: list[float]) -> tuple[float, float]:
    arr = sorted(arr)
    return (round(arr[int(0.025 * len(arr))], 4), round(arr[int(0.975 * len(arr))], 4))


def _metric_pack(y_true, y_pred_bin, y_score_cont, desc: str) -> dict:
    return {
        "descripcion": desc,
        "accuracy":  float(accuracy_score(y_true, y_pred_bin)),
        "precision": float(precision_score(y_true, y_pred_bin, zero_division=0)),
        "recall":    float(recall_score(y_true, y_pred_bin, zero_division=0)),
        "f1_score":  float(f1_score(y_true, y_pred_bin, zero_division=0)),
        "auc_roc":   float(roc_auc_score(y_true, y_score_cont)) if len(np.unique(y_true)) > 1 else 0.5,
    }


def _subgroup_pack(mask, y_test, y_prob) -> dict | None:
    if int(mask.sum()) < 15:
        return None
    y_t = y_test[mask]
    y_s = y_prob[mask]
    y_p = (y_s >= 0.50).astype(int)
    if len(np.unique(y_t)) < 2:
        return None
    return {
        "n":         int(mask.sum()),
        "tasa_real": float(y_t.mean()),
        "accuracy":  float(accuracy_score(y_t, y_p)),
        "precision": float(precision_score(y_t, y_p, zero_division=0)),
        "recall":    float(recall_score(y_t, y_p, zero_division=0)),
        "f1_score":  float(f1_score(y_t, y_p, zero_division=0)),
        "auc_roc":   float(roc_auc_score(y_t, y_s)),
    }


# ─── 1. Final metrics ──────────────────────────────────────────────────────────

def compute_final_metrics(calibrated, X_test, y_test) -> tuple:
    """Returns (y_prob, y_pred, fpr, tpr, metrics_test)."""
    y_prob = calibrated.predict_proba(X_test)[:, 1]
    y_pred = (y_prob >= 0.50).astype(int)
    fpr, tpr, _ = roc_curve(y_test, y_prob)

    tn, fp, fn, tp = confusion_matrix(y_test, y_pred).ravel()
    specificity = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
    mcc         = float(matthews_corrcoef(y_test, y_pred))
    ll          = float(log_loss(y_test, y_prob))

    cal_true_q, cal_pred_q   = calibration_curve(y_test, y_prob, n_bins=10, strategy="quantile")
    cal_true_u, cal_pred_u   = calibration_curve(y_test, y_prob, n_bins=10, strategy="uniform")
    brier = float(brier_score_loss(y_test, y_prob))

    metrics_test = {
        "accuracy":  float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred)),
        "recall":    float(recall_score(y_test, y_pred)),
        "f1_score":  float(f1_score(y_test, y_pred)),
        "auc_roc":   float(roc_auc_score(y_test, y_prob)),
        "brier_score": brier,
        "log_loss":  ll,
        "mcc":       mcc,
        "specificity": specificity,
        "confusion_matrix":      confusion_matrix(y_test, y_pred).tolist(),
        "roc_fpr": fpr.tolist(),
        "roc_tpr": tpr.tolist(),
        "calibration_prob_true":         cal_true_q.tolist(),
        "calibration_prob_pred":         cal_pred_q.tolist(),
        "calibration_prob_true_uniform": cal_true_u.tolist(),
        "calibration_prob_pred_uniform": cal_pred_u.tolist(),
    }
    print(f"  AUC={metrics_test['auc_roc']:.4f}  F1={metrics_test['f1_score']:.4f}  "
          f"Brier={brier:.4f}  MCC={mcc:.4f}  Spec={specificity:.4f}")
    return y_prob, y_pred, fpr, tpr, brier, cal_true_q, cal_pred_q, cal_true_u, cal_pred_u, metrics_test


# ─── 2. Monotonicity check ────────────────────────────────────────────────────

def compute_monotonicity_check(test_df, y_prob, monotonic_constraints) -> dict:
    from .config import MONOTONIC_CONSTRAINTS
    mono_features = {f: c for f, c in zip(ALL_FEATURES, MONOTONIC_CONSTRAINTS) if c != 0}
    check = {}
    for feat, mc in mono_features.items():
        if feat not in test_df.columns:
            continue
        sort_idx     = np.argsort(test_df[feat].values)
        prob_sorted  = y_prob[sort_idx]
        n_pairs      = len(prob_sorted) - 1
        if n_pairs <= 0:
            continue
        if mc == -1:
            correct = int(np.sum(prob_sorted[1:] <= prob_sorted[:-1] + 1e-8))
        else:
            correct = int(np.sum(prob_sorted[1:] >= prob_sorted[:-1] - 1e-8))
        violations  = n_pairs - correct
        compliance  = round(float(correct / n_pairs) * 100, 2)
        check[feat] = {"compliance_pct": compliance, "violations": violations, "n_pairs": n_pairs, "constraint": mc}
        print(f"  {feat:<22}  compliance={compliance:.1f}%  violations={violations}/{n_pairs}")
    return check


# ─── 3. Baselines ─────────────────────────────────────────────────────────────

def compute_baselines(test_df, y_test, y_prob, y_pred, ganador_nombre: str) -> tuple[dict, np.ndarray, np.ndarray]:
    b1_pred  = (test_df["M500_L"] < 450).astype(int).values
    b1_score = -test_df["M500_L"].values
    avg = (test_df["M500_L"] + test_df["M500_CN"]) / 2.0
    b2_pred  = (avg < 450).astype(int).values
    b2_score = -avg.values
    baselines = {
        "regla_lectura":    _metric_pack(y_test, b1_pred,  b1_score,  "Regla: M500_L < 450 -> riesgo"),
        "regla_promedio":   _metric_pack(y_test, b2_pred,  b2_score,  "Regla: (M500_L+M500_CN)/2 < 450"),
        "clase_mayoritaria":_metric_pack(y_test, np.zeros_like(y_test), np.zeros_like(y_test, dtype=float), "Baseline: predecir siempre 'sin riesgo'"),
        "modelo_ml": {
            "descripcion": f"Modelo ML calibrado ({ganador_nombre})",
            "accuracy":  float(accuracy_score(y_test, y_pred)),
            "precision": float(precision_score(y_test, y_pred, zero_division=0)),
            "recall":    float(recall_score(y_test, y_pred, zero_division=0)),
            "f1_score":  float(f1_score(y_test, y_pred, zero_division=0)),
            "auc_roc":   float(roc_auc_score(y_test, y_prob)),
        },
    }
    return baselines, b1_pred, b1_score


# ─── 4. Subgroup metrics ──────────────────────────────────────────────────────

def compute_subgroup_metrics(test_df, y_test, y_prob) -> tuple[dict, dict, pd.DataFrame, list]:
    test_with_ise = test_df.copy()
    test_with_ise["ise_tercil"] = pd.qcut(
        test_with_ise["ise"], 3, labels=["bajo", "medio", "alto"], duplicates="drop"
    )
    top_dist = test_df["Distrito"].value_counts().head(5).index.tolist()

    group_metrics: dict = {}
    sg_lookup: dict[str, np.ndarray] = {}

    for sx in test_df["sexo"].unique():
        mask = (test_df["sexo"] == sx).values
        sg_lookup[f"sexo:{sx}"] = mask
        pack = _subgroup_pack(mask, y_test, y_prob)
        if pack:
            group_metrics[f"sexo:{sx}"] = pack

    for t in test_with_ise["ise_tercil"].dropna().unique():
        mask = (test_with_ise["ise_tercil"] == t).values
        sg_lookup[f"ise_tercil:{t}"] = mask
        pack = _subgroup_pack(mask, y_test, y_prob)
        if pack:
            group_metrics[f"ise_tercil:{t}"] = pack

    for d in top_dist:
        mask = (test_df["Distrito"] == d).values
        sg_lookup[f"distrito:{d}"] = mask
        pack = _subgroup_pack(mask, y_test, y_prob)
        if pack:
            group_metrics[f"distrito:{d}"] = pack

    return group_metrics, sg_lookup, test_with_ise, top_dist


# ─── 5. ECE / MCE / Hosmer-Lemeshow ──────────────────────────────────────────

def compute_ece_mce(y_test, y_prob) -> tuple[float, float, list, np.ndarray]:
    ece_nbins  = 10
    ece_edges  = np.linspace(0.0, 1.0, ece_nbins + 1)
    ece_acc    = 0.0
    mce_acc    = 0.0
    ece_bin_data: list[dict] = []
    for lo, hi in zip(ece_edges[:-1], ece_edges[1:]):
        in_bin = (y_prob >= lo) & (y_prob < hi)
        if in_bin.sum() == 0:
            continue
        avg_p = float(y_prob[in_bin].mean())
        avg_y = float(y_test[in_bin].mean())
        gap   = abs(avg_p - avg_y)
        w     = float(in_bin.sum()) / len(y_test)
        ece_acc += w * gap
        mce_acc  = max(mce_acc, gap)
        ece_bin_data.append({
            "bin_mid":    round((lo + hi) / 2.0, 2),
            "avg_pred":   round(avg_p, 4),
            "avg_actual": round(avg_y, 4),
            "count":      int(in_bin.sum()),
            "weight":     round(w, 4),
            "gap":        round(gap, 4),
        })
    ece = round(float(ece_acc), 6)
    mce = round(float(mce_acc), 6)
    print(f"  ECE: {ece:.4f}  MCE: {mce:.4f}  "
          f"({'bien calibrado' if ece < 0.05 else 'recalibración recomendada'})")
    return ece, mce, ece_bin_data, ece_edges


def compute_hosmer_lemeshow(y_test, y_prob) -> dict:
    n       = len(y_test)
    order   = np.argsort(y_prob)
    y_s     = y_test[order]
    p_s     = y_prob[order]
    bins    = np.array_split(np.arange(n), 10)
    chi2_stat = 0.0
    for b in bins:
        O = float(y_s[b].sum())
        E = float(p_s[b].sum())
        if E > 0:
            chi2_stat += (O - E) ** 2 / E
    df_hl   = 8
    p_val   = float(1 - chi2_dist.cdf(chi2_stat, df=df_hl))
    result  = {
        "chi2": round(float(chi2_stat), 6),
        "p_value": round(p_val, 6),
        "df":  df_hl,
        "bien_calibrado": bool(p_val > 0.05),
    }
    print(f"  Hosmer-Lemeshow: chi2={chi2_stat:.4f}  p={p_val:.4f}  "
          f"({'bien calibrado (p>0.05)' if p_val > 0.05 else 'posible descalibracion (p<=0.05)'})")
    return result


# ─── 6. Bootstrap CI ──────────────────────────────────────────────────────────

def compute_bootstrap_ci(y_test, y_prob, y_pred, rng, N_BOOT=1000) -> tuple:
    boot_auc, boot_f1, boot_brier = [], [], []
    for _ in range(N_BOOT):
        idx = rng.choice(len(y_test), size=len(y_test), replace=True)
        yt, yp = y_test[idx], y_prob[idx]
        ybin   = (yp >= 0.50).astype(int)
        if len(np.unique(yt)) < 2:
            continue
        boot_auc.append(roc_auc_score(yt, yp))
        boot_f1.append(f1_score(yt, ybin, zero_division=0))
        boot_brier.append(brier_score_loss(yt, yp))
    auc_ci   = _ci95(boot_auc)
    f1_ci    = _ci95(boot_f1)
    brier_ci = _ci95(boot_brier)
    print(f"  AUC CI95%=[{auc_ci[0]:.4f},{auc_ci[1]:.4f}]  "
          f"F1 CI95%=[{f1_ci[0]:.4f},{f1_ci[1]:.4f}]  "
          f"Brier CI95%=[{brier_ci[0]:.4f},{brier_ci[1]:.4f}]")
    return auc_ci, f1_ci, brier_ci


def compute_subgroup_bootstrap(group_metrics, sg_lookup, y_test, y_prob, rng, N_BOOT=500):
    for sg_key, sg_mask in sg_lookup.items():
        if sg_key not in group_metrics:
            continue
        yt_sg = y_test[sg_mask]
        yp_sg = y_prob[sg_mask]
        if len(yt_sg) < 15 or len(np.unique(yt_sg)) < 2:
            continue
        boot_auc_sg: list[float] = []
        boot_rec_sg: list[float] = []
        for _ in range(N_BOOT):
            idx = rng.choice(len(yt_sg), size=len(yt_sg), replace=True)
            yt_b, yp_b = yt_sg[idx], yp_sg[idx]
            if len(np.unique(yt_b)) < 2:
                continue
            boot_auc_sg.append(float(roc_auc_score(yt_b, yp_b)))
            boot_rec_sg.append(float(recall_score(yt_b, (yp_b >= 0.50).astype(int), zero_division=0)))
        if boot_auc_sg:
            group_metrics[sg_key]["auc_ci_95"]    = list(_ci95(boot_auc_sg))
            group_metrics[sg_key]["recall_ci_95"] = list(_ci95(boot_rec_sg))


def compute_ece_by_subgroup(group_metrics, sg_lookup, y_test, y_prob, ece_edges):
    for sg_key, sg_mask in sg_lookup.items():
        if sg_key not in group_metrics:
            continue
        yt_sg = y_test[sg_mask]
        yp_sg = y_prob[sg_mask]
        if len(yt_sg) < 15:
            continue
        ece_sg = 0.0
        mce_sg = 0.0
        n_sg   = len(yt_sg)
        for lo, hi in zip(ece_edges[:-1], ece_edges[1:]):
            in_b = (yp_sg >= lo) & (yp_sg < hi)
            if in_b.sum() == 0:
                continue
            avg_p = float(yp_sg[in_b].mean())
            avg_y = float(yt_sg[in_b].mean())
            gap   = abs(avg_p - avg_y)
            w     = float(in_b.sum()) / n_sg
            ece_sg += w * gap
            mce_sg  = max(mce_sg, gap)
        group_metrics[sg_key]["ece"] = round(float(ece_sg), 6)
        group_metrics[sg_key]["mce"] = round(float(mce_sg), 6)


# ─── 7. Fair thresholds ───────────────────────────────────────────────────────

def compute_fair_thresholds(test_df, y_test, y_prob) -> dict:
    fair_thresholds: dict[str, float] = {}
    for sx in test_df["sexo"].unique():
        mask  = (test_df["sexo"] == sx).values
        yt_g  = y_test[mask]
        yp_g  = y_prob[mask]
        if len(np.unique(yt_g)) < 2 or yt_g.sum() < 5:
            continue
        best_t, best_f1 = 0.50, 0.0
        for t in np.arange(0.25, 0.85, 0.01):
            yb = (yp_g >= t).astype(int)
            f  = float(f1_score(yt_g, yb, zero_division=0))
            if f > best_f1:
                best_f1, best_t = f, float(t)
        fair_thresholds[sx] = round(best_t, 2)
        print(f"  {sx:<8}  umbral optimo F1 = {best_t:.2f}  (F1={best_f1:.4f})")
    return fair_thresholds


# ─── 8. SHAP ──────────────────────────────────────────────────────────────────

def get_prep_and_base_estimators(pipe_final):
    """
    Return (prep_fitted, [base classifiers]) for the winning estimator,
    supporting both a single (prep -> clf) Pipeline and a soft-voting
    VotingClassifier ensemble whose members are each (prep -> clf) pipelines
    built from the same recipe (build_preprocessor / make_pipeline).

    In the ensemble case every member's fitted preprocessor is equivalent
    (identical ColumnTransformer fit on the same training fold), so any one
    of them can be used to transform X — we just take the first.
    """
    if isinstance(pipe_final, Pipeline):
        return pipe_final.named_steps["prep"], [pipe_final.named_steps["clf"]]
    members = list(pipe_final.named_estimators_.values())
    return members[0].named_steps["prep"], [m.named_steps["clf"] for m in members]


def compute_shap(pipe_final, X_train, feature_names, rng) -> tuple[list, dict]:
    import shap

    prep_fitted, base_clfs = get_prep_and_base_estimators(pipe_final)
    X_train_t = prep_fitted.transform(X_train)

    # Modelo único: SHAP directo. Ensemble (soft-voting LR+RF): se calcula SHAP
    # de cada miembro con el explainer adecuado a su familia (TreeExplainer
    # para modelos de árboles, Explainer genérico para modelos lineales) y se
    # promedian las magnitudes |SHAP| — dado que el ensemble promedia las
    # probabilidades de sus miembros, promediar sus contribuciones de
    # importancia es la forma estándar de explicar un voting ensemble
    # heterogéneo y produce el mismo resultado que antes cuando hay un único
    # modelo ganador.
    abs_shap_per_member = []
    tree_member = None
    for base_clf in base_clfs:
        try:
            explainer   = shap.TreeExplainer(base_clf)
            shap_values = explainer.shap_values(X_train_t)
            if isinstance(shap_values, list):
                shap_values = shap_values[1]
            tree_member = tree_member or base_clf
        except Exception:
            explainer   = shap.Explainer(base_clf, X_train_t)
            shap_values = explainer(X_train_t).values

        # Normalizar a 2D (n_muestras, n_features): algunos explainers (p.ej.
        # el genérico sobre LogisticRegression) devuelven un array por clase
        # con forma (n_muestras, n_features, n_clases) — nos quedamos con la
        # clase positiva (índice 1), igual que se hace arriba para las listas
        # de TreeExplainer, así todos los miembros quedan en la misma forma
        # antes de promediarlos.
        if np.ndim(shap_values) == 3:
            shap_values = shap_values[:, :, 1]

        abs_shap_per_member.append(np.abs(shap_values))

    shap_means      = np.mean(abs_shap_per_member, axis=0).mean(axis=0).tolist()
    shap_importance = sorted(zip(feature_names, shap_means), key=lambda x: x[1], reverse=True)

    # Interaction values (200-sample subset). Solo disponibles vía
    # TreeExplainer — se usa el primer miembro basado en árboles del ensemble
    # (o el modelo ganador si no es un ensemble).
    shap_interactions: dict = {}
    base_clf_for_inter = tree_member or base_clfs[0]
    try:
        tree_exp = shap.TreeExplainer(base_clf_for_inter)
        sample_idx = rng.choice(len(X_train_t), size=min(200, len(X_train_t)), replace=False)
        X_sample   = X_train_t[sample_idx]
        shap_inter = tree_exp.shap_interaction_values(X_sample)
        if isinstance(shap_inter, list):
            shap_inter = shap_inter[1]
        inter_mean = np.abs(shap_inter).mean(axis=0)
        shap_interactions = {
            "matrix":   [[round(float(v), 6) for v in row] for row in inter_mean.tolist()],
            "features": list(feature_names),
        }
        print(f"  SHAP interactions: {inter_mean.shape[0]}x{inter_mean.shape[1]}")
    except Exception as e:
        print(f"  SHAP interactions no disponibles: {e}")
        shap_interactions = {"error": str(e), "matrix": [], "features": list(feature_names)}

    return list(shap_importance), shap_interactions, shap_means, X_train_t


# ─── 9. PDP ───────────────────────────────────────────────────────────────────

def compute_pdp(calibrated, X_test, shap_importance: list) -> list[dict]:
    from sklearn.inspection import partial_dependence
    top3 = [feat for feat, _ in shap_importance[:3]]
    pdp_data: list[dict] = []
    for feat in top3:
        if feat not in ALL_FEATURES:
            continue
        feat_idx = ALL_FEATURES.index(feat)
        try:
            result = partial_dependence(
                calibrated, X_test, features=[feat_idx],
                grid_resolution=50, kind="average",
            )
            pdp_data.append({
                "feature":  feat,
                "grid":     [round(float(v), 6) for v in result["grid_values"][0].tolist()],
                "avg_pred": [round(float(v), 6) for v in result["average"][0].tolist()],
            })
        except Exception as e:
            print(f"  PDP falló para {feat}: {e}")
    return pdp_data


# ─── 10. Correlation matrix ───────────────────────────────────────────────────

def compute_correlation_matrix(train_df) -> dict:
    num_features = [f for f in ALL_FEATURES if f not in FEATURES_CAT]
    corr_df      = train_df[num_features].corr(method="pearson")
    high_corr: list[dict] = []
    for i, fi in enumerate(num_features):
        for j, fj in enumerate(num_features):
            if j <= i:
                continue
            r = float(corr_df.iloc[i, j])
            if abs(r) > 0.70:
                high_corr.append({"f1": fi, "f2": fj, "r": round(r, 4)})
    result = {
        "features":        num_features,
        "matrix":          [[round(float(v), 4) for v in row] for row in corr_df.values.tolist()],
        "high_corr_pairs": high_corr,
    }
    print(f"  Pares con |r|>0.70: {len(high_corr)}")
    return result


# ─── 11. Feature ablation ─────────────────────────────────────────────────────

def run_feature_ablation(candidatos, ganador_nombre, train_df, g_train) -> list[dict]:
    cv_abl   = GroupKFold(n_splits=5)
    base_auc = float(
        cross_validate(
            candidatos[ganador_nombre], train_df[ALL_FEATURES], train_df[TARGET].values,
            cv=cv_abl, groups=g_train, scoring="roc_auc", n_jobs=-1,
        )["test_score"].mean()
    )
    results: list[dict] = []
    for feat_drop in ALL_FEATURES:
        cols_keep = [f for f in ALL_FEATURES if f != feat_drop]
        X_abl     = train_df[cols_keep]
        g_abl     = train_df[GROUP_COL].values
        y_abl     = train_df[TARGET].values
        cat_abl   = [f for f in FEATURES_CAT     if f != feat_drop]
        num_abl   = [f for f in (FEATURES_NUM + FEATURES_IE + FEATURES_DERIVED) if f != feat_drop]
        prep_abl  = ColumnTransformer(
            transformers=[
                ("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), cat_abl),
                ("num", StandardScaler(), num_abl),
            ], remainder="drop",
        )
        pipe_abl  = Pipeline([
            ("prep", prep_abl),
            ("clf",  LGBMClassifier(n_estimators=200, max_depth=5, random_state=SEED, verbosity=-1)),
        ])
        try:
            auc_abl = float(
                cross_validate(pipe_abl, X_abl, y_abl, cv=cv_abl, groups=g_abl,
                               scoring="roc_auc", n_jobs=-1)["test_score"].mean()
            )
        except Exception:
            auc_abl = float("nan")
        delta = round(auc_abl - base_auc, 4)
        results.append({"feature": feat_drop, "auc_without": round(auc_abl, 4), "delta_auc": delta})
        print(f"  Sin {feat_drop:<25}  AUC={auc_abl:.4f}  Δ={delta:+.4f}")
    results.sort(key=lambda x: x["delta_auc"])
    return results


# ─── 12. PR-AUC ───────────────────────────────────────────────────────────────

def compute_pr_auc(y_test, y_prob) -> tuple:
    pr_auc    = float(average_precision_score(y_test, y_prob))
    pr_prec, pr_rec, _ = precision_recall_curve(y_test, y_prob)
    pr_baseline = float(y_test.mean())
    print(f"  PR-AUC: {pr_auc:.4f}  (baseline aleatorio={pr_baseline:.4f}  mejora={pr_auc-pr_baseline:+.4f})")
    return pr_auc, pr_prec, pr_rec, pr_baseline


# ─── 13. Permutation importance ───────────────────────────────────────────────

def compute_permutation_importance(calibrated, X_test, y_test, feature_names) -> list:
    result = perm_imp_fn(calibrated, X_test, y_test, n_repeats=20, random_state=SEED,
                         scoring="roc_auc", n_jobs=-1)
    perm = sorted(
        zip(feature_names, result.importances_mean.tolist(), result.importances_std.tolist()),
        key=lambda x: x[1], reverse=True,
    )
    for feat, mean_i, std_i in perm:
        print(f"  {feat:<22} {mean_i:+.4f}  ±{std_i:.4f}")
    return [{"feature": f, "mean": m, "std": s} for f, m, s in perm]


# ─── 14. Statistical tests ────────────────────────────────────────────────────

def run_statistical_tests(y_test, y_pred, y_prob, b1_pred, b1_score, rng) -> tuple:
    # McNemar
    ml_correct   = (y_pred == y_test).astype(int)
    base_correct = (b1_pred == y_test).astype(int)
    b = int(((ml_correct == 1) & (base_correct == 0)).sum())
    c = int(((ml_correct == 0) & (base_correct == 1)).sum())
    if b + c > 0:
        chi2_val = (abs(b - c) - 1) ** 2 / (b + c)
        mc_p     = float(1 - chi2_dist.cdf(chi2_val, df=1))
    else:
        chi2_val, mc_p = 0.0, 1.0
    mcnemar = {"b": b, "c": c, "chi2": chi2_val, "p_value": mc_p, "significativo": mc_p < 0.05}
    print(f"  McNemar: b={b}  c={c}  chi2={chi2_val:.4f}  p={mc_p:.4f}  "
          f"{'** significativo **' if mc_p < 0.05 else '(no significativo)'}")

    # DeLong bootstrap (2 000 iter)
    ml_auc  = float(roc_auc_score(y_test, y_prob))
    bl_auc  = float(roc_auc_score(y_test, b1_score))
    boot_diff: list[float] = []
    for _ in range(2000):
        idx = rng.choice(len(y_test), size=len(y_test), replace=True)
        if len(np.unique(y_test[idx])) < 2:
            continue
        boot_diff.append(
            float(roc_auc_score(y_test[idx], y_prob[idx])) -
            float(roc_auc_score(y_test[idx], b1_score[idx]))
        )
    dl_p   = float(np.mean(np.array(boot_diff) <= 0))
    dl_ci  = _ci95(sorted(boot_diff))
    delong = {
        "delta_auc": ml_auc - bl_auc,
        "ci_95":     list(dl_ci),
        "p_value":   dl_p,
        "significativo": dl_p < 0.05,
        "ml_auc":    ml_auc,
        "baseline_auc": bl_auc,
    }
    print(f"  DeLong: ΔAUC={ml_auc-bl_auc:+.4f}  IC95%={dl_ci}  p={dl_p:.4f}")
    return mcnemar, delong


# ─── 15. Learning curve ───────────────────────────────────────────────────────

def compute_learning_curve(candidatos, ganador_nombre, X_train, y_train, g_train, cv) -> dict:
    lc_sizes, lc_train_sc, lc_val_sc = lc_fn(
        candidatos[ganador_nombre], X_train, y_train,
        cv=cv, groups=g_train, scoring="roc_auc",
        train_sizes=np.linspace(0.10, 1.0, 8), n_jobs=-1,
    )
    data = {
        "train_sizes":    lc_sizes.tolist(),
        "train_auc_mean": lc_train_sc.mean(axis=1).tolist(),
        "train_auc_std":  lc_train_sc.std(axis=1).tolist(),
        "val_auc_mean":   lc_val_sc.mean(axis=1).tolist(),
        "val_auc_std":    lc_val_sc.std(axis=1).tolist(),
    }
    for sz, tm, vm in zip(data["train_sizes"], data["train_auc_mean"], data["val_auc_mean"]):
        print(f"  n={int(sz):<5}  train={tm:.4f}  val={vm:.4f}  gap={tm-vm:+.4f}")
    return data


# ─── 16. Threshold policies ───────────────────────────────────────────────────

def compute_policies(y_test, y_prob) -> dict:
    # Max recall
    best_t_rec, best_rec = 0.50, 0.0
    for t in np.arange(0.05, 0.85, 0.01):
        r = float(recall_score(y_test, (y_prob >= t).astype(int), zero_division=0))
        if r > best_rec:
            best_rec, best_t_rec = r, float(t)
    yb1 = (y_prob >= best_t_rec).astype(int)
    # Max precision
    best_t_prec, best_prec = 0.50, 0.0
    for t in np.arange(0.05, 0.90, 0.01):
        yb = (y_prob >= t).astype(int)
        p  = float(precision_score(y_test, yb, zero_division=0))
        if int(yb.sum()) > 5 and p > best_prec:
            best_prec, best_t_prec = p, float(t)
    yb2 = (y_prob >= best_t_prec).astype(int)
    # Min asymmetric cost (FN=5×FP)
    best_t_cost, best_cost = 0.50, float("inf")
    for t in np.arange(0.05, 0.85, 0.01):
        yb = (y_prob >= t).astype(int)
        fn = int(((yb == 0) & (y_test == 1)).sum())
        fp = int(((yb == 1) & (y_test == 0)).sum())
        c  = fn * 5 + fp * 1
        if c < best_cost:
            best_cost, best_t_cost = float(c), float(t)
    yb3 = (y_prob >= best_t_cost).astype(int)
    return {
        "max_recall":    {"threshold": round(best_t_rec, 2),  "recall": float(recall_score(y_test, yb1, zero_division=0)),    "precision": float(precision_score(y_test, yb1, zero_division=0)),    "f1": float(f1_score(y_test, yb1, zero_division=0)),    "descripcion": "Maximizar Recall: no perder ningún caso real de riesgo"},
        "max_precision": {"threshold": round(best_t_prec, 2), "recall": float(recall_score(y_test, yb2, zero_division=0)),    "precision": float(precision_score(y_test, yb2, zero_division=0)),    "f1": float(f1_score(y_test, yb2, zero_division=0)),    "descripcion": "Maximizar Precision: reducir falsas alarmas"},
        "min_cost":      {"threshold": round(best_t_cost, 2), "recall": float(recall_score(y_test, yb3, zero_division=0)),    "precision": float(precision_score(y_test, yb3, zero_division=0)),    "f1": float(f1_score(y_test, yb3, zero_division=0)),    "total_cost": int(best_cost), "fn_weight": 5, "fp_weight": 1, "descripcion": "Costo asimétrico FN=5×FP"},
    }


# ─── 17. DCA ──────────────────────────────────────────────────────────────────

def compute_dca(y_test, y_prob) -> dict:
    thresholds     = np.arange(0.05, 0.81, 0.01)
    n              = len(y_test)
    prev           = float(y_test.mean())
    nb_model, nb_all = [], []
    for t in thresholds:
        yb   = (y_prob >= t).astype(int)
        tp_  = float(((yb == 1) & (y_test == 1)).sum())
        fp_  = float(((yb == 1) & (y_test == 0)).sum())
        nb_model.append(round(tp_ / n - (fp_ / n) * (t / (1 - t)), 6))
        nb_all.append(round(prev - (1 - prev) * (t / (1 - t)), 6))
    return {
        "thresholds":        [round(float(t), 3) for t in thresholds.tolist()],
        "net_benefit_model": nb_model,
        "net_benefit_all":   nb_all,
        "net_benefit_none":  [0.0] * len(thresholds),
    }


# ─── 18. Error analysis ───────────────────────────────────────────────────────

def run_error_analysis(test_df, y_pred, y_test, y_prob) -> dict:
    fn_mask = (y_pred == 0) & (y_test == 1)
    fp_mask = (y_pred == 1) & (y_test == 0)
    fn_df   = test_df[fn_mask].copy()
    fn_df["y_prob"] = y_prob[fn_mask]
    fn_df   = fn_df.sort_values("y_prob", ascending=False).head(20)
    fp_df   = test_df[fp_mask].copy()
    fp_df["y_prob"] = y_prob[fp_mask]
    fp_df   = fp_df.sort_values("y_prob", ascending=True).head(20)
    return {
        "total_fn":         int(fn_mask.sum()),
        "total_fp":         int(fp_mask.sum()),
        "fn_mean_lectura":  float(fn_df["M500_L"].mean())  if len(fn_df) > 0 else 0.0,
        "fn_mean_ciencias": float(fn_df["M500_CN"].mean()) if len(fn_df) > 0 else 0.0,
        "fn_mean_ise":      float(fn_df["ise"].mean())     if len(fn_df) > 0 else 0.0,
        "fn_mean_prob":     float(fn_df["y_prob"].mean())  if len(fn_df) > 0 else 0.0,
        "fp_mean_lectura":  float(fp_df["M500_L"].mean())  if len(fp_df) > 0 else 0.0,
        "fp_mean_ciencias": float(fp_df["M500_CN"].mean()) if len(fp_df) > 0 else 0.0,
        "fp_mean_ise":      float(fp_df["ise"].mean())     if len(fp_df) > 0 else 0.0,
        "fp_mean_prob":     float(fp_df["y_prob"].mean())  if len(fp_df) > 0 else 0.0,
        "fn_sexo":          fn_df["sexo"].value_counts().to_dict() if len(fn_df) > 0 else {},
        "fp_sexo":          fp_df["sexo"].value_counts().to_dict() if len(fp_df) > 0 else {},
    }


# ─── 19. Drift baseline ───────────────────────────────────────────────────────

def compute_drift_baseline(train_df) -> dict:
    drift: dict = {}
    for feat in FEATURES_NUM + FEATURES_IE:
        drift[feat] = {
            "mean": float(train_df[feat].mean()),
            "std":  float(train_df[feat].std()),
            "min":  float(train_df[feat].min()),
            "max":  float(train_df[feat].max()),
            "p25":  float(train_df[feat].quantile(0.25)),
            "p50":  float(train_df[feat].quantile(0.50)),
            "p75":  float(train_df[feat].quantile(0.75)),
        }
    return drift
