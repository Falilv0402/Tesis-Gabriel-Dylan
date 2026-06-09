"use client";

import { useState } from "react";
import {
  Activity, BarChart3, CalendarRange, CheckCircle2, MessageSquare, Pencil, Plus, Save, Users, TrendingUp,
} from "lucide-react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { AlumnoColegio, Tab } from "@/types";
import { Panel, EmptyState } from "@/components/ui/Primitives";
import { pct, riskClass } from "@/lib/format";
import { MATERIAS_COLEGIO, anioFromSalon, notaInfo, notaBimestre, colegioStudentId, type Bimestre } from "@/lib/colegio";

interface Annotation { id: string; estudiante_id: string; contenido: string; created_at: string; autor_nombre?: string | null; autor_email?: string | null; es_propia?: boolean }
interface Milestone  { id: string; texto: string; fecha: string; completado: boolean; autor_nombre?: string | null; autor_email?: string | null; es_propio?: boolean }

interface ColegioEstudianteViewProps {
  role: string;
  alumno: AlumnoColegio | undefined;
  annotations: Annotation[];
  annotationText: string;
  setAnnotationText: (v: string) => void;
  isSavingAnnotation: boolean;
  planMilestones: Milestone[];
  newMilestone: string;
  setNewMilestone: (v: string) => void;
  newMilestoneDate: string;
  setNewMilestoneDate: (v: string) => void;
  studentTab: "resumen" | "anotaciones" | "plan";
  setStudentTab: (v: "resumen" | "anotaciones" | "plan") => void;
  setTab: (tab: Tab) => void;
  saveAnnotation: () => void;
  loadAnnotations: (id: string) => void;
  addMilestone: () => void;
  toggleMilestone: (id: string) => void;
  loadMilestones: (id: string) => void;
  isLoadingMilestones: boolean;
}

const LINE_COLORS: Record<string, string> = {
  "Matemática":      "#2563eb",
  "Comunicación":    "#7c3aed",
  "Ciencia y Tec.":  "#0891b2",
  "Personal Social": "#f59e0b",
  "Inglés":          "#db2777",
  "Arte y Cultura":  "#84cc16",
  "Ed. Física":      "#f97316",
};

export function ColegioEstudianteView({
  role, alumno,
  annotations, annotationText, setAnnotationText, isSavingAnnotation,
  planMilestones, newMilestone, setNewMilestone, newMilestoneDate, setNewMilestoneDate,
  studentTab, setStudentTab, setTab,
  saveAnnotation, loadAnnotations, addMilestone, toggleMilestone, loadMilestones, isLoadingMilestones,
}: ColegioEstudianteViewProps) {
  const canEditAll = role === "director";
  const [bimestreDetalle, setBimestreDetalle] = useState<Bimestre>("1");

  if (!alumno) {
    return (
      <section className="full-col">
        <Panel title="Detalle del alumno">
          <div className="empty-state-large">
            <Users size={48} style={{ opacity: 0.4, marginBottom: 12 }} />
            <h3 style={{ margin: "0 0 6px" }}>No hay alumno seleccionado</h3>
            <p className="model-note" style={{ marginBottom: 14 }}>
              Ve al Dashboard o Reportes y haz clic en un alumno para ver su detalle aquí.
            </p>
            <button className="primary" onClick={() => setTab("dashboard")}>
              <BarChart3 size={14} /> Ir al Dashboard
            </button>
          </div>
        </Panel>
      </section>
    );
  }

  const sid = colegioStudentId(alumno);
  const anioLabel = anioFromSalon(alumno.salon).label;

  // Colores derivados del nivel de riesgo y de las notas
  const gaugeColor  = alumno.nivel_riesgo === "ALTO" ? "#dc2626"
                    : alumno.nivel_riesgo === "MEDIO" ? "#d97706"
                    : "#16a34a";
  const gradeColor  = (n: number | null | undefined) =>
    n == null ? "var(--text-muted)" : n >= 15 ? "#16a34a" : n >= 13 ? "#d97706" : "#dc2626";
  const promedioNum = alumno.promedio_materias  != null ? Number(alumno.promedio_materias)  : null;
  const conductaNum = alumno.conducta_promedio  != null ? Number(alumno.conducta_promedio)  : null;
  const cursosC     = alumno.n_materias_c ?? 0;

  // Trayectoria de notas por bimestre y materia (B1-B4)
  const trayectoria = (["1", "2", "3", "4"] as const).map((b) => {
    const row: Record<string, number | string | null> = { bimestre: `B${b}` };
    for (const m of MATERIAS_COLEGIO) row[m.label] = notaBimestre(alumno, m.key, b);
    return row;
  });

  const annsDeAlumno = annotations.filter((a) => a.estudiante_id === sid);

  return (
    <section className="full-col">
      <Panel title={`${alumno.nombre} — Detalle del alumno`}>
        <div className="student-detail-page">
          <div className="student-detail-header">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "var(--navy)", lineHeight: 1.2 }}>
                {alumno.nombre}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className={riskClass(alumno.nivel_riesgo)}>{alumno.nivel_riesgo}</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ opacity: 0.35, fontSize: 16, lineHeight: 1 }}>·</span>
                  {alumno.salon}
                  <span style={{ opacity: 0.35, fontSize: 16, lineHeight: 1 }}>·</span>
                  {anioLabel}
                </span>
              </div>
            </div>

            {/* Gauge: color según nivel de riesgo */}
            <div className="gauge" style={{ borderColor: `${gaugeColor}28`, minWidth: 130 }}>
              <strong style={{ color: gaugeColor }}>{pct(alumno.prob_riesgo)}</strong>
              <span>Probabilidad de<br/>riesgo</span>
            </div>
          </div>

          {/* ── Stat chips ── cada chip es un div contenedor (label + valor)    */}
          {/* Reemplaza el detail-grid anterior que tenía span/strong como hijos  */}
          {/* sueltos del grid y se despareaban al romper columnas.               */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {([
              { label: "Salón",          value: alumno.salon,                                           accent: "var(--navy)" },
              { label: "Año escolar",    value: anioLabel,                                              accent: "var(--navy)" },
              { label: "Promedio anual", value: promedioNum != null ? promedioNum.toFixed(1) : "—",     accent: gradeColor(promedioNum) },
              { label: "Conducta",       value: conductaNum != null ? conductaNum.toFixed(1) : "—",     accent: gradeColor(conductaNum) },
              { label: "Cursos en C",    value: String(cursosC),                                        accent: cursosC > 2 ? "#dc2626" : cursosC > 0 ? "#d97706" : "#16a34a" },
            ] as { label: string; value: string; accent: string }[]).map(({ label, value, accent }) => (
              <div key={label} style={{
                flex: "1 1 100px",
                minWidth: 90,
                background: "var(--surface)",
                borderRadius: 10,
                border: "1px solid var(--border)",
                borderLeft: `3px solid ${accent}`,
                padding: "10px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
                  textTransform: "uppercase", letterSpacing: "0.55px",
                }}>
                  {label}
                </span>
                <strong style={{ fontSize: 20, fontWeight: 800, color: accent, lineHeight: 1.1 }}>
                  {value}
                </strong>
              </div>
            ))}
          </div>

          <div className="student-quick-actions">
            <button className="btn-student-action" onClick={() => setTab("intervenciones")} title="Registrar intervención">
              <CheckCircle2 size={14} /> Intervenir
            </button>
            <button className="btn-student-action" onClick={() => setTab("dashboard")} title="Volver al dashboard" style={{ marginLeft: "auto" }}>
              ← Volver
            </button>
          </div>

          <div className="student-tabs" role="tablist">
            <button role="tab" aria-selected={studentTab === "resumen"} className={`student-tab${studentTab === "resumen" ? " active" : ""}`} onClick={() => setStudentTab("resumen")}>
              <Activity size={13} /> Trayectoria
            </button>
            <button role="tab" aria-selected={studentTab === "anotaciones"} className={`student-tab${studentTab === "anotaciones" ? " active" : ""}`}
              onClick={() => { setStudentTab("anotaciones"); void loadAnnotations(sid); }}>
              <MessageSquare size={13} /> Anotaciones
              {annsDeAlumno.length > 0 && <span className="tab-badge">{annsDeAlumno.length}</span>}
            </button>
            <button role="tab" aria-selected={studentTab === "plan"} className={`student-tab${studentTab === "plan" ? " active" : ""}`}
              onClick={() => { setStudentTab("plan"); void loadMilestones(sid); }}>
              <CheckCircle2 size={13} /> Plan
              {planMilestones.length > 0 && <span className="tab-badge">{planMilestones.length}</span>}
            </button>
          </div>

          <div className="student-tab-content">
            {studentTab === "resumen" && (
              <div className="shap-section">
                {/* ── Detalle por bimestre ──────────────────────────────────
                    Tabla con la nota de cada materia (+ Conducta) para el
                    bimestre seleccionado — complementa la trayectoria con un
                    corte puntual, fácil de leer de un vistazo. */}
                <div className="shap-section-title" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <CalendarRange size={14} /> Detalle por bimestre
                  </span>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, textTransform: "none", letterSpacing: 0, color: "var(--text-muted)" }}>
                    Bimestre
                    <select value={bimestreDetalle} onChange={(e) => setBimestreDetalle(e.target.value as Bimestre)}>
                      <option value="1">Bimestre 1</option>
                      <option value="2">Bimestre 2</option>
                      <option value="3">Bimestre 3</option>
                      <option value="4">Bimestre 4</option>
                    </select>
                  </label>
                </div>
                <div className="model-note" style={{ marginBottom: 4 }}>
                  Notas del <strong>Bimestre {bimestreDetalle}</strong> por materia (escala AD/A/B/C).
                  La Conducta se evalúa de forma anual, no por bimestre.
                </div>
                <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border)", marginBottom: 18 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "var(--navy)", color: "#fff" }}>
                        {MATERIAS_COLEGIO.map((m) => (
                          <th key={m.key} style={{ padding: "8px 10px", textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: "0.03em" }}>{m.label}</th>
                        ))}
                        <th style={{ padding: "8px 10px", textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: "0.03em" }} title="Promedio anual de conducta">
                          Conducta
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ background: "var(--surface)" }}>
                        {MATERIAS_COLEGIO.map((m) => {
                          const g = notaInfo(notaBimestre(alumno, m.key, bimestreDetalle));
                          return (
                            <td key={m.key} style={{ padding: "10px", textAlign: "center", fontWeight: 700, color: g.color }}>
                              {g.label}
                            </td>
                          );
                        })}
                        {(() => {
                          const c = notaInfo(alumno.conducta_promedio);
                          return (
                            <td style={{ padding: "10px", textAlign: "center", fontWeight: 700, color: c.color }}>
                              {c.label}
                            </td>
                          );
                        })()}
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="shap-section-title">
                  <TrendingUp size={14} /> Trayectoria de notas por bimestre
                </div>
                <div className="model-note" style={{ marginBottom: 8 }}>
                  Evolución de las notas (0-20) a lo largo de los 4 bimestres. El modelo usa los
                  primeros 3 bimestres para anticipar el riesgo al cierre del 4°.
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trayectoria} margin={{ top: 8, right: 16, left: -10, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="bimestre" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => v == null ? "Sin nota" : Number(v).toFixed(0)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {MATERIAS_COLEGIO.map((m) => (
                      <Line key={m.key} type="monotone" dataKey={m.label} stroke={LINE_COLORS[m.label]} strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
                    ))}
                    {/* Línea de referencia de aprobación (11) */}
                    <Line type="monotone" dataKey={() => 11} stroke="#94a3b8" strokeDasharray="5 4" strokeWidth={1} dot={false} name="Mínimo aprobatorio" legendType="none" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {studentTab === "anotaciones" && (
              <div className="annotations-panel">
                <div className="annotations-header"><Pencil size={13} /> Anotaciones</div>
                <div className="annotations-list">
                  {annsDeAlumno.length === 0 ? (
                    <div className="annotations-empty">Sin anotaciones para este alumno. Escribe la primera abajo.</div>
                  ) : annsDeAlumno.map((a) => {
                    const quien = a.autor_nombre ?? a.autor_email?.split("@")[0] ?? "Director";
                    return (
                      <div key={a.id} className="annotation-item" style={{ borderLeft: `3px solid ${a.es_propia ? "var(--accent)" : canEditAll ? "#7c3aed" : "#94a3b8"}`, paddingLeft: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: a.es_propia ? "var(--accent)" : canEditAll ? "#7c3aed" : "#64748b" }}>
                            👤 {quien}{a.es_propia ? " (tú)" : ""}
                          </span>
                          <span className="annotation-date">{new Date(a.created_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}</span>
                        </div>
                        <p style={{ margin: 0 }}>{a.contenido}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="annotations-input">
                  <textarea className="annotation-textarea" value={annotationText} onChange={(e) => setAnnotationText(e.target.value)} placeholder="Agregar nueva anotación..." rows={3} />
                  <button className="btn-save-annotation" onClick={() => void saveAnnotation()} disabled={isSavingAnnotation || !annotationText.trim()}>
                    <Save size={13} /> {isSavingAnnotation ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            )}

            {studentTab === "plan" && (
              <div className="plan-panel">
                <div className="model-note" style={{ marginBottom: 10 }}>Define hitos concretos con fechas tentativas para el seguimiento.</div>
                {isLoadingMilestones ? (
                  <div className="annotations-empty">Cargando hitos...</div>
                ) : planMilestones.length === 0 ? (
                  <div className="annotations-empty">Sin hitos definidos. Agrega el primero abajo.</div>
                ) : (
                  <ul className="plan-list">
                    {planMilestones.map((m) => {
                      const autor = m.autor_nombre ?? m.autor_email?.split("@")[0] ?? "Director";
                      const puedeEditar = canEditAll || m.es_propio;
                      return (
                        <li key={m.id} className={`plan-milestone${m.completado ? " plan-done" : ""}`} style={{ borderLeft: `3px solid ${m.es_propio ? "var(--accent)" : canEditAll ? "#7c3aed" : "#94a3b8"}`, paddingLeft: 8 }}>
                          <button className="milestone-check" onClick={() => puedeEditar && toggleMilestone(m.id)} disabled={!puedeEditar}
                            aria-label={m.completado ? "Marcar como pendiente" : "Marcar como completado"}
                            style={{ opacity: puedeEditar ? 1 : 0.4, cursor: puedeEditar ? "pointer" : "not-allowed" }}>
                            {m.completado ? "✓" : "○"}
                          </button>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span className="milestone-text">{m.texto}</span>
                            {!m.es_propio && <span style={{ display: "block", fontSize: 10, color: canEditAll ? "#7c3aed" : "#94a3b8", marginTop: 2 }}>por {autor}</span>}
                          </div>
                          <span className="milestone-date">{m.fecha}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="plan-add-row">
                  <input className="plan-text-input" value={newMilestone} onChange={(e) => setNewMilestone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addMilestone()} placeholder="Nuevo hito (ej. Reunión con familia)" aria-label="Nuevo hito" />
                  <input type="date" className="plan-date-input" value={newMilestoneDate} onChange={(e) => setNewMilestoneDate(e.target.value)} aria-label="Fecha objetivo del hito" />
                  <button className="primary" onClick={addMilestone} aria-label="Agregar hito"><Plus size={14} /> Agregar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Panel>
    </section>
  );
}
