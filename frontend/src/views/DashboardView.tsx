"use client";

import { AlertTriangle, Download, Filter, RefreshCcw } from "lucide-react";
import { Cell, PieChart, Pie, ResponsiveContainer, Tooltip } from "recharts";
import dynamic from "next/dynamic";
import type { Student, DatasetSummary, Metrics } from "@/types";
import type { DistrictRiskEntry } from "@/components/maps/LimaHeatmap";
import { Kpi, Panel, Bar, EmptyState } from "@/components/ui/Primitives";
import { StudentTable } from "@/components/tables/StudentTable";
import { shortId, pct, riskClass } from "@/lib/format";

const LimaHeatmap = dynamic(() => import("@/components/maps/LimaHeatmap"), { ssr: false });

interface DashboardViewProps {
  filtered: Student[];
  selected: Student | undefined;
  displayTotal: number;
  high: number;
  medium: number;
  low: number;
  avgIse: string;
  totalStudents: number;
  isLoadingMore: boolean;
  isLoadingModel: boolean;
  isSavingPredictions: boolean;
  predictionsSaved: boolean;
  students: Student[];
  metrics: Metrics;
  summary: DatasetSummary;
  districtRiskMap: Record<string, DistrictRiskEntry>;
  classifiedStudents: Student[];
  risk: string;
  setRisk: (v: string) => void;
  distrito: string;
  setDistrito: (v: string) => void;
  sexo: string;
  setSexo: (v: string) => void;
  segment: string;
  setSegment: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
  selectedId: string;
  setSelectedId: (v: string) => void;
  profileDistrito: string | null;
  setTab: (tab: import("@/types").Tab) => void;
  loadModelData: () => void;
  exportCsv: () => void;
  exportXlsx: () => void;
  savePredictionsToSupabase: (students: Student[], modelVersion: string) => void;
  loadMoreStudents: () => void;
}

export function DashboardView({
  filtered, selected, displayTotal, high, medium, low, avgIse,
  totalStudents, isLoadingMore, isLoadingModel,
  isSavingPredictions, predictionsSaved,
  students, metrics, summary, districtRiskMap, classifiedStudents,
  risk, setRisk, distrito, setDistrito, sexo, setSexo,
  segment, setSegment, search, setSearch,
  selectedId, setSelectedId, profileDistrito,
  setTab, loadModelData, exportCsv, exportXlsx,
  savePredictionsToSupabase, loadMoreStudents,
}: DashboardViewProps) {
  return (
    <>
      <section className="kpi-grid">
        <Kpi label="Estudiantes" value={displayTotal} detail={`${filtered.length.toLocaleString("es-PE")} filtrados`} />
        <Kpi label="Riesgo alto" value={high} detail={`${((high / Math.max(displayTotal, 1)) * 100).toFixed(1)}%`} tone="high" />
        <Kpi label="Riesgo medio" value={medium} detail={`${((medium / Math.max(displayTotal, 1)) * 100).toFixed(1)}%`} tone="medium" />
        <Kpi label="Riesgo bajo" value={low} detail={`${((low / Math.max(displayTotal, 1)) * 100).toFixed(1)}%`} tone="low" />
        <Kpi label="ISE promedio" value={avgIse} detail="muestra filtrada" />
      </section>

      <section className="filters">
        <Filter size={18} />
        <label className="filter-field">Nivel de riesgo
          <select value={risk} onChange={(e) => setRisk(e.target.value)}>
            <option>Todos</option><option>ALTO</option><option>MEDIO</option><option>BAJO</option>
          </select>
        </label>
        <label className="filter-field">Distrito
          {profileDistrito ? (
            <select value={profileDistrito} disabled className="filter-locked">
              <option>{profileDistrito}</option>
            </select>
          ) : (
            <select value={distrito} onChange={(e) => setDistrito(e.target.value)}>
              <option>Todos</option>
              {Object.keys(summary.facets.distrito ?? {}).sort().map((item) => <option key={item}>{item}</option>)}
            </select>
          )}
        </label>
        <label className="filter-field">Sexo
          <select value={sexo} onChange={(e) => setSexo(e.target.value)}>
            <option>Todos</option><option>Hombre</option><option>Mujer</option>
          </select>
        </label>
        <label className="filter-field">Tipo de riesgo
          <select value={segment} onChange={(e) => setSegment(e.target.value)}>
            <option>Todos</option>
            <option>Rendimiento multiple</option>
            <option>Bajo en Lectura</option>
            <option>Bajo en Ciencias</option>
            <option>Contexto socioecon.</option>
            <option>Sin alerta</option>
          </select>
        </label>
        <label className="filter-field">Buscar
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ID o distrito..."
            style={{ minWidth: "130px" }}
          />
        </label>
        <button onClick={() => void loadModelData()}><RefreshCcw size={17} /> Actualizar</button>
        <button onClick={exportCsv}><Download size={17} /> CSV</button>
        <button onClick={exportXlsx}><Download size={17} /> Excel</button>
      </section>

      <section className="two-col">
        <Panel title="Ranking por urgencia">
          {isLoadingModel ? (
            <EmptyState message="Cargando predicciones desde el modelo EM 2022..." />
          ) : (
            <StudentTable
              students={filtered}
              total={totalStudents}
              isLoadingMore={isLoadingMore}
              onLoadMore={() => void loadMoreStudents()}
              onSelect={setSelectedId}
              selectedId={selected?.id ?? ""}
            />
          )}
        </Panel>
        <Panel title="Resumen del estudiante">
          {selected ? (
            <div className="student-detail">
              <div>
                <h2>Estudiante {shortId(selected.id)}</h2>
                <span className={riskClass(selected.nivel_riesgo)}>{selected.nivel_riesgo}</span>
              </div>
              <div className="gauge">
                <strong>{pct(selected.probabilidad_riesgo)}</strong>
                <span>Probabilidad de riesgo</span>
              </div>
              <p>
                Riesgo {selected.nivel_riesgo.toLowerCase()} — {selected.tipo_riesgo.toLowerCase()}.
              </p>
              <div className="detail-grid">
                <span>Distrito</span><strong>{selected.distrito}</strong>
                <span>Sexo</span><strong>{selected.sexo}</strong>
                <span>ISE</span><strong>{selected.ise.toFixed(2)}</strong>
                <span>M500 Lectura</span><strong>{selected.M500_L.toFixed(0)}</strong>
                <span>M500 Ciencias</span><strong>{selected.M500_CN.toFixed(0)}</strong>
              </div>
              <button
                className="primary view-detail-cta"
                onClick={() => setTab("estudiante")}
                aria-label="Ver detalle completo del estudiante"
              >
                Ver detalle completo →
              </button>
              <p className="view-detail-hint">
                SHAP, anotaciones, plan de intervención y más.
              </p>
            </div>
          ) : (
            <EmptyState message="Selecciona un estudiante del ranking para ver su resumen." />
          )}
        </Panel>
      </section>

      <section className="full-col">
        <Panel title="Mapa de calor de riesgo por distrito — Lima Metropolitana">
          <div className="model-note" style={{ marginBottom: 10 }}>
            <strong>Visualización geoespacial</strong> — cada círculo representa un distrito.
            El tamaño es proporcional al número de estudiantes; el color indica la tasa de riesgo ALTO.
            Pasa el cursor sobre un distrito para ver el detalle.
          </div>
          {classifiedStudents.length > 0 ? (
            <LimaHeatmap districtRisk={districtRiskMap} />
          ) : (
            <EmptyState message="Carga los datos del modelo para visualizar el mapa de calor." />
          )}
          {classifiedStudents.length > 0 && (
            <div className="district-risk-table">
              <table>
                <colgroup>
                  <col style={{ width: "40%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "15%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="col-left">Distrito</th>
                    <th>Total</th>
                    <th>Alto</th>
                    <th>% Alto</th>
                    <th>Nivel</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(districtRiskMap)
                    .sort((a, b) => b[1].pct - a[1].pct)
                    .slice(0, 10)
                    .map(([d, v]) => {
                      const color = v.pct >= 0.65 ? "#ef4444" : v.pct >= 0.50 ? "#f97316" : v.pct >= 0.35 ? "#eab308" : v.pct >= 0.20 ? "#84cc16" : "#22c55e";
                      const label = v.pct >= 0.65 ? "Crítico" : v.pct >= 0.50 ? "Alto" : v.pct >= 0.35 ? "Medio" : v.pct >= 0.20 ? "Moderado" : "Bajo";
                      return (
                        <tr key={d}>
                          <td className="col-left"><strong>{d.charAt(0) + d.slice(1).toLowerCase()}</strong></td>
                          <td>{v.total}</td>
                          <td>{v.alto}</td>
                          <td><strong>{(v.pct * 100).toFixed(1)}%</strong></td>
                          <td>
                            <span className="drift-tag" style={{ background: color + "22", color, border: `1px solid ${color}66` }}>{label}</span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {Object.keys(districtRiskMap).length > 10 && (
                <div className="model-note" style={{ marginTop: 8, fontSize: 11, textAlign: "center" }}>
                  Mostrando top 10 distritos por tasa de riesgo · Total: {Object.keys(districtRiskMap).length}
                </div>
              )}
            </div>
          )}
        </Panel>
      </section>

      <section className="three-col">
        <Panel title="Distribucion de riesgo">
          <Bar label="Alto" value={high / Math.max(displayTotal, 1)} tone="high" />
          <Bar label="Medio" value={medium / Math.max(displayTotal, 1)} tone="medium" />
          <Bar label="Bajo" value={low / Math.max(displayTotal, 1)} tone="low" />
          {high + medium + low > 0 && (
            <ResponsiveContainer width="100%" height={170} style={{ marginTop: 12 }}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Alto", value: high },
                    { name: "Medio", value: medium },
                    { name: "Bajo", value: low },
                  ]}
                  cx="50%" cy="50%"
                  innerRadius={42} outerRadius={68}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => percent != null ? `${name} ${(percent * 100).toFixed(0)}%` : ""}
                  labelLine={false}
                >
                  <Cell fill="#ef4444" />
                  <Cell fill="#f59e0b" />
                  <Cell fill="#22c55e" />
                </Pie>
                <Tooltip formatter={(v) => Number(v).toLocaleString("es-PE")} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>
        <Panel title="Alertas activas">
          {filtered.filter((s) => s.nivel_riesgo === "ALTO").slice(0, 4).map((s) => (
            <div className="alert-card" key={s.id}>
              <div className="alert-card-icon"><AlertTriangle size={16} /></div>
              <div className="alert-card-body">
                <strong>Est. {shortId(s.id)}</strong>
                <span>{s.distrito} · ISE {s.ise.toFixed(2)}</span>
                <span className="alert-card-sub">{s.tipo_riesgo} — {pct(s.probabilidad_riesgo)} prob.</span>
              </div>
              <button className="alert-card-btn" onClick={() => { setSelectedId(s.id); setTab("intervenciones"); }}>
                Intervenir
              </button>
            </div>
          ))}
          {filtered.filter((s) => s.nivel_riesgo === "ALTO").length === 0 && <EmptyState message="No hay alertas activas." />}
        </Panel>
        <Panel title="Comparación con su colegio y distrito">
          {selected ? (() => {
            const peers = classifiedStudents.filter(s => s.distrito === selected.distrito);
            const distAvgL = peers.reduce((a, b) => a + b.M500_L, 0) / Math.max(peers.length, 1);
            const distAvgCN = peers.reduce((a, b) => a + b.M500_CN, 0) / Math.max(peers.length, 1);
            const distAvgIse = peers.reduce((a, b) => a + b.ise, 0) / Math.max(peers.length, 1);
            const ieAvgL = selected.M500_L_iemean ?? distAvgL;
            const ieAvgCN = selected.M500_CN_iemean ?? distAvgCN;
            const ieAvgIse = selected.ise_iemean ?? distAvgIse;

            return (
              <>
                <div className="model-note" style={{ marginBottom: 6, fontWeight: 600 }}>Lectura (M500_L)</div>
                <Bar label="Estudiante" value={selected.M500_L / 800}
                     tone={selected.M500_L < ieAvgL ? "high" : selected.M500_L > distAvgL ? "low" : "medium"} />
                <Bar label="Promedio de su IE" value={ieAvgL / 800} />
                <Bar label="Promedio del distrito" value={distAvgL / 800} />

                <div className="model-note" style={{ marginTop: 10, marginBottom: 6, fontWeight: 600 }}>Ciencias (M500_CN)</div>
                <Bar label="Estudiante" value={selected.M500_CN / 800}
                     tone={selected.M500_CN < ieAvgCN ? "high" : selected.M500_CN > distAvgCN ? "low" : "medium"} />
                <Bar label="Promedio de su IE" value={ieAvgCN / 800} />
                <Bar label="Promedio del distrito" value={distAvgCN / 800} />

                <div className="model-note" style={{ marginTop: 10 }}>
                  ISE estudiante: <strong>{selected.ise.toFixed(2)}</strong> · IE: <strong>{ieAvgIse.toFixed(2)}</strong> · Distrito: <strong>{distAvgIse.toFixed(2)}</strong>
                </div>
                <div className="model-note" style={{ marginTop: 8, fontSize: 11 }}>
                  Comparación real basada en {peers.length.toLocaleString("es-PE")} estudiantes cargados del mismo distrito.
                </div>
              </>
            );
          })() : <EmptyState message="Seleccione un estudiante." />}
        </Panel>
      </section>
    </>
  );
}
