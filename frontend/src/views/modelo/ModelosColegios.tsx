"use client";

import { useState } from "react";
import { Panel, Kpi, EmptyState } from "@/components/ui/Primitives";
import { pct } from "@/lib/format";
import { formatearFechaModelo } from "@/lib/colegio";
import { formatearMejora, mejoraSobreBase } from "@/lib/metricasBase";
import type { ColegioModelSummary } from "@/hooks/useColegioModels";
import { DetalleColegio } from "@/views/modelo/DetalleColegio";

interface ModelosColegiosProps {
  models: ColegioModelSummary[];
  isLoading: boolean;
  /** Colegios con modelo cuyo resumen no se pudo leer. */
  failed: number;
  /** No se pudo ni listar los colegios. */
  loadError: boolean;
  onReload: () => void;
}

// AUC CV: el indicador válido (validación cruzada). Umbrales solo para colorear.
function aucTone(v: number | null): { bg: string; fg: string } {
  if (v == null) return { bg: "var(--surface)", fg: "var(--text-muted)" };
  if (v >= 0.85) return { bg: "#dcfce7", fg: "#166534" };
  if (v >= 0.7)  return { bg: "#fef3c7", fg: "#92400e" };
  return { bg: "#fee2e2", fg: "#991b1b" };
}

const TIPO_RESULTADO: Record<string, string> = {
  pronostico:   "Pronóstico",
  cierre_anual: "Cierre anual",
  descriptivo:  "Descriptivo",
};

/**
 * Supervisión del superadmin: una fila por colegio con modelo propio entrenado
 * (nº de alumnos, reparto por nivel de riesgo, AUC por validación cruzada y las
 * métricas de entrenamiento). Es lo único que muestra la pestaña mientras el
 * modelo nacional EM2022 esté apagado (EM2022_HABILITADO); con él encendido se
 * incrusta arriba de los paneles del modelo nacional.
 */
export function ModelosColegios({ models, isLoading, failed, loadError, onReload }: ModelosColegiosProps) {
  const ppm = (v: number | null) => (v != null ? pct(v) : "—");

  // Colegio del que se muestran los gráficos; si el elegido ya no está en la lista, el primero.
  const [elegido, setElegido] = useState<string | null>(null);
  const actual = models.find((m) => m.codigo_ie === elegido) ?? models[0];

  const totalAlumnos = models.reduce((s, m) => s + m.n_alumnos, 0);
  const totalRiesgo  = models.reduce((s, m) => s + m.n_riesgo, 0);
  const conAuc       = models.filter((m) => m.auc_cv != null);
  const aucProm      = conAuc.length ? conAuc.reduce((s, m) => s + (m.auc_cv as number), 0) / conAuc.length : null;

  return (
    <>
      {models.length > 0 && (
        <section className="full-col">
          <div className="metric-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
            <Kpi label="Colegios con modelo" value={models.length} detail="modelo propio entrenado" />
            <Kpi label="Alumnos modelados" value={totalAlumnos} detail="suma de todos los colegios" />
            <Kpi
              label="En riesgo (alto + medio)"
              value={totalAlumnos ? `${((100 * totalRiesgo) / totalAlumnos).toFixed(1)}%` : "—"}
              detail={`${totalRiesgo.toLocaleString("es-PE")} de ${totalAlumnos.toLocaleString("es-PE")} alumnos`}
              tone={totalAlumnos && totalRiesgo / totalAlumnos > 0.4 ? "high" : "medium"}
            />
            <Kpi
              label="AUC CV promedio"
              value={ppm(aucProm)}
              detail="validación cruzada, entre colegios"
              tone="low"
            />
          </div>
        </section>
      )}

      <section className="full-col">
        <Panel title="Modelos de colegio — supervisión">
          <div className="model-note" style={{ marginBottom: 10 }}>
            Cada colegio tiene su propio modelo (conjunto híbrido regresión logística + bosque aleatorio, calibrado).
            El indicador válido es el <strong>AUC CV</strong> (validación cruzada); las columnas marcadas con{" "}
            <strong>*</strong> son de entrenamiento y sirven solo de referencia.
          </div>

          {isLoading && (
            <div className="empty-state" role="status" aria-live="polite">Cargando los modelos de los colegios…</div>
          )}

          {!isLoading && loadError && (
            <div className="empty-state" role="alert">
              No se pudo obtener la lista de colegios del servidor.{" "}
              <button onClick={onReload} style={botonReintentar}>Reintentar</button>
            </div>
          )}

          {!isLoading && !loadError && models.length === 0 && (
            <EmptyState message="Todavía no hay colegios con modelo propio entrenado. Se crean al subir los Excel de notas desde la pestaña Datos." />
          )}

          {!isLoading && failed > 0 && (
            <div
              role="alert"
              style={{
                margin: "0 0 10px", padding: "8px 12px", borderRadius: 8, fontSize: 12,
                background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e",
              }}
            >
              {failed === 1 ? "No se pudo leer 1 colegio" : `No se pudieron leer ${failed} colegios`} (la lista de abajo está
              incompleta).{" "}
              <button onClick={onReload} style={botonReintentar}>Reintentar</button>
            </div>
          )}

          {!isLoading && models.length > 0 && (
            <>
              <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "var(--navy)", color: "#fff" }}>
                      <th style={th}>Colegio</th>
                      <th style={{ ...th, textAlign: "right" }}>Alumnos</th>
                      <th style={{ ...th, minWidth: 190 }}>Reparto por nivel de riesgo</th>
                      <th style={{ ...th, textAlign: "right" }}>En riesgo</th>
                      <th style={{ ...th, textAlign: "right" }}>AUC CV</th>
                      <th style={{ ...th, textAlign: "right" }}>F1 CV</th>
                      <th
                        style={{ ...th, textAlign: "right" }}
                        title="Puntos de F1 CV que el modelo añade sobre decir que todos los alumnos están en riesgo"
                      >
                        Mejora
                      </th>
                      <th style={{ ...th, textAlign: "right" }}>F1*</th>
                      <th style={{ ...th, textAlign: "right" }}>Precisión*</th>
                      <th style={{ ...th, textAlign: "right" }}>Recall*</th>
                      <th style={{ ...th, textAlign: "right" }}>Accuracy*</th>
                      <th style={th}>Resultado</th>
                      <th style={th}>Entrenado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((c, i) => {
                      const tone = aucTone(c.auc_cv);
                      const total = Math.max(c.n_alto + c.n_medio + c.n_bajo, 1);
                      // Tasa REAL de riesgo (no la de alto + medio): el F1 depende de ella, así que se compara contra lo que
                      // saldría sin modelo para poder mirar colegios con distinta proporción de alumnos en riesgo.
                      const base = mejoraSobreBase(c.f1_cv, c.uso_real?.tasa_base);
                      return (
                        <tr
                          key={c.codigo_ie}
                          style={{
                            background: i % 2 === 0 ? "var(--surface)" : "transparent",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          <td style={td}>
                            <strong>{c.nombre_colegio}</strong>
                            <div style={{ color: "var(--text-muted)", fontSize: 11 }}>IE {c.codigo_ie}</div>
                          </td>
                          <td style={{ ...td, textAlign: "right" }}>{c.n_alumnos.toLocaleString("es-PE")}</td>
                          <td style={td}>
                            <div
                              role="img"
                              aria-label={`Alto ${c.n_alto}, medio ${c.n_medio}, bajo ${c.n_bajo}`}
                              style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "var(--border)" }}
                            >
                              <span style={{ width: `${(100 * c.n_alto) / total}%`, background: "#dc2626" }} />
                              <span style={{ width: `${(100 * c.n_medio) / total}%`, background: "#d97706" }} />
                              <span style={{ width: `${(100 * c.n_bajo) / total}%`, background: "#16a34a" }} />
                            </div>
                            <div style={{ marginTop: 3, color: "var(--text-muted)", fontSize: 11 }}>
                              <span style={{ color: "#dc2626" }}>{c.n_alto} alto</span> ·{" "}
                              <span style={{ color: "#b45309" }}>{c.n_medio} medio</span> ·{" "}
                              <span style={{ color: "#15803d" }}>{c.n_bajo} bajo</span>
                            </div>
                          </td>
                          <td style={{ ...td, textAlign: "right" }}>
                            <strong>{c.pct_riesgo}%</strong>
                            <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{c.n_riesgo} alumnos</div>
                          </td>
                          <td style={{ ...td, textAlign: "right" }}>
                            <span
                              style={{
                                display: "inline-block", padding: "2px 8px", borderRadius: 999,
                                fontWeight: 700, background: tone.bg, color: tone.fg,
                              }}
                              title={c.n_splits_cv ? `Validación cruzada de ${c.n_splits_cv} particiones` : undefined}
                            >
                              {ppm(c.auc_cv)}
                            </span>
                          </td>
                          <td style={{ ...td, textAlign: "right" }}>
                            <strong>{ppm(c.f1_cv)}</strong>
                            {base && (
                              <div style={{ color: "var(--text-muted)", fontSize: 11 }}>sin modelo {pct(base.base)}</div>
                            )}
                          </td>
                          <td style={{ ...td, textAlign: "right" }}>
                            {base ? (
                              <span
                                style={{
                                  display: "inline-block", padding: "2px 8px", borderRadius: 999, fontWeight: 700,
                                  background: base.mejora > 0 ? "#dcfce7" : "#fee2e2",
                                  color: base.mejora > 0 ? "#166534" : "#991b1b",
                                }}
                              >
                                {formatearMejora(base.mejora)}
                              </span>
                            ) : "—"}
                          </td>
                          <td style={{ ...td, textAlign: "right" }}>{ppm(c.f1_train)}</td>
                          <td style={{ ...td, textAlign: "right" }}>{ppm(c.precision_train)}</td>
                          <td style={{ ...td, textAlign: "right" }}>{ppm(c.recall_train)}</td>
                          <td style={{ ...td, textAlign: "right" }}>{ppm(c.accuracy_train)}</td>
                          <td style={td}>{c.tipo_resultado ? (TIPO_RESULTADO[c.tipo_resultado] ?? c.tipo_resultado) : "—"}</td>
                          <td style={td}>{formatearFechaModelo(c.trained_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="model-note" style={{ marginTop: 8, fontSize: 11 }}>
                <strong>*</strong> métricas de entrenamiento (en muestra, optimistas). El <strong>AUC CV</strong> es el indicador válido:
                verde desde 85 %, ámbar desde 70 %. El F1 depende de cuántos alumnos están en riesgo, así que no se compara
                directo entre colegios: <strong>Mejora</strong> son los puntos de <strong>F1 CV</strong> que el modelo añade sobre
                decir que todos los alumnos están en riesgo (el «sin modelo» bajo el F1 CV), calculado con la proporción real de
                riesgo de cada colegio (solo en cierre de año).
              </div>
            </>
          )}
        </Panel>
      </section>

      {!isLoading && actual && (
        <section className="full-col" aria-label="Detalle por colegio">
          <Panel title="Detalle por colegio">
            <div role="group" aria-label="Elegir colegio" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {models.map((m) => {
                const activo = m.codigo_ie === actual.codigo_ie;
                return (
                  <button
                    key={m.codigo_ie}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => setElegido(m.codigo_ie)}
                    style={{
                      padding: "7px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                      border: `1px solid ${activo ? "var(--navy)" : "var(--border)"}`,
                      background: activo ? "var(--navy)" : "var(--surface)",
                      color: activo ? "#fff" : "var(--navy)",
                      transition: "background 160ms ease, color 160ms ease, border-color 160ms ease",
                    }}
                  >
                    {m.nombre_colegio} <span style={{ opacity: 0.7, fontWeight: 500 }}>· IE {m.codigo_ie}</span>
                  </button>
                );
              })}
            </div>
            <div className="model-note">
              {actual.nombre_colegio} · {actual.modo_prediccion !== "—" ? `${actual.modo_prediccion} · ` : ""}
              entrenado: {formatearFechaModelo(actual.trained_at)}
            </div>
            <DetalleColegio c={actual} />
          </Panel>
        </section>
      )}
    </>
  );
}

const th: React.CSSProperties = {
  padding: "9px 10px", textAlign: "left", fontSize: 11,
  fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.03em",
};
const td: React.CSSProperties = {
  padding: "9px 10px", whiteSpace: "nowrap", verticalAlign: "top",
};
const botonReintentar: React.CSSProperties = {
  marginLeft: 8, padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--navy)", cursor: "pointer",
};
