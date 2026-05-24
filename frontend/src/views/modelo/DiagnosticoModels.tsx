"use client";

/**
 * DiagnosticoModels — sections 1-3 of DiagnosticoFinal:
 *   • Learning Curve + Policies
 *   • Stacking Ensemble + Optuna/AutoML
 *   • GridSearchCV + Fair Thresholds
 */

import {
  CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Diagnostico, Metrics } from "@/types";
import { Panel, Kpi, EmptyState } from "@/components/ui/Primitives";
import { pct } from "@/lib/format";

interface Props {
  diagnostico: Diagnostico;
  metrics: Metrics;
}

export function DiagnosticoModels({ diagnostico, metrics }: Props) {
  return (
    <>
      {/* ── Learning Curve + Políticas ──────────────────────── */}
      <section className="two-col">
        <Panel title="Learning Curve — AUC vs. tamaño de entrenamiento">
          {diagnostico.learning_curve && Array.isArray(diagnostico.learning_curve.train_sizes) && diagnostico.learning_curve.train_sizes.length > 0 ? (
            <>
              <div className="model-note" style={{ marginBottom: 8 }}>
                Muestra si el modelo mejora con más datos o si ya converge. La brecha indica overfitting.
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart
                  data={diagnostico.learning_curve.train_sizes.map((n, i) => ({
                    n,
                    train: +((diagnostico.learning_curve!.train_auc_mean[i] ?? 0) * 100).toFixed(2),
                    val: +((diagnostico.learning_curve!.val_auc_mean[i] ?? 0) * 100).toFixed(2),
                  }))}
                  margin={{ top: 8, right: 16, left: -8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="n" tick={{ fontSize: 11 }} label={{ value: "Ejemplos de entrenamiento", position: "insideBottom", offset: -2, style: { fontSize: 11 } }} />
                  <YAxis domain={[50, 100]} unit="%" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${Number(v).toFixed(2)}%`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="train" name="Train AUC" stroke="#7c3aed" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="val" name="Validación AUC" stroke="var(--accent)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
              {(() => {
                const lc = diagnostico.learning_curve!;
                const lastTrain = lc.train_auc_mean[lc.train_auc_mean.length - 1];
                const lastVal   = lc.val_auc_mean[lc.val_auc_mean.length - 1];
                const gap = lastTrain - lastVal;
                return (
                  <div className={`fairness-summary fairness-${gap > 0.10 ? "alta" : gap > 0.05 ? "media" : "ok"}`} style={{ marginTop: 8 }}>
                    <strong>Gap final (train − val):</strong> {(gap * 100).toFixed(2)} pp →{" "}
                    {gap > 0.10 ? "⚠ Posible sobreajuste" : gap > 0.05 ? "△ Brecha moderada — aceptable" : "✓ Buena generalización"}
                  </div>
                );
              })()}
            </>
          ) : <EmptyState message="Reentrena el modelo para ver la curva de aprendizaje." />}
        </Panel>

        <Panel title="Umbrales multi-objetivo (3 políticas)">
          {diagnostico.policies && Object.keys(diagnostico.policies).length > 0 ? (
            <>
              <div className="model-note" style={{ marginBottom: 8 }}>
                Cada política optimiza un objetivo diferente según el contexto pedagógico.
              </div>
              {Object.entries(diagnostico.policies).map(([key, pol]) => {
                const icon  = key === "max_recall" ? "📡" : key === "max_precision" ? "🎯" : "⚖️";
                const color = key === "max_recall" ? "#2563eb" : key === "max_precision" ? "#059669" : "#7c3aed";
                return (
                  <div key={key} className="grid-result-item" style={{ borderLeft: `3px solid ${color}` }}>
                    <div className="grid-result-name">{icon} {key.replace("_", " ").replace("max ", "Maximizar ")}</div>
                    <div className="model-note" style={{ fontSize: 11, marginBottom: 4 }}>{pol.descripcion}</div>
                    <div className="metric-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                      <Kpi label="Umbral"    value={`${(pol.threshold * 100).toFixed(0)}%`} detail="clasificación" />
                      <Kpi label="Recall"    value={pct(pol.recall)}    detail="sensibilidad" />
                      <Kpi label="Precisión" value={pct(pol.precision)} detail="exactitud" />
                    </div>
                  </div>
                );
              })}
            </>
          ) : <EmptyState message="Reentrena el modelo para ver las políticas de umbral." />}
        </Panel>
      </section>

      {/* ── Stacking + Optuna ─────────────────────────────── */}
      <section className="two-col">
        <Panel title="Stacking ensemble (soft-voting)">
          {diagnostico.stacking_result && !("error" in diagnostico.stacking_result) && "auc_cv_mean" in diagnostico.stacking_result ? (
            <>
              <div className="model-note" style={{ marginBottom: 8 }}>
                Ensemble de los 2 mejores modelos con votación suave.
              </div>
              <div className="metric-grid">
                <Kpi
                  label="AUC-CV Stacking"
                  value={typeof diagnostico.stacking_result.auc_cv_mean === "number" ? pct(diagnostico.stacking_result.auc_cv_mean) : "—"}
                  detail={typeof diagnostico.stacking_result.auc_cv_std === "number" ? `±${(diagnostico.stacking_result.auc_cv_std * 100).toFixed(2)} pp` : "—"}
                />
                <Kpi label="F1-CV Stacking" value={pct(diagnostico.stacking_result.f1_cv_mean as number)} detail="media CV" />
                <Kpi
                  label="Ganador" value={diagnostico.stacking_result.ganador ? "Stacking" : "Individual"}
                  detail={diagnostico.stacking_result.ganador ? "Stacking supera al mejor individual" : "El modelo individual es mejor"}
                  tone={diagnostico.stacking_result.ganador ? "low" : "medium"}
                />
              </div>
              <div className="model-note" style={{ marginTop: 6, fontSize: 11 }}>
                Modelos base: {(diagnostico.stacking_result.modelos_base as string[])?.join(" + ")}
              </div>
            </>
          ) : <EmptyState message={String(diagnostico.stacking_result?.error ?? "Reentrena para ver el stacking.")} />}
        </Panel>

        <Panel title="Bayesian tuning con Optuna">
          {diagnostico.optuna_result && "best_auc_cv" in diagnostico.optuna_result ? (
            <>
              <div className="model-note" style={{ marginBottom: 8 }}>
                Tuning bayesiano con <code>TPESampler</code> ({diagnostico.optuna_result.n_trials as number} trials).
              </div>
              <Kpi label="Mejor AUC-CV (Optuna)" value={pct(diagnostico.optuna_result.best_auc_cv as number)} detail={`${diagnostico.optuna_result.n_trials} trials`} />
              <div className="model-note" style={{ fontFamily: "monospace", fontSize: 11, marginTop: 8 }}>
                {Object.entries(diagnostico.optuna_result.best_params as Record<string, unknown>).map(([k, v]) =>
                  `${k}=${JSON.stringify(v)}`
                ).join("  ·  ")}
              </div>
            </>
          ) : diagnostico.optuna_result?.available === false ? (
            <div className="model-note">Optuna no instalado. Ejecuta <code>pip install optuna</code> para activar el tuning bayesiano.</div>
          ) : <EmptyState message={String(diagnostico.optuna_result?.error ?? "Optuna no disponible.")} />}

          {/* AutoML comparison */}
          <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: "var(--navy)", marginBottom: 8 }}>Comparación AutoML (FLAML)</div>
            {diagnostico.automl_result?.available ? (
              <>
                <div className="metric-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <Kpi label="AutoML estimador" value={diagnostico.automl_result.best_estimator ?? "—"} detail="FLAML best model" />
                  <Kpi label="AutoML AUC-CV" value={typeof diagnostico.automl_result.best_auc_cv === "number" ? pct(diagnostico.automl_result.best_auc_cv) : "—"} detail="upper-bound automático" />
                </div>
                {typeof diagnostico.automl_result.best_auc_cv === "number" && typeof metrics.auc_roc === "number" && (
                  <div className="model-note" style={{ marginTop: 6, padding: "6px 10px", borderRadius: 6, background: "var(--accent-soft)" }}>
                    Tu modelo: <strong>{pct(metrics.auc_roc)}</strong> · AutoML: <strong>{pct(diagnostico.automl_result.best_auc_cv)}</strong>
                    {diagnostico.automl_result.best_auc_cv - metrics.auc_roc <= 0.02
                      ? <span style={{ color: "#16a34a", marginLeft: 8, fontWeight: 700 }}>✓ Dentro del 2% — justifica diseño manual</span>
                      : <span style={{ color: "#d97706", marginLeft: 8, fontWeight: 700 }}>△ Brecha {((diagnostico.automl_result.best_auc_cv - metrics.auc_roc) * 100).toFixed(1)} pp</span>
                    }
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6, background: "#fef9c3", border: "1px solid #fde047", fontSize: 12, color: "#92400e" }}>
                <span>FLAML no instalado</span>
                <code style={{ background: "#fef3c7", padding: "1px 6px", borderRadius: 4 }}>pip install flaml</code>
              </div>
            )}
          </div>
        </Panel>
      </section>

      {/* ── GridSearch + Fair Thresholds ─────────────────── */}
      <section className="two-col">
        <Panel title="Ajuste de hiperparametros (GridSearchCV)">
          {diagnostico.grid_resultados && Object.keys(diagnostico.grid_resultados).length > 0 ? (
            <>
              <div className="model-note" style={{ marginBottom: 8 }}>
                Búsqueda exhaustiva con <code>GridSearchCV</code> + <code>GroupKFold(5)</code>.
              </div>
              {Object.entries(diagnostico.grid_resultados).map(([nombre, res]) => (
                <div key={nombre} className="grid-result-item">
                  <div className="grid-result-name">{nombre}</div>
                  <div className="model-note">Mejor AUC-CV: <strong>{pct(res.best_auc_cv)}</strong></div>
                  <div className="model-note" style={{ fontFamily: "monospace", fontSize: 11 }}>
                    {Object.entries(res.best_params).map(([k, v]) => `${k.replace("clf__", "")}=${JSON.stringify(v)}`).join(" · ")}
                  </div>
                </div>
              ))}
            </>
          ) : <EmptyState message="Reentrena el modelo para ver los resultados de GridSearch." />}
        </Panel>

        <Panel title="Umbrales de equidad por grupo (Fairness)">
          {diagnostico.fair_thresholds && Object.keys(diagnostico.fair_thresholds).length > 0 ? (
            <>
              <div className="model-note" style={{ marginBottom: 8 }}>
                Umbral de clasificación que maximiza el F1 dentro de cada grupo.
              </div>
              <table style={{ width: "100%", fontSize: 13 }}>
                <tbody>
                  <tr><th style={{ textAlign: "left" }}>Grupo</th><th>Umbral óptimo F1</th><th>Diferencia vs. global (70%)</th></tr>
                  {Object.entries(diagnostico.fair_thresholds).map(([grupo, thr]) => {
                    const diff = (thr - 0.70) * 100;
                    return (
                      <tr key={grupo}>
                        <td><strong>{grupo}</strong></td>
                        <td style={{ textAlign: "center" }}>{(thr * 100).toFixed(0)}%</td>
                        <td style={{ textAlign: "center", color: Math.abs(diff) > 5 ? "#dc2626" : "#22c55e" }}>
                          {diff > 0 ? "+" : ""}{diff.toFixed(1)} pp
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : <EmptyState message="Reentrena el modelo para generar umbrales de equidad." />}
        </Panel>
      </section>
    </>
  );
}
