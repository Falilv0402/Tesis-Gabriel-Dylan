"use client";

import { RefObject } from "react";
import { Upload, CheckCircle2, AlertTriangle, School, Loader, Info } from "lucide-react";
import { Panel, Kpi } from "@/components/ui/Primitives";
import { isLocalBackend } from "@/lib/env";

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
  colegioModelStats,
}: DatosViewProps) {

  // Si el admin tiene un colegio asignado, usarlo por defecto
  const ieEfectiva = role === "admin" && profileCodigoIe ? profileCodigoIe : colegioUploadIe;

  const statusIcon = {
    idle:      <School size={18} style={{ color: "var(--accent)" }} />,
    uploading: <Loader size={18} style={{ color: "#d97706", animation: "spin 1s linear infinite" }} />,
    success:   <CheckCircle2 size={18} style={{ color: "#16a34a" }} />,
    error:     <AlertTriangle size={18} style={{ color: "#dc2626" }} />,
  }[colegioUploadStatus];

  return (
    <section className="full-col" style={{ maxWidth: 780 }}>

      {/* ── Panel 0: Estadísticas del modelo actual ─────────────────────── */}
      {colegioModelStats && (
        <Panel title={`Modelo del colegio — ${colegioModelStats.nombre_colegio}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Métricas principales */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              <Kpi label="Alumnos"   value={colegioModelStats.n_alumnos}           detail="en el modelo" />
              <Kpi label="En riesgo" value={colegioModelStats.n_riesgo}            detail={`${colegioModelStats.pct_riesgo}% del total`} tone={colegioModelStats.n_riesgo > 0 ? "high" : undefined} />
              <Kpi label="AUC CV"    value={colegioModelStats.auc_cv != null ? `${(colegioModelStats.auc_cv * 100).toFixed(1)}%` : "—"} detail="5-fold estratificado" tone={colegioModelStats.auc_cv != null && colegioModelStats.auc_cv >= 0.80 ? "low" : "medium"} />
            </div>

            {/* Distribución por nivel */}
            {Object.keys(colegioModelStats.por_nivel).length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", marginBottom: 4, textTransform: "uppercase" }}>Distribución</p>
                <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 1 }}>
                  {[["ALTO","#dc2626"],["MEDIO","#d97706"],["BAJO","#16a34a"]].map(([nivel, color]) =>
                    (colegioModelStats.por_nivel[nivel] ?? 0) > 0 ? (
                      <div key={nivel} style={{ flex: colegioModelStats.por_nivel[nivel], background: color }}
                        title={`${nivel}: ${colegioModelStats.por_nivel[nivel]}`} />
                    ) : null
                  )}
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>
                  {[["ALTO","#dc2626"],["MEDIO","#d97706"],["BAJO","#16a34a"]].map(([nivel, color]) => (
                    <span key={nivel} style={{ color }}>
                      {nivel}: <strong>{colegioModelStats.por_nivel[nivel] ?? 0}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Modo y features */}
            <div style={{ padding: "8px 10px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, fontSize: 12 }}>
              <strong style={{ color: "#0369a1" }}>Modo:</strong>{" "}
              <span style={{ color: "#0369a1" }}>{colegioModelStats.modo_prediccion}</span>
            </div>

            {/* Salones y fecha */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
              <span>Salones: {colegioModelStats.salones.join(" · ")}</span>
              {colegioModelStats.trained_at && (
                <span>Entrenado: {new Date(colegioModelStats.trained_at).toLocaleDateString("es-PE", { dateStyle: "medium" })}</span>
              )}
            </div>
          </div>
        </Panel>
      )}

      {/* ── Panel 1: Carga Excel del colegio (solo en local) ──────────── */}
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

        {/* IE selector — solo si el admin no tiene IE fija */}
        {role === "superadmin" && (
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
        )}

        {role === "admin" && profileCodigoIe && (
          <div style={{ padding: "8px 12px", background: "#f0f9ff", border: "1px solid #bae6fd",
            borderRadius: 8, fontSize: 12, color: "#0369a1", marginBottom: 10 }}>
            📌 Los archivos se procesarán para tu colegio (IE {profileCodigoIe})
          </div>
        )}

        {/* Botón de carga */}
        <button
          className="primary"
          disabled={colegioUploadStatus === "uploading" || (!ieEfectiva && role === "superadmin")}
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

    </section>
  );
}
