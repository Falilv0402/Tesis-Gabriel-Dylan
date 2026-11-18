"use client";

import {
  Bar as RBar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Panel, Kpi, Bar, EmptyState } from "@/components/ui/Primitives";
import { ConfusionMatrix } from "@/components/charts/ConfusionMatrix";
import { RocMiniChart } from "@/components/charts/RocMiniChart";
import { pct } from "@/lib/format";
import type { ColegioModelSummary } from "@/hooks/useColegioModels";
import { UsoRealPanel } from "./UsoRealPanel";

const ROJO = "#dc2626";
const AMBAR = "#d97706";
const VERDE = "#16a34a";

const grid2: React.CSSProperties = {
  display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
};

/** Orden natural de salones («1° A», «2° A», «10° B»…): por número y luego por letra. */
export function ordenarSalones(a: string, b: string): number {
  return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
}

/**
 * Gráficos de UN colegio para la supervisión del superadmin: lo que antes mostraba el panel del modelo
 * nacional (métricas, reparto por nivel, matriz de confusión, curva ROC), pero con los datos del modelo
 * propio del colegio, más el riesgo por salón y las variables que más pesan. Se dejó fuera lo muy técnico
 * (SHAP, umbrales, calibración): no se puede explicar en una pantalla.
 */
export function DetalleColegio({ c }: { c: ColegioModelSummary }) {
  const ppm = (v: number | null) => (v != null ? pct(v) : "—");
  const total = c.n_alto + c.n_medio + c.n_bajo;

  const salones = Object.entries(c.por_salon ?? {})
    .sort(([a], [b]) => ordenarSalones(a, b))
    .map(([salon, v]) => ({ salon, Alto: v.ALTO ?? 0, Medio: v.MEDIO ?? 0, Bajo: v.BAJO ?? 0 }));

  const importancias = (c.importancia_variables ?? []).slice(0, 8);
  const maxImp = importancias[0]?.importancia || 1;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Métricas del modelo */}
      <div className="metric-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <Kpi
          label="AUC CV"
          value={ppm(c.auc_cv)}
          detail={c.n_splits_cv ? `validación cruzada · ${c.n_splits_cv} particiones` : "validación cruzada"}
          tone={c.auc_cv != null && c.auc_cv >= 0.85 ? "low" : c.auc_cv != null && c.auc_cv >= 0.7 ? "medium" : "high"}
        />
        <Kpi label="F1 CV" value={ppm(c.f1_cv)} detail="equilibrio entre acierto y cobertura" />
        <Kpi label="Precisión CV" value={ppm(c.precision_cv)} detail="de los que marca en riesgo, cuántos lo están" />
        <Kpi label="Recall CV" value={ppm(c.recall_cv)} detail="de los que están en riesgo, cuántos detecta" />
        <Kpi label="Accuracy*" value={ppm(c.accuracy_train)} detail="entrenamiento (referencia)" />
      </div>

      {c.uso_real && <UsoRealPanel u={c.uso_real} />}

      <div style={grid2}>
        {/* Reparto por nivel */}
        <Panel title="Reparto de alumnos por nivel de riesgo">
          <Bar label={`Riesgo alto · ${c.n_alto}`} value={c.n_alto / Math.max(total, 1)} tone="high" />
          <Bar label={`Riesgo medio · ${c.n_medio}`} value={c.n_medio / Math.max(total, 1)} tone="medium" />
          <Bar label={`Riesgo bajo · ${c.n_bajo}`} value={c.n_bajo / Math.max(total, 1)} tone="low" />
          {total > 0 && (
            <ResponsiveContainer width="100%" height={170} style={{ marginTop: 6 }}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Alto", value: c.n_alto },
                    { name: "Medio", value: c.n_medio },
                    { name: "Bajo", value: c.n_bajo },
                  ]}
                  cx="50%" cy="50%" innerRadius={42} outerRadius={64} paddingAngle={3} dataKey="value"
                >
                  <Cell fill={ROJO} /><Cell fill={AMBAR} /><Cell fill={VERDE} />
                </Pie>
                <Tooltip formatter={(v) => Number(v).toLocaleString("es-PE")} />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="model-note">
            {c.n_alumnos.toLocaleString("es-PE")} alumnos modelados · {c.pct_riesgo}% en riesgo (alto + medio).
          </div>
        </Panel>

        {/* Riesgo por salón */}
        <Panel title="Riesgo por salón">
          {salones.length === 0 ? (
            <EmptyState message="Este modelo no trae el detalle por salón." />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(190, salones.length * 26 + 56)}>
              <BarChart data={salones} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="salon" width={64} tick={{ fontSize: 11 }} interval={0} />
                <Tooltip />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <RBar dataKey="Alto" stackId="r" fill={ROJO} />
                <RBar dataKey="Medio" stackId="r" fill={AMBAR} />
                <RBar dataKey="Bajo" stackId="r" fill={VERDE} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="model-note">Cuántos alumnos de cada salón caen en cada nivel.</div>
        </Panel>
      </div>

      <div style={grid2}>
        <Panel title="Aciertos y errores del modelo">
          <ConfusionMatrix matrix={c.confusion_matrix ?? undefined} />
          <div className="model-note" style={{ fontSize: 11 }}>
            <strong>VP</strong> en riesgo y detectado · <strong>VN</strong> sin riesgo y bien clasificado ·{" "}
            <strong>FP</strong> falsa alarma · <strong>FN</strong> en riesgo que el modelo no detectó. Calculada con los
            mismos alumnos del entrenamiento (referencia).
          </div>
        </Panel>

        <Panel title="Curva ROC">
          <RocMiniChart fpr={c.roc_fpr ?? undefined} tpr={c.roc_tpr ?? undefined} auc={c.auc_train ?? undefined} />
          <div className="model-note" style={{ fontSize: 11 }}>
            Mientras más pegada a la esquina superior izquierda, mejor separa a los alumnos en riesgo de los que no.
            La línea punteada es el azar. El AUC de esta curva es de entrenamiento (referencia); el válido es el AUC CV.
          </div>
        </Panel>
      </div>

      <Panel title="Qué datos pesan más en la predicción">
        {importancias.length === 0 ? (
          <EmptyState message="Este modelo no trae la importancia de variables." />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {importancias.map((d) => (
              <div
                key={d.variable}
                style={{ display: "grid", gridTemplateColumns: "minmax(150px, 1.2fr) 2fr 48px", alignItems: "center", gap: 10 }}
              >
                <span style={{ fontSize: 12 }}>{d.variable}</span>
                <div style={{ height: 8, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.max((d.importancia / maxImp) * 100, 3)}%`, background: "var(--accent)", borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textAlign: "right" }}>
                  {(d.importancia * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="model-note" style={{ fontSize: 11 }}>
          Ranking general de qué notas e historial pesan más al calcular el riesgo de este colegio (bosque aleatorio).
          No explica a un alumno en particular.
        </div>
      </Panel>
    </div>
  );
}
