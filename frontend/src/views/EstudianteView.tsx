"use client";

import {
  Activity, BarChart3, CheckCircle2, Database, FileText,
  Lightbulb, MessageSquare, Pencil, Plus, Save, Scale, Users,
} from "lucide-react";
import type { Student, ShapData, Tab } from "@/types";
import { Panel, EmptyState } from "@/components/ui/Primitives";
import { ShapBar } from "@/components/ui/ShapBar";
import { shortId, pct, riskClass, recommendation, recommendationFromShap } from "@/lib/format";

interface EstudianteViewProps {
  role: string;
  selected: Student | undefined;
  shapData: ShapData | null;
  shapLoading: boolean;
  annotations: { id: string; estudiante_id: string; contenido: string; created_at: string; autor_nombre?: string | null; autor_email?: string | null; es_propia?: boolean }[];
  annotationText: string;
  setAnnotationText: (v: string) => void;
  isSavingAnnotation: boolean;
  isGeneratingStudentPdf: boolean;
  planMilestones: { id: string; texto: string; fecha: string; completado: boolean; autor_nombre?: string | null; autor_email?: string | null; es_propio?: boolean }[];
  newMilestone: string;
  setNewMilestone: (v: string) => void;
  newMilestoneDate: string;
  setNewMilestoneDate: (v: string) => void;
  studentTab: "resumen" | "anotaciones" | "plan";
  setStudentTab: (v: "resumen" | "anotaciones" | "plan") => void;
  comparatorIds: string[];
  setTab: (tab: Tab) => void;
  exportStudentPdf: () => void;
  saveAnnotation: () => void;
  loadAnnotations: (id: string) => void;
  toggleComparator: (id: string) => void;
  setShowComparator: (v: boolean) => void;
  setIeProfileId: (id: string | null) => void;
  setShowIeProfile: (v: boolean) => void;
  addMilestone: () => void;
  toggleMilestone: (id: string) => void;
  loadMilestones: (id: string) => void;
  isLoadingMilestones: boolean;
}

export function EstudianteView({
  role, selected, shapData, shapLoading,
  annotations, annotationText, setAnnotationText,
  isSavingAnnotation, isGeneratingStudentPdf,
  planMilestones, newMilestone, setNewMilestone,
  newMilestoneDate, setNewMilestoneDate,
  studentTab, setStudentTab,
  comparatorIds, setTab,
  exportStudentPdf, saveAnnotation, loadAnnotations,
  toggleComparator, setShowComparator,
  setIeProfileId, setShowIeProfile,
  addMilestone, toggleMilestone, loadMilestones, isLoadingMilestones,
}: EstudianteViewProps) {
  // Director puede editar anotaciones e hitos de cualquier usuario
  const canEditAll = role === "director";
  return (
    <section className="full-col">
      <Panel title={selected ? `Estudiante ${shortId(selected.id)} — Detalle completo` : "Detalle del estudiante"}>
        {selected ? (
          <div className="student-detail-page">
            <div className="student-detail-header">
              <div>
                <h2 style={{ margin: "0 0 6px" }}>Estudiante {shortId(selected.id)}</h2>
                <span className={riskClass(selected.nivel_riesgo)}>{selected.nivel_riesgo}</span>
              </div>
              <div className="gauge">
                <strong>{pct(selected.probabilidad_riesgo)}</strong>
                <span>Probabilidad de riesgo</span>
              </div>
            </div>

            <p>
              Riesgo {selected.nivel_riesgo.toLowerCase()} — {selected.tipo_riesgo.toLowerCase()}. {recommendation(selected)}
            </p>

            {(() => {
              const shapRec = recommendationFromShap(shapData);
              if (!shapRec) return null;
              return (
                <div className="shap-recommendation">
                  <Lightbulb size={14} />
                  <span><strong>Sugerencia personalizada:</strong> {shapRec}</span>
                </div>
              );
            })()}

            <div className="detail-grid">
              <span>ID</span><strong>···{shortId(selected.id)}</strong>
              <span>Distrito</span><strong>{selected.distrito}</strong>
              <span>Sexo</span><strong>{selected.sexo}</strong>
              <span>ISE</span><strong>{selected.ise.toFixed(2)}</strong>
              <span>M500 Lectura</span><strong>{selected.M500_L.toFixed(0)}</strong>
              <span>M500 Ciencias</span><strong>{selected.M500_CN.toFixed(0)}</strong>
              <span>Nivel real Mat.</span><strong>{selected.grupo_m_real ?? "Sin dato"}</strong>
            </div>

            <div className="student-quick-actions">
              <button
                className="btn-student-action"
                onClick={() => void exportStudentPdf()}
                disabled={isGeneratingStudentPdf}
                title="Generar reporte PDF de 1 página"
              >
                <FileText size={14} />
                {isGeneratingStudentPdf ? "Generando..." : "PDF"}
              </button>
              <button
                className={`btn-student-action${comparatorIds.includes(selected.id) ? " active" : ""}`}
                onClick={() => { toggleComparator(selected.id); setShowComparator(true); }}
                title="Agregar al comparador (máx 3)"
              >
                <Scale size={14} />
                {comparatorIds.includes(selected.id) ? "En comparador ✓" : "Comparar"}
              </button>
              {selected.id_ie && (
                <button
                  className="btn-student-action"
                  onClick={() => { setIeProfileId(selected.id_ie ?? null); setShowIeProfile(true); }}
                  title="Ver perfil del colegio"
                >
                  <Database size={14} /> Perfil IE
                </button>
              )}
              <button
                className="btn-student-action"
                onClick={() => setTab("dashboard")}
                title="Volver al ranking"
                style={{ marginLeft: "auto" }}
              >
                ← Volver al ranking
              </button>
            </div>

            <div className="student-tabs" role="tablist">
              <button
                role="tab"
                aria-selected={studentTab === "resumen"}
                className={`student-tab${studentTab === "resumen" ? " active" : ""}`}
                onClick={() => setStudentTab("resumen")}
              >
                <Activity size={13} /> Resumen
              </button>
              <button
                role="tab"
                aria-selected={studentTab === "anotaciones"}
                className={`student-tab${studentTab === "anotaciones" ? " active" : ""}`}
                onClick={() => {
                  setStudentTab("anotaciones");
                  void loadAnnotations(selected.id);
                }}
              >
                <MessageSquare size={13} /> Anotaciones
                {annotations.filter(a => a.estudiante_id === selected.id).length > 0 && (
                  <span className="tab-badge">{annotations.filter(a => a.estudiante_id === selected.id).length}</span>
                )}
              </button>
              <button
                role="tab"
                aria-selected={studentTab === "plan"}
                className={`student-tab${studentTab === "plan" ? " active" : ""}`}
                onClick={() => {
                  setStudentTab("plan");
                  void loadMilestones(selected.id);
                }}
              >
                <CheckCircle2 size={13} /> Plan
                {planMilestones.length > 0 && (
                  <span className="tab-badge">{planMilestones.length}</span>
                )}
              </button>
            </div>

            <div className="student-tab-content">
              {studentTab === "resumen" && (
                <div className="shap-section">
                  <div className="shap-section-title">
                    <Activity size={14} />
                    ¿Por qué está en riesgo?
                  </div>
                  {shapLoading ? (
                    <div className="model-note" style={{ textAlign: "center", padding: "8px 0" }}>Calculando factores de riesgo...</div>
                  ) : shapData && shapData.id_estudiante === selected.id ? (
                    <>
                      <div className="model-note" style={{ marginBottom: 6 }}>
                        Contribución de cada factor al riesgo — rojo lo sube, verde lo reduce.
                        Probabilidad base del modelo: <strong>{pct(shapData.base_probabilidad)}</strong>
                      </div>
                      {shapData.contributions.map((c) => (
                        <ShapBar key={c.feature} contrib={c} />
                      ))}
                    </>
                  ) : (
                    <div className="model-note">Cargando análisis de factores...</div>
                  )}
                </div>
              )}

              {studentTab === "anotaciones" && (
                <div className="annotations-panel">
                  <div className="annotations-header">
                    <Pencil size={13} /> Anotaciones del director
                  </div>
                  <div className="annotations-list">
                    {annotations.filter(a => a.estudiante_id === selected.id).length === 0 ? (
                      <div className="annotations-empty">Sin anotaciones para este estudiante. Escribe la primera abajo.</div>
                    ) : (
                      annotations.filter(a => a.estudiante_id === selected.id).map((a) => {
                        const quien = a.autor_nombre ?? a.autor_email?.split("@")[0] ?? "Director";
                        const puedeEditar = canEditAll || a.es_propia;
                        return (
                          <div key={a.id} className="annotation-item" style={{
                            borderLeft: `3px solid ${a.es_propia ? "var(--accent)" : canEditAll ? "#7c3aed" : "#94a3b8"}`,
                            paddingLeft: 10,
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                              <span style={{
                                fontSize: 11, fontWeight: 600,
                                color: a.es_propia ? "var(--accent)" : canEditAll ? "#7c3aed" : "#64748b",
                              }}>
                                👤 {quien}{a.es_propia ? " (tú)" : canEditAll ? " · puedes editar" : ""}
                              </span>
                              <span className="annotation-date">
                                {new Date(a.created_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}
                              </span>
                            </div>
                            <p style={{ margin: 0 }}>{a.contenido}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="annotations-input">
                    <textarea
                      className="annotation-textarea"
                      value={annotationText}
                      onChange={(e) => setAnnotationText(e.target.value)}
                      placeholder="Agregar nueva anotación..."
                      rows={3}
                    />
                    <button
                      className="btn-save-annotation"
                      onClick={() => void saveAnnotation()}
                      disabled={isSavingAnnotation || !annotationText.trim()}
                    >
                      <Save size={13} /> {isSavingAnnotation ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </div>
              )}

              {studentTab === "plan" && (
                <div className="plan-panel">
                  <div className="model-note" style={{ marginBottom: 10 }}>
                    Define hitos concretos con fechas tentativas para el seguimiento.
                  </div>
                  {isLoadingMilestones ? (
                    <div className="annotations-empty">Cargando hitos...</div>
                  ) : planMilestones.length === 0 ? (
                    <div className="annotations-empty">Sin hitos definidos. Agrega el primero abajo.</div>
                  ) : (
                    <ul className="plan-list">
                      {planMilestones.map((m) => {
                        const autor = m.autor_nombre ?? m.autor_email?.split("@")[0] ?? "Director";
                        const puedeEditarHito = canEditAll || m.es_propio;
                        return (
                          <li key={m.id} className={`plan-milestone${m.completado ? " plan-done" : ""}`}
                            style={{ borderLeft: `3px solid ${m.es_propio ? "var(--accent)" : canEditAll ? "#7c3aed" : "#94a3b8"}`, paddingLeft: 8 }}>
                            <button
                              className="milestone-check"
                              onClick={() => puedeEditarHito && toggleMilestone(m.id)}
                              disabled={!puedeEditarHito}
                              title={puedeEditarHito ? undefined : `Creado por ${autor} — solo el director puede modificarlo`}
                              aria-label={m.completado ? "Marcar como pendiente" : "Marcar como completado"}
                              style={{ opacity: m.es_propio ? 1 : 0.4, cursor: m.es_propio ? "pointer" : "not-allowed" }}
                            >
                              {m.completado ? "✓" : "○"}
                            </button>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span className="milestone-text">{m.texto}</span>
                              {!m.es_propio && (
                                <span style={{ display: "block", fontSize: 10, color: canEditAll ? "#7c3aed" : "#94a3b8", marginTop: 2 }}>
                                  por {autor}
                                </span>
                              )}
                            </div>
                            <span className="milestone-date">{m.fecha}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="plan-add-row">
                    <input
                      className="plan-text-input"
                      value={newMilestone}
                      onChange={(e) => setNewMilestone(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addMilestone()}
                      placeholder="Nuevo hito (ej. Reunión con familia)"
                      aria-label="Nuevo hito"
                    />
                    <input
                      type="date"
                      className="plan-date-input"
                      value={newMilestoneDate}
                      onChange={(e) => setNewMilestoneDate(e.target.value)}
                      aria-label="Fecha objetivo del hito"
                      title="Fecha objetivo del hito"
                    />
                    <button className="primary" onClick={addMilestone} aria-label="Agregar hito">
                      <Plus size={14} /> Agregar
                    </button>
                  </div>
                  <div className="model-note" style={{ marginTop: 8, fontSize: 11 }}>
                    La fecha por defecto es 14 días desde hoy. Puedes cambiarla antes de agregar.
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-state-large">
            <Users size={48} style={{ opacity: 0.4, marginBottom: 12 }} />
            <h3 style={{ margin: "0 0 6px" }}>No hay estudiante seleccionado</h3>
            <p className="model-note" style={{ marginBottom: 14 }}>
              Ve al Dashboard y haz clic en un estudiante del ranking para ver su detalle aquí.
            </p>
            <button className="primary" onClick={() => setTab("dashboard")}>
              <BarChart3 size={14} /> Ir al Dashboard
            </button>
          </div>
        )}
      </Panel>
    </section>
  );
}
