"use client";

import {
  CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Scale, TrendingUp } from "lucide-react";
import type { Diagnostico, Metrics } from "@/types";
import { Panel, Kpi, EmptyState } from "@/components/ui/Primitives";
import { pct, fmt } from "@/lib/format";
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

      {/* ── Fairness + Drift ─────────────────────────────────── */}
      <section className="two-col">
        <Panel title="Auditoría de equidad (Fairness por subgrupo)">
          {Object.keys(diagnostico.group_metrics).length > 0 ? (
            <>
              <div className="model-note" style={{ marginBottom: 8 }}>
                <Scale size={12} style={{ verticalAlign: "middle" }} /> El modelo debe funcionar similar para todos los grupos.
              </div>
              <table style={{ width: "100%", fontSize: 12 }}>
                <tbody>
                  <tr>
                    <th style={{ textAlign: "left" }}>Subgrupo</th>
                    <th>n</th><th>Tasa real</th>
                    <th>Recall <span className="ci-badge">IC95%</span></th>
                    <th>Precisión</th>
                    <th>AUC <span className="ci-badge">IC95%</span></th>
                  </tr>
                  {Object.entries(diagnostico.group_metrics).map(([k, m]) => (
                    <tr key={k}>
                      <td><strong>{k.replace(":", ": ")}</strong></td>
                      <td style={{ textAlign: "center" }}>{m.n}</td>
                      <td style={{ textAlign: "center" }}>{pct(m.tasa_real)}</td>
                      <td style={{ textAlign: "center" }}>
                        {pct(m.recall)}
                        {m.recall_ci_95 && <div className="ci-range">[{pct(m.recall_ci_95[0])}–{pct(m.recall_ci_95[1])}]</div>}
                      </td>
                      <td style={{ textAlign: "center" }}>{pct(m.precision)}</td>
                      <td style={{ textAlign: "center" }}>
                        {pct(m.auc_roc)}
                        {m.auc_ci_95 && <div className="ci-range">[{pct(m.auc_ci_95[0])}–{pct(m.auc_ci_95[1])}]</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(() => {
                const recalls = Object.values(diagnostico.group_metrics).map(m => m.recall);
                const aucs = Object.values(diagnostico.group_metrics).map(m => m.auc_roc);
                const recallGap = Math.max(...recalls) - Math.min(...recalls);
                const aucGap = Math.max(...aucs) - Math.min(...aucs);
                const status = recallGap < 0.10 && aucGap < 0.10 ? "ok" : recallGap < 0.20 && aucGap < 0.15 ? "media" : "alta";
                return (
                  <div className={`fairness-summary fairness-${status}`}>
                    <strong>Gap máximo Recall:</strong> {pct(recallGap)} · <strong>Gap máximo AUC:</strong> {pct(aucGap)} →{" "}
                    {status === "ok" ? "✓ Equidad aceptable (gaps < 10%)" : status === "media" ? "⚠ Diferencias moderadas — documentar" : "✗ Diferencias significativas — investigar sesgo"}
                  </div>
                );
              })()}
            </>
          ) : <EmptyState message="Reentrena para generar el análisis de equidad." />}
        </Panel>

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

      {/* ── PR-AUC + Permutation Importance ─────────────────── */}
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

        <Panel title="Permutation Importance (cross-check SHAP)">
          {diagnostico.perm_importance && diagnostico.perm_importance.length > 0 ? (
            <>
              <div className="model-note" style={{ marginBottom: 8 }}>
                Caída en AUC al barajar aleatoriamente cada feature. Confirma los resultados de SHAP.
              </div>
              {diagnostico.perm_importance.map((pi) => {
                const maxMean = diagnostico.perm_importance![0].mean;
                const width = maxMean > 0 ? Math.min(Math.abs(pi.mean) / Math.abs(maxMean) * 100, 100) : 0;
                return (
                  <div key={pi.feature} className="shap-bar-row" style={{ marginBottom: 6 }}>
                    <div className="shap-bar-meta">
                      <span className="shap-feature-label">{featureLabels[pi.feature] ?? pi.feature}</span>
                      <span className="shap-feature-val">±{pi.std.toFixed(4)}</span>
                    </div>
                    <div className="shap-bar-track">
                      <div className={`shap-bar-fill ${pi.mean > 0 ? "shap-risk" : "shap-protect"}`} style={{ width: `${width}%` }} />
                    </div>
                    <span className={`shap-delta ${pi.mean > 0 ? "shap-risk-text" : "shap-protect-text"}`}>
                      {pi.mean > 0 ? "−" : "+"}{Math.abs(pi.mean).toFixed(4)}
                    </span>
                  </div>
                );
              })}
            </>
          ) : <EmptyState message="Reentrena el modelo para ver permutation importance." />}
        </Panel>
      </section>

      {/* ── McNemar + DeLong ───────────────────────────────── */}
      <section className="two-col">
        <Panel title="Tests estadísticos formales (McNemar + DeLong)">
          {(() => {
            const m = diagnostico.mcnemar;
            const d = diagnostico.delong;
            if (!m || typeof m.chi2 !== "number" || !d || typeof d.delta_auc !== "number") {
              return <EmptyState message="Reentrena el modelo para calcular los tests estadísticos." />;
            }
            return (
              <>
                <div className="model-note" style={{ marginBottom: 8 }}>
                  Comparan el modelo ML calibrado contra la mejor regla heurística. p &lt; 0.05 = diferencia significativa.
                </div>
                <div className="metric-grid">
                  <Kpi label="McNemar χ²" value={m.chi2.toFixed(3)} detail={`p = ${m.p_value.toFixed(4)}`} tone={m.significativo ? "low" : "high"} />
                  <Kpi label="McNemar" value={m.significativo ? "✓ Significativo" : "No signif."} detail={`b=${m.b ?? "—"}  c=${m.c ?? "—"}`} tone={m.significativo ? "low" : "medium"} />
                  <Kpi label="ΔAUC (DeLong)" value={`${d.delta_auc > 0 ? "+" : ""}${(d.delta_auc * 100).toFixed(2)} pp`}
                    detail={`IC95% [${((d.ci_95[0] ?? 0)*100).toFixed(2)}, ${((d.ci_95[1] ?? 0)*100).toFixed(2)}]`} tone={d.significativo ? "low" : "medium"} />
                  <Kpi label="DeLong p" value={d.p_value.toFixed(4)} detail={d.significativo ? "✓ AUC mejora sign." : "No significativo"} tone={d.significativo ? "low" : "high"} />
                </div>
                <div className="model-note" style={{ marginTop: 8 }}>
                  ML AUC: <strong>{pct(d.ml_auc ?? 0)}</strong> vs Baseline AUC: <strong>{pct(d.baseline_auc ?? 0)}</strong>.{" "}
                  {d.significativo ? "✓ La mejora del modelo es estadísticamente real (p < 0.05)." : "⚠ La diferencia no alcanza significancia estadística."}
                </div>
              </>
            );
          })()}
        </Panel>

        <Panel title="Análisis cualitativo de errores (FN / FP)">
          {(() => {
            const ea = diagnostico.error_analysis;
            if (!ea) return <EmptyState message="Reentrena el modelo para generar el análisis de errores." />;
            return (
              <>
                <div className="model-note" style={{ marginBottom: 8 }}>
                  <strong>FN</strong>: casos reales de riesgo no detectados. <strong>FP</strong>: alarmas innecesarias.
                </div>
                <div className="metric-grid">
                  <Kpi label="Total FN" value={ea.total_fn != null ? String(ea.total_fn) : "—"} detail="riesgo real no detectado" tone="high" />
                  <Kpi label="Total FP" value={ea.total_fp != null ? String(ea.total_fp) : "—"} detail="alarmas innecesarias" tone="medium" />
                </div>
                <table style={{ width: "100%", fontSize: 12, marginTop: 10 }}>
                  <tbody>
                    <tr><th style={{ textAlign: "left" }}>Métrica</th><th>FN</th><th>FP</th></tr>
                    <tr><td>M500_L (Lectura)</td><td style={{ textAlign: "center" }}>{fmt(ea.fn_mean_lectura, 1)}</td><td style={{ textAlign: "center" }}>{fmt(ea.fp_mean_lectura, 1)}</td></tr>
                    <tr><td>M500_CN (Ciencias)</td><td style={{ textAlign: "center" }}>{fmt(ea.fn_mean_ciencias, 1)}</td><td style={{ textAlign: "center" }}>{fmt(ea.fp_mean_ciencias, 1)}</td></tr>
                    <tr><td>ISE</td><td style={{ textAlign: "center" }}>{fmt(ea.fn_mean_ise, 2)}</td><td style={{ textAlign: "center" }}>{fmt(ea.fp_mean_ise, 2)}</td></tr>
                    <tr><td>Prob. predicha media</td>
                      <td style={{ textAlign: "center" }}>{typeof ea.fn_mean_prob === "number" ? pct(ea.fn_mean_prob) : "—"}</td>
                      <td style={{ textAlign: "center" }}>{typeof ea.fp_mean_prob === "number" ? pct(ea.fp_mean_prob) : "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </>
            );
          })()}
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
