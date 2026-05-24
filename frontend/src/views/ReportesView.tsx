"use client";

import { Download, FileText, Mail } from "lucide-react";
import type { Diagnostico, DatasetSummary } from "@/types";
import { Panel, Bar, EmptyState } from "@/components/ui/Primitives";
import { pct } from "@/lib/format";

interface ReportesViewProps {
  diagnostico: Diagnostico | null;
  summary: DatasetSummary;
  globalSummary: DatasetSummary;
  high: number;
  displayTotal: number;
  exportCsv: () => void;
  exportXlsx: () => void;
  exportPdf: () => void;
}

export function ReportesView({
  diagnostico, summary, globalSummary, high, displayTotal,
  exportCsv, exportXlsx, exportPdf,
}: ReportesViewProps) {
  return (
    <section className="three-col">
      <Panel title="Equidad: rendimiento por tercil ISE">
        {diagnostico && Object.keys(diagnostico.group_metrics).filter(k => k.startsWith("ise_tercil:")).length > 0 ? (
          <>
            <div className="model-note" style={{ marginBottom: 8 }}>
              Tasa de riesgo real observada por nivel socioeconómico. Permite verificar la equidad del modelo.
            </div>
            {Object.entries(diagnostico.group_metrics)
              .filter(([k]) => k.startsWith("ise_tercil:"))
              .map(([key, m]) => {
                const label = key.replace("ise_tercil:", "ISE ");
                return (
                  <div key={key} style={{ marginBottom: 8 }}>
                    <p className="model-note" style={{ margin: "0 0 4px", fontWeight: 600 }}>
                      {label} · n={m.n} · recall {pct(m.recall)}
                    </p>
                    <Bar
                      label="Tasa real de riesgo"
                      value={m.tasa_real}
                      tone={m.tasa_real > 0.5 ? "high" : m.tasa_real > 0.35 ? "medium" : "low"}
                    />
                  </div>
                );
              })}
            <div className="model-note" style={{ fontSize: 11, marginTop: 6 }}>
              Datos del test set EM 2022 (real, no simulado).
            </div>
          </>
        ) : <EmptyState message="Diagnóstico no disponible. Reentrena el modelo." />}
      </Panel>

      <Panel title="Distribucion por distrito">
        {Object.entries(summary.facets.distrito ?? {}).slice(0, 6).map(([dist, count]) => (
          <Bar key={dist} label={dist} value={count / Math.max(summary.total, 1)} />
        ))}
        {Object.keys(summary.facets.distrito ?? {}).length === 0 && (
          <EmptyState message="Conecta el backend ML para ver distribucion por distrito." />
        )}
      </Panel>

      <Panel title="Exportaciones y alertas">
        <button onClick={exportCsv}><Download size={17} /> Exportar CSV</button>
        <button onClick={exportXlsx}><Download size={17} /> Exportar Excel (.xlsx)</button>
        <button onClick={exportPdf}><FileText size={17} /> Generar PDF ejecutivo</button>
        <button onClick={() => {
          const subject = encodeURIComponent(`Alerta riesgo academico — ${new Date().toLocaleDateString("es-PE")}`);
          const body = encodeURIComponent(`Se detectaron ${high} estudiantes en riesgo ALTO de un total de ${displayTotal}.`);
          window.open(`mailto:?subject=${subject}&body=${body}`);
        }}>
          <Mail size={17} /> Enviar alerta por email
        </button>
        <div className="model-note" style={{ marginTop: "8px" }}>
          Resumen global: <strong>{globalSummary.risk_counts.ALTO}</strong> alto · <strong>{globalSummary.risk_counts.MEDIO}</strong> medio · <strong>{globalSummary.risk_counts.BAJO}</strong> bajo<br />
          Periodo: EM 2022 · {globalSummary.total.toLocaleString("es-PE")} estudiantes
        </div>
      </Panel>
    </section>
  );
}
