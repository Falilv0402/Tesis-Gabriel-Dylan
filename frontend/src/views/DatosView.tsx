"use client";

import { RefreshCcw, Upload, Database } from "lucide-react";
import type { RefObject } from "react";
import { Panel, Kpi } from "@/components/ui/Primitives";

interface CsvValidation {
  total_filas: number;
  filas_validas: number;
  errores: { fila: number; campo: string; error: string }[];
  columnas_faltantes: string[];
}

interface DatosViewProps {
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
}

export function DatosView({
  fileInputRef, uploadResult, setUploadResult,
  csvValidation, isValidating,
  scheduleFreq, setScheduleFreq,
  nextUpdate, scheduleMsg,
  onValidateCsv, onSaveSchedule,
}: DatosViewProps) {
  return (
    <section className="two-col">
      <Panel title="Carga e integracion de datos">
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
            <Upload size={18} /> CSV academico
          </button>
          <button onClick={() => setUploadResult("Carga XLSX: exporta tu planilla como CSV UTF-8 e importala usando el boton CSV.")}>
            <Upload size={18} /> XLSX institucional
          </button>
          <button onClick={() => setUploadResult("Fuente SIS: integracion via API REST pendiente de configuracion con MINEDU.")}>
            <Database size={18} /> Fuente SIS
          </button>
        </div>

        <label>Frecuencia de actualizacion
          <select value={scheduleFreq} onChange={(e) => setScheduleFreq(e.target.value)}>
            <option value="minedu">Por evaluacion MINEDU</option>
            <option value="semanal">Semanal</option>
            <option value="mensual">Mensual</option>
          </select>
        </label>
        {nextUpdate && (
          <p className="auth-success" style={{ margin: 0 }}>
            Proxima actualizacion programada: <strong>{nextUpdate}</strong>
          </p>
        )}
        <button className="primary" onClick={onSaveSchedule}>
          <RefreshCcw size={17} /> Guardar programacion
        </button>
        {scheduleMsg && <p className="audit-line">{scheduleMsg}</p>}

        <button
          className="primary"
          disabled={isValidating}
          onClick={() => fileInputRef.current?.click()}
          style={{ marginTop: "8px" }}
        >
          <Upload size={17} /> {isValidating ? "Validando..." : "Seleccionar y validar archivo"}
        </button>
      </Panel>

      <Panel title="Resultados de validacion">
        <p className="audit-line">{uploadResult}</p>
        {csvValidation ? (
          <>
            <div className="metric-grid" style={{ marginBottom: "12px" }}>
              <Kpi label="Total filas" value={csvValidation.total_filas} detail="en el archivo" />
              <Kpi label="Filas validas" value={csvValidation.filas_validas} detail="pasan validacion" />
              <Kpi
                label="Errores"
                value={csvValidation.errores.length}
                detail="encontrados"
                tone={csvValidation.errores.length > 0 ? "high" : undefined}
              />
            </div>
            {csvValidation.columnas_faltantes.length > 0 && (
              <p className="auth-error">Columnas faltantes: {csvValidation.columnas_faltantes.join(", ")}</p>
            )}
            <table><tbody>
              <tr><th>Fila</th><th>Campo</th><th>Error</th></tr>
              {csvValidation.errores.map((e, i) => (
                <tr key={i}>
                  <td>{e.fila === 0 ? "—" : e.fila}</td>
                  <td>{e.campo}</td>
                  <td>{e.error}</td>
                </tr>
              ))}
              {csvValidation.errores.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ color: "#16a34a", textAlign: "center" }}>
                    Sin errores — archivo listo para procesar
                  </td>
                </tr>
              )}
            </tbody></table>
          </>
        ) : (
          <table><tbody>
            <tr><th>Fila</th><th>Campo</th><th>Error</th></tr>
            <tr>
              <td colSpan={3} style={{ color: "#6b7280", textAlign: "center" }}>
                Selecciona un archivo CSV para ver los resultados.
              </td>
            </tr>
          </tbody></table>
        )}
      </Panel>
    </section>
  );
}
