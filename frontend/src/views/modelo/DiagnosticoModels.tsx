"use client";

// Secciones de diagnóstico avanzado eliminadas por simplicidad:
// Learning Curve, Policies, Stacking, Optuna/FLAML, GridSearch, Fair Thresholds

import type { Diagnostico, Metrics } from "@/types";

interface Props {
  diagnostico: Diagnostico;
  metrics: Metrics;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function DiagnosticoModels({ diagnostico, metrics }: Props) {
  return null;
}
