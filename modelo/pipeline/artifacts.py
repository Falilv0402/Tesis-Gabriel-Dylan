"""
artifacts.py — Assemble the metricas dict and persist all three artefacts.
"""
import joblib
import pandas as pd

from .config import MODEL_PATH, PREP_PATH, METR_PATH, ALL_FEATURES, MONOTONIC_CONSTRAINTS


def build_metricas(
    *,
    metrics_test:       dict,
    auc_ci:             tuple,
    f1_ci:              tuple,
    brier_ci:           tuple,
    fair_thresholds:    dict,
    grid_resultados:    dict,
    resultados:         dict,
    ganador_nombre:     str,
    shap_importance:    list,
    shap_means:         list,
    feature_names:      list,
    baselines:          dict,
    group_metrics:      dict,
    drift_baseline:     dict,
    y_test,
    y_prob,
    monotonicity_check: dict,
    pr_auc:             float,
    pr_baseline:        float,
    pr_prec_arr,
    pr_rec_arr,
    perm_importance:    list,
    mcnemar:            dict,
    delong:             dict,
    learning_curve_data:dict,
    policies:           dict,
    error_analysis:     dict,
    stacking_result:    dict,
    optuna_result:      dict,
    ece:                float,
    mce:                float,
    ece_bin_data:       list,
    feature_corr_matrix:dict,
    ablation_results:   list,
    hosmer_lemeshow:    dict,
    dca_curve:          dict,
    nested_cv:          dict,
    shap_interactions:  dict,
    pdp_data:           list,
    stability:          dict,
    automl_result:      dict,
    cal_true_unif,
    cal_pred_unif,
    dataset_source:     str,
    dataset_rows:       int,
    train_rows:         int,
    test_rows:          int,
    train_ies:          int,
    test_ies:           int,
    log_loss_val:       float,
    mcc_val:            float,
    specificity_val:    float,
) -> dict:
    return {
        **metrics_test,
        # bootstrap ICs
        "auc_ci_95":   list(auc_ci),
        "f1_ci_95":    list(f1_ci),
        "brier_ci_95": list(brier_ci),
        # fairness
        "fair_thresholds": fair_thresholds,
        # grid search
        "grid_resultados": grid_resultados,
        # CV results
        "cv_comparativa":  resultados,
        "modelo_ganador":  ganador_nombre,
        # SHAP
        "shap_importance":  [{"feature": f, "shap_mean": v} for f, v in shap_importance],
        "feature_importances": shap_means,
        "features":         feature_names,
        # baselines
        "baselines":        baselines,
        # subgroup fairness
        "group_metrics":    group_metrics,
        # drift
        "drift_baseline":   drift_baseline,
        # test arrays for live threshold tuning
        "test_arrays":      {"y_true": y_test.tolist(), "y_prob": y_prob.tolist()},
        # monotonic constraints
        "monotonic_constraints": dict(zip(ALL_FEATURES, MONOTONIC_CONSTRAINTS)),
        # PR-AUC
        "pr_auc":             pr_auc,
        "pr_baseline":        pr_baseline,
        "pr_curve_precision": pr_prec_arr.tolist(),
        "pr_curve_recall":    pr_rec_arr.tolist(),
        # permutation importance
        "perm_importance": perm_importance,
        # statistical tests
        "mcnemar": mcnemar,
        "delong":  delong,
        # learning curve
        "learning_curve": learning_curve_data,
        # multi-objective policies
        "policies": policies,
        # error analysis
        "error_analysis": error_analysis,
        # extra metrics
        "log_loss":    log_loss_val,
        "mcc":         mcc_val,
        "specificity": specificity_val,
        # calibration
        "ece":          ece,
        "mce":          mce,
        "ece_bin_data": ece_bin_data,
        # feature correlation
        "feature_corr_matrix": feature_corr_matrix,
        # ablation
        "ablation_results": ablation_results,
        # stacking / optuna
        "stacking_result": stacking_result,
        "optuna_result":   optuna_result,
        # calibration formal tests
        "hosmer_lemeshow": hosmer_lemeshow,
        # DCA
        "dca_curve": dca_curve,
        # nested CV
        "nested_cv": nested_cv,
        # SHAP advanced
        "shap_interactions": shap_interactions,
        "pdp_data":          pdp_data,
        # monotonicity verification
        "monotonicity_check": monotonicity_check,
        # stability
        "stability": stability,
        # AutoML
        "automl_result": automl_result,
        # calibration uniform bins
        "calibration_prob_true_uniform": cal_true_unif.tolist(),
        "calibration_prob_pred_uniform": cal_pred_unif.tolist(),
        # meta
        "trained_at":      pd.Timestamp.now().isoformat(timespec="seconds"),
        "dataset_source":  dataset_source,
        "dataset_rows":    dataset_rows,
        "train_rows":      train_rows,
        "test_rows":       test_rows,
        "train_ies":       train_ies,
        "test_ies":        test_ies,
        "target_definition": "riesgo_matematica = 1 si grupo_M en {Previo al Inicio, En inicio}",
        "scope":           "Lima Metropolitana — gestión no estatal (privada) — 2S EM 2022",
    }


def save_artifacts(calibrated, prep_fitted, metricas: dict) -> None:
    joblib.dump(calibrated,  MODEL_PATH)
    joblib.dump(prep_fitted, PREP_PATH)
    joblib.dump(metricas,    METR_PATH)
    print(f"\nModelo guardado      -> {MODEL_PATH}")
    print(f"Preprocesador        -> {PREP_PATH}")
    print(f"Metricas guardadas   -> {METR_PATH}")
    print("\nListo.")
