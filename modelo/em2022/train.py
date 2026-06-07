"""
Entrenamiento del modelo de riesgo académico — EM 2022, Lima Metropolitana, gestión privada.
Proyecto P20261012.

Pipeline:
  1. Carga del dataset limpio (em_2022_lima_privado.csv)
  2. Feature engineering con agregados por IE (colegio)
  3. Split train / test respetando grupos de IE (no mezcla alumnos del mismo colegio)
  4. Comparativa de modelos con GroupKFold(5) + Nested CV + GridSearch + Stacking
  5. AutoML (FLAML) + Bayesian tuning (Optuna)
  6. Entrenamiento del modelo ganador con calibración isotónica
  7. Evaluación final completa + SHAP + interpretabilidad
  8. Exportación de artefactos (.pkl)

Genera:
  model/modelo_em.pkl       — modelo calibrado final
  model/preprocessor_em.pkl — pipeline de preprocesamiento
  model/metricas_em.pkl     — métricas, SHAP, importancias, configuración
"""

import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold, GroupShuffleSplit

from em2022.pipeline.config import (
    SEED, DATASET, MODEL_DIR,
    TARGET, GROUP_COL, ALL_FEATURES,
    MONOTONIC_CONSTRAINTS,
)
from em2022.pipeline.preprocessing import add_ie_features
from em2022.pipeline.training import (
    build_candidates,
    run_cv_comparison,
    run_nested_cv,
    run_gridsearch,
    run_stacking,
    fit_final_model,
    run_stability_analysis,
    compute_cv_metrics,
)
from em2022.pipeline.automl import run_flaml, run_optuna
from em2022.pipeline.evaluation import (
    get_prep_and_base_estimators,
    compute_final_metrics,
    compute_monotonicity_check,
    compute_baselines,
    compute_subgroup_metrics,
    compute_ece_mce,
    compute_hosmer_lemeshow,
    compute_bootstrap_ci,
    compute_subgroup_bootstrap,
    compute_ece_by_subgroup,
    compute_fair_thresholds,
    compute_shap,
    compute_pdp,
    compute_correlation_matrix,
    run_feature_ablation,
    compute_pr_auc,
    compute_permutation_importance,
    run_statistical_tests,
    compute_learning_curve,
    compute_policies,
    compute_dca,
    run_error_analysis,
    compute_drift_baseline,
)
from em2022.pipeline.artifacts import build_metricas, save_artifacts


def main() -> None:
    MODEL_DIR.mkdir(exist_ok=True)
    np.random.seed(SEED)
    rng = np.random.default_rng(SEED)

    # ── 1. Carga ──────────────────────────────────────────────────────────────
    print(f"\nCargando {DATASET}...")
    df = pd.read_csv(DATASET)
    for col in ["M500_L", "M500_CN", "M500_M", "ise"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=["M500_L", "M500_CN", "ise"])
    print(f"  {len(df):,} estudiantes | {df[GROUP_COL].nunique()} IEs | "
          f"{df['Distrito'].nunique()} distritos")
    print(f"  Riesgo Mat: {df[TARGET].mean()*100:.1f}% positivos")
    dataset_source = str(DATASET)
    dataset_rows   = len(df)

    # ── 2. Split train / test por IE ─────────────────────────────────────────
    gss = GroupShuffleSplit(n_splits=1, test_size=0.20, random_state=SEED)
    train_idx, test_idx = next(gss.split(df, df[TARGET], groups=df[GROUP_COL]))
    train_raw = df.iloc[train_idx].copy()
    test_raw  = df.iloc[test_idx].copy()
    print(f"\n  Train: {len(train_raw):,} alumnos | {train_raw[GROUP_COL].nunique()} IEs")
    print(f"  Test:  {len(test_raw):,} alumnos  | {test_raw[GROUP_COL].nunique()} IEs")

    # ── 3. Feature engineering (agregados calculados solo desde train) ────────
    train_df = add_ie_features(train_raw, train_raw)
    test_df  = add_ie_features(train_raw, test_raw)

    X_train = train_df[ALL_FEATURES]
    y_train = train_df[TARGET].values
    g_train = train_df[GROUP_COL].values

    X_test  = test_df[ALL_FEATURES]
    y_test  = test_df[TARGET].values

    print("\n  Monotonic constraints aplicadas:")
    for feat, c in zip(ALL_FEATURES, MONOTONIC_CONSTRAINTS):
        marca = ("feature sube => riesgo baja" if c == -1
                 else ("feature sube => riesgo sube" if c == 1 else "sin restriccion"))
        print(f"    {feat:<22} {c:>+d}   ({marca})")

    # ── 4. Comparativa de modelos (GroupKFold-5) ──────────────────────────────
    cv = GroupKFold(n_splits=5)
    candidatos = build_candidates(y_train)

    print("\n" + "=" * 65)
    print("  COMPARATIVA DE MODELOS — GroupKFold(5) sobre train")
    print(f"  {'Modelo':<22} {'AUC':>10} {'+-':>6} {'F1':>10} {'+-':>6}")
    print("  " + "-" * 55)
    resultados = run_cv_comparison(candidatos, X_train, y_train, g_train, cv)

    ganador_nombre = max(resultados, key=lambda k: resultados[k]["auc_mean"])
    sorted_cands   = sorted(resultados.items(), key=lambda x: x[1]["auc_mean"], reverse=True)
    top2_nombres   = [k for k, _ in sorted_cands[:2]]
    print(f"\n  >> Ganador preliminar: {ganador_nombre}")
    print(f"  >> Top-2 para GridSearchCV: {top2_nombres}")

    # ── 5. Nested CV ──────────────────────────────────────────────────────────
    print("\n" + "=" * 65)
    print("  NESTED CROSS-VALIDATION — estimación de AUC no sesgada")
    print("=" * 65)
    nested_cv = run_nested_cv(candidatos, ganador_nombre, resultados, X_train, y_train, g_train)

    # ── 6. GridSearchCV ───────────────────────────────────────────────────────
    print("\n" + "=" * 65)
    print("  GRIDSEARCHCV — ajuste de hiperparametros (top-2 modelos)")
    print("=" * 65)
    grid_resultados = run_gridsearch(candidatos, top2_nombres, X_train, y_train, g_train, cv)
    for nombre in top2_nombres:
        if nombre in grid_resultados:
            resultados[nombre]["auc_mean_grid"] = grid_resultados[nombre]["best_auc_cv"]
    ganador_nombre = max(
        resultados,
        key=lambda k: resultados[k].get("auc_mean_grid", resultados[k]["auc_mean"]),
    )
    print(f"\n  >> Ganador final (post-GridSearch): {ganador_nombre}")

    # ── 7. Stacking ───────────────────────────────────────────────────────────
    print("\n" + "=" * 65)
    print("  STACKING ENSEMBLE — soft-voting sobre top-2 modelos")
    print("=" * 65)
    stacking_result, ganador_nombre = run_stacking(
        candidatos, top2_nombres, X_train, y_train, g_train, cv, resultados, ganador_nombre
    )

    # ── 8. FLAML AutoML ───────────────────────────────────────────────────────
    automl_result = run_flaml(X_train, y_train)

    # ── 9. Optuna Bayesian tuning ─────────────────────────────────────────────
    optuna_result = run_optuna(candidatos, ganador_nombre, X_train, y_train, g_train)

    # ── 10. Entrenamiento final + calibración isotónica ───────────────────────
    print("\n" + "=" * 65)
    print(f"  ENTRENAMIENTO FINAL — {ganador_nombre}")
    print("=" * 65)
    pipe_final, calibrated = fit_final_model(candidatos, ganador_nombre, X_train, y_train,
                                              g_train=g_train)
    # El ganador puede ser un Pipeline único (prep -> clf) o un VotingClassifier
    # (Ensemble LR+RF); get_prep_and_base_estimators maneja ambos casos.
    prep_fitted, _base_clfs_final = get_prep_and_base_estimators(pipe_final)

    # ── 11. Stability analysis (10 seeds) ────────────────────────────────────
    print("\n" + "=" * 65)
    print("  ESTABILIDAD — 10 semillas aleatorias")
    print("=" * 65)
    stability = run_stability_analysis(df, candidatos, ganador_nombre, X_train, y_train)

    # ── 11b. Métricas de validación cruzada (comparables entre datasets) ──────
    print("\n" + "=" * 65)
    print("  MÉTRICAS CV — Precision/Recall/F1/Accuracy out-of-fold (GroupKFold por IE)")
    print("=" * 65)
    cv_metrics = compute_cv_metrics(candidatos[ganador_nombre], X_train, y_train, g_train, cv)

    # ── 12. Evaluación final ──────────────────────────────────────────────────
    print("\n" + "=" * 65)
    print("  EVALUACIÓN FINAL — conjunto de test")
    print("=" * 65)
    (y_prob, y_pred, fpr, tpr, brier,
     _cal_true_q, _cal_pred_q,
     cal_true_unif, cal_pred_unif,
     metrics_test) = compute_final_metrics(calibrated, X_test, y_test)

    print(f"  AUC      : {metrics_test['auc_roc']:.4f}")
    print(f"  F1       : {metrics_test['f1_score']:.4f}")
    print(f"  Precisión: {metrics_test['precision']:.4f}")
    print(f"  Recall   : {metrics_test['recall']:.4f}")
    print(f"  Brier    : {brier:.4f}")

    monotonicity_check = compute_monotonicity_check(test_df, y_prob, MONOTONIC_CONSTRAINTS)
    baselines, b1_pred, b1_score = compute_baselines(test_df, y_test, y_prob, y_pred, ganador_nombre)
    group_metrics, sg_lookup, test_with_ise, top_dist = compute_subgroup_metrics(
        test_df, y_test, y_prob
    )
    ece, mce, ece_bin_data, ece_edges = compute_ece_mce(y_test, y_prob)
    hosmer_lemeshow = compute_hosmer_lemeshow(y_test, y_prob)
    auc_ci, f1_ci, brier_ci = compute_bootstrap_ci(y_test, y_prob, y_pred, rng)
    compute_subgroup_bootstrap(group_metrics, sg_lookup, y_test, y_prob, rng)
    compute_ece_by_subgroup(group_metrics, sg_lookup, y_test, y_prob, ece_edges)
    fair_thresholds = compute_fair_thresholds(test_df, y_test, y_prob)

    feature_names = ALL_FEATURES
    shap_importance, shap_interactions, shap_means, _ = compute_shap(
        pipe_final, X_train, feature_names, rng
    )
    pdp_data = compute_pdp(calibrated, X_test, shap_importance)

    feature_corr_matrix = compute_correlation_matrix(train_df)
    ablation_results    = run_feature_ablation(candidatos, ganador_nombre, train_df, g_train)
    pr_auc, pr_prec_arr, pr_rec_arr, pr_baseline = compute_pr_auc(y_test, y_prob)
    perm_importance = compute_permutation_importance(calibrated, X_test, y_test, feature_names)
    mcnemar, delong  = run_statistical_tests(y_test, y_pred, y_prob, b1_pred, b1_score, rng)
    learning_curve_data = compute_learning_curve(candidatos, ganador_nombre, X_train, y_train, g_train, cv)
    policies    = compute_policies(y_test, y_prob)
    dca_curve   = compute_dca(y_test, y_prob)
    error_analysis = run_error_analysis(test_df, y_pred, y_test, y_prob)
    drift_baseline = compute_drift_baseline(train_df)

    # ── 13. Ensamblar métricas y guardar artefactos ───────────────────────────
    metricas = build_metricas(
        metrics_test        = metrics_test,
        auc_ci              = auc_ci,
        f1_ci               = f1_ci,
        brier_ci            = brier_ci,
        fair_thresholds     = fair_thresholds,
        grid_resultados     = grid_resultados,
        resultados          = resultados,
        ganador_nombre      = ganador_nombre,
        shap_importance     = shap_importance,
        shap_means          = shap_means,
        feature_names       = feature_names,
        baselines           = baselines,
        group_metrics       = group_metrics,
        drift_baseline      = drift_baseline,
        y_test              = y_test,
        y_prob              = y_prob,
        monotonicity_check  = monotonicity_check,
        pr_auc              = pr_auc,
        pr_baseline         = pr_baseline,
        pr_prec_arr         = pr_prec_arr,
        pr_rec_arr          = pr_rec_arr,
        perm_importance     = perm_importance,
        mcnemar             = mcnemar,
        delong              = delong,
        learning_curve_data = learning_curve_data,
        policies            = policies,
        error_analysis      = error_analysis,
        stacking_result     = stacking_result,
        optuna_result       = optuna_result,
        ece                 = ece,
        mce                 = mce,
        ece_bin_data        = ece_bin_data,
        feature_corr_matrix = feature_corr_matrix,
        ablation_results    = ablation_results,
        hosmer_lemeshow     = hosmer_lemeshow,
        dca_curve           = dca_curve,
        nested_cv           = nested_cv,
        cv_metrics          = cv_metrics,
        shap_interactions   = shap_interactions,
        pdp_data            = pdp_data,
        stability           = stability,
        automl_result       = automl_result,
        cal_true_unif       = cal_true_unif,
        cal_pred_unif       = cal_pred_unif,
        dataset_source      = dataset_source,
        dataset_rows        = dataset_rows,
        train_rows          = len(train_df),
        test_rows           = len(test_df),
        train_ies           = int(train_df[GROUP_COL].nunique()),
        test_ies            = int(test_df[GROUP_COL].nunique()),
        log_loss_val        = float(metrics_test.get("log_loss", 0.0)),
        mcc_val             = float(metrics_test.get("mcc", 0.0)),
        specificity_val     = float(metrics_test.get("specificity", 0.0)),
    )

    save_artifacts(calibrated, prep_fitted, metricas)


if __name__ == "__main__":
    main()
