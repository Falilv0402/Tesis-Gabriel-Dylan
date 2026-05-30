"use client";

import { RefObject } from "react";
import { Upload, Database, RefreshCcw, CheckCircle2, AlertTriangle, School, Loader } from "lucide-react";
import { Panel, Kpi } from "@/components/ui/Primitives";

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
    <section className="two-col">

      {/* ── Panel 1: Carga Excel del colegio ───────────────────────────── */}
      <Panel title="Datos del colegio — Excel interno">
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
              ✓ El tab "Mi Colegio" del director ya muestra los datos actualizados.
            </p>
          </div>
        )}
      </Panel>

      {/* ── Panel 2: CSV EM 2022 + programación ───────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        <Panel title="Validación CSV académico (EM 2022)">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.CSV"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onValidateCsv(f);
              e.target.value = "";
            }}
          />
          <div className="source-grid">
            <button onClick={() => fileInputRef.current?.click()}>
              <Upload size={18} /> CSV académico
            </button>
            <button onClick={() => setUploadResult("Exporta tu planilla como CSV UTF-8 e impórtala con el botón CSV.")}>
              <Upload size={18} /> XLSX → CSV
            </button>
            <button onClick={() => setUploadResult("Integración SIS: API REST pendiente de configuración con MINEDU.")}>
              <Database size={18} /> Fuente SIS
            </button>
          </div>

          <button
            className="primary"
            disabled={isValidating}
            onClick={() => fileInputRef.current?.click()}
            style={{ marginTop: 8, width: "100%" }}
          >
            <Upload size={17} /> {isValidating ? "Validando..." : "Seleccionar y validar CSV"}
          </button>

          {/* Resultados de validación CSV */}
          {uploadResult && uploadResult !== "Sin archivo cargado." && (
            <p className="audit-line" style={{ marginTop: 8 }}>{uploadResult}</p>
          )}

          {csvValidation && (
            <>
              <div className="metric-grid" style={{ margin: "10px 0 8px" }}>
                <Kpi label="Total filas"  value={csvValidation.total_filas}    detail="en el archivo" />
                <Kpi label="Válidas"      value={csvValidation.filas_validas}  detail="pasan validación" />
                <Kpi label="Errores"      value={csvValidation.errores.length} detail="encontrados"
                  tone={csvValidation.errores.length > 0 ? "high" : undefined} />
              </div>
              {csvValidation.columnas_faltantes.length > 0 && (
                <p className="auth-error">Columnas faltantes: {csvValidation.columnas_faltantes.join(", ")}</p>
              )}
              {csvValidation.errores.length === 0 && (
                <p style={{ color: "#16a34a", fontSize: 12, fontWeight: 600, textAlign: "center" }}>
                  ✓ Archivo válido — listo para procesar
                </p>
              )}
            </>
          )}
        </Panel>

        <Panel title="Programación de actualizaciones">
          <label>Frecuencia
            <select value={scheduleFreq} onChange={(e) => setScheduleFreq(e.target.value)}>
              <option value="minedu">Por evaluación MINEDU</option>
              <option value="semanal">Semanal</option>
              <option value="mensual">Mensual</option>
            </select>
          </label>
          {nextUpdate && (
            <p className="auth-success" style={{ margin: 0 }}>
              Próxima actualización: <strong>{nextUpdate}</strong>
            </p>
          )}
          <button className="primary" onClick={onSaveSchedule}>
            <RefreshCcw size={17} /> Guardar programación
          </button>
          {scheduleMsg && <p className="audit-line">{scheduleMsg}</p>}
        </Panel>

      </div>
    </section>
  );
}
