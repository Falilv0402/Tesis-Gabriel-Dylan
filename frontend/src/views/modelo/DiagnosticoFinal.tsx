"use client";

// Secciones de diagnóstico avanzado eliminadas en la simplificación del modelo.
// Archivo conservado para compatibilidad con DiagnosticoAvanzado.tsx.
// Ver docs/ROADMAP_CARGA_EXCEL_COLEGIO.md para trabajo futuro.

import type { Diagnostico, Metrics } from "@/types";

interface DiagnosticoFinalProps {
  diagnostico:    Diagnostico;
  metrics:        Metrics;
  scheduleFreq:   string;
  setScheduleFreq:(v: string) => void;
  scheduleMsg:    string;
  nextUpdate:     string | null;
  onSaveSchedule: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function DiagnosticoFinal(_props: DiagnosticoFinalProps) {
  return null;
}
