"use client";

import { useMemo, useState } from "react";
import { Filter, RefreshCcw, GraduationCap, AlertTriangle, Users, ArrowRight } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { AlumnoColegio, ColegioResumen } from "@/types";
import { Kpi, Panel, EmptyState } from "@/components/ui/Primitives";
import { AttentionBanner, type AttentionItem } from "@/components/ui/AttentionBanner";
import { pct, riskClass } from "@/lib/format";
import {
  anioFromSalon, aniosDeSalones,
  seccionFromSalon, seccionesDeSalones,
  colegioStudentId,
} from "@/lib/colegio";

/**
 * Niveles de riesgo del donut, con su color fijo. Definidos una sola vez para
 * que el color de cada porción dependa del NIVEL (no de su posición en el
 * arreglo): si ALTO=0 alumnos, esa porción se omite del donut sin que MEDIO
 * y BAJO "hereden" los colores rojo/ámbar que dejó libres.
 */
const DONUT_NIVELES = [
  { nivel: "ALTO" as const,  name: "Alto",  color: "#dc2626" },
  { nivel: "MEDIO" as const, name: "Medio", color: "#d97706" },
  { nivel: "BAJO" as const,  name: "Bajo",  color: "#16a34a" },
];

// Cuántos alumnos mostrar en la tabla de "más críticos" antes de mandar a la lista completa.
const TOP_CRITICOS = 25;

interface ColegioDashboardViewProps {
  nombreColegio: string;
  alumnos: AlumnoColegio[];
  resumen: ColegioResumen | null;
  isLoading: boolean;
  onRefresh: () => void;
  onSelect?: (a: AlumnoColegio) => void;
  /** Selecciona al alumno y navega a la pestaña de Intervenciones — botón "Intervenir". */
  onIntervenir?: (a: AlumnoColegio) => void;
  /** Navega a la pestaña "Estudiante" (lista completa con notas por materia). */
  onVerListaCompleta?: () => void;
}

export function ColegioDashboardView({
  nombreColegio, alumnos, resumen, isLoading, onRefresh, onSelect, onIntervenir, onVerListaCompleta,
}: ColegioDashboardViewProps) {
  const [nivel,    setNivel]    = useState<"Todos" | "ALTO" | "MEDIO" | "BAJO">("Todos");
  const [anio,     setAnio]     = useState<string>("Todos");
  const [seccion,  setSeccion]  = useState<string>("Todas");

  // Opciones de "Año de secundaria" y "Sección" derivadas de los salones presentes
  const anios     = useMemo(() => aniosDeSalones(alumnos), [alumnos]);
  const secciones = useMemo(() => seccionesDeSalones(alumnos), [alumnos]);

  const filtrados = useMemo(() => {
    return alumnos
      .filter((a) => nivel === "Todos" || a.nivel_riesgo === nivel)
      .filter((a) => anio === "Todos" || anioFromSalon(a.salon).label === anio)
      .filter((a) => seccion === "Todas" || seccionFromSalon(a.salon) === seccion)
      .sort((a, b) => b.prob_riesgo - a.prob_riesgo);
  }, [alumnos, nivel, anio, seccion]);

  const counts = useMemo(() => {
    const c = { ALTO: 0, MEDIO: 0, BAJO: 0 };
    for (const a of filtrados) c[a.nivel_riesgo]++;
    return c;
  }, [filtrados]);

  const totalFiltrado = filtrados.length;
  const enRiesgo = counts.ALTO + counts.MEDIO;

  // ── Riesgo agrupado por salón (sustituto del mapa geográfico) ─────────────
  // Un colegio propio no tiene distritos: el agrupamiento natural del riesgo
  // es por salón. Replicamos la misma lógica de "semáforo" que usa el mapa de
  // calor por distrito de los colegios EM 2022 (ver DashboardView), pero sobre
  // el % de alumnos en riesgo (ALTO+MEDIO) de cada salón.
  const salonRiesgoRows = useMemo(() => {
    const acc = new Map<string, { total: number; alto: number; medio: number; bajo: number }>();
    for (const a of filtrados) {
      const e = acc.get(a.salon) ?? { total: 0, alto: 0, medio: 0, bajo: 0 };
      e.total++;
      if (a.nivel_riesgo === "ALTO") e.alto++;
      else if (a.nivel_riesgo === "MEDIO") e.medio++;
      else e.bajo++;
      acc.set(a.salon, e);
    }
    return [...acc.entries()]
      .map(([salon, e]) => {
        const pctRiesgo = (e.alto + e.medio) / Math.max(e.total, 1);
        const color = pctRiesgo >= 0.65 ? "#ef4444" : pctRiesgo >= 0.50 ? "#f97316" : pctRiesgo >= 0.35 ? "#eab308" : pctRiesgo >= 0.20 ? "#84cc16" : "#22c55e";
        const label = pctRiesgo >= 0.65 ? "Crítico" : pctRiesgo >= 0.50 ? "Alto" : pctRiesgo >= 0.35 ? "Medio" : pctRiesgo >= 0.20 ? "Moderado" : "Bajo";
        return { salon, ...e, pctRiesgo, color, label };
      })
      .sort((x, y) => y.pctRiesgo - x.pctRiesgo);
  }, [filtrados]);

  // ── Alumnos prioritarios para intervención ────────────────────────────────
  // Equivalente a "Alertas activas" del dashboard distrital — pero ahí solo se
  // listan alumnos en riesgo ALTO, y muchos colegios propios pueden no tener
  // ninguno (no hay "críticos"). Para que el botón "Intervenir" esté siempre
  // accesible desde el dashboard, priorizamos primero a los de riesgo ALTO y,
  // si no alcanzan, completamos con los de riesgo MEDIO de mayor probabilidad.
  const prioritarios = useMemo(() => {
    const altos  = filtrados.filter((a) => a.nivel_riesgo === "ALTO").sort((a, b) => b.prob_riesgo - a.prob_riesgo);
    const medios = filtrados.filter((a) => a.nivel_riesgo === "MEDIO").sort((a, b) => b.prob_riesgo - a.prob_riesgo);
    return [...altos, ...medios].slice(0, 5);
  }, [filtrados]);

  const attentionItems: AttentionItem[] = prioritarios.map((a) => ({
    id: colegioStudentId(a),
    nombre: a.nombre,
    detalle: `${a.salon} · ${anioFromSalon(a.salon).label}`,
    nivel: a.nivel_riesgo === "ALTO" ? "ALTO" : "MEDIO",
    prob: a.prob_riesgo,
  }));
  const attentionMap = new Map(prioritarios.map((a) => [colegioStudentId(a), a]));

  return (
    <>
      {/* ── Resumen ejecutivo accionable ──────────────────────────────── */}
      <AttentionBanner
        items={attentionItems}
        totalUrgente={enRiesgo}
        contexto={`en ${nombreColegio}`}
        onSelect={onSelect ? (id) => { const a = attentionMap.get(id); if (a) onSelect(a); } : undefined}
        onIntervenir={onIntervenir ? (id) => { const a = attentionMap.get(id); if (a) onIntervenir(a); } : undefined}
      />

      {/* ── Encabezado del colegio ─────────────────────────────────────── */}
      <div className="colegio-hero">
        <div className="colegio-hero-icon"><GraduationCap size={22} /></div>
        <div>
          <h2>{nombreColegio}</h2>
          <span>
            Modelo interno del colegio · alerta temprana B1-B3 → B4
            {resumen?.trained_at && ` · actualizado ${new Date(resumen.trained_at).toLocaleDateString("es-PE", { dateStyle: "medium" })}`}
          </span>
        </div>
      </div>

      {/* ── Aviso: modelo con datos incompletos ─────────────────────────── */}
      {resumen?.metricas?.modo_prediccion?.startsWith("descriptivo") && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px",
          background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10,
        }}>
          <AlertTriangle size={16} style={{ color: "#92400e", flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, color: "#92400e", lineHeight: 1.5 }}>
            <strong>Este colegio todavía no tiene los 4 bimestres cargados</strong> — el modelo está
            operando con datos limitados (no está prediciendo, solo describiendo lo que hay). Algunas
            materias o bimestres pueden verse sin nota hasta que se suban los Excel faltantes.
          </div>
        </div>
      )}

      {/* ── KPIs ───────────────────────────────────────────────────────── */}
      <section className="kpi-grid">
        <Kpi label="Alumnos" value={totalFiltrado} detail={`${alumnos.length.toLocaleString("es-PE")} en total`} />
        <Kpi label="En riesgo" value={enRiesgo} detail={`${((enRiesgo / Math.max(totalFiltrado, 1)) * 100).toFixed(1)}% del filtro`} tone="high" />
        <Kpi label="Riesgo alto" value={counts.ALTO} detail="prioritario" tone="high" />
        <Kpi label="Riesgo medio" value={counts.MEDIO} detail="seguimiento" tone="medium" />
        <Kpi label="Riesgo bajo" value={counts.BAJO} detail="estable" tone="low" />
      </section>

      {/* ── Filtros ────────────────────────────────────────────────────── */}
      <section className="filters">
        <Filter size={18} />
        <label className="filter-field">Nivel de riesgo
          <select value={nivel} onChange={(e) => setNivel(e.target.value as typeof nivel)}>
            <option value="Todos">Todos</option>
            <option value="ALTO">ALTO</option>
            <option value="MEDIO">MEDIO</option>
            <option value="BAJO">BAJO</option>
          </select>
        </label>
        <label className="filter-field">Grado
          <select value={anio} onChange={(e) => setAnio(e.target.value)}>
            <option value="Todos">Todos</option>
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="filter-field">Sección
          <select value={seccion} onChange={(e) => setSeccion(e.target.value)}>
            <option value="Todas">Todas</option>
            {secciones.map((s) => <option key={s} value={s}>Sección {s}</option>)}
          </select>
        </label>
        <button onClick={onRefresh}><RefreshCcw size={17} /> Actualizar</button>
      </section>

      <section className="two-col">
        {/* ── Estudiantes más críticos (vista simplificada) ─────────────── */}
        <Panel title="Estudiantes más críticos">
          {isLoading ? (
            <EmptyState message="Cargando alumnos del colegio..." />
          ) : totalFiltrado === 0 ? (
            <EmptyState message="No hay alumnos con el filtro seleccionado." />
          ) : (
            <>
              <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 420px)", borderRadius: 10, border: "1px solid var(--border)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--navy)", color: "#fff", position: "sticky", top: 0 }}>
                      <th style={th}>Alumno</th>
                      <th style={th}>Salón</th>
                      <th style={th}>Nivel</th>
                      <th style={{ ...th, textAlign: "right" }}>Prob.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.slice(0, TOP_CRITICOS).map((a, i) => (
                      <tr
                        key={colegioStudentId(a)}
                        onClick={onSelect ? () => onSelect(a) : undefined}
                        style={{
                          background: i % 2 === 0 ? "var(--surface)" : "transparent",
                          borderBottom: "1px solid var(--border)",
                          cursor: onSelect ? "pointer" : "default",
                        }}
                        title={onSelect ? "Ver detalle del alumno" : undefined}
                      >
                        <td style={{ ...td, fontWeight: 600 }}>{a.nombre}</td>
                        <td style={td}>{a.salon}</td>
                        <td style={td}>
                          <span className={riskClass(a.nivel_riesgo)} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 12 }}>
                            {a.nivel_riesgo}
                          </span>
                        </td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 700,
                          color: a.nivel_riesgo === "ALTO" ? "#dc2626" : a.nivel_riesgo === "MEDIO" ? "#d97706" : "#16a34a" }}>
                          {(a.prob_riesgo * 100).toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                  {Math.min(totalFiltrado, TOP_CRITICOS).toLocaleString("es-PE")} de {totalFiltrado.toLocaleString("es-PE")} alumnos del filtro, ordenados por urgencia
                </p>
                {onVerListaCompleta && (
                  <button
                    onClick={onVerListaCompleta}
                    style={{ fontSize: 11.5, padding: "5px 10px", display: "flex", alignItems: "center", gap: 5 }}
                  >
                    Ver notas por materia <ArrowRight size={13} />
                  </button>
                )}
              </div>
            </>
          )}
        </Panel>

        {/* ── Distribución de riesgo ───────────────────────────────────── */}
        <Panel title="Distribución de riesgo (filtro actual)">
          {totalFiltrado > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={DONUT_NIVELES
                      .map(({ nivel, name, color }) => ({ name, color, value: counts[nivel] }))
                      .filter((d) => d.value > 0)}
                    cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {/* Color ligado al nivel real de cada porción (no a su posición
                        en el arreglo): así, cuando ALTO=0 se omite del donut, MEDIO
                        y BAJO conservan su color correcto (ámbar / verde) en vez de
                        heredar el rojo y el ámbar de las posiciones que dejó vacías. */}
                    {DONUT_NIVELES
                      .filter(({ nivel }) => counts[nivel] > 0)
                      .map(({ name, color }) => <Cell key={name} fill={color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} alumnos`]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {[
                  { label: "Riesgo ALTO",  n: counts.ALTO,  color: "#dc2626", icon: <AlertTriangle size={14} /> },
                  { label: "Riesgo MEDIO", n: counts.MEDIO, color: "#d97706", icon: <AlertTriangle size={14} /> },
                  { label: "Riesgo BAJO",  n: counts.BAJO,  color: "#16a34a", icon: <Users size={14} /> },
                ].map(({ label, n, color, icon }) => (
                  <div key={label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 10px", borderRadius: 8, background: "var(--surface)",
                    border: "1px solid var(--border)", borderLeft: `4px solid ${color}`,
                  }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, color, fontSize: 12, fontWeight: 600 }}>{icon} {label}</span>
                    <strong style={{ fontSize: 18, color }}>{n}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState message="Sin datos para el filtro seleccionado." />
          )}
        </Panel>
      </section>

      {/* ── Alumnos que requieren intervención ─────────────────────────────
          Equivalente a "Alertas activas" del dashboard distrital: ahí solo se
          listan alumnos en riesgo ALTO ("críticos"), pero un colegio propio
          puede no tener ninguno. Para que "Intervenir" esté siempre accesible,
          priorizamos ALTO y, si no alcanzan, completamos con MEDIO. */}
      <section className="full-col">
        <Panel title="Alumnos que requieren intervención">
          <div className="model-note" style={{ marginBottom: 10 }}>
            Prioriza primero a los alumnos de riesgo <strong>ALTO</strong> y, si no hay
            suficientes, a los de riesgo <strong>MEDIO</strong> con mayor probabilidad —
            así el botón <strong>Intervenir</strong> está siempre disponible, aunque el
            colegio no tenga casos críticos por el momento.
          </div>
          {prioritarios.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {prioritarios.map((a) => {
                const color = a.nivel_riesgo === "ALTO" ? "#dc2626" : "#d97706";
                return (
                  <div className="alert-card" key={colegioStudentId(a)} style={{ borderLeft: `3px solid ${color}` }}>
                    <div className="alert-card-icon" style={{ color }}><AlertTriangle size={16} /></div>
                    <div className="alert-card-body">
                      <strong>{a.nombre}</strong>
                      <span>{a.salon} · {anioFromSalon(a.salon).label}</span>
                      <span style={{ color, fontWeight: 600 }}>
                        {a.nivel_riesgo} · {pct(a.prob_riesgo)} prob. de riesgo
                      </span>
                    </div>
                    <button className="alert-card-btn" style={{ background: color }} onClick={() => onIntervenir?.(a)}>
                      Intervenir
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState message="No hay alumnos que requieran intervención prioritaria por ahora." />
          )}
        </Panel>
      </section>

      {/* ── Riesgo por salón ───────────────────────────────────────────────
          Equivalente al "mapa de calor por distrito" de los colegios EM 2022:
          como un colegio propio no tiene dispersión geográfica, la unidad de
          análisis natural es el SALÓN — agrupa visualmente dónde se concentra
          el riesgo dentro del propio plantel. */}
      <section className="full-col">
        <Panel title="Riesgo por salón — distribución dentro del colegio">
          <div className="model-note" style={{ marginBottom: 10 }}>
            <strong>Vista por salón</strong> — equivalente, dentro de un solo colegio,
            al mapa de riesgo por distrito de los demás colegios. Cada fila agrupa a los
            alumnos de un salón; el color indica qué tan concentrado está el riesgo
            (ALTO + MEDIO) en ese grupo.
          </div>
          {salonRiesgoRows.length > 0 ? (
            <div className="district-risk-table">
              <table>
                <colgroup>
                  <col style={{ width: "30%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "14%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="col-left">Salón</th>
                    <th>Total</th>
                    <th>Alto</th>
                    <th>Medio</th>
                    <th>% en riesgo</th>
                    <th>Nivel</th>
                  </tr>
                </thead>
                <tbody>
                  {salonRiesgoRows.map(({ salon, total, alto, medio, pctRiesgo, color, label }) => (
                    <tr key={salon} onClick={() => setSeccion(seccionFromSalon(salon))} style={{ cursor: "pointer" }}
                        title={`Filtrar por sección ${seccionFromSalon(salon)}`}>
                      <td className="col-left"><strong>{salon}</strong> <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({anioFromSalon(salon).label})</span></td>
                      <td>{total}</td>
                      <td style={{ color: "#dc2626", fontWeight: 700 }}>{alto}</td>
                      <td style={{ color: "#d97706", fontWeight: 700 }}>{medio}</td>
                      <td><strong>{(pctRiesgo * 100).toFixed(1)}%</strong></td>
                      <td>
                        <span className="drift-tag" style={{ background: color + "22", color, border: `1px solid ${color}66` }}>{label}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="model-note" style={{ marginTop: 8, fontSize: 11, textAlign: "center" }}>
                {salonRiesgoRows.length} salones · Bajo = {counts.BAJO}, Medio = {counts.MEDIO}, Alto = {counts.ALTO} (filtro actual) · clic en una fila para filtrar por su sección
              </div>
            </div>
          ) : (
            <EmptyState message="Sin datos por salón para el filtro seleccionado." />
          )}
        </Panel>
      </section>
    </>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const th: React.CSSProperties = {
  padding: "8px 10px", textAlign: "left", fontSize: 11,
  fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.03em",
};
const td: React.CSSProperties = {
  padding: "7px 10px", whiteSpace: "nowrap",
};
