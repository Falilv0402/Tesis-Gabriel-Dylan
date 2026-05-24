"use client";

/**
 * DiagnosticoStability — sections 6-7 of DiagnosticoFinal:
 *   • Monotonicity verification + Stability analysis
 *   • Model version history + Retraining schedule
 */

import { Save } from "lucide-react";
import {
  CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Diagnostico, Metrics } from "@/types";
import { Panel, Kpi, EmptyState } from "@/components/ui/Primitives";
import { pct } from "@/lib/format";
import { featureLabels } from "@/lib/constants";

interface Props {
  diagnostico:    Diagnostico;
  metrics:        Metrics;
  scheduleFreq:   string;
  setScheduleFreq:(v: string) => void;
  scheduleMsg:    string;
  nextUpdate:     string | null;
  onSaveSchedule: () => void;
}

export function DiagnosticoStability({
  diagnostico, metrics,
  scheduleFreq, setScheduleFreq,
  scheduleMsg, nextUpdate, onSaveSchedule,
}: Props) {
  return (
    <>
      {/* ── Monotonicity + Stability ─────────────────────── */}
      <section className="two-col">
        <Panel title="Verificación de monotonicidad post-entrenamiento">
          {diagnostico.monotonicity_check && Object.keys(diagnostico.monotonicity_check).length > 0 ? (
            <>
              <div className="model-note" style={{ marginBottom: 8 }}>
                Verifica que las constraints monotónicas se respetan en el conjunto de test.
              </div>
              {Object.entries(diagnostico.monotonicity_check).map(([feat, check]) => {
                const pct_val = check.compliance_pct;
                const tone    = pct_val >= 95 ? "#16a34a" : pct_val >= 85 ? "#d97706" : "#dc2626";
                return (
                  <div key={feat} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 12 }}>{featureLabels[feat] ?? feat}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: tone }}>
                        {pct_val >= 95 ? "✓ Cumple" : pct_val >= 85 ? "△ Parcial" : "✗ Viola"} — {pct_val.toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${pct_val}%`, height: "100%", background: tone, borderRadius: 4, transition: "width 0.5s ease" }} />
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{check.violations} violaciones detectadas</div>
                  </div>
                );
              })}
            </>
          ) : <EmptyState message="Reentrena el modelo para verificar las constraints de monotonicidad." />}
        </Panel>

        <Panel title="Estabilidad del modelo (multi-semilla)">
          {diagnostico.stability && Array.isArray(diagnostico.stability.auc_per_seed) && diagnostico.stability.auc_per_seed.length > 0 ? (
            <>
              <div className="model-note" style={{ marginBottom: 8 }}>
                Variación del AUC al cambiar la semilla aleatoria. Baja variabilidad confirma robustez.
              </div>
              <div className="metric-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
                <Kpi label="AUC medio"      value={typeof diagnostico.stability.mean === "number" ? pct(diagnostico.stability.mean) : "—"} detail="multi-semilla" tone="low" />
                <Kpi
                  label="Desv. estándar"
                  value={typeof diagnostico.stability.std === "number" ? `${(diagnostico.stability.std * 100).toFixed(3)} pp` : "—"}
                  detail={typeof diagnostico.stability.std === "number" ? (diagnostico.stability.std < 0.01 ? "✓ baja" : diagnostico.stability.std < 0.02 ? "△ media" : "⚠ alta") : "—"}
                  tone={typeof diagnostico.stability.std === "number" ? (diagnostico.stability.std < 0.01 ? "low" : diagnostico.stability.std < 0.02 ? "medium" : "high") : undefined}
                />
                <Kpi label="Mínimo" value={typeof diagnostico.stability.min === "number" ? pct(diagnostico.stability.min) : "—"} detail="peor semilla" />
                <Kpi label="Máximo" value={typeof diagnostico.stability.max === "number" ? pct(diagnostico.stability.max) : "—"} detail="mejor semilla" />
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart
                  data={diagnostico.stability.auc_per_seed.map((auc, i) => ({ semilla: i + 1, auc: +(auc * 100).toFixed(3) }))}
                  margin={{ top: 4, right: 16, left: -8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="semilla" tick={{ fontSize: 10 }} />
                  <YAxis
                    domain={[+(diagnostico.stability.min * 100 - 2).toFixed(1), +(diagnostico.stability.max * 100 + 2).toFixed(1)]}
                    unit="%" tick={{ fontSize: 10 }}
                  />
                  <Tooltip formatter={(v: unknown) => `${Number(v).toFixed(3)}%`} />
                  <Line type="monotone" dataKey="auc" name="AUC" stroke="var(--accent)" strokeWidth={2} dot={{ fill: "var(--accent)", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : <EmptyState message="Reentrena con múltiples semillas para ver el análisis de estabilidad." />}
        </Panel>
      </section>

      {/* ── Historial + Schedule ──────────────────────────── */}
      <section className="two-col">
        <Panel title="Histórico de versiones del modelo">
          <div className="model-note" style={{ marginBottom: 10 }}>
            Registro de cada reentrenamiento con sus métricas.
          </div>
          {metrics.trained_at ? (
            <div style={{ position: "relative", paddingLeft: 24 }}>
              <div style={{ position: "absolute", left: 8, top: 0, bottom: 0, width: 2, background: "var(--border)" }} />
              <div style={{ position: "relative", marginBottom: 16, paddingLeft: 12 }}>
                <div style={{ position: "absolute", left: -20, top: 4, width: 12, height: 12, borderRadius: "50%", background: "var(--accent)", border: "2px solid var(--surface)", zIndex: 1 }} />
                <div style={{ background: "var(--accent-soft)", borderRadius: 8, padding: "10px 14px", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <strong style={{ fontSize: 13, color: "var(--navy)" }}>v1.0 — actual</strong>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {new Date(metrics.trained_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{metrics.modelo_ganador ?? "—"}</div>
                  <div className="metric-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                    <Kpi label="AUC-ROC" value={pct(metrics.auc_roc)} detail="test" />
                    <Kpi label="F1"      value={pct(metrics.f1_score)} detail="test" />
                    {typeof metrics.pr_auc === "number" && <Kpi label="PR-AUC" value={pct(metrics.pr_auc)} detail="test" />}
                  </div>
                </div>
              </div>
            </div>
          ) : <EmptyState message="Reentrena el modelo para registrar la primera versión." />}
        </Panel>

        <Panel title="Configuración de actualización periódica">
          <div className="model-note" style={{ marginBottom: 8 }}>
            Programa la frecuencia de reentrenamiento del modelo.
          </div>
          <label>Frecuencia de actualización
            <select value={scheduleFreq} onChange={(e) => setScheduleFreq(e.target.value)}>
              <option value="semanal">Semanal</option>
              <option value="mensual">Mensual</option>
              <option value="semestral">Semestral</option>
            </select>
          </label>
          <button onClick={onSaveSchedule}><Save size={16} /> Guardar programación</button>
          {scheduleMsg  && <p className="model-note" style={{ color: "var(--accent)" }}>{scheduleMsg}</p>}
          {nextUpdate   && <p className="model-note">Próxima actualización: <strong>{nextUpdate}</strong></p>}
        </Panel>
      </section>
    </>
  );
}
