import React from "react";
import { Bar as RBar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel, Bar } from "@/components/ui/Primitives";
import { ConfusionMatrix } from "./ConfusionMatrix";
import { RocMiniChart } from "./RocMiniChart";
import { evaluacionColegio, porcentajeEvaluacion as pp } from "@/lib/evaluacionColegio";

export function GraficosInformeColegio({ codigoIe }: { codigoIe: string | null | undefined }) {
  const informe = evaluacionColegio(codigoIe);
  if (!informe) return null;
  const g = informe.graficos;
  const c = g.clasificacion;
  const m = informe.metricas_macro;
  const metricasMatriz: [string, number][] = [
    ["Accuracy", m.accuracy_cv],
    ["Precisión macro", m.precision_macro_cv],
    ["Recall macro", m.recall_macro_cv],
    ["F1 macro", m.f1_macro_cv],
  ];
  const salones = [...g.por_salon].sort((a, b) => a.salon.localeCompare(b.salon, "es", { numeric: true })).map((s) => ({ salon: s.salon, "Con riesgo": s.en_riesgo_predicho, "Sin riesgo": s.sin_riesgo_predicho }));
  return (
    <section aria-label="Gráficos del informe" style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))" }}>
        <Panel title="Matriz de confusión">
          <ConfusionMatrix matrix={g.matriz_confusion} showPercentages />
          <p className="model-note">{c.total} alumnos evaluados · filas: resultado real · columnas: clasificación del modelo.</p>
          <p className="model-note">Porcentajes sobre el total de cada fila; cada fila suma 100%. Verde: aciertos · rojo: errores.</p>
          <dl aria-label="Métricas derivadas de la matriz" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, margin: "12px 0 0", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            {metricasMatriz.map(([label, value]) => <div key={label}>
              <dt style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</dt>
              <dd style={{ margin: "3px 0 0", fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>{pp(value)}</dd>
            </div>)}
          </dl>
          <p className="model-note">Macro: promedio de las métricas de las dos clases.</p>
        </Panel>
        <Panel title="Curva ROC">
          <RocMiniChart fpr={g.roc.fpr} tpr={g.roc.tpr} auc={g.roc.auc} decimals={2} />
          <p className="model-note">Predicciones de validación cruzada del informe del 18/11/2026.</p>
        </Panel>
        <Panel title="Clasificación de alumnos">
          <Bar label={`Clasificados con riesgo · ${c.en_riesgo}`} value={c.en_riesgo / c.total} tone="high" />
          <Bar label={`Clasificados sin riesgo · ${c.sin_riesgo}`} value={c.sin_riesgo / c.total} tone="low" />
          <ResponsiveContainer width="100%" height={175}>
            <PieChart><Pie data={[{ name: "Con riesgo", value: c.en_riesgo }, { name: "Sin riesgo", value: c.sin_riesgo }]} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={62}>
              <Cell fill="#dc2626" /><Cell fill="#16a34a" />
            </Pie><Tooltip /><Legend iconType="circle" iconSize={10} /></PieChart>
          </ResponsiveContainer>
          <p className="model-note">Total: {c.total} alumnos · {c.en_riesgo_real} con riesgo real.</p>
        </Panel>
        <Panel title="Clasificación por salón">
          <ResponsiveContainer width="100%" height={Math.max(220, salones.length * 26 + 56)}>
            <BarChart data={salones} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="salon" width={50} />
              <Tooltip /><Legend iconType="circle" iconSize={10} /><RBar dataKey="Con riesgo" stackId="alumnos" fill="#dc2626" /><RBar dataKey="Sin riesgo" stackId="alumnos" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
          <p className="model-note">Clasificaciones de los mismos {c.total} alumnos del informe.</p>
        </Panel>
      </div>
    </section>
  );
}
