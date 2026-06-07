"use client";

import { useMemo, useState } from "react";
import { Filter, RefreshCcw, GraduationCap, AlertTriangle, Users } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { AlumnoColegio, ColegioResumen } from "@/types";
import { Kpi, Panel, EmptyState } from "@/components/ui/Primitives";
import { riskClass } from "@/lib/format";
import {
  MATERIAS_COLEGIO as MATERIAS, anioFromSalon, aniosDeSalones,
  notaInfo, notaBimestre, colegioStudentId, type Bimestre,
} from "@/lib/colegio";

interface ColegioDashboardViewProps {
  nombreColegio: string;
  alumnos: AlumnoColegio[];
  resumen: ColegioResumen | null;
  isLoading: boolean;
  onRefresh: () => void;
  onSelect?: (a: AlumnoColegio) => void;
}

export function ColegioDashboardView({
  nombreColegio, alumnos, resumen, isLoading, onRefresh, onSelect,
}: ColegioDashboardViewProps) {
  const [nivel,    setNivel]    = useState<"Todos" | "ALTO" | "MEDIO" | "BAJO">("Todos");
  const [anio,     setAnio]     = useState<string>("Todos");
  const [bimestre, setBimestre] = useState<Bimestre>("1");
  const [search,   setSearch]   = useState("");

  // Opciones de "Año de secundaria" derivadas de los salones presentes
  const anios = useMemo(() => aniosDeSalones(alumnos), [alumnos]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return alumnos
      .filter((a) => nivel === "Todos" || a.nivel_riesgo === nivel)
      .filter((a) => anio === "Todos" || anioFromSalon(a.salon).label === anio)
      .filter((a) => !q || a.nombre.toLowerCase().includes(q) || a.salon.toLowerCase().includes(q))
      .sort((a, b) => b.prob_riesgo - a.prob_riesgo);
  }, [alumnos, nivel, anio, search]);

  const counts = useMemo(() => {
    const c = { ALTO: 0, MEDIO: 0, BAJO: 0 };
    for (const a of filtrados) c[a.nivel_riesgo]++;
    return c;
  }, [filtrados]);

  const totalFiltrado = filtrados.length;
  const enRiesgo = counts.ALTO + counts.MEDIO;

  const grade = (a: AlumnoColegio, materia: string) => notaInfo(notaBimestre(a, materia, bimestre));

  return (
    <>
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
        <label className="filter-field">Año de secundaria
          <select value={anio} onChange={(e) => setAnio(e.target.value)}>
            <option value="Todos">Todos</option>
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="filter-field">Bimestre
          <select value={bimestre} onChange={(e) => setBimestre(e.target.value as typeof bimestre)}>
            <option value="1">Bimestre 1</option>
            <option value="2">Bimestre 2</option>
            <option value="3">Bimestre 3</option>
            <option value="4">Bimestre 4</option>
          </select>
        </label>
        <label className="filter-field">Buscar
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre o salón..."
            style={{ minWidth: "150px" }}
          />
        </label>
        <button onClick={onRefresh}><RefreshCcw size={17} /> Actualizar</button>
      </section>

      <section className="two-col">
        {/* ── Tabla de alumnos ─────────────────────────────────────────── */}
        <Panel title={`Alumnos por urgencia — notas del Bimestre ${bimestre}`}>
          {isLoading ? (
            <EmptyState message="Cargando alumnos del colegio..." />
          ) : totalFiltrado === 0 ? (
            <EmptyState message="No hay alumnos con el filtro seleccionado." />
          ) : (
            <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 420px)", borderRadius: 10, border: "1px solid var(--border)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--navy)", color: "#fff", position: "sticky", top: 0 }}>
                    <th style={th}>Alumno</th>
                    <th style={th}>Salón</th>
                    <th style={th}>Nivel</th>
                    <th style={{ ...th, textAlign: "right" }}>Prob.</th>
                    {MATERIAS.map((m) => (
                      <th key={m.key} style={{ ...th, textAlign: "center" }}>{m.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((a, i) => (
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
                      {MATERIAS.map((m) => {
                        const g = grade(a, m.key);
                        return (
                          <td key={m.key} style={{ ...td, textAlign: "center", fontWeight: 600, color: g.color }}>
                            {g.label}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, textAlign: "right" }}>
            {totalFiltrado.toLocaleString("es-PE")} de {alumnos.length.toLocaleString("es-PE")} alumnos · notas del Bimestre {bimestre} (escala AD/A/B/C)
          </p>
        </Panel>

        {/* ── Distribución de riesgo ───────────────────────────────────── */}
        <Panel title="Distribución de riesgo (filtro actual)">
          {totalFiltrado > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Alto", value: counts.ALTO },
                      { name: "Medio", value: counts.MEDIO },
                      { name: "Bajo", value: counts.BAJO },
                    ].filter((d) => d.value > 0)}
                    cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    <Cell fill="#dc2626" /><Cell fill="#d97706" /><Cell fill="#16a34a" />
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
