"use client";

import { useMemo } from "react";
import { CheckCircle2, Mail, RefreshCcw } from "lucide-react";
import type { AlumnoColegio } from "@/types";
import { Panel, Kpi, Bar, EmptyState } from "@/components/ui/Primitives";
import { pct } from "@/lib/format";
import { colegioStudentId } from "@/lib/colegio";

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
  total: number; cerradas: number; enProceso: number; pendientes: number;
  byTipo: Record<string, { total: number; cerradas: number }>; tasaCierre: number;
}

interface ColegioIntervencionesViewProps {
  role: string;
  alumnos: AlumnoColegio[];
  selectedAlumno: AlumnoColegio | undefined;
  onSelectAlumno: (id: string) => void;
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
  onRegistrar: () => void;
  onSendAlert: () => void;
  onUpdateEstado: (id: string, estado: string) => void;
  onLoadInterventions: () => void;
}

export function ColegioIntervencionesView({
  role, alumnos, selectedAlumno, onSelectAlumno,
  tipoIntervencion, setTipoIntervencion,
  descIntervencion, setDescIntervencion,
  notifScope, setNotifScope,
  isSendingAlert, profileDistrito, profileCodigoIe,
  interventions, interventionStats,
  authBusy, onRegistrar, onSendAlert, onUpdateEstado, onLoadInterventions,
}: ColegioIntervencionesViewProps) {
  // Lookup id → nombre para mostrar nombres reales en la bitácora
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of alumnos) m.set(colegioStudentId(a), a.nombre);
    return m;
  }, [alumnos]);

  const ordenados = useMemo(
    () => [...alumnos].sort((a, b) => b.prob_riesgo - a.prob_riesgo),
    [alumnos]
  );

  const selectedId = selectedAlumno ? colegioStudentId(selectedAlumno) : "";

  return (
    <>
      <section className="two-col">
        <Panel title="Registrar intervención">
          <label>Alumno
            <select value={selectedId} onChange={(e) => onSelectAlumno(e.target.value)}>
              <option value="">{ordenados.length > 0 ? "Seleccionar alumno..." : "Sin alumnos cargados"}</option>
              {ordenados.slice(0, 30).map((a) => (
                <option key={colegioStudentId(a)} value={colegioStudentId(a)}>
                  {a.nombre} — {a.salon} · {a.nivel_riesgo} ({pct(a.prob_riesgo)})
                </option>
              ))}
            </select>
          </label>
          <label>Tipo de intervención
            <select value={tipoIntervencion} onChange={(e) => setTipoIntervencion(e.target.value as typeof tipoIntervencion)}>
              <option value="tutoria">Tutoría académica</option>
              <option value="reunion">Reunión familiar</option>
              <option value="derivacion">Derivación especialista</option>
              <option value="seguimiento">Seguimiento periódico</option>
            </select>
          </label>
          <label>Descripción
            <textarea value={descIntervencion} onChange={(e) => setDescIntervencion(e.target.value)}
              placeholder="Describe la acción a tomar..." rows={3} />
          </label>
          <button className="primary" disabled={!selectedAlumno || authBusy} onClick={onRegistrar}>
            <CheckCircle2 size={17} /> {authBusy ? "Guardando..." : "Registrar en base de datos"}
          </button>

          {selectedAlumno && (
            <div className="alert-notify-box">
              <div className="alert-notify-header"><Mail size={15} /><strong>Notificar al equipo</strong></div>
              <p className="model-note">
                Envía un correo a los demás directores/coordinadores con los datos de este alumno y la acción recomendada.
              </p>
              <label style={{ textTransform: "none", letterSpacing: 0, fontSize: 13, fontWeight: 500 }}>
                Destinatarios
                <select value={notifScope} onChange={(e) => setNotifScope(e.target.value as "distrito" | "ie")}>
                  <option value="distrito">Todo el distrito — {profileDistrito ?? "sin asignar"}</option>
                  {profileCodigoIe && <option value="ie">Solo mi colegio — {profileCodigoIe}</option>}
                </select>
              </label>
              <button disabled={isSendingAlert} onClick={onSendAlert} style={{ width: "100%" }}>
                <Mail size={15} /> {isSendingAlert ? "Preparando correo..." : "Enviar alerta al equipo"}
              </button>
            </div>
          )}
        </Panel>

        <Panel title="Bitácora de intervenciones">
          {interventions.map((item) => {
            const autor = item.autor_nombre ?? item.autor_email?.split("@")[0] ?? "Director";
            const canEditAll = role === "director";
            const puedeEditar = canEditAll || item.es_propia;
            const nombre = item.codigo_estudiante ? (nameById.get(item.codigo_estudiante) ?? item.codigo_estudiante) : "—";
            return (
              <div className="intervencion-card" key={item.id}
                style={{ borderLeft: `3px solid ${item.es_propia ? "var(--accent)" : canEditAll ? "#7c3aed" : "#94a3b8"}` }}>
                <div className="intervencion-header">
                  <strong>{nombre}</strong>
                  <span className={`estado-tag ${item.estado}`}>{item.estado.replace("_", " ")}</span>
                </div>
                <div className="intervencion-meta">
                  <span className="intervencion-tipo">{item.tipo}</span>
                  <small>{new Date(item.fecha).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}</small>
                </div>
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
                  <select className={`estado-select estado-${item.estado}`} value={item.estado}
                    onChange={(e) => puedeEditar && onUpdateEstado(item.id, e.target.value)}
                    disabled={!puedeEditar}
                    style={{ opacity: puedeEditar ? 1 : 0.5, cursor: puedeEditar ? "pointer" : "not-allowed" }}>
                    <option value="pendiente">Pendiente</option>
                    <option value="en_proceso">En proceso</option>
                    <option value="cerrada">Cerrada</option>
                  </select>
                </div>
              </div>
            );
          })}
          {interventions.length === 0 && <EmptyState message="No hay intervenciones registradas aún." />}
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
              <Kpi label="Pendientes" value={interventionStats.pendientes} detail="por iniciar" tone={interventionStats.pendientes > 5 ? "high" : undefined} />
            </div>
            <div className="model-note" style={{ fontWeight: 600, marginTop: 12, marginBottom: 4 }}>Tasa de cierre por tipo de intervención</div>
            {Object.entries(interventionStats.byTipo).map(([tipo, st]) => {
              const tasa = st.total > 0 ? st.cerradas / st.total : 0;
              return <Bar key={tipo} label={`${tipo} (${st.cerradas}/${st.total})`} value={tasa} tone={tasa >= 0.6 ? "low" : tasa >= 0.3 ? "medium" : "high"} />;
            })}
          </Panel>
        </section>
      )}
    </>
  );
}
