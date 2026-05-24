"use client";

/**
 * DiagnosticoDiagnostics — sections 4-5 of DiagnosticoFinal:
 *   • Nested CV + Decision Curve Analysis
 *   • Partial Dependence Plots + SHAP Interactions
 */

import {
  CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Diagnostico } from "@/types";
import { Panel, Kpi, EmptyState } from "@/components/ui/Primitives";
import { pct } from "@/lib/format";
import { featureLabels } from "@/lib/constants";

interface Props {
  diagnostico: Diagnostico;
}

export function DiagnosticoDiagnostics({ diagnostico }: Props) {
  return (
    <>
      {/* ── Nested CV + DCA ──────────────────────────────── */}
      <section className="two-col">
        <Panel title="Validación cruzada anidada (Nested CV)">
          {diagnostico.nested_cv ? (
            <>
              <div className="model-note" style={{ marginBottom: 8 }}>
                La CV anidada proporciona una estimación imparcial del AUC real del modelo.
              </div>
              <div className="metric-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Kpi
                  label="AUC Nested CV"
                  value={typeof diagnostico.nested_cv.nested_auc_mean === "number" ? pct(diagnostico.nested_cv.nested_auc_mean) : "—"}
                  detail={typeof diagnostico.nested_cv.nested_auc_std === "number" ? `±${(diagnostico.nested_cv.nested_auc_std * 100).toFixed(2)} pp` : "—"}
                  tone="low"
                />
                <Kpi label="AUC inner CV" value={"—"} detail="con selección de hiperparámetros" />
              </div>
              {(() => {
                const bias    = diagnostico.nested_cv!.bias_estimate;
                const biasPp  = (bias * 100).toFixed(2);
                const biasTone = bias < 0.01 ? "#16a34a" : bias < 0.03 ? "#d97706" : "#dc2626";
                return (
                  <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, border: `1px solid ${biasTone}22`, background: `${biasTone}11` }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Estimación de sesgo por selección de hiperparámetros</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: biasTone }}>+{biasPp} pp</div>
                    <div style={{ fontSize: 11, color: biasTone, fontWeight: 600 }}>
                      {bias < 0.01 ? "Sesgo despreciable" : bias < 0.03 ? "Sesgo leve — aceptable" : "Sesgo alto — reportar con cautela"}
                    </div>
                  </div>
                );
              })()}
            </>
          ) : <EmptyState message="Reentrena el modelo para ejecutar la validación cruzada anidada." />}
        </Panel>

        <Panel title="Curva de decisión (DCA) — valor clínico neto">
          {diagnostico.dca_curve && Array.isArray(diagnostico.dca_curve.thresholds) && diagnostico.dca_curve.thresholds.length > 0 ? (
            <>
              <div className="model-note" style={{ marginBottom: 8 }}>
                Beneficio neto del modelo vs. intervenir a todos o a nadie.
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={diagnostico.dca_curve.thresholds.map((t, i) => ({
                    threshold: +(t * 100).toFixed(1),
                    modelo:    +((diagnostico.dca_curve!.net_benefit_model[i] ?? 0)).toFixed(4),
                    todos:     +((diagnostico.dca_curve!.net_benefit_all[i]   ?? 0)).toFixed(4),
                    ninguno:   0,
                  })).filter(d => d.threshold >= 5 && d.threshold <= 80)}
                  margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="threshold" unit="%" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: unknown) => Number(v).toFixed(4)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="modelo"   name="Modelo ML"           stroke="var(--accent)" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="todos"    name="Intervenir a todos"   stroke="#d97706"       strokeDasharray="6 3" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="ninguno"  name="No intervenir"        stroke="#94a3b8"       strokeDasharray="2 4" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : <EmptyState message="Reentrena el modelo para generar la curva de decisión." />}
        </Panel>
      </section>

      {/* ── PDP + SHAP Interactions ──────────────────────── */}
      <section className="two-col">
        <Panel title="Dependencia parcial (PDP) — efecto marginal de features clave">
          {diagnostico.pdp_data && diagnostico.pdp_data.length > 0 ? (
            <>
              <div className="model-note" style={{ marginBottom: 8 }}>
                Cómo cambia la probabilidad predicha al variar cada feature, manteniendo las demás constantes.
              </div>
              <div className="pdp-grid">
                {diagnostico.pdp_data.slice(0, 3).map((pdp) => (
                  <div key={pdp.feature} className="pdp-mini-chart">
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", marginBottom: 4, textAlign: "center" }}>
                      {featureLabels[pdp.feature] ?? pdp.feature}
                    </div>
                    <ResponsiveContainer width="100%" height={130}>
                      <LineChart
                        data={pdp.grid.map((x, i) => ({ x: +x.toFixed(2), prob: +((pdp.avg_pred[i] ?? 0) * 100).toFixed(1) }))}
                        margin={{ top: 4, right: 8, left: -20, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="x" tick={{ fontSize: 9 }} />
                        <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 9 }} />
                        <Tooltip formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} />
                        <Line type="monotone" dataKey="prob" name="P(riesgo)" stroke="var(--accent)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ))}
              </div>
            </>
          ) : <EmptyState message="Reentrena el modelo para generar los gráficos de dependencia parcial." />}
        </Panel>

        <Panel title="Interacciones SHAP — pares de features">
          {diagnostico.shap_interactions && Array.isArray(diagnostico.shap_interactions.matrix) && diagnostico.shap_interactions.matrix.length > 0 ? (
            <>
              <div className="model-note" style={{ marginBottom: 8 }}>
                Intensidad de la interacción entre pares de features según Shapley.
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="shap-interaction-table">
                  <thead>
                    <tr>
                      <th style={{ fontSize: 10, padding: "4px 6px", background: "var(--surface)" }}></th>
                      {diagnostico.shap_interactions.features.map((f) => (
                        <th key={f} style={{ fontSize: 9, padding: "4px 6px", background: "var(--surface)", textAlign: "center", minWidth: 60 }}>
                          {featureLabels[f] ?? f}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {diagnostico.shap_interactions.matrix.map((row, ri) => {
                      const maxVal = Math.max(...diagnostico.shap_interactions!.matrix.flat().map(Math.abs));
                      return (
                        <tr key={ri}>
                          <td style={{ fontSize: 9, padding: "4px 6px", fontWeight: 600, background: "var(--surface)", whiteSpace: "nowrap" }}>
                            {featureLabels[diagnostico.shap_interactions!.features[ri]] ?? diagnostico.shap_interactions!.features[ri]}
                          </td>
                          {row.map((val, ci) => {
                            const intensity = maxVal > 0 ? Math.abs(val) / maxVal : 0;
                            return (
                              <td key={ci} className="shap-interaction-cell" style={{
                                background: `rgba(37, 99, 235, ${intensity.toFixed(2)})`,
                                color: intensity > 0.5 ? "#fff" : "var(--text)",
                                fontSize: 10, textAlign: "center", padding: "4px 6px",
                              }}>
                                {val.toFixed(3)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : <EmptyState message="Reentrena el modelo para calcular las interacciones SHAP." />}
        </Panel>
      </section>
    </>
  );
}

