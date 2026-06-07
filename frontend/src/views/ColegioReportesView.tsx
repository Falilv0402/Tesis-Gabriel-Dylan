"use client";

import { useMemo, useState } from "react";
import {
  Filter, Download, Users, AlertTriangle,
  BarChart as BarChartIcon,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import type { AlumnoColegio, ColegioResumen } from "@/types";
import { Panel } from "@/components/ui/Primitives";
import { riskClass } from "@/lib/format";
import {
  MATERIAS_COLEGIO, anioFromSalon, aniosDeSalones,
  notaInfo, notaBimestre, colegioStudentId, type Bimestre,
} from "@/lib/colegio";

interface ColegioReportesViewProps {
  nombreColegio: string;
  alumnos: AlumnoColegio[];
  resumen: ColegioResumen | null;
  onSelect?: (a: AlumnoColegio) => void;
}

const RISK_COLORS = { ALTO: "#dc2626", MEDIO: "#d97706", BAJO: "#16a34a" };
const NOTA_COLORS = { AD: "#16a34a", A: "#2563eb", B: "#d97706", C: "#dc2626" };

export function ColegioReportesView({
  nombreColegio, alumnos, resumen, onSelect,
}: ColegioReportesViewProps) {
  const [nivel,    setNivel]    = useState<"Todos" | "ALTO" | "MEDIO" | "BAJO">("Todos");
  const [anio,     setAnio]     = useState<string>("Todos");
  const [bimestre, setBimestre] = useState<Bimestre>("1");
  const [search,   setSearch]   = useState("");

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

  const total = filtrados.length;

  // ── Datos para gráficos ───────────────────────────────────────────────────
  const pieData = useMemo(() => [
    { name: "ALTO",  value: counts.ALTO,  color: RISK_COLORS.ALTO },
    { name: "MEDIO", value: counts.MEDIO, color: RISK_COLORS.MEDIO },
    { name: "BAJO",  value: counts.BAJO,  color: RISK_COLORS.BAJO },
  ].filter((d) => d.value > 0), [counts]);

  const porSalon = useMemo(() => {
    const acc: Record<string, { salon: string; ALTO: number; MEDIO: number; BAJO: number }> = {};
    for (const a of filtrados) {
      if (!acc[a.salon]) acc[a.salon] = { salon: a.salon, ALTO: 0, MEDIO: 0, BAJO: 0 };
      acc[a.salon][a.nivel_riesgo]++;
    }
    return Object.values(acc).sort((x, y) => x.salon.localeCompare(y.salon));
  }, [filtrados]);

  const notasPorMateria = useMemo(() => {
    return MATERIAS_COLEGIO.map(({ key, label }) => {
      const cnts = { AD: 0, A: 0, B: 0, C: 0 };
      for (const a of filtrados) {
        const letra = notaInfo(notaBimestre(a, key, bimestre)).letra;
        if (letra in cnts) cnts[letra as keyof typeof cnts]++;
      }
      return { materia: label, ...cnts };
    });
  }, [filtrados, bimestre]);

  // ── Export CSV ────────────────────────────────────────────────────────────
  function exportCsv() {
    const headers = ["n_alumno", "nombre", "salon", "nivel_riesgo", "prob_riesgo",
      ...MATERIAS_COLEGIO.map((m) => `b${bimestre}_${m.key}`)];
    const lines = [headers.join(",")];
    for (const a of filtrados) {
      const row = [
        a.n_alumno, `"${a.nombre}"`, a.salon, a.nivel_riesgo,
        (a.prob_riesgo * 100).toFixed(1) + "%",
        ...MATERIAS_COLEGIO.map((m) => notaBimestre(a, m.key, bimestre) ?? ""),
      ];
      lines.push(row.join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${nombreColegio.replace(/\s+/g, "_")}_bimestre${bimestre}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Filtros ──────────────────────────────────────────────────────── */}
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
          <select value={bimestre} onChange={(e) => setBimestre(e.target.value as Bimestre)}>
            <option value="1">Bimestre 1</option>
            <option value="2">Bimestre 2</option>
            <option value="3">Bimestre 3</option>
            <option value="4">Bimestre 4</option>
          </select>
        </label>
        <label className="filter-field">Buscar
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre o salón..." style={{ minWidth: "150px" }} />
        </label>
        <button onClick={exportCsv}><Download size={17} /> Exportar CSV</button>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, alignItems: "start" }}>
        {/* ── Tabla ──────────────────────────────────────────────────────── */}
        <Panel title={`${nombreColegio} — ${total.toLocaleString("es-PE")} alumnos · notas del Bimestre ${bimestre}`}>
          <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 360px)", borderRadius: 10, border: "1px solid var(--border)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--navy)", color: "#fff", position: "sticky", top: 0 }}>
                  <th style={th}>Alumno</th>
                  <th style={th}>Salón</th>
                  <th style={th}>Nivel</th>
                  <th style={{ ...th, textAlign: "right" }}>Prob.</th>
                  {MATERIAS_COLEGIO.map((m) => <th key={m.key} style={{ ...th, textAlign: "center" }}>{m.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {total === 0 ? (
                  <tr><td colSpan={4 + MATERIAS_COLEGIO.length} style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)" }}>
                    No hay alumnos con el filtro seleccionado.
                  </td></tr>
                ) : filtrados.map((a, i) => (
                  <tr key={colegioStudentId(a)}
                    onClick={onSelect ? () => onSelect(a) : undefined}
                    style={{ background: i % 2 === 0 ? "var(--surface)" : "transparent", borderBottom: "1px solid var(--border)", cursor: onSelect ? "pointer" : "default" }}
                    title={onSelect ? "Ver detalle del alumno" : undefined}
                  >
                    <td style={{ ...td, fontWeight: 600 }}>{a.nombre}</td>
                    <td style={td}>{a.salon}</td>
                    <td style={td}><span className={riskClass(a.nivel_riesgo)} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 12 }}>{a.nivel_riesgo}</span></td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: a.nivel_riesgo === "ALTO" ? "#dc2626" : a.nivel_riesgo === "MEDIO" ? "#d97706" : "#16a34a" }}>
                      {(a.prob_riesgo * 100).toFixed(0)}%
                    </td>
                    {MATERIAS_COLEGIO.map((m) => {
                      const g = notaInfo(notaBimestre(a, m.key, bimestre));
                      return <td key={m.key} style={{ ...td, textAlign: "center", fontWeight: 600, color: g.color }}>{g.label}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* ── Resumen lateral ────────────────────────────────────────────── */}
        <Panel title="Resumen">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "Total alumnos", value: total, color: "var(--accent)", icon: <Users size={14} /> },
              { label: "Riesgo ALTO",  value: counts.ALTO,  color: "#dc2626", icon: <AlertTriangle size={14} /> },
              { label: "Riesgo MEDIO", value: counts.MEDIO, color: "#d97706", icon: <AlertTriangle size={14} /> },
              { label: "Riesgo BAJO",  value: counts.BAJO,  color: "#16a34a", icon: <Users size={14} /> },
            ].map(({ label, value, color, icon }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 10px", borderRadius: 8, background: "var(--surface)",
                border: "1px solid var(--border)", borderLeft: `4px solid ${color}` }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, color, fontSize: 12, fontWeight: 600 }}>{icon} {label}</span>
                <strong style={{ fontSize: 18, color }}>{value}</strong>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8, textAlign: "center" }}>
            {alumnos.length.toLocaleString("es-PE")} alumnos en el modelo del colegio
          </p>
        </Panel>
      </section>

      {/* ── Gráficos ─────────────────────────────────────────────────────── */}
      {total > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <Panel title="Distribución por nivel de riesgo">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" nameKey="name"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {pieData.map((e) => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v) => [`${v} alumnos`]} />
              </PieChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Riesgo por salón">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={porSalon} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="salon" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="ALTO"  stackId="a" fill={RISK_COLORS.ALTO}  name="Alto"  radius={[2,2,0,0]} />
                <Bar dataKey="MEDIO" stackId="a" fill={RISK_COLORS.MEDIO} name="Medio" radius={[0,0,0,0]} />
                <Bar dataKey="BAJO"  stackId="a" fill={RISK_COLORS.BAJO}  name="Bajo"  radius={[0,0,2,2]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title={`Notas por materia · Bimestre ${bimestre}`}>
            <div className="model-note" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
              <BarChartIcon size={12} /> Cantidad de alumnos por nota (AD/A/B/C).
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={notasPorMateria} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="materia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="AD" fill={NOTA_COLORS.AD} name="AD" radius={[2,2,0,0]} />
                <Bar dataKey="A"  fill={NOTA_COLORS.A}  name="A"  radius={[2,2,0,0]} />
                <Bar dataKey="B"  fill={NOTA_COLORS.B}  name="B"  radius={[2,2,0,0]} />
                <Bar dataKey="C"  fill={NOTA_COLORS.C}  name="C"  radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "8px 10px", textAlign: "left", fontSize: 11,
  fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.03em",
};
const td: React.CSSProperties = {
  padding: "7px 10px", whiteSpace: "nowrap",
};
