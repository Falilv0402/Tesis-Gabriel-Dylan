"use client";

import { CheckCircle2, Mail, RefreshCcw } from "lucide-react";
import type { Student } from "@/types";
import { Panel, Kpi, Bar, EmptyState } from "@/components/ui/Primitives";
import { shortId, pct, recommendation } from "@/lib/format";

interface IntervencionItem {
  id: string;
  codigo_estudiante: string | null;
  tipo: string;
  descripcion: string;
  estado: string;
  fecha: string;
  autor_nombre?: string | null;
  autor_email?: string | null;
  es_propia?: boolean;
}

interface InterventionStats {
  total: number;
  cerradas: number;
  enProceso: number;
  pendientes: number;
  byTipo: Record<string, { total: number; cerradas: number }>;
  tasaCierre: number;
}

interface IntervencionesViewProps {
  selected: Student | undefined;
  filtered: Student[];
  tipoIntervencion: "tutoria" | "reunion" | "derivacion" | "seguimiento";
  setTipoIntervencion: (v: "tutoria" | "reunion" | "derivacion" | "seguimiento") => void;
  descIntervencion: string;
  setDescIntervencion: (v: string) => void;
  notifScope: "distrito" | "ie";
  setNotifScope: (v: "distrito" | "ie") => void;
  isSendingAlert: boolean;
  profileDistrito: string | null;
  profileCodigoIe: string | null;
  interventions: IntervencionItem[];
  interventionStats: InterventionStats | null;
  authBusy: boolean;
  setSelectedId: (id: string) => void;
  onRegistrar: () => void;
  onSendAlert: () => void;
  onUpdateEstado: (id: string, estado: string) => void;
  onLoadInterventions: () => void;
}

export function IntervencionesView({
  selected, filtered,
  tipoIntervencion, setTipoIntervencion,
  descIntervencion, setDescIntervencion,
  notifScope, setNotifScope,
  isSendingAlert, profileDistrito, profileCodigoIe,
  interventions, interventionStats,
  authBusy, setSelectedId,
  onRegistrar, onSendAlert, onUpdateEstado, onLoadInterventions,
}: IntervencionesViewProps) {
  return (
    <>
      <section className="two-col">
        <Panel title="Registrar intervencion">
          <label>Estudiante
            <select value={selected?.id ?? ""} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">{filtered.length > 0 ? "Seleccionar estudiante..." : "Sin estudiantes cargados"}</option>
              {filtered.slice(0, 10).map((s) => (
                <option key={s.id} value={s.id}>
                  Est. {shortId(s.id)} — {s.nivel_riesgo} ({pct(s.probabilidad_riesgo)})
                </option>
              ))}
            </select>
          </label>
          <label>Tipo de intervencion
            <select value={tipoIntervencion} onChange={(e) => setTipoIntervencion(e.target.value as typeof tipoIntervencion)}>
              <option value="tutoria">Tutoria academica</option>
              <option value="reunion">Reunion familiar</option>
              <option value="derivacion">Derivacion especialista</option>
              <option value="seguimiento">Seguimiento periodico</option>
            </select>
          </label>
          <label>Descripcion
            <textarea
              value={descIntervencion}
              onChange={(e) => setDescIntervencion(e.target.value)}
              placeholder={selected ? recommendation(selected) : "Describe la accion a tomar..."}
              rows={3}
            />
          </label>
          <button className="primary" disabled={!selected || authBusy} onClick={onRegistrar}>
            <CheckCircle2 size={17} /> {authBusy ? "Guardando..." : "Registrar en base de datos"}
          </button>

          {selected && (
            <div className="alert-notify-box">
              <div className="alert-notify-header">
                <Mail size={15} />
                <strong>Notificar al equipo</strong>
              </div>
              <p className="model-note">
                Envía un correo a los demás directores con los datos de este estudiante y la acción recomendada.
              </p>
              <label style={{ textTransform: "none", letterSpacing: 0, fontSize: 13, fontWeight: 500 }}>
                Destinatarios
                <select value={notifScope} onChange={(e) => setNotifScope(e.target.value as "distrito" | "ie")}>
                  <option value="distrito">Todo el distrito — {profileDistrito ?? "sin asignar"}</option>
                  {profileCodigoIe && (
                    <option value="ie">Solo mi IE — {profileCodigoIe}</option>
                  )}
                </select>
              </label>
              <button disabled={isSendingAlert} onClick={onSendAlert} style={{ width: "100%" }}>
                <Mail size={15} />
                {isSendingAlert ? "Preparando correo..." : "Abrir correo con destinatarios"}
              </button>
            </div>
          )}
        </Panel>

        <Panel title="Bitacora de intervenciones">
          {interventions.map((item) => {
            const autor = item.autor_nombre ?? item.autor_email?.split("@")[0] ?? "Director";
            return (
              <div className="intervencion-card" key={item.id}
                style={{ borderLeft: `3px solid ${item.es_propia ? "var(--accent)" : "#94a3b8"}` }}>
                <div className="intervencion-header">
                  <strong>Est. {item.codigo_estudiante ? shortId(item.codigo_estudiante) : "—"}</strong>
                  <span className={`estado-tag ${item.estado}`}>{item.estado.replace("_", " ")}</span>
                </div>
                <div className="intervencion-meta">
                  <span className="intervencion-tipo">{item.tipo}</span>
                  <small>{new Date(item.fecha).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}</small>
                </div>
                {/* Autor */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, margin: "3px 0 4px" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 20,
                    background: item.es_propia ? "#eff6ff" : "#f8fafc",
                    color: item.es_propia ? "var(--accent)" : "#64748b",
                    border: `1px solid ${item.es_propia ? "#bfdbfe" : "#e2e8f0"}`,
                  }}>
                    👤 {autor}{item.es_propia ? " (tú)" : ""}
                  </span>
                </div>
                {item.descripcion && <p className="intervencion-desc">{item.descripcion}</p>}
                <div className="intervencion-actions">
                  <select
                    className={`estado-select estado-${item.estado}`}
                    value={item.estado}
                    onChange={(e) => item.es_propia && onUpdateEstado(item.id, e.target.value)}
                    disabled={!item.es_propia}
                    title={!item.es_propia ? `Registrado por ${autor}` : undefined}
                    style={{ opacity: item.es_propia ? 1 : 0.5, cursor: item.es_propia ? "pointer" : "not-allowed" }}
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="en_proceso">En proceso</option>
                    <option value="cerrada">Cerrada</option>
                  </select>
                </div>
              </div>
            );
          })}
          {interventions.length === 0 && <EmptyState message="No hay intervenciones registradas aun." />}
          <button style={{ marginTop: "8px" }} onClick={onLoadInterventions}>
            <RefreshCcw size={16} /> Actualizar
          </button>
        </Panel>
      </section>

      {interventionStats && (
        <section className="panel" style={{ background: "transparent", border: "none", padding: 0 }}>
          <Panel title="Impacto y seguimiento de intervenciones">
            <div className="metric-grid">
              <Kpi label="Total" value={interventionStats.total} detail="registradas" />
              <Kpi label="Cerradas" value={interventionStats.cerradas} detail={pct(interventionStats.tasaCierre)} tone="low" />
              <Kpi label="En proceso" value={interventionStats.enProceso} detail="activas" tone="medium" />
              <Kpi
                label="Pendientes"
                value={interventionStats.pendientes}
                detail="por iniciar"
                tone={interventionStats.pendientes > 5 ? "high" : undefined}
              />
            </div>
            <div className="model-note" style={{ fontWeight: 600, marginTop: 12, marginBottom: 4 }}>
              Tasa de cierre por tipo de intervención
            </div>
            {Object.entries(interventionStats.byTipo).map(([tipo, st]) => {
              const tasa = st.total > 0 ? st.cerradas / st.total : 0;
              return (
                <Bar
                  key={tipo}
                  label={`${tipo} (${st.cerradas}/${st.total})`}
                  value={tasa}
                  tone={tasa >= 0.6 ? "low" : tasa >= 0.3 ? "medium" : "high"}
                />
              );
            })}
            <div className="model-note" style={{ marginTop: 10, fontSize: 11 }}>
              La <strong>tasa de cierre</strong> indica qué proporción de intervenciones llegan a su resolución.
              Una tasa baja por mucho tiempo puede indicar falta de seguimiento.
            </div>
          </Panel>
        </section>
      )}
    </>
  );
}
