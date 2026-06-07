"use client";

import {
  Activity, BarChart3, CheckCircle2, MessageSquare, Pencil, Plus, Save, Users, TrendingUp,
} from "lucide-react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { AlumnoColegio, Tab } from "@/types";
import { Panel, EmptyState } from "@/components/ui/Primitives";
import { pct, riskClass } from "@/lib/format";
import { MATERIAS_COLEGIO, anioFromSalon, notaBimestre, colegioStudentId } from "@/lib/colegio";

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
  "Matemática": "#2563eb", "Comunicación": "#7c3aed", "CTA": "#0891b2",
};

export function ColegioEstudianteView({
  role, alumno,
  annotations, annotationText, setAnnotationText, isSavingAnnotation,
  planMilestones, newMilestone, setNewMilestone, newMilestoneDate, setNewMilestoneDate,
  studentTab, setStudentTab, setTab,
  saveAnnotation, loadAnnotations, addMilestone, toggleMilestone, loadMilestones, isLoadingMilestones,
}: ColegioEstudianteViewProps) {
  const canEditAll = role === "director";

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
            <div>
              <h2 style={{ margin: "0 0 6px" }}>{alumno.nombre}</h2>
              <span className={riskClass(alumno.nivel_riesgo)}>{alumno.nivel_riesgo}</span>
              <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>
                {alumno.salon} · {anioLabel}
              </span>
            </div>
            <div className="gauge">
              <strong>{pct(alumno.prob_riesgo)}</strong>
              <span>Probabilidad de riesgo</span>
            </div>
          </div>

          <div className="detail-grid">
            <span>Salón</span><strong>{alumno.salon}</strong>
            <span>Año</span><strong>{anioLabel}</strong>
            <span>Promedio general</span><strong>{alumno.promedio_materias != null ? Number(alumno.promedio_materias).toFixed(1) : "—"}</strong>
            <span>Conducta</span><strong>{alumno.conducta_promedio != null ? Number(alumno.conducta_promedio).toFixed(1) : "—"}</strong>
            <span>Cursos en C</span><strong>{alumno.n_materias_c ?? "—"}</strong>
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
                <div className="shap-section-title">
                  <TrendingUp size={14} /> Trayectoria de notas por bimestre
                </div>
                <div className="model-note" style={{ marginBottom: 8 }}>
                  Evolución de las notas (0-20) a lo largo de los 4 bimestres. El modelo usa los
                  primeros 3 bimestres para anticipar el riesgo al cierre del 4°.
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trayectoria} margin={{ top: 8, right: 16, left: -10, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="bimestre" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => v == null ? "Sin nota" : Number(v).toFixed(0)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
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
