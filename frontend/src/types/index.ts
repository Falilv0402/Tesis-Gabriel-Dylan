// ── Core domain types ────────────────────────────────────────────────────────
export type RiskLevel = "ALTO" | "MEDIO" | "BAJO";
export type UserRole  = "superadmin" | "admin" | "director" | "coordinador";

export type Student = {
  id: string;
  id_ie?: string;
  sexo: string;
  ise: number;
  distrito: string;
  M500_L: number;
  M500_CN: number;
  M500_L_iemean?: number;
  M500_CN_iemean?: number;
  ise_iemean?: number;
  M500_M?: number;
  grupo_m_real?: string;
  probabilidad_riesgo: number;
  nivel_riesgo: RiskLevel;
  tipo_riesgo: string;
  periodo: string;
};

export type Metrics = {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  auc_roc?: number;
  brier_score?: number;
  auc_ci_95?: [number, number];
  f1_ci_95?: [number, number];
  brier_ci_95?: [number, number];
  pr_auc?: number;
  pr_baseline?: number;
  modelo_ganador?: string;
  trained_at?: string;
  train_rows?: number;
  test_rows?: number;
  scope?: string;
};

export type Importance = { feature: string; importancia: number };

export type Evaluation = {
  confusion_matrix?: number[][];
  roc_fpr?: number[];
  roc_tpr?: number[];
  cv_comparativa?: Record<string, { auc_mean: number; auc_std: number; f1_mean: number; f1_std: number }>;
  calibration_prob_true?: number[];
  calibration_prob_pred?: number[];
  brier_score?: number;
};

export type DatasetSummary = {
  total: number;
  risk_counts: Record<"ALTO" | "MEDIO" | "BAJO", number>;
  facets: Record<string, Record<string, number>>;
};

export type BaselineMetric = {
  descripcion: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  auc_roc: number;
};

export type GroupMetric = {
  n: number;
  tasa_real: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  auc_roc: number;
  auc_ci_95?: [number, number];
  recall_ci_95?: [number, number];
};

export type DriftFeature = {
  current_mean: number;
  current_std: number;
  baseline_mean: number;
  baseline_std: number;
  rel_shift: number;
  alerta: "ok" | "media" | "alta";
};

export type PermImportanceItem = { feature: string; mean: number; std: number };

export type LearningCurveData = {
  train_sizes: number[];
  train_auc_mean: number[];
  train_auc_std: number[];
  val_auc_mean: number[];
  val_auc_std: number[];
};

export type PolicyItem = {
  threshold: number;
  recall: number;
  precision: number;
  f1: number;
  descripcion: string;
  total_cost?: number;
  fn_weight?: number;
  fp_weight?: number;
};

export type McNemar = {
  b: number;
  c: number;
  chi2: number;
  p_value: number;
  significativo: boolean;
};

export type DeLong = {
  delta_auc: number;
  ci_95: [number, number];
  p_value: number;
  significativo: boolean;
  ml_auc: number;
  baseline_auc: number;
};

export type ErrorAnalysis = {
  total_fn: number;
  total_fp: number;
  fn_mean_lectura: number;
  fn_mean_ciencias: number;
  fn_mean_ise: number;
  fn_mean_prob: number;
  fp_mean_lectura: number;
  fp_mean_ciencias: number;
  fp_mean_ise: number;
  fp_mean_prob: number;
  fn_sexo: Record<string, number>;
  fp_sexo: Record<string, number>;
};

export type Diagnostico = {
  baselines: Record<string, BaselineMetric>;
  group_metrics: Record<string, GroupMetric>;
  monotonic_constraints: Record<string, number>;
  drift_baseline: Record<string, { mean: number; std: number; min: number; max: number; p25: number; p50: number; p75: number }>;
  drift_actual: Record<string, DriftFeature>;
  test_arrays: { y_true: number[]; y_prob: number[] };
  target_definition: string;
  auc_ci_95?: [number, number] | null;
  f1_ci_95?: [number, number] | null;
  brier_ci_95?: [number, number] | null;
  fair_thresholds?: Record<string, number>;
  grid_resultados?: Record<string, { best_auc_cv: number; best_params: Record<string, unknown> }>;
  pr_auc?: number;
  pr_baseline?: number;
  pr_curve_precision?: number[];
  pr_curve_recall?: number[];
  perm_importance?: PermImportanceItem[];
  mcnemar?: McNemar;
  delong?: DeLong;
  learning_curve?: LearningCurveData;
  policies?: Record<string, PolicyItem>;
  error_analysis?: ErrorAnalysis;
  stacking_result?: Record<string, unknown>;
  optuna_result?: Record<string, unknown>;
  ece?: number;
  mce?: number;
  ece_bin_data?: { bin_mid: number; avg_pred: number; avg_actual: number; count: number; weight: number; gap: number }[];
  has_relative_features?: boolean;
  hosmer_lemeshow?: { chi2: number; p_value: number; df: number; bien_calibrado: boolean };
  dca_curve?: { thresholds: number[]; net_benefit_model: number[]; net_benefit_all: number[]; net_benefit_none: number[] };
  nested_cv?: { nested_auc_mean: number; nested_auc_std: number; bias_estimate: number };
  shap_interactions?: { matrix: number[][]; features: string[] };
  pdp_data?: { feature: string; grid: number[]; avg_pred: number[] }[];
  monotonicity_check?: Record<string, { compliance_pct: number; violations: number }>;
  stability?: { auc_per_seed: number[]; mean: number; std: number; min: number; max: number; n_seeds: number };
  automl_result?: { best_estimator?: string; best_auc_cv?: number; available: boolean; error?: string };
  calibration_prob_true_uniform?: number[];
  calibration_prob_pred_uniform?: number[];
};

export type ShapContribution = {
  feature: string;
  value: number | string | null;
  baseline: number | string | null;
  contribution: number;
  abs_contribution: number;
};

export type ShapData = {
  id_estudiante: string;
  probabilidad_riesgo: number;
  nivel_riesgo: string;
  base_probabilidad: number;
  contributions: ShapContribution[];
};

export type Tab = "dashboard" | "estudiante" | "intervenciones" | "datos" | "modelo" | "reportes" | "usuarios" | "micolegio";

// ── Mi Colegio ────────────────────────────────────────────────────────────────
export type AlumnoColegio = {
  n_alumno:        number;
  nombre:          string;
  salon:           string;
  codigo_ie:       string;
  nivel_riesgo:    "ALTO" | "MEDIO" | "BAJO";
  prob_riesgo:     number;
  riesgo:          number;
  n_materias_c:    number;
  promedio_materias?: number;
  pp_matematica?:  number | null;
  pp_comunicacion?: number | null;
  pp_cta?:         number | null;
  conducta_promedio?: number | null;
};

export type ColegioResumen = {
  codigo_ie:       string;
  nombre_colegio?: string;
  n_alumnos:       number;
  n_riesgo:        number;
  pct_riesgo:      number;
  por_nivel:       Record<"ALTO" | "MEDIO" | "BAJO", number>;
  por_salon:       Record<string, Record<string, number>>;
  trained_at?:     string;
};
