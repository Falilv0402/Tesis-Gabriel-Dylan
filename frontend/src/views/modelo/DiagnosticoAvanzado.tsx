"use client";

import {
  CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import type { Diagnostico, Metrics } from "@/types";
import { Panel, Kpi, EmptyState } from "@/components/ui/Primitives";
import { pct } from "@/lib/format";
import { featureLabels } from "@/lib/constants";
import { DiagnosticoFinal } from "@/views/modelo/DiagnosticoFinal";

interface LiveMetrics {
  tp: number; fp: number; precision: number; recall: number; f1: number; n: number;
}

interface DiagnosticoAvanzadoProps {
  diagnostico: Diagnostico;
  metrics: Metrics;
  liveMetrics: LiveMetrics | null;
  scheduleFreq: string;
  setScheduleFreq: (v: string) => void;
  scheduleMsg: string;
  nextUpdate: string | null;
  onSaveSchedule: () => void;
}

export function DiagnosticoAvanzado({
  diagnostico, metrics, liveMetrics,
  scheduleFreq, setScheduleFreq,
  scheduleMsg, nextUpdate, onSaveSchedule,
}: DiagnosticoAvanzadoProps) {
  return (
    <>
      {/* ── Baselines ────────────────────────────────────────── */}
      <Panel title="Comparativa contra baselines triviales">
        {Object.keys(diagnostico.baselines).length > 0 ? (
          <>
            <div className="model-note" style={{ marginBottom: 8 }}>
              Justifica el uso de ML: muestra cuánto mejora tu modelo frente a reglas simples.
            </div>
            <table style={{ width: "100%", fontSize: 12 }}>
              <tbody>
                <tr><th style={{ textAlign: "left" }}>Modelo</th><th>Accuracy</th><th>Precision</th><th>Recall</th><th>F1</th><th>AUC</th></tr>
                {Object.entries(diagnostico.baselines).map(([k, m]) => {
                  const isML = k === "modelo_ml";
                  return (
                    <tr key={k} className={isML ? "baseline-winner" : ""}>
                      <td><strong>{isML ? "Tu modelo ML ★" : k}</strong><br />
                        <small style={{ color: "var(--text-muted)" }}>{m.descripcion}</small>
                      </td>
                      <td style={{ textAlign: "center" }}>{pct(m.accuracy)}</td>
                      <td style={{ textAlign: "center" }}>{pct(m.precision)}</td>
                      <td style={{ textAlign: "center" }}><strong>{pct(m.recall)}</strong></td>
                      <td style={{ textAlign: "center" }}><strong>{pct(m.f1_score)}</strong></td>
                      <td style={{ textAlign: "center" }}>{pct(m.auc_roc)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        ) : <EmptyState message="Reentrena el modelo para generar baselines." />}
      </Panel>

      {/* ── Drift ────────────────────────────────────────────── */}
      <section className="one-col">
        <Panel title="Monitoreo de deriva del dataset (data drift)">
          {Object.keys(diagnostico.drift_actual).length > 0 ? (
            <>
              <div className="model-note" style={{ marginBottom: 8 }}>
                <TrendingUp size={12} style={{ verticalAlign: "middle" }} /> Compara la distribución actual vs. la del entrenamiento.
              </div>
              <table style={{ width: "100%", fontSize: 12 }}>
                <tbody>
                  <tr><th style={{ textAlign: "left" }}>Feature</th><th>μ train</th><th>μ actual</th><th>Δ relativo</th><th>Estado</th></tr>
                  {Object.entries(diagnostico.drift_actual).map(([feat, d]) => (
                    <tr key={feat}>
                      <td><strong>{featureLabels[feat] ?? feat}</strong></td>
                      <td style={{ textAlign: "center" }}>{d.baseline_mean.toFixed(2)}</td>
                      <td style={{ textAlign: "center" }}>{d.current_mean.toFixed(2)}</td>
                      <td style={{ textAlign: "center" }}>{(d.rel_shift * 100).toFixed(1)}%</td>
                      <td style={{ textAlign: "center" }}><span className={`drift-tag drift-${d.alerta}`}>{d.alerta}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : <EmptyState message="Sin información de drift disponible." />}
        </Panel>
      </section>

      {/* ── PR-AUC + Error Analysis ──────────────────────────── */}
      <section className="two-col">
        <Panel title="Curva Precision-Recall (PR-AUC)">
          {diagnostico.pr_curve_precision && diagnostico.pr_curve_precision.length > 1 ? (
            <>
              <div className="model-note" style={{ marginBottom: 8 }}>
                La curva PR es más informativa que ROC en datasets desbalanceados.
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={(diagnostico.pr_curve_recall ?? []).map((r, i) => ({
                    recall: +(r * 100).toFixed(1),
                    precision: +((diagnostico.pr_curve_precision![i] ?? 0) * 100).toFixed(1),
                    baseline: +((diagnostico.pr_baseline ?? 0) * 100).toFixed(1),
                  })).filter((_, i) => i % 5 === 0)}
                  margin={{ top: 8, right: 16, left: -8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="recall" type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }}
                    label={{ value: "Recall", position: "insideBottom", offset: -2, style: { fontSize: 11 } }} />
                  <YAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="baseline" name="Azar" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="precision" name="Modelo" stroke="var(--accent)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="metric-grid" style={{ marginTop: 8 }}>
                <Kpi label="PR-AUC" value={pct(diagnostico.pr_auc)} detail={`${(((diagnostico.pr_auc ?? 0) - (diagnostico.pr_baseline ?? 0)) * 100).toFixed(1)} pp sobre azar`} />
                <Kpi label="Baseline" value={pct(diagnostico.pr_baseline)} detail="clasificador aleatorio" />
              </div>
            </>
          ) : <EmptyState message="Reentrena el modelo para generar la curva PR." />}
        </Panel>

      </section>

      {/* ── Secciones finales (learning curve, policies, stacking, etc.) ── */}
      <DiagnosticoFinal
        diagnostico={diagnostico}
        metrics={metrics}
        scheduleFreq={scheduleFreq}
        setScheduleFreq={setScheduleFreq}
        scheduleMsg={scheduleMsg}
        nextUpdate={nextUpdate}
        onSaveSchedule={onSaveSchedule}
      />
    </>
  );
}
