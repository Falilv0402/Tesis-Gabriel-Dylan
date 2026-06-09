"use client";

import { RefObject } from "react";
import { Upload, CheckCircle2, AlertTriangle, School, Loader, Info, Cpu, ShieldAlert } from "lucide-react";
import { Panel, Kpi } from "@/components/ui/Primitives";
import { isLocalBackend } from "@/lib/env";
import type { Metrics } from "@/types";

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
  // Métricas del modelo nacional EM2022 (para admin de colegios sin modelo CUBICOL propio)
  em2022Metrics?: Metrics;
  colegioModelStats: {
    nombre_colegio: string; n_alumnos: number; n_riesgo: number;
    pct_riesgo: number; auc_cv: number | null; auc_train: number | null;
    modo_prediccion: string; salones: string[]; trained_at: string | null;
    por_nivel: Record<string, number>;
  } | null;
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
  role, profileCodigoIe,
  em2022Metrics,
  colegioModelStats,
}: DatosViewProps) {

  // El panel de carga es exclusivo del superadmin: usa la IE que escribe.
  const ieEfectiva = colegioUploadIe;

  const statusIcon = {
    idle:      <School size={18} style={{ color: "var(--accent)" }} />,
    uploading: <Loader size={18} style={{ color: "#d97706", animation: "spin 1s linear infinite" }} />,
    success:   <CheckCircle2 size={18} style={{ color: "#16a34a" }} />,
    error:     <AlertTriangle size={18} style={{ color: "#dc2626" }} />,
  }[colegioUploadStatus];

  const isAdminRole   = role === "admin";
  const noModelYet    = isAdminRole && !colegioModelStats;
  const noIeAssigned  = isAdminRole && !profileCodigoIe;
  const isEM2022      = colegioModelStats?.modo_prediccion === "Modelo Nacional EM2022";

  return (
    <section className="full-col" style={{ maxWidth: 780 }}>

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
                El colegio IE <strong>{profileCodigoIe}</strong> no está en el dataset EM2022 ni tiene
                un modelo CUBICOL propio. Contacta al Super Admin.
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
                      {em2022Metrics.trained_at}
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
                      <span>Entrenado: {new Date(colegioModelStats.trained_at).toLocaleDateString("es-PE", { dateStyle: "medium" })}</span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </Panel>
      )}

      {/* ── Panel 1: Carga Excel del colegio (solo Super Admin) ───────────── */}
      {/* El admin de colegio solo monitorea; el entrenamiento es tarea del superadmin */}
      {role === "superadmin" && (
      <Panel title="Datos del colegio — Excel interno">
        {!isLocalBackend() && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8,
            padding: "10px 12px", background: "#fffbeb", border: "1px solid #fde68a",
            borderRadius: 8, fontSize: 12, color: "#92400e", marginBottom: 12 }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Actualización de datos desactivada en producción.</strong>
              <p style={{ margin: "3px 0 0", fontSize: 11, lineHeight: 1.4 }}>
                Para actualizar los datos del colegio, entrena el modelo localmente y
                haz <code style={{ background: "#fef3c7", padding: "1px 4px", borderRadius: 3 }}>git push</code>.
                El despliegue actualizará automáticamente.
              </p>
            </div>
          </div>
        )}
        {isLocalBackend() && (<>
        <p className="model-note" style={{ marginBottom: 12 }}>
          Sube los archivos Excel de notas y conducta del colegio (formato CUBICOL Académico).
          El sistema entrenará automáticamente el modelo de riesgo con las notas internas.
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

        {/* IE selector — el superadmin indica para qué colegio es la carga */}
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
          </div>
        )}
        </>)}
      </Panel>
      )}

    </section>
  );
}
