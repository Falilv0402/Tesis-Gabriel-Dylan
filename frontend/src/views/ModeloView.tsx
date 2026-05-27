"use client";

import { Play, Save, Info } from "lucide-react";
import { isLocalBackend } from "@/lib/env";
import {
  CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Metrics, Evaluation, Diagnostico, DatasetSummary, Importance } from "@/types";
import { Panel, Kpi, Bar, EmptyState } from "@/components/ui/Primitives";
import { ConfusionMatrix } from "@/components/charts/ConfusionMatrix";
import { RocMiniChart } from "@/components/charts/RocMiniChart";
import { featureLabels } from "@/lib/constants";
import { pct, fmt } from "@/lib/format";
import { DiagnosticoAvanzado } from "@/views/modelo/DiagnosticoAvanzado";

interface LiveMetrics {
  tp: number; fp: number; tn: number; fn: number;
  accuracy: number; precision: number; recall: number; f1: number; n: number;
}

interface ModeloViewProps {
  metrics: Metrics;
  evaluation: Evaluation;
  diagnostico: Diagnostico | null;
  globalSummary: DatasetSummary;
  topFactors: Importance[];
  maxImportance: number;
  liveMetrics: LiveMetrics | null;
  thresholdHigh: number;
  setThresholdHigh: (v: number) => void;
  thresholdMedium: number;
  setThresholdMedium: (v: number) => void;
  scheduleFreq: string;
  setScheduleFreq: (v: string) => void;
  scheduleMsg: string;
  nextUpdate: string | null;
  modelMessage: string;
  onRetrain: () => void;
  onSaveSchedule: () => void;
}

export function ModeloView({
  metrics, evaluation, diagnostico, globalSummary,
  topFactors, maxImportance, liveMetrics,
  thresholdHigh, setThresholdHigh, thresholdMedium, setThresholdMedium,
  scheduleFreq, setScheduleFreq, scheduleMsg, nextUpdate,
  modelMessage, onRetrain, onSaveSchedule,
}: ModeloViewProps) {
  return (
    <>
      {/* ── Operacion + SHAP global ─────────────────────────────── */}
      <section className="two-col">
        <Panel title="Operacion del modelo">
          <div className="metric-grid">
            <Kpi label="Accuracy" value={pct(metrics.accuracy)} detail="test (umbral fijo)" />
            <Kpi label="Recall" value={pct(metrics.recall)} detail="critico" />
            <Kpi
              label="F1"
              value={pct(metrics.f1_score)}
              detail={metrics.f1_ci_95 ? `IC95% [${pct(metrics.f1_ci_95[0])}–${pct(metrics.f1_ci_95[1])}]` : "balance"}
            />
            <Kpi
              label="AUC-ROC"
              value={pct(metrics.auc_roc)}
              detail={metrics.auc_ci_95 ? `IC95% [${pct(metrics.auc_ci_95[0])}–${pct(metrics.auc_ci_95[1])}]` : "ROC"}
            />
            {typeof metrics.pr_auc === "number" && (
              <Kpi
                label="PR-AUC"
                value={pct(metrics.pr_auc)}
                detail={`baseline ${pct(metrics.pr_baseline ?? 0)}`}
                tone={metrics.pr_auc > 0.6 ? "low" : metrics.pr_auc > 0.35 ? "medium" : "high"}
              />
            )}
            {typeof metrics.brier_score === "number" && (
              <Kpi
                label="Brier"
                value={metrics.brier_score.toFixed(3)}
                detail={Array.isArray(metrics.brier_ci_95) && typeof metrics.brier_ci_95[0] === "number"
                  ? `IC95% [${metrics.brier_ci_95[0].toFixed(3)}–${metrics.brier_ci_95[1].toFixed(3)}]`
                  : "↓ mejor"}
                tone={metrics.brier_score < 0.15 ? "low" : metrics.brier_score < 0.22 ? "medium" : "high"}
              />
            )}
          </div>
          <div className="model-note">
            Modelo: <strong>{metrics.modelo_ganador ?? "—"}</strong> &nbsp;|&nbsp;
            Train: <strong>{metrics.train_rows?.toLocaleString("es-PE") ?? "—"}</strong> alumnos &nbsp;|&nbsp;
            Test: <strong>{metrics.test_rows?.toLocaleString("es-PE") ?? "—"}</strong> alumnos
          </div>
          <div className="model-note">{metrics.scope ?? ""}</div>
          <div className="slider-grid">
            <label>Umbral riesgo ALTO (actual: {thresholdHigh}%)
              <input type="range" min="30" max="90" value={thresholdHigh}
                onChange={(e) => setThresholdHigh(Number(e.target.value))} />
            </label>
            <label>Umbral riesgo MEDIO (actual: {thresholdMedium}%)
              <input type="range" min="20" max={thresholdHigh - 5} value={thresholdMedium}
                onChange={(e) => setThresholdMedium(Number(e.target.value))} />
            </label>
          </div>
          {liveMetrics && (
            <div className="live-metrics-box">
              <div className="live-metrics-title">
                Impacto del umbral seleccionado ({thresholdHigh}%)
              </div>
              <div className="metric-grid">
                <Kpi label="Accuracy" value={pct(liveMetrics.accuracy)} detail="con umbral" />
                <Kpi label="Precision" value={pct(liveMetrics.precision)} detail={`${liveMetrics.tp} VP / ${liveMetrics.tp + liveMetrics.fp} predichos`} />
                <Kpi label="Recall" value={pct(liveMetrics.recall)} detail={`${liveMetrics.tp} VP / ${liveMetrics.tp + liveMetrics.fn} reales`} />
                <Kpi label="F1" value={pct(liveMetrics.f1)} detail="balance" />
              </div>
              <div className="model-note" style={{ fontSize: 11 }}>
                VP={liveMetrics.tp} · VN={liveMetrics.tn} · FP={liveMetrics.fp} · FN={liveMetrics.fn} · n={liveMetrics.n}
              </div>
            </div>
          )}
          {isLocalBackend() ? (
            <button className="primary" onClick={onRetrain}>
              <Play size={17} /> Reentrenar
            </button>
          ) : (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              padding: "10px 12px", marginTop: 4,
              background: "#fffbeb", border: "1px solid #fde68a",
              borderRadius: 8, fontSize: 12, color: "#92400e",
            }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>Reentrenamiento desactivado en producción.</strong>
                <p style={{ margin: "3px 0 0", fontSize: 11, lineHeight: 1.4 }}>
                  Para reentrenar con nuevos datos, ejecuta{" "}
                  <code style={{ background: "#fef3c7", padding: "1px 4px", borderRadius: 3 }}>
                    python modelo/train_em_model.py
                  </code>{" "}
                  localmente y haz commit de los nuevos artefactos <code style={{ background: "#fef3c7", padding: "1px 4px", borderRadius: 3 }}>.pkl</code>.
                  El despliegue actualizará el modelo automáticamente.
                </p>
              </div>
            </div>
          )}
          <p className="audit-line">{modelMessage}</p>
        </Panel>
        <Panel title="Importancia global — SHAP">
          {topFactors.map((item) => (
            <Bar key={item.feature} label={featureLabels[item.feature] ?? item.feature} value={item.importancia / maxImportance} />
          ))}
          <div className="model-note">Valores SHAP normalizados respecto al predictor dominante.</div>
        </Panel>
      </section>

      {/* ── model-grid ─────────────────────────────────────────── */}
      <section className="model-grid">
        <Panel title="Datos modelados por nivel">
          <Bar label="Riesgo alto" value={globalSummary.risk_counts.ALTO / Math.max(globalSummary.total, 1)} tone="high" />
          <Bar label="Riesgo medio" value={globalSummary.risk_counts.MEDIO / Math.max(globalSummary.total, 1)} tone="medium" />
          <Bar label="Riesgo bajo" value={globalSummary.risk_counts.BAJO / Math.max(globalSummary.total, 1)} tone="low" />
          {globalSummary.total > 0 && (
            <ResponsiveContainer width="100%" height={160} style={{ marginTop: 10 }}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Alto", value: globalSummary.risk_counts.ALTO },
                    { name: "Medio", value: globalSummary.risk_counts.MEDIO },
                    { name: "Bajo", value: globalSummary.risk_counts.BAJO },
                  ]}
                  cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value"
                >
                  <Cell fill="#ef4444" /><Cell fill="#f59e0b" /><Cell fill="#22c55e" />
                </Pie>
                <Tooltip formatter={(v) => Number(v).toLocaleString("es-PE")} />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="model-note">
            Distribución global — {globalSummary.total.toLocaleString("es-PE")} estudiantes EM 2022.
          </div>
        </Panel>
        <Panel title="Matriz de confusion">
          <ConfusionMatrix matrix={evaluation.confusion_matrix} />
        </Panel>
        <Panel title="Curva ROC">
          <RocMiniChart fpr={evaluation.roc_fpr} tpr={evaluation.roc_tpr} auc={metrics.auc_roc} />
        </Panel>
      </section>

      {/* ── Calibración ─────────────────────────────────────────── */}
      <section className="two-col">
        <Panel title="Calibración del modelo (Reliability diagram)">
          {evaluation.calibration_prob_pred && evaluation.calibration_prob_pred.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={evaluation.calibration_prob_pred.map((p, i) => ({
                    predicha: +(p * 100).toFixed(1),
                    observada: +((evaluation.calibration_prob_true?.[i] ?? 0) * 100).toFixed(1),
                    perfecta: +(p * 100).toFixed(1),
                    observada_unif: diagnostico?.calibration_prob_pred_uniform?.[i] !== undefined
                      ? +((diagnostico.calibration_prob_true_uniform?.[i] ?? 0) * 100).toFixed(1)
                      : undefined,
                  }))}
                  margin={{ top: 10, right: 16, left: -8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="predicha" type="number" domain={[0, 100]} unit="%"
                    tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                    label={{ value: "Probabilidad predicha", position: "insideBottom", offset: -2, style: { fontSize: 11 } }} />
                  <YAxis type="number" domain={[0, 100]} unit="%"
                    tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                    label={{ value: "Frecuencia observada", angle: -90, position: "insideLeft", style: { fontSize: 11, textAnchor: "middle" } }} />
                  <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="line" />
                  <Line type="monotone" dataKey="perfecta" name="Calibración perfecta" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="observada" name="Cuantil (modelo actual)" stroke="var(--accent)" strokeWidth={2.5} dot={{ fill: "var(--accent)", r: 4 }} activeDot={{ r: 6 }} />
                  {diagnostico?.calibration_prob_pred_uniform && diagnostico.calibration_prob_pred_uniform.length > 0 && (
                    <Line type="monotone" dataKey="observada_unif" name="Uniforme (bins iguales)" stroke="#7c3aed" strokeWidth={2} strokeDasharray="6 3" dot={{ fill: "#7c3aed", r: 3 }} />
                  )}
                </LineChart>
              </ResponsiveContainer>
              <div className="model-note">
                Diagonal punteada = calibración perfecta. Azul sólido = bins por cuantil. Violeta punteado = bins uniformes.
              </div>
            </>
          ) : (
            <EmptyState message="Curva de calibración no disponible. Reentrena el modelo para generarla." />
          )}
        </Panel>

        <Panel title="Interpretación de calibración">
          <div className="metric-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Kpi
              label="Brier Score"
              value={typeof metrics.brier_score === "number" ? metrics.brier_score.toFixed(4) : "—"}
              detail="0 = perfecto · 0.25 = aleatorio"
              tone={metrics.brier_score !== undefined ? (metrics.brier_score < 0.15 ? "low" : metrics.brier_score < 0.22 ? "medium" : "high") : undefined}
            />
            {typeof diagnostico?.ece === "number" && (
              <Kpi
                label="ECE"
                value={diagnostico.ece.toFixed(4)}
                detail={diagnostico.ece < 0.05 ? "✓ bien calibrado" : "⚠ recalibrar"}
                tone={diagnostico.ece < 0.05 ? "low" : diagnostico.ece < 0.10 ? "medium" : "high"}
              />
            )}
          </div>
          {diagnostico?.hosmer_lemeshow && (
            <div style={{
              marginTop: 10, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)",
              background: diagnostico.hosmer_lemeshow.p_value > 0.05 ? "var(--risk-low-bg, #f0fdf4)" : "var(--risk-high-bg, #fef2f2)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: "var(--navy)" }}>Hosmer-Lemeshow test</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 4,
                  background: diagnostico.hosmer_lemeshow.p_value > 0.05 ? "#22c55e" : "#dc2626", color: "#fff",
                }}>
                  {diagnostico.hosmer_lemeshow.p_value > 0.05 ? "✓ No evidencia de mala calibración" : "⚠ Posible mala calibración"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-muted)" }}>
                <span>χ² = <strong>{fmt(diagnostico.hosmer_lemeshow.chi2, 3)}</strong></span>
                <span>p = <strong style={{ color: diagnostico.hosmer_lemeshow.p_value > 0.05 ? "#16a34a" : "#dc2626" }}>{fmt(diagnostico.hosmer_lemeshow.p_value, 4)}</strong></span>
                <span>df = <strong>{diagnostico.hosmer_lemeshow.df}</strong></span>
              </div>
              <div className="model-note" style={{ marginTop: 4, fontSize: 10 }}>
                H-L test: H₀ = modelo bien calibrado. p &gt; 0.05 = no rechazamos H₀ (buen ajuste).
              </div>
            </div>
          )}
          {typeof diagnostico?.mce === "number" && (
            <div className="model-note" style={{ marginTop: 6 }}>
              <strong>MCE (Max Calibration Error):</strong> {diagnostico.mce.toFixed(4)}
              <span style={{ marginLeft: 8, color: diagnostico.mce < 0.10 ? "var(--green)" : "var(--amber)", fontWeight: 600 }}>
                {diagnostico.mce < 0.10 ? "Aceptable" : "Revisar bins de alta probabilidad"}
              </span>
            </div>
          )}
          <div className="model-note" style={{ lineHeight: 1.6, marginTop: 10 }}>
            <strong style={{ color: "var(--navy)" }}>¿Qué significa esto?</strong><br />
            Una probabilidad del <strong>70%</strong> debe corresponder a un grupo donde efectivamente ~70 de cada 100 estudiantes están en riesgo.
            <br /><br />
            <strong>ECE</strong> cuantifica formalmente esta brecha. <strong>ECE &lt; 0.05</strong> se considera bien calibrado.
          </div>
        </Panel>
      </section>

      {/* ── Paneles avanzados de diagnóstico (sólo si hay datos) ── */}
      {diagnostico && (
        <DiagnosticoAvanzado
          diagnostico={diagnostico}
          metrics={metrics}
          liveMetrics={liveMetrics}
          scheduleFreq={scheduleFreq}
          setScheduleFreq={setScheduleFreq}
          scheduleMsg={scheduleMsg}
          nextUpdate={nextUpdate}
          onSaveSchedule={onSaveSchedule}
        />
      )}
    </>
  );
}
