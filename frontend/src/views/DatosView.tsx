"use client";

import { RefObject } from "react";
import { Upload, CheckCircle2, AlertTriangle, School, Loader, Info, Cpu, ShieldAlert, Download } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Panel, Kpi, EmptyState } from "@/components/ui/Primitives";
import { ConfusionMatrix } from "@/components/charts/ConfusionMatrix";
import { RocMiniChart } from "@/components/charts/RocMiniChart";
import type { Metrics, Evaluation } from "@/types";
import { EM2022_HABILITADO } from "@/lib/constants";

interface CsvValidation {
  total_filas: number;
  filas_validas: number;
  errores: { fila: number; campo: string; error: string }[];
  columnas_faltantes: string[];
}

interface ColegioUploadResult {
  n_alumnos: number;
  n_riesgo: number;
  pct_riesgo: number;
  nombre_colegio: string;
  salones: string[];
  advertencias: string[];
}

interface DatosViewProps {
  // CSV EM 2022
  fileInputRef: RefObject<HTMLInputElement>;
  uploadResult: string;
  setUploadResult: (v: string) => void;
  csvValidation: CsvValidation | null;
  isValidating: boolean;
  scheduleFreq: string;
  setScheduleFreq: (v: string) => void;
  nextUpdate: string | null;
  scheduleMsg: string;
  onValidateCsv: (file: File) => void;
  onSaveSchedule: () => void;
  // Excel del colegio
  colegioFileRef: RefObject<HTMLInputElement>;
  colegioUploadIe: string;
  setColegioUploadIe: (v: string) => void;
  colegioUploadStatus: "idle" | "uploading" | "success" | "error";
  colegioUploadMsg: string;
  colegioUploadResult: ColegioUploadResult | null;
  onUploadColegioExcels: (files: FileList, ie: string) => void;
  role: string;
  profileCodigoIe: string | null;
  setTab: (tab: import("@/types").Tab) => void;
  // Métricas del modelo nacional EM2022 (para admin de colegios sin modelo CUBICOL propio)
  em2022Metrics?: Metrics;
  em2022Evaluation?: Evaluation;
  colegioModelStats: {
    nombre_colegio: string; n_alumnos: number; n_riesgo: number;
    pct_riesgo: number; auc_cv: number | null; auc_train: number | null;
    f1_train: number | null; precision_train: number | null;
    recall_train: number | null; accuracy_train: number | null;
    n_splits_cv: number | null;
    confusion_matrix: number[][] | null;
    roc_fpr: number[] | null;
    roc_tpr: number[] | null;
    modo_prediccion: string; salones: string[]; trained_at: string | null;
    por_nivel: Record<string, number>;
    advertencias_carga: string[];
    importancia_variables: { variable: string; importancia: number }[] | null;
  } | null;
  // HU024/HU025/HU026: histórico de reentrenamientos del colegio actual.
  modelosVersiones: {
    id: string; version: string; created_at: string;
    n_alumnos: number | null; n_alto: number | null; n_medio: number | null; n_bajo: number | null;
    accuracy: number | null; auc_roc: number | null;
  }[];
  // HU039: respaldo y restauración del modelo.
  colegioRespaldo: { disponible: boolean; fecha: string | null } | null;
  restaurandoModelo: boolean;
  onRestaurarModelo: (ie: string) => void;
}

export function DatosView({
  fileInputRef, uploadResult, setUploadResult,
  csvValidation, isValidating,
  scheduleFreq, setScheduleFreq,
  nextUpdate, scheduleMsg,
  onValidateCsv, onSaveSchedule,
  colegioFileRef,
  colegioUploadIe, setColegioUploadIe,
  colegioUploadStatus, colegioUploadMsg, colegioUploadResult,
  onUploadColegioExcels,
  role, profileCodigoIe, setTab,
  em2022Metrics,
  em2022Evaluation,
  colegioModelStats,
  modelosVersiones,
  colegioRespaldo, restaurandoModelo, onRestaurarModelo,
}: DatosViewProps) {

  // El superadmin escribe la IE a mano (puede cargar cualquier colegio);
  // admin/director/coordinador quedan fijos a la IE de su propio perfil.
  const isSuperadmin = role === "superadmin";
  const ieEfectiva = isSuperadmin ? colegioUploadIe : (profileCodigoIe ?? "");

  const statusIcon = {
    idle:      <School size={18} style={{ color: "var(--accent)" }} />,
    uploading: <Loader size={18} style={{ color: "#d97706", animation: "spin 1s linear infinite" }} />,
    success:   <CheckCircle2 size={18} style={{ color: "#16a34a" }} />,
    error:     <AlertTriangle size={18} style={{ color: "#dc2626" }} />,
  }[colegioUploadStatus];

  const isColegioRole = role === "admin" || role === "director" || role === "coordinador";
  const noModelYet    = isColegioRole && !colegioModelStats;
  const noIeAssigned  = isColegioRole && !profileCodigoIe;
  const isEM2022      = colegioModelStats?.modo_prediccion === "Modelo Nacional EM2022";
  const puedeSubirExcel = isSuperadmin || (isColegioRole && !!profileCodigoIe);

  return (
    <section className="full-col">

      {/* ── Estado: cuenta admin sin IE asignada ──────────────────────────── */}
      {noIeAssigned && (
        <Panel title="Sin colegio asignado">
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 14, padding: "24px 16px", textAlign: "center",
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              background: "#fef2f2", border: "2px solid #fca5a5",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <ShieldAlert size={24} style={{ color: "#dc2626" }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
                Tu cuenta no tiene un colegio asignado
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, maxWidth: 420 }}>
                Para gestionar los datos de un colegio necesitas que el Super Admin te asigne
                un código IE. Comunícate con el administrador del sistema.
              </p>
            </div>
          </div>
        </Panel>
      )}

      {/* ── Estado: admin con IE pero sin datos en ningún modelo ────────── */}
      {noModelYet && profileCodigoIe && (
        <Panel title={`Colegio IE ${profileCodigoIe} — Sin datos`}>
          <div style={{ display: "flex", alignItems: "center", gap: 12,
            padding: "16px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10 }}>
            <Info size={18} style={{ color: "#d97706", flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 3 }}>
                No hay datos disponibles para esta IE
              </p>
              <p style={{ fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
                {EM2022_HABILITADO
                  ? <>El colegio IE <strong>{profileCodigoIe}</strong> no está en el dataset EM2022 ni tiene un modelo CUBICOL propio. Contacta al Super Admin.</>
                  : <>El colegio IE <strong>{profileCodigoIe}</strong> todavía no tiene un modelo propio entrenado. Sube el Excel de notas y conducta abajo, o contacta al Super Admin.</>}
              </p>
            </div>
          </div>
        </Panel>
      )}

      {/* ── Panel 0: Estadísticas del colegio en el modelo ──────────────── */}
      {colegioModelStats && (
        <Panel title={`Datos del colegio — ${colegioModelStats.nombre_colegio}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* KPIs del colegio: alumnos + riesgo + distribución */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              <Kpi label="Alumnos en el modelo" value={colegioModelStats.n_alumnos} detail={isEM2022 ? "Dataset EM2022" : "Modelo propio"} />
              <Kpi label="En riesgo"    value={colegioModelStats.n_riesgo}  detail={`${colegioModelStats.pct_riesgo}% del total`} tone={colegioModelStats.n_riesgo > 0 ? "high" : undefined} />
              {!isEM2022
                ? <Kpi label="AUC CV" value={colegioModelStats.auc_cv != null ? `${(colegioModelStats.auc_cv * 100).toFixed(1)}%` : "—"} detail="5-fold estratificado" tone={colegioModelStats.auc_cv != null && colegioModelStats.auc_cv >= 0.80 ? "low" : "medium"} />
                : <Kpi label="AUC-ROC" value={em2022Metrics?.auc_roc != null ? `${((em2022Metrics.auc_roc) * 100).toFixed(1)}%` : "—"} detail="Modelo nacional" tone="low" />
              }
            </div>

            {/* Barra de distribución */}
            {Object.keys(colegioModelStats.por_nivel).length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Distribución de riesgo</p>
                <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 1 }}>
                  {[["ALTO","#dc2626"],["MEDIO","#d97706"],["BAJO","#16a34a"]].map(([nivel, color]) =>
                    (colegioModelStats.por_nivel[nivel] ?? 0) > 0 ? (
                      <div key={nivel} style={{ flex: colegioModelStats.por_nivel[nivel], background: color }}
                        title={`${nivel}: ${colegioModelStats.por_nivel[nivel]}`} />
                    ) : null
                  )}
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 5, fontSize: 11 }}>
                  {[["ALTO","#dc2626"],["MEDIO","#d97706"],["BAJO","#16a34a"]].map(([nivel, color]) => (
                    <span key={nivel} style={{ color }}>
                      {nivel}: <strong>{colegioModelStats.por_nivel[nivel] ?? 0}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Métricas completas del modelo PROPIO del colegio (híbrido LR+RF calibrado) ── */}
            {!isEM2022 && (colegioModelStats.auc_cv != null || colegioModelStats.f1_train != null) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--navy)", borderRadius: 10 }}>
                  <Cpu size={14} style={{ color: "#93c5fd" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                    Modelo híbrido del colegio (Reg. Logística + Random Forest, calibrado) — métricas
                  </span>
                </div>
                {(() => {
                  const pp = (v: number | null) => v != null ? `${(v * 100).toFixed(1)}%` : "—";
                  const cs = colegioModelStats;
                  return (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                        <Kpi label="AUC CV" value={pp(cs.auc_cv)} detail={`${cs.n_splits_cv ?? 5}-fold · indicador válido`} tone="low" />
                        <Kpi label="F1 (train)" value={pp(cs.f1_train)} detail="referencia" />
                        <Kpi label="Precisión (train)" value={pp(cs.precision_train)} detail="referencia" />
                        <Kpi label="Recall (train)" value={pp(cs.recall_train)} detail="referencia" />
                        <Kpi label="Accuracy (train)" value={pp(cs.accuracy_train)} detail="referencia" />
                        <Kpi label="AUC (train)" value={pp(cs.auc_train)} detail="referencia (optimista)" />
                      </div>
                      <p style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                        El <strong>AUC CV</strong> (validación cruzada por folds) es la métrica válida; las marcadas
                        <em> (train)</em> se calculan sobre los mismos datos de entrenamiento y son solo de referencia
                        (tienden a ser optimistas). Modo: <strong>{cs.modo_prediccion}</strong>.
                      </p>
                      {(cs.confusion_matrix || cs.roc_fpr) && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <p style={{ fontSize: 10.5, fontWeight: 700, color: "var(--navy)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Matriz de confusión</p>
                            <ConfusionMatrix matrix={cs.confusion_matrix ?? undefined} />
                          </div>
                          <div>
                            <p style={{ fontSize: 10.5, fontWeight: 700, color: "var(--navy)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Curva ROC</p>
                            <RocMiniChart fpr={cs.roc_fpr ?? undefined} tpr={cs.roc_tpr ?? undefined} auc={cs.auc_train ?? undefined} />
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* ── Métricas del modelo EM2022 (para colegios sin modelo CUBICOL) ── */}
            {isEM2022 && em2022Metrics && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 12px",
                  background: "var(--navy)", borderRadius: 10,
                }}>
                  <Cpu size={14} style={{ color: "#93c5fd" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                    Modelo Nacional EM2022 — Operación del modelo
                  </span>
                  {em2022Metrics.trained_at && (
                    <span style={{ fontSize: 10, color: "#93c5fd", marginLeft: "auto" }}>
                      {new Date(em2022Metrics.trained_at).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  )}
                </div>

                {/* Métricas principales: 4 KPIs */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                  <Kpi label="Accuracy"
                    value={em2022Metrics.accuracy != null ? `${(em2022Metrics.accuracy * 100).toFixed(1)}%` : "—"}
                    detail="Test (umbral fijo)" />
                  <Kpi label="Recall"
                    value={em2022Metrics.recall != null ? `${(em2022Metrics.recall * 100).toFixed(1)}%` : "—"}
                    detail="Crítico" tone="high" />
                  <Kpi label="F1"
                    value={em2022Metrics.f1_score != null ? `${(em2022Metrics.f1_score * 100).toFixed(1)}%` : "—"}
                    detail={em2022Metrics.f1_ci_95 ? `IC95% [${(em2022Metrics.f1_ci_95[0]*100).toFixed(1)}%–${(em2022Metrics.f1_ci_95[1]*100).toFixed(1)}%]` : ""} />
                  <Kpi label="AUC-ROC"
                    value={em2022Metrics.auc_roc != null ? `${(em2022Metrics.auc_roc * 100).toFixed(1)}%` : "—"}
                    detail={em2022Metrics.auc_ci_95 ? `IC95% [${(em2022Metrics.auc_ci_95[0]*100).toFixed(1)}%–${(em2022Metrics.auc_ci_95[1]*100).toFixed(1)}%]` : ""}
                    tone="low" />
                </div>

                {/* PR-AUC + Brier */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <Kpi label="PR-AUC"
                    value={em2022Metrics.pr_auc != null ? `${(em2022Metrics.pr_auc * 100).toFixed(1)}%` : "—"}
                    detail={em2022Metrics.pr_baseline != null ? `Baseline ${(em2022Metrics.pr_baseline * 100).toFixed(1)}%` : ""}
                    tone="low" />
                  <Kpi label="Brier"
                    value={em2022Metrics.brier_score != null ? em2022Metrics.brier_score.toFixed(3) : "—"}
                    detail={em2022Metrics.brier_ci_95 ? `IC95% [${em2022Metrics.brier_ci_95[0].toFixed(3)}–${em2022Metrics.brier_ci_95[1].toFixed(3)}]` : ""}
                    tone="medium" />
                </div>

                {/* Matriz de confusión + Curva ROC (test set, conjunto held-out) */}
                {(em2022Evaluation?.confusion_matrix || em2022Evaluation?.roc_fpr) && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <p style={{ fontSize: 10.5, fontWeight: 700, color: "var(--navy)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Matriz de confusión</p>
                      <ConfusionMatrix matrix={em2022Evaluation?.confusion_matrix} />
                    </div>
                    <div>
                      <p style={{ fontSize: 10.5, fontWeight: 700, color: "var(--navy)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Curva ROC</p>
                      <RocMiniChart fpr={em2022Evaluation?.roc_fpr} tpr={em2022Evaluation?.roc_tpr} auc={em2022Metrics.auc_roc} />
                    </div>
                  </div>
                )}

                {/* Info modelo */}
                {(em2022Metrics.train_rows || em2022Metrics.test_rows || em2022Metrics.scope) && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6,
                    padding: "7px 10px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}>
                    {em2022Metrics.modelo_ganador && (
                      <span>Modelo: <strong style={{ color: "var(--navy)" }}>{em2022Metrics.modelo_ganador}</strong></span>
                    )}
                    {em2022Metrics.train_rows && <span style={{ marginLeft: 12 }}>Train: <strong>{em2022Metrics.train_rows.toLocaleString()}</strong> alumnos</span>}
                    {em2022Metrics.test_rows  && <span style={{ marginLeft: 12 }}>Test: <strong>{em2022Metrics.test_rows.toLocaleString()}</strong> alumnos</span>}
                    {em2022Metrics.scope && <div style={{ marginTop: 2 }}>{em2022Metrics.scope}</div>}
                  </div>
                )}

              </div>
            )}

            {/* Modo y salones (solo modelo CUBICOL) */}
            {!isEM2022 && (
              <>
                <div style={{ padding: "8px 10px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, fontSize: 12 }}>
                  <strong style={{ color: "#0369a1" }}>Modo:</strong>{" "}
                  <span style={{ color: "#0369a1" }}>{colegioModelStats.modo_prediccion}</span>
                </div>
                {(colegioModelStats.salones.length > 0 || colegioModelStats.trained_at) && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
                    {colegioModelStats.salones.length > 0 && <span>Salones: {colegioModelStats.salones.join(" · ")}</span>}
                    {colegioModelStats.trained_at && (
                      <span>Entrenado: {new Date(colegioModelStats.trained_at).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" })}</span>
                    )}
                  </div>
                )}
                {colegioModelStats.advertencias_carga.length > 0 && (
                  <div style={{ padding: "8px 10px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>
                      ⚠️ {colegioModelStats.advertencias_carga.length} hoja(s)/archivo(s) omitidos en la última carga:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: "#92400e", lineHeight: 1.6 }}>
                      {colegioModelStats.advertencias_carga.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}

                {/* HU034: importancia global de variables del modelo propio del
                    colegio (Random Forest — no SHAP: la muestra por colegio es
                    muy chica para explicaciones por instancia confiables). */}
                {colegioModelStats.importancia_variables && colegioModelStats.importancia_variables.length > 0 && (
                  <div style={{ padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Importancia de variables — modelo propio de este colegio
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {colegioModelStats.importancia_variables.slice(0, 8).map((d) => {
                        const maxImp = colegioModelStats.importancia_variables![0].importancia || 1;
                        const width = Math.max((d.importancia / maxImp) * 100, 3);
                        return (
                          <div key={d.variable} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 44px", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, color: "var(--text)" }}>{d.variable}</span>
                            <div style={{ height: 8, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${width}%`, background: "var(--accent)", borderRadius: 4 }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textAlign: "right" }}>
                              {(d.importancia * 100).toFixed(1)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
                      Ranking global (Random Forest) de qué tanto pesa cada variable en las predicciones de este colegio —
                      no es SHAP por alumno (como en EM2022): con la cantidad de alumnos de un solo colegio, una
                      explicación por instancia no sería confiable.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </Panel>
      )}

      {/* ── Panel: Histórico de reentrenamientos (HU024/HU025/HU026/HU034) ── */}
      {colegioModelStats && !isEM2022 && (
        <Panel title="Histórico de reentrenamientos">
          {/* HU039: si el último reentrenamiento quedó peor que el anterior,
              puedeSubirExcel restaura ese respaldo sin necesitar el servidor. */}
          {puedeSubirExcel && colegioRespaldo?.disponible && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              padding: "10px 14px", marginBottom: 12,
              background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <ShieldAlert size={16} style={{ color: "#92400e", flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12.5, color: "#92400e", lineHeight: 1.5 }}>
                  Hay un respaldo del modelo anterior a la última carga
                  {colegioRespaldo.fecha && ` (${new Date(colegioRespaldo.fecha).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" })})`}.
                  Si el último Excel dejó el modelo peor, puedes revertirlo.
                </span>
              </div>
              <button
                type="button"
                disabled={restaurandoModelo}
                onClick={() => onRestaurarModelo(ieEfectiva)}
                style={{
                  flexShrink: 0, fontSize: 12, fontWeight: 600, padding: "6px 12px",
                  color: "#92400e", background: "#fff", border: "1px solid #fde68a", borderRadius: 8,
                  cursor: restaurandoModelo ? "default" : "pointer",
                }}
              >
                {restaurandoModelo ? "Restaurando..." : "Restaurar modelo anterior"}
              </button>
            </div>
          )}
          {modelosVersiones.length === 0 ? (
            <EmptyState message="Aún no hay versiones registradas. Cada vez que se cargue un Excel nuevo, quedará un registro aquí." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <LineChart
                    data={[...modelosVersiones]
                      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                      .map((v) => ({
                        fecha: new Date(v.created_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short" }),
                        ALTO: v.n_alto,
                        MEDIO: v.n_medio,
                        BAJO: v.n_bajo,
                      }))}
                    margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 10.5 }} />
                    <YAxis tick={{ fontSize: 10.5 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="ALTO" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="MEDIO" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="BAJO" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                      <th style={{ padding: "6px 8px", fontWeight: 700 }}>Fecha</th>
                      <th style={{ padding: "6px 8px", fontWeight: 700 }}>Versión</th>
                      <th style={{ padding: "6px 8px", fontWeight: 700 }}>Alumnos</th>
                      <th style={{ padding: "6px 8px", fontWeight: 700, color: "#dc2626" }}>Alto</th>
                      <th style={{ padding: "6px 8px", fontWeight: 700, color: "#d97706" }}>Medio</th>
                      <th style={{ padding: "6px 8px", fontWeight: 700, color: "#16a34a" }}>Bajo</th>
                      <th style={{ padding: "6px 8px", fontWeight: 700 }}>AUC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelosVersiones.map((v) => (
                      <tr key={v.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "6px 8px" }}>{new Date(v.created_at).toLocaleDateString("es-PE", { dateStyle: "medium" })}</td>
                        <td style={{ padding: "6px 8px" }}>{v.version || "—"}</td>
                        <td style={{ padding: "6px 8px" }}>{v.n_alumnos ?? "—"}</td>
                        <td style={{ padding: "6px 8px", color: "#dc2626", fontWeight: 600 }}>{v.n_alto ?? "—"}</td>
                        <td style={{ padding: "6px 8px", color: "#d97706", fontWeight: 600 }}>{v.n_medio ?? "—"}</td>
                        <td style={{ padding: "6px 8px", color: "#16a34a", fontWeight: 600 }}>{v.n_bajo ?? "—"}</td>
                        <td style={{ padding: "6px 8px" }}>{v.auc_roc != null ? v.auc_roc.toFixed(3) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={() => {
                  const header = "fecha,version,n_alumnos,n_alto,n_medio,n_bajo,accuracy,auc_roc";
                  const rows = modelosVersiones.map((v) =>
                    [v.created_at, v.version, v.n_alumnos, v.n_alto, v.n_medio, v.n_bajo, v.accuracy, v.auc_roc].join(",")
                  );
                  const csv = [header, ...rows].join("\n");
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `historico_modelo_${colegioModelStats?.nombre_colegio || "colegio"}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 6, alignSelf: "flex-start",
                  padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "var(--navy)",
                  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                <Download size={14} /> Exportar CSV
              </button>
            </div>
          )}
        </Panel>
      )}

      {/* ── Panel 1: Carga Excel del colegio ────────────────────────────────
          El superadmin puede cargar para cualquier IE (la escribe a mano);
          admin/director/coordinador solo pueden cargar para su propio
          colegio (la IE queda fija, tomada de su perfil) — el backend
          (require_admin_de_colegio en colegio_propio.py) valida lo mismo
          del lado del servidor, así que esto es solo UX, no la única barrera. */}
      {puedeSubirExcel && (
      <Panel title="Datos del colegio — Excel interno">
        <p className="model-note" style={{ marginBottom: 12 }}>
          Sube los archivos Excel de notas y conducta del colegio (formato CUBICOL Académico
          o Reporte consolidado, según el que use tu colegio). El sistema entrenará
          automáticamente el modelo de riesgo con las notas internas.
        </p>

        {/* Input oculto para múltiples Excel */}
        <input
          ref={colegioFileRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
              onUploadColegioExcels(files, ieEfectiva);
            }
            e.target.value = "";
          }}
        />

        {/* IE selector — el superadmin indica para qué colegio es la carga;
            el resto de roles ven fija la IE de su propio colegio. */}
        {isSuperadmin ? (
          <label style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>
              Código IE del colegio <span style={{ color: "#ef4444" }}>*</span>
            </span>
            <input
              value={colegioUploadIe}
              onChange={(e) => setColegioUploadIe(e.target.value.trim())}
              placeholder="Ej: 0249 ó 249"
              style={{ fontSize: 13, padding: "7px 10px", borderRadius: 8,
                border: "1px solid var(--border)" }}
            />
          </label>
        ) : (
          <div style={{ marginBottom: 10, padding: "8px 10px", fontSize: 12,
            background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8 }}>
            Vas a cargar datos para tu colegio — <strong>IE {ieEfectiva}</strong>
          </div>
        )}

        {/* Botón de carga */}
        <button
          className="primary"
          disabled={colegioUploadStatus === "uploading" || !ieEfectiva}
          onClick={() => colegioFileRef.current?.click()}
          style={{ width: "100%", marginBottom: 8 }}
        >
          <Upload size={17} />
          {colegioUploadStatus === "uploading"
            ? "Procesando... (puede tardar ~30 seg)"
            : "Seleccionar Excel de notas y conducta"}
        </button>

        <p className="model-note" style={{ fontSize: 10 }}>
          Selecciona múltiples archivos a la vez. Deben incluir "Notas" o "Conducta" en el nombre.
        </p>

        {/* Estado del proceso */}
        {colegioUploadStatus !== "idle" && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            marginTop: 10, padding: "10px 12px", borderRadius: 8,
            background: colegioUploadStatus === "success" ? "#f0fdf4"
              : colegioUploadStatus === "error" ? "#fef2f2" : "#fffbeb",
            border: `1px solid ${colegioUploadStatus === "success" ? "#86efac"
              : colegioUploadStatus === "error" ? "#fca5a5" : "#fde68a"}`,
          }}>
            {statusIcon}
            <span style={{ fontSize: 12, lineHeight: 1.5 }}>{colegioUploadMsg}</span>
          </div>
        )}

        {/* Resultado del entrenamiento */}
        {colegioUploadResult && colegioUploadStatus === "success" && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)", marginBottom: 8 }}>
              Modelo entrenado — {colegioUploadResult.nombre_colegio}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <Kpi label="Alumnos"  value={colegioUploadResult.n_alumnos}  detail="procesados" />
              <Kpi label="En riesgo" value={colegioUploadResult.n_riesgo}  detail="detectados" tone={colegioUploadResult.n_riesgo > 0 ? "high" : undefined} />
              <Kpi label="% Riesgo" value={`${colegioUploadResult.pct_riesgo}%`} detail="del total" />
            </div>
            {colegioUploadResult.salones.length > 0 && (
              <p className="model-note" style={{ marginTop: 6 }}>
                Salones: {colegioUploadResult.salones.join(" · ")}
              </p>
            )}
            <p style={{ fontSize: 11, color: "#16a34a", marginTop: 6, fontWeight: 600 }}>
              ✓ El modelo del colegio quedó actualizado con estos datos.
            </p>
            {(role === "director" || role === "coordinador") && (
              <button
                className="primary"
                style={{ marginTop: 10, width: "100%" }}
                onClick={() => setTab("dashboard")}
              >
                Ver en el Dashboard →
              </button>
            )}
            {colegioUploadResult.advertencias.length > 0 && (
              <div style={{ marginTop: 10, padding: "8px 10px", background: "#fffbeb",
                border: "1px solid #fde68a", borderRadius: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>
                  ⚠️ {colegioUploadResult.advertencias.length} hoja(s)/archivo(s) omitidos o con error:
                </p>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: "#92400e", lineHeight: 1.6 }}>
                  {colegioUploadResult.advertencias.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </Panel>
      )}

    </section>
  );
}
