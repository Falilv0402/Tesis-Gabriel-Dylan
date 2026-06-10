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
import { featureLabels, modelLabel } from "@/lib/constants";
import { pct, fmt } from "@/lib/format";
import { DiagnosticoAvanzado } from "@/views/modelo/DiagnosticoAvanzado";
import type { ColegioModelSummary } from "@/hooks/useColegioModels";

interface LiveMetrics {
  tp: number; fp: number; tn: number; fn: number;
  accuracy: number; precision: number; recall: number; f1: number; n: number;
}

interface ModeloViewProps {
  colegioModels: ColegioModelSummary[];
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
  colegioModels,
  metrics, evaluation, diagnostico, globalSummary,
  topFactors, maxImportance, liveMetrics,
  thresholdHigh, setThresholdHigh, thresholdMedium, setThresholdMedium,
  scheduleFreq, setScheduleFreq, scheduleMsg, nextUpdate,
  modelMessage, onRetrain, onSaveSchedule,
}: ModeloViewProps) {
  const ppm = (v: number | null) => v != null ? pct(v) : "—";
  return (
    <>
      {/* ── Modelos de colegio (CUBICOL) — supervisión del superadmin ───── */}
      {colegioModels.length > 0 && (
        <section className="full-col">
          <Panel title="Modelos de colegio (CUBICOL) — supervisión">
            <div className="model-note" style={{ marginBottom: 8 }}>
              Modelos propios entrenados por colegio (Ensemble híbrido LR + RF, calibrado · predictivo B1-B3 → B4).
              La métrica válida es el <strong>AUC CV</strong>; las marcadas con <strong>*</strong> son de entrenamiento (referencia).
            </div>
            <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--navy)", color: "#fff" }}>
                    <th style={thM}>Colegio</th>
                    <th style={{ ...thM, textAlign: "right" }}>Alumnos</th>
                    <th style={{ ...thM, textAlign: "right" }}>En riesgo</th>
                    <th style={{ ...thM, textAlign: "right" }}>AUC CV</th>
                    <th style={{ ...thM, textAlign: "right" }}>F1*</th>
                    <th style={{ ...thM, textAlign: "right" }}>Precisión*</th>
                    <th style={{ ...thM, textAlign: "right" }}>Recall*</th>
                    <th style={{ ...thM, textAlign: "right" }}>Accuracy*</th>
                  </tr>
                </thead>
                <tbody>
                  {colegioModels.map((c, i) => (
                    <tr key={c.codigo_ie} style={{ background: i % 2 === 0 ? "var(--surface)" : "transparent", borderBottom: "1px solid var(--border)" }}>
                      <td style={tdM}>
                        <strong>{c.nombre_colegio}</strong>{" "}
                        <span style={{ color: "var(--text-muted)" }}>IE {c.codigo_ie}</span>
                      </td>
                      <td style={{ ...tdM, textAlign: "right" }}>{c.n_alumnos.toLocaleString("es-PE")}</td>
                      <td style={{ ...tdM, textAlign: "right" }}>{c.n_riesgo} <span style={{ color: "var(--text-muted)" }}>({c.pct_riesgo}%)</span></td>
                      <td style={{ ...tdM, textAlign: "right", fontWeight: 700, color: "#16a34a" }}>{ppm(c.auc_cv)}</td>
                      <td style={{ ...tdM, textAlign: "right" }}>{ppm(c.f1_train)}</td>
                      <td style={{ ...tdM, textAlign: "right" }}>{ppm(c.precision_train)}</td>
                      <td style={{ ...tdM, textAlign: "right" }}>{ppm(c.recall_train)}</td>
                      <td style={{ ...tdM, textAlign: "right" }}>{ppm(c.accuracy_train)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="model-note" style={{ marginTop: 8, fontSize: 11 }}>
              <strong>*</strong> métricas de entrenamiento (en muestra, optimistas). El <strong>AUC CV</strong> (validación cruzada) es el indicador válido.
            </div>
          </Panel>
        </section>
      )}

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
            Modelo: <strong>{modelLabel(metrics.modelo_ganador)}</strong> &nbsp;|&nbsp;
            Train: <strong>{metrics.train_rows?.toLocaleString("es-PE") ?? "—"}</strong> alumnos &nbsp;|&nbsp;
            Test: <strong>{metrics.test_rows?.toLocaleString("es-PE") ?? "—"}</strong> alumnos
          </div>
          <div className="model-note">{metrics.scope ?? ""}</div>

          {diagnostico?.cv_metrics && (
            <div className="hybrid-cv-box">
              <div className="hybrid-cv-title">
                <span className="hybrid-cv-badge">Ensemble Híbrido · LR + RF</span>
                Validación cruzada ({diagnostico.cv_metrics.n_splits}-fold por colegio)
              </div>
              <div className="metric-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))" }}>
                <Kpi
                  label="Precisión CV"
                  value={pct(diagnostico.cv_metrics.precision_cv_mean)}
                  detail={`±${(diagnostico.cv_metrics.precision_cv_std * 100).toFixed(2)} pp`}
                  tone="low"
                />
                <Kpi
                  label="Recall CV"
                  value={pct(diagnostico.cv_metrics.recall_cv_mean)}
                  detail={`±${(diagnostico.cv_metrics.recall_cv_std * 100).toFixed(2)} pp`}
                />
                <Kpi
                  label="F1 CV"
                  value={pct(diagnostico.cv_metrics.f1_cv_mean)}
                  detail={`±${(diagnostico.cv_metrics.f1_cv_std * 100).toFixed(2)} pp`}
                />
                <Kpi
                  label="Accuracy CV"
                  value={pct(diagnostico.cv_metrics.accuracy_cv_mean)}
                  detail={`±${(diagnostico.cv_metrics.accuracy_cv_std * 100).toFixed(2)} pp`}
                />
                <Kpi
                  label="AUC CV"
                  value={pct(diagnostico.cv_metrics.auc_cv_mean)}
                  detail={`±${(diagnostico.cv_metrics.auc_cv_std * 100).toFixed(2)} pp`}
                  tone="low"
                />
              </div>
            </div>
          )}
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

// ── Estilos tabla "Modelos de colegio" ─────────────────────────────────────────
const thM: React.CSSProperties = {
  padding: "8px 10px", textAlign: "left", fontSize: 11,
  fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.03em",
};
const tdM: React.CSSProperties = {
  padding: "7px 10px", whiteSpace: "nowrap",
};
