import React, { type ReactNode } from "react";
import { Kpi } from "./Primitives";
import { evaluacionColegio, porcentajeEvaluacion as pp } from "@/lib/evaluacionColegio";
import { GraficosInformeColegio } from "@/components/charts/GraficosInformeColegio";

export function EvaluacionMacroColegio({ codigoIe }: { codigoIe: string | null | undefined }) {
  const evaluacion = evaluacionColegio(codigoIe);
  if (!evaluacion) return null;
  const m = evaluacion.metricas_macro;
  const riesgo = evaluacion.metricas_clase_en_riesgo;
  return (
    <section aria-label="Métricas macro del colegio" style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 12, display: "grid", gap: 12 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 15, color: "var(--navy)" }}>Joseph And Mery · métricas macro</h3>
        <p className="model-note" style={{ marginBottom: 0 }}>Informe del 18/11/2026 · {evaluacion.n_evaluados_reales} alumnos · B1–B3 → B4.</p>
      </div>
      <div className="metric-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <Kpi label="AUC CV" value={pp(m.auc_cv)} detail="validación cruzada" tone="low" />
        <Kpi label="Accuracy CV" value={pp(m.accuracy_cv)} detail="validación cruzada" tone="low" />
        <Kpi label="Precisión macro CV" value={pp(m.precision_macro_cv)} detail="promedio de ambas clases" tone="low" />
        <Kpi label="Recall macro CV" value={pp(m.recall_macro_cv)} detail="promedio de ambas clases" tone="low" />
        <Kpi label="F1 macro CV" value={pp(m.f1_macro_cv)} detail="promedio de ambas clases" tone="low" />
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
        <strong>Clase «en riesgo»:</strong> precisión {pp(riesgo.precision)} · recall {pp(riesgo.recall)} · F1 {pp(riesgo.f1)}. Detectados 54 de 75 alumnos en riesgo.
      </div>
      <GraficosInformeColegio codigoIe={codigoIe} />
    </section>
  );
}

export function ReferenciaModeloActivo({ experimental, children }: { experimental: boolean; children: ReactNode }) {
  if (!experimental) return <>{children}</>;
  return (
    <details>
      <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Ver métricas del modelo en uso</summary>
      {children}
    </details>
  );
}
