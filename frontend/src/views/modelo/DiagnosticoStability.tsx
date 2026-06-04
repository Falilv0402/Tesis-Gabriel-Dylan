"use client";

// Secciones eliminadas por simplicidad:
// PDP (Dependencia Parcial), Interacciones SHAP,
// Verificación de monotonicidad, Estabilidad multi-semilla

import type { Diagnostico, Metrics } from "@/types";

interface Props {
  diagnostico:    Diagnostico;
  metrics:        Metrics;
  scheduleFreq:   string;
  setScheduleFreq:(v: string) => void;
  scheduleMsg:    string;
  nextUpdate:     string | null;
  onSaveSchedule: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function DiagnosticoStability(props: Props) {
  return null;
}
