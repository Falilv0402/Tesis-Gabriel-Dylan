"use client";

/**
 * DiagnosticoFinal — compose the three advanced-diagnostics sub-views.
 * Kept thin: each section lives in its own file for maintainability.
 */

import type { Diagnostico, Metrics } from "@/types";
import { DiagnosticoModels }      from "./DiagnosticoModels";
import { DiagnosticoDiagnostics } from "./DiagnosticoDiagnostics";
import { DiagnosticoStability }   from "./DiagnosticoStability";

interface DiagnosticoFinalProps {
  diagnostico:    Diagnostico;
  metrics:        Metrics;
  scheduleFreq:   string;
  setScheduleFreq:(v: string) => void;
  scheduleMsg:    string;
  nextUpdate:     string | null;
  onSaveSchedule: () => void;
}

export function DiagnosticoFinal({
  diagnostico, metrics,
  scheduleFreq, setScheduleFreq,
  scheduleMsg, nextUpdate, onSaveSchedule,
}: DiagnosticoFinalProps) {
  return (
    <>
      <DiagnosticoModels diagnostico={diagnostico} metrics={metrics} />
      <DiagnosticoDiagnostics diagnostico={diagnostico} />
      <DiagnosticoStability
        diagnostico={diagnostico} metrics={metrics}
        scheduleFreq={scheduleFreq} setScheduleFreq={setScheduleFreq}
        scheduleMsg={scheduleMsg} nextUpdate={nextUpdate}
        onSaveSchedule={onSaveSchedule}
      />
    </>
  );
}
