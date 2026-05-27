"use client";

import { useState } from "react";
import { Download, FileText, Mail, AlertTriangle, Users } from "lucide-react";
import type { DatasetSummary, Student } from "@/types";
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
}

export function ReportesView({
  summary, globalSummary, filtered,
  high, medium, low, displayTotal,
  exportCsv, exportXlsx, exportPdf,
}: ReportesViewProps) {
  const [riskFilter, setRiskFilter] = useState<"TODOS" | "ALTO" | "MEDIO" | "BAJO">("TODOS");

  const rows = riskFilter === "TODOS"
    ? filtered
    : filtered.filter((s) => s.nivel_riesgo === riskFilter);

  const total = high + medium + low;

  return (
    <section style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, alignItems: "start" }}>

      {/* ── Tabla principal ───────────────────────────────────────────────── */}
      <Panel title={`Listado de estudiantes — ${rows.length.toLocaleString("es-PE")} registros`}>

        {/* Filtro rápido por nivel */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {(["TODOS", "ALTO", "MEDIO", "BAJO"] as const).map((nivel) => {
            const count = nivel === "TODOS" ? total : nivel === "ALTO" ? high : nivel === "MEDIO" ? medium : low;
            const active = riskFilter === nivel;
            const color  = nivel === "ALTO" ? "#dc2626" : nivel === "MEDIO" ? "#d97706" : nivel === "BAJO" ? "#16a34a" : "var(--accent)";
            return (
              <button
                key={nivel}
                onClick={() => setRiskFilter(nivel)}
                style={{
                  fontSize: 12, fontWeight: 600, padding: "4px 12px",
                  borderRadius: 20, border: `1.5px solid ${active ? color : "var(--border)"}`,
                  background: active ? color : "var(--surface)",
                  color: active ? "#fff" : color,
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {nivel === "TODOS" ? "Todos" : nivel}
                <span style={{
                  marginLeft: 5, fontSize: 11, padding: "0 5px", borderRadius: 10,
                  background: active ? "rgba(255,255,255,0.25)" : `${color}22`,
                  color: active ? "#fff" : color,
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tabla */}
        <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 280px)", borderRadius: 8, border: "1px solid var(--border)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--navy)", color: "#fff", position: "sticky", top: 0 }}>
                <th style={th}>ID</th>
                <th style={th}>Nivel</th>
                <th style={{ ...th, textAlign: "right" }}>Prob.</th>
                <th style={th}>Distrito</th>
                <th style={th}>Sexo</th>
                <th style={{ ...th, textAlign: "right" }}>Lectura</th>
                <th style={{ ...th, textAlign: "right" }}>Ciencias</th>
                <th style={th}>Tipo de riesgo</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>
                    No hay estudiantes con el filtro seleccionado.
                  </td>
                </tr>
              ) : rows.map((s, i) => (
                <tr key={s.id} style={{
                  background: i % 2 === 0 ? "var(--surface)" : "transparent",
                  borderBottom: "1px solid var(--border)",
                }}>
                  <td style={{ ...td, fontWeight: 600, fontFamily: "monospace" }}>···{shortId(s.id)}</td>
                  <td style={td}>
                    <span className={riskClass(s.nivel_riesgo)} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 12 }}>
                      {s.nivel_riesgo}
                    </span>
                  </td>
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

      {/* ── Panel lateral ────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* KPIs */}
        <Panel title="Resumen">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "Total estudiantes", value: total.toLocaleString("es-PE"), color: "var(--accent)", icon: <Users size={14}/> },
              { label: "Riesgo ALTO",        value: high.toLocaleString("es-PE"),  color: "#dc2626",      icon: <AlertTriangle size={14}/> },
              { label: "Riesgo MEDIO",       value: medium.toLocaleString("es-PE"), color: "#d97706",      icon: <AlertTriangle size={14}/> },
              { label: "Riesgo BAJO",        value: low.toLocaleString("es-PE"),   color: "#16a34a",      icon: <Users size={14}/> },
            ].map(({ label, value, color, icon }) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 10px", borderRadius: 8, background: "var(--surface)",
                border: `1px solid var(--border)`, borderLeft: `4px solid ${color}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color, fontSize: 12, fontWeight: 600 }}>
                  {icon} {label}
                </div>
                <span style={{ fontWeight: 800, fontSize: 18, color }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Barra de proporción */}
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

        {/* Exportaciones */}
        <Panel title="Exportar listado">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={exportCsv} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-start", width: "100%", padding: "9px 12px" }}>
              <Download size={15} style={{ color: "#16a34a" }} />
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Exportar CSV</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Para Excel, Google Sheets</div>
              </div>
            </button>
            <button onClick={exportXlsx} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-start", width: "100%", padding: "9px 12px" }}>
              <Download size={15} style={{ color: "#0369a1" }} />
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Exportar Excel (.xlsx)</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Con hoja de resumen</div>
              </div>
            </button>
            <button onClick={exportPdf} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-start", width: "100%", padding: "9px 12px" }}>
              <FileText size={15} style={{ color: "#dc2626" }} />
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Reporte PDF ejecutivo</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Para presentar a directivos</div>
              </div>
            </button>
            <button
              onClick={() => {
                const subject = encodeURIComponent(`[SATRA] Alerta riesgo académico — ${new Date().toLocaleDateString("es-PE")}`);
                const body = encodeURIComponent(
                  `Se detectaron ${high} estudiantes en riesgo ALTO de un total de ${displayTotal}.\n\n` +
                  `ALTO: ${high} · MEDIO: ${medium} · BAJO: ${low}\n\n` +
                  `Periodo: EM 2022 · Sistema SATRA`
                );
                window.open(`mailto:?subject=${subject}&body=${body}`);
              }}
              style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-start", width: "100%", padding: "9px 12px" }}
            >
              <Mail size={15} style={{ color: "#7c3aed" }} />
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Enviar alerta por email</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Abre tu cliente de correo</div>
              </div>
            </button>
          </div>

          <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8, textAlign: "center" }}>
            Se exporta el listado con el filtro activo · {rows.length} registros
          </p>
        </Panel>

      </div>
    </section>
  );
}

// ── Estilos de tabla ──────────────────────────────────────────────────────────
const th: React.CSSProperties = {
  padding: "8px 10px", textAlign: "left", fontSize: 11,
  fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.03em",
};
const td: React.CSSProperties = {
  padding: "7px 10px", whiteSpace: "nowrap",
};
