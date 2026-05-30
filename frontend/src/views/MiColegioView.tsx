"use client";

import { RefreshCcw, School, AlertTriangle, Users, BookOpen, TrendingDown } from "lucide-react";
import type { AlumnoColegio, ColegioResumen } from "@/types";
import { Panel, EmptyState } from "@/components/ui/Primitives";
import { pct, riskClass } from "@/lib/format";

interface MiColegioViewProps {
  codigoIe:     string | null;
  alumnos:      AlumnoColegio[];
  resumen:      ColegioResumen | null;
  isLoading:    boolean;
  error:        string | null;
  salonFilter:  string;
  setSalonFilter:(v: string) => void;
  nivelFilter:  string;
  setNivelFilter:(v: string) => void;
  salones:      string[];
  onRefresh:    () => void;
  onSelectAlumno?: (alumno: AlumnoColegio) => void;
}

export function MiColegioView({
  codigoIe, alumnos, resumen, isLoading, error,
  salonFilter, setSalonFilter, nivelFilter, setNivelFilter,
  salones, onRefresh, onSelectAlumno,
}: MiColegioViewProps) {

  // ── Sin colegio asignado ──────────────────────────────────────────────────
  if (!codigoIe) {
    return (
      <section className="full-col">
        <Panel title="Mi Colegio">
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <School size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <h3 style={{ margin: "0 0 8px", color: "var(--navy)" }}>Sin colegio asignado</h3>
            <p className="model-note">
              Tu cuenta no tiene un colegio asignado. Contacta al administrador del sistema.
            </p>
          </div>
        </Panel>
      </section>
    );
  }

  // ── Sin datos del colegio aún ─────────────────────────────────────────────
  if (error === "no_data") {
    return (
      <section className="full-col">
        <Panel title="Mi Colegio">
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <BookOpen size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <h3 style={{ margin: "0 0 8px", color: "var(--navy)" }}>Sin datos cargados aún</h3>
            <p className="model-note" style={{ maxWidth: 400, margin: "0 auto 16px" }}>
              El administrador todavía no ha subido los archivos de tu colegio.
              Cuando los suba, aquí verás el análisis de riesgo de tus estudiantes.
            </p>
          </div>
        </Panel>
      </section>
    );
  }

  return (
    <section style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 16, alignItems: "start" }}>

      {/* ── Tabla de alumnos ───────────────────────────────────────────── */}
      <Panel title={`${resumen?.nombre_colegio ?? "Mi Colegio"} · ${alumnos.length} estudiantes`}>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          {/* Filtro salón */}
          <select
            value={salonFilter}
            onChange={(e) => setSalonFilter(e.target.value)}
            style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)" }}
          >
            <option value="Todos">Todos los salones</option>
            {salones.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Chips de nivel */}
          {(["Todos", "ALTO", "MEDIO", "BAJO"] as const).map((nivel) => {
            const active = nivelFilter === nivel;
            const color  = nivel === "ALTO" ? "#dc2626" : nivel === "MEDIO" ? "#d97706" : nivel === "BAJO" ? "#16a34a" : "var(--accent)";
            const count  = nivel === "Todos"
              ? alumnos.length
              : alumnos.filter((a) => a.nivel_riesgo === nivel).length;
            return (
              <button
                key={nivel}
                onClick={() => setNivelFilter(nivel)}
                style={{
                  fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20,
                  border: `1.5px solid ${active ? color : "var(--border)"}`,
                  background: active ? color : "var(--surface)",
                  color: active ? "#fff" : color, cursor: "pointer",
                }}
              >
                {nivel === "Todos" ? "Todos" : nivel}
                <span style={{ marginLeft: 4, fontSize: 10,
                  background: active ? "rgba(255,255,255,0.25)" : `${color}22`,
                  borderRadius: 10, padding: "0 5px",
                  color: active ? "#fff" : color,
                }}>
                  {count}
                </span>
              </button>
            );
          })}

          <button style={{ marginLeft: "auto" }} onClick={onRefresh} disabled={isLoading}>
            <RefreshCcw size={14} /> {isLoading ? "Cargando..." : "Actualizar"}
          </button>
        </div>

        {/* Tabla */}
        {isLoading ? (
          <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
            Cargando estudiantes...
          </div>
        ) : alumnos.length === 0 ? (
          <EmptyState message="No hay estudiantes con el filtro seleccionado." />
        ) : (
          <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 300px)", borderRadius: 8, border: "1px solid var(--border)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--navy)", color: "#fff", position: "sticky", top: 0 }}>
                  <th style={th}>#</th>
                  <th style={th}>Salón</th>
                  <th style={th}>Nivel</th>
                  <th style={{ ...th, textAlign: "right" }}>Riesgo</th>
                  <th style={{ ...th, textAlign: "right" }}>Mat.</th>
                  <th style={{ ...th, textAlign: "right" }}>Com.</th>
                  <th style={{ ...th, textAlign: "right" }}>CTA</th>
                  <th style={{ ...th, textAlign: "right" }}>Conducta</th>
                  <th style={{ ...th, textAlign: "right" }}>C's</th>
                </tr>
              </thead>
              <tbody>
                {alumnos.map((a, i) => (
                  <tr
                    key={`${a.salon}-${a.n_alumno}`}
                    style={{
                      background: i % 2 === 0 ? "var(--surface)" : "transparent",
                      borderBottom: "1px solid var(--border)",
                      cursor: onSelectAlumno ? "pointer" : "default",
                    }}
                    onClick={() => onSelectAlumno?.(a)}
                  >
                    <td style={{ ...td, fontWeight: 700, color: "var(--text-muted)" }}>
                      {a.n_alumno}
                    </td>
                    <td style={{ ...td, fontWeight: 600 }}>{a.salon}</td>
                    <td style={td}>
                      <span className={riskClass(a.nivel_riesgo)}
                        style={{ fontSize: 10, padding: "2px 7px", borderRadius: 12 }}>
                        {a.nivel_riesgo}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700,
                      color: a.nivel_riesgo === "ALTO" ? "#dc2626" : a.nivel_riesgo === "MEDIO" ? "#d97706" : "#16a34a" }}>
                      {pct(a.prob_riesgo)}
                    </td>
                    <td style={tdNota(a.pp_matematica)}>{fmtNota(a.pp_matematica)}</td>
                    <td style={tdNota(a.pp_comunicacion)}>{fmtNota(a.pp_comunicacion)}</td>
                    <td style={tdNota(a.pp_cta)}>{fmtNota(a.pp_cta)}</td>
                    <td style={tdNota(a.conducta_promedio)}>{fmtNota(a.conducta_promedio)}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: a.n_materias_c > 0 ? 700 : 400,
                      color: a.n_materias_c > 1 ? "#dc2626" : a.n_materias_c === 1 ? "#d97706" : "var(--text)" }}>
                      {a.n_materias_c}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && resumen && (
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, textAlign: "right" }}>
            Modelo entrenado: {resumen.trained_at
              ? new Date(resumen.trained_at).toLocaleDateString("es-PE", { dateStyle: "medium" })
              : "—"}
          </p>
        )}
      </Panel>

      {/* ── Panel lateral ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* KPIs */}
        {resumen && (
          <Panel title={resumen.nombre_colegio ?? "Resumen del colegio"}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Total alumnos",  value: resumen.n_alumnos,  color: "var(--accent)", icon: <Users size={13}/> },
                { label: "En riesgo",      value: resumen.n_riesgo,   color: "#dc2626",        icon: <AlertTriangle size={13}/> },
                { label: "% en riesgo",    value: `${resumen.pct_riesgo}%`, color: "#d97706",  icon: <TrendingDown size={13}/> },
              ].map(({ label, value, color, icon }) => (
                <div key={label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "7px 10px", borderRadius: 8, background: "var(--surface)",
                  border: "1px solid var(--border)", borderLeft: `4px solid ${color}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, color, fontSize: 11, fontWeight: 600 }}>
                    {icon} {label}
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 16, color }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Por salón */}
            {Object.keys(resumen.por_salon).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Por salón
                </p>
                {Object.entries(resumen.por_salon).map(([salon, counts]) => {
                  const total    = counts.total || 1;
                  const enRiesgo = (counts.ALTO || 0) + (counts.MEDIO || 0);
                  const pctRiesgo = Math.round((enRiesgo / total) * 100);
                  return (
                    <div key={salon} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                        <span style={{ fontWeight: 600 }}>{salon}</span>
                        <span style={{ color: "var(--text-muted)" }}>{enRiesgo}/{total} en riesgo ({pctRiesgo}%)</span>
                      </div>
                      <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: "var(--border)" }}>
                        <div style={{ flex: counts.ALTO   || 0, background: "#dc2626" }} />
                        <div style={{ flex: counts.MEDIO  || 0, background: "#d97706" }} />
                        <div style={{ flex: counts.BAJO   || 0, background: "#16a34a" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8 }}>
              Riesgo = C en Matemática o Comunicación
            </p>
          </Panel>
        )}

        {/* Leyenda de notas */}
        <Panel title="Escala de notas">
          {[
            { literal: "AD", num: "18-20", desc: "Logro destacado",  color: "#16a34a" },
            { literal: "A",  num: "14-17", desc: "Logro esperado",   color: "#2563eb" },
            { literal: "B",  num: "11-13", desc: "En proceso",       color: "#d97706" },
            { literal: "C",  num: "0-10",  desc: "En inicio",        color: "#dc2626" },
          ].map(({ literal, num, desc, color }) => (
            <div key={literal} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 12 }}>
              <span style={{ fontWeight: 800, fontSize: 14, color, width: 24, textAlign: "center" }}>{literal}</span>
              <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{num}</span>
              <span>{desc}</span>
            </div>
          ))}
        </Panel>
      </div>
    </section>
  );
}

// ── Helpers de estilo ─────────────────────────────────────────────────────────
const th: React.CSSProperties = {
  padding: "7px 10px", textAlign: "left", fontSize: 11,
  fontWeight: 700, whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "6px 10px", whiteSpace: "nowrap",
};

function tdNota(val: number | null | undefined): React.CSSProperties {
  const color = val == null ? "var(--text-muted)"
    : val <= 13 ? "#dc2626"
    : val <= 15.9 ? "#d97706"
    : "#16a34a";
  return { ...td, textAlign: "right", fontWeight: val != null && val <= 13 ? 700 : 400, color };
}

function fmtNota(val: number | null | undefined): string {
  if (val == null) return "—";
  if (val >= 18) return "AD";
  if (val >= 14) return "A";
  if (val >= 11) return "B";
  return "C";
}
