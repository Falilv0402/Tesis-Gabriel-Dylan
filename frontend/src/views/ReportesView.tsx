"use client";

import { useState, useMemo, useCallback } from "react";
import { Download, FileText, Mail, AlertTriangle, Users } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import type { DatasetSummary, Student, AlumnoColegio, ColegioResumen } from "@/types";
import { Panel } from "@/components/ui/Primitives";
import { shortId, pct, riskClass } from "@/lib/format";

interface ReportesViewProps {
  summary: DatasetSummary;
  globalSummary: DatasetSummary;
  filtered: Student[];
  high: number;
  medium: number;
  low: number;
  displayTotal: number;
  exportCsv: () => void;
  exportXlsx: () => void;
  exportPdf: () => void;
  miColegioAlumnos?: AlumnoColegio[];
  miColegioResumen?: ColegioResumen | null;
}

const RISK_COLORS = { ALTO: "#dc2626", MEDIO: "#d97706", BAJO: "#16a34a" };
const NOTA_COLORS = { AD: "#16a34a", A: "#2563eb", B: "#d97706", C: "#dc2626" };

export function ReportesView({
  summary, globalSummary, filtered,
  high, medium, low, displayTotal,
  exportCsv, exportXlsx, exportPdf,
  miColegioAlumnos = [], miColegioResumen,
}: ReportesViewProps) {
  // Filtro EM 2022 — compartido entre chips y gráficos
  const [riskFilter,    setRiskFilter]    = useState<"TODOS" | "ALTO" | "MEDIO" | "BAJO">("TODOS");
  const [tipoFilter,    setTipoFilter]    = useState<string>("TODOS");
  const [sexoFilter,    setSexoFilter]    = useState<string>("TODOS");
  // Filtro Mi Colegio — para el donut y la mini-tabla
  const [mcFilter,      setMcFilter]      = useState<"TODOS" | "ALTO" | "MEDIO" | "BAJO">("TODOS");
  const [mcSalonFilter, setMcSalonFilter] = useState<string>("TODOS");

  // Toggle helper: si el mismo valor ya está activo, vuelve a TODOS
  const toggleFilter = useCallback(
    <T extends string>(current: T, next: T, set: (v: T) => void, resetValue: T) =>
      set(current === next ? resetValue : next),
    []
  );

  const rows = useMemo(() => {
    let r = filtered;
    if (riskFilter !== "TODOS") r = r.filter(s => s.nivel_riesgo === riskFilter);
    if (tipoFilter !== "TODOS") r = r.filter(s => s.tipo_riesgo  === tipoFilter);
    if (sexoFilter !== "TODOS") r = r.filter(s => s.sexo         === sexoFilter);
    return r;
  }, [filtered, riskFilter, tipoFilter, sexoFilter]);

  const mcRows = useMemo(() => {
    let r = miColegioAlumnos;
    if (mcFilter      !== "TODOS") r = r.filter(a => a.nivel_riesgo === mcFilter);
    if (mcSalonFilter !== "TODOS") r = r.filter(a => a.salon        === mcSalonFilter);
    return r;
  }, [miColegioAlumnos, mcFilter, mcSalonFilter]);

  const total = high + medium + low;

  // ── Datos para gráficos EM 2022 ───────────────────────────────────────────

  const pieData = useMemo(() => [
    { name: "ALTO",  value: high,   color: RISK_COLORS.ALTO  },
    { name: "MEDIO", value: medium, color: RISK_COLORS.MEDIO },
    { name: "BAJO",  value: low,    color: RISK_COLORS.BAJO  },
  ].filter(d => d.value > 0), [high, medium, low]);

  const bySexData = useMemo(() => {
    const acc: Record<string, { sexo: string; ALTO: number; MEDIO: number; BAJO: number }> = {};
    for (const s of filtered) {
      const sx = s.sexo || "N/D";
      if (!acc[sx]) acc[sx] = { sexo: sx, ALTO: 0, MEDIO: 0, BAJO: 0 };
      acc[sx][s.nivel_riesgo] = (acc[sx][s.nivel_riesgo] || 0) + 1;
    }
    return Object.values(acc).sort((a, b) => a.sexo.localeCompare(b.sexo));
  }, [filtered]);

  const byTipoData = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const s of filtered) {
      const t = s.tipo_riesgo || "Sin tipo";
      acc[t] = (acc[t] || 0) + 1;
    }
    return Object.entries(acc)
      .map(([tipo, n]) => ({ tipo: tipo.length > 22 ? tipo.slice(0, 20) + "…" : tipo, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 6);
  }, [filtered]);

  // ── Datos para gráficos Mi Colegio ────────────────────────────────────────

  const notaLabel = (val: number | null | undefined) => {
    if (val == null) return null;
    if (val >= 18) return "AD";
    if (val >= 14) return "A";
    if (val >= 11) return "B";
    return "C";
  };

  const notasPorMateria = useMemo(() => {
    if (!miColegioAlumnos.length) return [];
    const materias = [
      { key: "pp_matematica",   label: "Matemática" },
      { key: "pp_comunicacion", label: "Comunicación" },
      { key: "pp_cta",          label: "CTA" },
    ] as const;
    return materias.map(({ key, label }) => {
      const cnts = { AD: 0, A: 0, B: 0, C: 0 };
      for (const a of miColegioAlumnos) {
        const lbl = notaLabel((a as Record<string, unknown>)[key] as number | null);
        if (lbl) cnts[lbl]++;
      }
      return { materia: label, ...cnts };
    });
  }, [miColegioAlumnos]);

  const riesgoPorSalon = useMemo(() => {
    if (!miColegioAlumnos.length) return [];
    const acc: Record<string, { salon: string; ALTO: number; MEDIO: number; BAJO: number; total: number }> = {};
    for (const a of miColegioAlumnos) {
      const s = a.salon;
      if (!acc[s]) acc[s] = { salon: s, ALTO: 0, MEDIO: 0, BAJO: 0, total: 0 };
      acc[s][a.nivel_riesgo]++;
      acc[s].total++;
    }
    return Object.values(acc).sort((a, b) => a.salon.localeCompare(b.salon));
  }, [miColegioAlumnos]);

  const hasMiColegio = miColegioAlumnos.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Fila superior: tabla + panel lateral ──────────────────────────── */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, alignItems: "start" }}>

        {/* Tabla */}
        <Panel title={`Listado de estudiantes — ${rows.length.toLocaleString("es-PE")} registros`}>
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            {(["TODOS", "ALTO", "MEDIO", "BAJO"] as const).map((nivel) => {
              const count = nivel === "TODOS" ? total : nivel === "ALTO" ? high : nivel === "MEDIO" ? medium : low;
              const active = riskFilter === nivel;
              const color  = nivel === "ALTO" ? "#dc2626" : nivel === "MEDIO" ? "#d97706" : nivel === "BAJO" ? "#16a34a" : "var(--accent)";
              return (
                <button key={nivel} onClick={() => toggleFilter(riskFilter, nivel, setRiskFilter, "TODOS")} style={{
                  fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 20,
                  border: `1.5px solid ${active ? color : "var(--border)"}`,
                  background: active ? color : "var(--surface)", color: active ? "#fff" : color,
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                  {nivel === "TODOS" ? "Todos" : nivel}
                  <span style={{ marginLeft: 5, fontSize: 11, padding: "0 5px", borderRadius: 10,
                    background: active ? "rgba(255,255,255,0.25)" : `${color}22`, color: active ? "#fff" : color }}>
                    {count}
                  </span>
                </button>
              );
            })}
            {/* Filtros activos adicionales */}
            {tipoFilter !== "TODOS" && (
              <span onClick={() => setTipoFilter("TODOS")} style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 20, cursor: "pointer",
                background: "#eff6ff", border: "1px solid #bfdbfe", color: "var(--accent)",
              }}>
                {tipoFilter} ✕
              </span>
            )}
            {sexoFilter !== "TODOS" && (
              <span onClick={() => setSexoFilter("TODOS")} style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 20, cursor: "pointer",
                background: "#f5f3ff", border: "1px solid #ddd6fe", color: "#7c3aed",
              }}>
                {sexoFilter} ✕
              </span>
            )}
            {(riskFilter !== "TODOS" || tipoFilter !== "TODOS" || sexoFilter !== "TODOS") && (
              <button onClick={() => { setRiskFilter("TODOS"); setTipoFilter("TODOS"); setSexoFilter("TODOS"); }}
                style={{ fontSize: 11, color: "var(--text-muted)", cursor: "pointer", padding: "3px 8px",
                  border: "1px solid var(--border)", borderRadius: 20, background: "transparent" }}>
                Limpiar filtros
              </button>
            )}
          </div>

          <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 380px)", borderRadius: 8, border: "1px solid var(--border)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--navy)", color: "#fff", position: "sticky", top: 0 }}>
                  <th style={th}>ID</th><th style={th}>Nivel</th>
                  <th style={{ ...th, textAlign: "right" }}>Prob.</th>
                  <th style={th}>Distrito</th><th style={th}>Sexo</th>
                  <th style={{ ...th, textAlign: "right" }}>Lectura</th>
                  <th style={{ ...th, textAlign: "right" }}>Ciencias</th>
                  <th style={th}>Tipo de riesgo</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>
                    No hay estudiantes con el filtro seleccionado.
                  </td></tr>
                ) : rows.map((s, i) => (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "transparent", borderBottom: "1px solid var(--border)" }}>
                    <td style={{ ...td, fontWeight: 600, fontFamily: "monospace" }}>···{shortId(s.id)}</td>
                    <td style={td}><span className={riskClass(s.nivel_riesgo)} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 12 }}>{s.nivel_riesgo}</span></td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700,
                      color: s.nivel_riesgo === "ALTO" ? "#dc2626" : s.nivel_riesgo === "MEDIO" ? "#d97706" : "#16a34a" }}>
                      {pct(s.probabilidad_riesgo)}
                    </td>
                    <td style={td}>{s.distrito}</td>
                    <td style={td}>{s.sexo}</td>
                    <td style={{ ...td, textAlign: "right" }}>{s.M500_L.toFixed(0)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{s.M500_CN.toFixed(0)}</td>
                    <td style={{ ...td, color: "var(--text-muted)", fontSize: 11 }}>{s.tipo_riesgo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 0 && (
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, textAlign: "right" }}>
              Mostrando {rows.length.toLocaleString("es-PE")} de {displayTotal.toLocaleString("es-PE")} estudiantes · Periodo EM 2022
            </p>
          )}
        </Panel>

        {/* Panel lateral */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel title="Resumen">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Total estudiantes", value: total.toLocaleString("es-PE"), color: "var(--accent)", icon: <Users size={14}/> },
                { label: "Riesgo ALTO",  value: high.toLocaleString("es-PE"),   color: "#dc2626", icon: <AlertTriangle size={14}/> },
                { label: "Riesgo MEDIO", value: medium.toLocaleString("es-PE"), color: "#d97706", icon: <AlertTriangle size={14}/> },
                { label: "Riesgo BAJO",  value: low.toLocaleString("es-PE"),    color: "#16a34a", icon: <Users size={14}/> },
              ].map(({ label, value, color, icon }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 10px", borderRadius: 8, background: "var(--surface)",
                  border: `1px solid var(--border)`, borderLeft: `4px solid ${color}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color, fontSize: 12, fontWeight: 600 }}>{icon} {label}</div>
                  <span style={{ fontWeight: 800, fontSize: 18, color }}>{value}</span>
                </div>
              ))}
            </div>
            {total > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 1 }}>
                  {high   > 0 && <div style={{ flex: high,   background: "#dc2626" }} title={`ALTO: ${high}`}/>}
                  {medium > 0 && <div style={{ flex: medium, background: "#d97706" }} title={`MEDIO: ${medium}`}/>}
                  {low    > 0 && <div style={{ flex: low,    background: "#16a34a" }} title={`BAJO: ${low}`}/>}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                  <span>ALTO {((high / total) * 100).toFixed(0)}%</span>
                  <span>MEDIO {((medium / total) * 100).toFixed(0)}%</span>
                  <span>BAJO {((low / total) * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}
            <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8, textAlign: "center" }}>
              Global: {globalSummary.total.toLocaleString("es-PE")} est. · EM 2022
            </p>
          </Panel>

          <Panel title="Exportar listado">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Exportar CSV",       sub: "Para Excel, Google Sheets",    color: "#16a34a", icon: <Download size={15}/>, fn: exportCsv },
                { label: "Exportar Excel",      sub: "Con hoja de resumen",          color: "#0369a1", icon: <Download size={15}/>, fn: exportXlsx },
                { label: "Reporte PDF",         sub: "Para presentar a directivos",  color: "#dc2626", icon: <FileText size={15}/>, fn: exportPdf },
              ].map(({ label, sub, color, icon, fn }) => (
                <button key={label} onClick={fn} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-start", width: "100%", padding: "9px 12px" }}>
                  <span style={{ color }}>{icon}</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{sub}</div>
                  </div>
                </button>
              ))}
            </div>
            <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8, textAlign: "center" }}>
              {rows.length} registros con filtro activo
            </p>
          </Panel>
        </div>
      </section>

      {/* ── Gráficos EM 2022 ──────────────────────────────────────────────── */}
      {total > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>

            {/* Gráfico 1: Distribución por nivel (Donut interactivo) */}
            <Panel title={`Distribución por nivel${riskFilter !== "TODOS" ? ` · ${riskFilter}` : ""}`}>
              <div className="model-note" style={{ marginBottom: 8 }}>
                Clic en un segmento para filtrar la tabla ↑
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    dataKey="value" nameKey="name" paddingAngle={3} cursor="pointer"
                    onClick={(d) => toggleFilter(riskFilter, d.name as "ALTO"|"MEDIO"|"BAJO", setRiskFilter, "TODOS")}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color}
                        opacity={riskFilter === "TODOS" || riskFilter === entry.name ? 1 : 0.3}
                        stroke={riskFilter === entry.name ? "#fff" : "none"} strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} estudiantes`]} />
                </PieChart>
              </ResponsiveContainer>
            </Panel>

            {/* Gráfico 2: Riesgo por sexo (interactivo) */}
            <Panel title={`Riesgo por sexo${sexoFilter !== "TODOS" ? ` · ${sexoFilter}` : ""}`}>
              <div className="model-note" style={{ marginBottom: 8 }}>
                Clic en una barra para filtrar por sexo y nivel.
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={bySexData} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}
                  onClick={(d) => {
                    if (d?.activeLabel) toggleFilter(sexoFilter, String(d.activeLabel), setSexoFilter, "TODOS");
                  }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="sexo" tick={{ fontSize: 11 }} cursor="pointer" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="ALTO"  fill={RISK_COLORS.ALTO}  name="Alto"  radius={[2,2,0,0]} cursor="pointer"
                    opacity={riskFilter === "TODOS" || riskFilter === "ALTO"  ? 1 : 0.3} />
                  <Bar dataKey="MEDIO" fill={RISK_COLORS.MEDIO} name="Medio" radius={[2,2,0,0]} cursor="pointer"
                    opacity={riskFilter === "TODOS" || riskFilter === "MEDIO" ? 1 : 0.3} />
                  <Bar dataKey="BAJO"  fill={RISK_COLORS.BAJO}  name="Bajo"  radius={[2,2,0,0]} cursor="pointer"
                    opacity={riskFilter === "TODOS" || riskFilter === "BAJO"  ? 1 : 0.3} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            {/* Gráfico 3: Tipo de riesgo (interactivo) */}
            <Panel title={`Tipo de riesgo${tipoFilter !== "TODOS" ? ` · seleccionado` : ""}`}>
              <div className="model-note" style={{ marginBottom: 8 }}>
                Clic en una barra para filtrar por tipo de riesgo.
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byTipoData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="tipo" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip formatter={(v) => [`${v} estudiantes`]} />
                  <Bar dataKey="n" name="Estudiantes" radius={[0,2,2,0]} cursor="pointer"
                    onClick={(d) => toggleFilter(tipoFilter, String((d as unknown as Record<string,unknown>).tipo ?? ""), setTipoFilter, "TODOS")}>
                    {byTipoData.map((entry) => (
                      <Cell key={entry.tipo}
                        fill={tipoFilter === "TODOS" || tipoFilter === entry.tipo ? "var(--accent)" : "#cbd5e1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          {/* ── Gráficos Mi Colegio (solo si hay datos) ─────────────────────── */}
          {hasMiColegio && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 -4px" }}>
                <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)", whiteSpace: "nowrap" }}>
                  {miColegioResumen?.nombre_colegio ?? "Mi Colegio"} — datos internos
                </span>
                <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>

                {/* Gráfico 4: Notas por materia */}
                <Panel title="Distribución de notas por materia">
                  <div className="model-note" style={{ marginBottom: 8 }}>
                    Cantidad de alumnos por nota (AD/A/B/C) en cada materia clave.
                  </div>
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={notasPorMateria} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="materia" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="AD" fill={NOTA_COLORS.AD} name="AD (Dest.)" radius={[2,2,0,0]} />
                      <Bar dataKey="A"  fill={NOTA_COLORS.A}  name="A (Logro)"  radius={[2,2,0,0]} />
                      <Bar dataKey="B"  fill={NOTA_COLORS.B}  name="B (Proceso)"radius={[2,2,0,0]} />
                      <Bar dataKey="C"  fill={NOTA_COLORS.C}  name="C (Inicio)" radius={[2,2,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Panel>

                {/* Gráfico 5: Riesgo por salón (interactivo) */}
                <Panel title={`Riesgo por salón${mcSalonFilter !== "TODOS" ? ` · ${mcSalonFilter}` : ""}`}>
                  <div className="model-note" style={{ marginBottom: 8 }}>
                    Clic en un salón para filtrar la lista de abajo.
                  </div>
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={riesgoPorSalon} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}
                      onClick={(d) => {
                        if (d?.activeLabel) toggleFilter(mcSalonFilter, String(d.activeLabel), setMcSalonFilter, "TODOS");
                      }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="salon" tick={{ fontSize: 11 }} cursor="pointer" />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="ALTO"  fill={RISK_COLORS.ALTO}  name="Alto"  radius={[2,2,0,0]} stackId="a" cursor="pointer" />
                      <Bar dataKey="MEDIO" fill={RISK_COLORS.MEDIO} name="Medio" radius={[2,2,0,0]} stackId="a" cursor="pointer" />
                      <Bar dataKey="BAJO"  fill={RISK_COLORS.BAJO}  name="Bajo"  radius={[0,0,2,2]} stackId="a" cursor="pointer" />
                    </BarChart>
                  </ResponsiveContainer>
                </Panel>

                {/* Gráfico 6: Donut crítico/moderado/bajo */}
                <Panel title={`Estado general${mcFilter !== "TODOS" ? ` · ${mcFilter === "ALTO" ? "Crítico" : mcFilter === "MEDIO" ? "Moderado" : "Bajo"}` : ""}`}>
                  <div className="model-note" style={{ marginBottom: 4 }}>
                    Clic en un segmento para filtrar la lista de abajo.
                  </div>
                  {(() => {
                    const critico  = miColegioAlumnos.filter(a => a.nivel_riesgo === "ALTO").length;
                    const moderado = miColegioAlumnos.filter(a => a.nivel_riesgo === "MEDIO").length;
                    const bajo     = miColegioAlumnos.filter(a => a.nivel_riesgo === "BAJO").length;
                    // Mapeo entre etiquetas del donut y valores del filtro
                    const labelToFilter: Record<string,"ALTO"|"MEDIO"|"BAJO"> =
                      { "Crítico": "ALTO", "Moderado": "MEDIO", "Bajo": "BAJO" };
                    const donutData = [
                      { name: "Crítico",  value: critico,  color: "#dc2626", nivel: "ALTO"  as const },
                      { name: "Moderado", value: moderado, color: "#d97706", nivel: "MEDIO" as const },
                      { name: "Bajo",     value: bajo,     color: "#16a34a", nivel: "BAJO"  as const },
                    ].filter(d => d.value > 0);
                    const pctCritico = miColegioAlumnos.length
                      ? ((critico / miColegioAlumnos.length) * 100).toFixed(0)
                      : "0";
                    return (
                      <>
                        <ResponsiveContainer width="100%" height={170}>
                          <PieChart>
                            <Pie data={donutData} cx="50%" cy="50%"
                              innerRadius={42} outerRadius={72}
                              dataKey="value" paddingAngle={3}
                              cursor="pointer"
                              onClick={(d) => { const nv = labelToFilter[String(d.name)]; if (nv) toggleFilter(mcFilter, nv, setMcFilter, "TODOS"); }}
                              label={({ name, percent }) =>
                                `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                              labelLine={false}>
                              {donutData.map((d) => (
                                <Cell key={d.name} fill={d.color}
                                  opacity={mcFilter === "TODOS" || mcFilter === d.nivel ? 1 : 0.3}
                                  stroke={mcFilter === d.nivel ? "#fff" : "none"} strokeWidth={2} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => [`${v} alumnos`]} />
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Texto central interpretativo */}
                        <div style={{ textAlign: "center", marginTop: 6 }}>
                          <span style={{
                            fontSize: 22, fontWeight: 800,
                            color: critico > 0 ? "#dc2626" : "#16a34a",
                          }}>
                            {pctCritico}%
                          </span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>
                            en estado crítico
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 6 }}>
                          {[
                            { label: "Crítico",  n: critico,  color: "#dc2626" },
                            { label: "Moderado", n: moderado, color: "#d97706" },
                            { label: "Bajo",     n: bajo,     color: "#16a34a" },
                          ].map(({ label, n, color }) => (
                            <div key={label} style={{ textAlign: "center" }}>
                              <div style={{ fontSize: 16, fontWeight: 700, color }}>{n}</div>
                              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{label}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </Panel>

              </div>

              {/* Mini-tabla filtrada de Mi Colegio */}
              {(mcFilter !== "TODOS" || mcSalonFilter !== "TODOS") && (
                <Panel title={`Alumnos filtrados — ${mcRows.length} resultado${mcRows.length !== 1 ? "s" : ""}`}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
                    {mcFilter !== "TODOS" && (
                      <span onClick={() => setMcFilter("TODOS")} style={{
                        fontSize: 11, padding: "2px 10px", borderRadius: 20, cursor: "pointer",
                        background: mcFilter === "ALTO" ? "#fef2f2" : mcFilter === "MEDIO" ? "#fffbeb" : "#f0fdf4",
                        border: `1px solid ${mcFilter === "ALTO" ? "#fca5a5" : mcFilter === "MEDIO" ? "#fde68a" : "#86efac"}`,
                        color:  mcFilter === "ALTO" ? "#dc2626" : mcFilter === "MEDIO" ? "#d97706" : "#16a34a",
                      }}>
                        {mcFilter === "ALTO" ? "Crítico" : mcFilter === "MEDIO" ? "Moderado" : "Bajo"} ✕
                      </span>
                    )}
                    {mcSalonFilter !== "TODOS" && (
                      <span onClick={() => setMcSalonFilter("TODOS")} style={{
                        fontSize: 11, padding: "2px 10px", borderRadius: 20, cursor: "pointer",
                        background: "#eff6ff", border: "1px solid #bfdbfe", color: "var(--accent)",
                      }}>
                        Salón {mcSalonFilter} ✕
                      </span>
                    )}
                  </div>
                  <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "var(--navy)", color: "#fff" }}>
                          <th style={th}>#</th>
                          <th style={th}>Salón</th>
                          <th style={th}>Estado</th>
                          <th style={{ ...th, textAlign: "right" }}>Riesgo</th>
                          <th style={{ ...th, textAlign: "right" }}>Mat.</th>
                          <th style={{ ...th, textAlign: "right" }}>Com.</th>
                          <th style={{ ...th, textAlign: "right" }}>CTA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mcRows.slice(0, 20).map((a, i) => (
                          <tr key={`${a.salon}-${a.n_alumno}`} style={{
                            background: i % 2 === 0 ? "var(--surface)" : "transparent",
                            borderBottom: "1px solid var(--border)",
                          }}>
                            <td style={{ ...td, fontWeight: 600, color: "var(--text-muted)" }}>{a.n_alumno}</td>
                            <td style={{ ...td, fontWeight: 600 }}>{a.salon}</td>
                            <td style={td}>
                              <span style={{
                                fontSize: 10, padding: "2px 8px", borderRadius: 12, fontWeight: 600,
                                background: a.nivel_riesgo === "ALTO" ? "#fef2f2" : a.nivel_riesgo === "MEDIO" ? "#fffbeb" : "#f0fdf4",
                                color: a.nivel_riesgo === "ALTO" ? "#dc2626" : a.nivel_riesgo === "MEDIO" ? "#d97706" : "#16a34a",
                              }}>
                                {a.nivel_riesgo === "ALTO" ? "Crítico" : a.nivel_riesgo === "MEDIO" ? "Moderado" : "Bajo"}
                              </span>
                            </td>
                            <td style={{ ...td, textAlign: "right", fontWeight: 700,
                              color: a.nivel_riesgo === "ALTO" ? "#dc2626" : a.nivel_riesgo === "MEDIO" ? "#d97706" : "#16a34a" }}>
                              {(a.prob_riesgo * 100).toFixed(0)}%
                            </td>
                            {(["pp_matematica","pp_comunicacion","pp_cta"] as const).map((k) => {
                              const v = (a as Record<string,unknown>)[k] as number|null;
                              const lbl = v == null ? "—" : v >= 18 ? "AD" : v >= 14 ? "A" : v >= 11 ? "B" : "C";
                              return (
                                <td key={k} style={{ ...td, textAlign: "right", fontWeight: lbl === "C" ? 700 : 400,
                                  color: lbl === "AD" ? "#16a34a" : lbl === "A" ? "#2563eb" : lbl === "B" ? "#d97706" : lbl === "C" ? "#dc2626" : "var(--text-muted)" }}>
                                  {lbl}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        {mcRows.length > 20 && (
                          <tr><td colSpan={7} style={{ textAlign: "center", padding: "8px", color: "var(--text-muted)", fontSize: 11 }}>
                            +{mcRows.length - 20} más · usa el filtro de salón para ver todos
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              )}
            </>
          )}
        </>
      )}
    </div>
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
