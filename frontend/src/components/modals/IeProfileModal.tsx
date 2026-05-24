"use client";

import { Database, X } from "lucide-react";
import type { Student } from "@/types";
import { Kpi, Bar } from "@/components/ui/Primitives";
import { pct } from "@/lib/format";

interface IeProfileModalProps {
  show: boolean;
  ieProfileId: string | null;
  classifiedStudents: Student[];
  onClose: () => void;
}

export function IeProfileModal({ show, ieProfileId, classifiedStudents, onClose }: IeProfileModalProps) {
  if (!show || !ieProfileId) return null;

  const ieStudents = classifiedStudents.filter((s) => s.id_ie === ieProfileId);
  const ieAlto = ieStudents.filter((s) => s.nivel_riesgo === "ALTO").length;
  const ieMedio = ieStudents.filter((s) => s.nivel_riesgo === "MEDIO").length;
  const ieBajo = ieStudents.filter((s) => s.nivel_riesgo === "BAJO").length;
  const ieMeanL = ieStudents.length > 0 ? ieStudents.reduce((a, s) => a + s.M500_L, 0) / ieStudents.length : 0;
  const ieMeanCN = ieStudents.length > 0 ? ieStudents.reduce((a, s) => a + s.M500_CN, 0) / ieStudents.length : 0;
  const ieMeanIse = ieStudents.length > 0 ? ieStudents.reduce((a, s) => a + s.ise, 0) / ieStudents.length : 0;
  const ieDistrict = ieStudents[0]?.distrito ?? "—";

  const iesByAlto = Array.from(new Set(classifiedStudents.map((s) => s.id_ie).filter(Boolean)))
    .map((ie) => {
      const grp = classifiedStudents.filter((s) => s.id_ie === ie);
      return { ie, pctAlto: grp.filter((s) => s.nivel_riesgo === "ALTO").length / Math.max(grp.length, 1) };
    })
    .sort((a, b) => b.pctAlto - a.pctAlto);
  const rank = iesByAlto.findIndex((x) => x.ie === ieProfileId) + 1;

  return (
    <div
      className="comparator-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Perfil del colegio"
      onClick={onClose}
    >
      <div className="comparator-panel" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="comparator-header">
          <Database size={16} />
          <strong>Perfil del colegio — IE {ieProfileId}</strong>
          <button className="comparator-close" onClick={onClose} aria-label="Cerrar perfil IE">
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "0 4px" }}>
          <div className="metric-grid" style={{ marginBottom: 12 }}>
            <Kpi label="Total alumnos" value={ieStudents.length} detail={ieDistrict} />
            <Kpi label="Riesgo ALTO" value={pct(ieAlto / Math.max(ieStudents.length, 1))} detail={`${ieAlto} alumnos`} tone="high" />
            <Kpi
              label="Ranking distrital"
              value={`#${rank}`}
              detail={`de ${iesByAlto.length} IEs`}
              tone={rank <= 5 ? "high" : rank <= iesByAlto.length / 2 ? "medium" : "low"}
            />
          </div>
          <div className="metric-grid">
            <Kpi label="M500 Lectura" value={ieMeanL.toFixed(0)} detail="promedio IE" tone={ieMeanL < 450 ? "high" : "low"} />
            <Kpi label="M500 Ciencias" value={ieMeanCN.toFixed(0)} detail="promedio IE" tone={ieMeanCN < 450 ? "high" : "low"} />
            <Kpi label="ISE promedio" value={ieMeanIse.toFixed(2)} detail="contexto socioecon." tone={ieMeanIse < 1.0 ? "high" : "low"} />
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="model-note" style={{ fontWeight: 700, marginBottom: 6 }}>Distribución de riesgo</div>
            <Bar label="Riesgo ALTO" value={ieAlto / Math.max(ieStudents.length, 1)} tone="high" />
            <Bar label="Riesgo MEDIO" value={ieMedio / Math.max(ieStudents.length, 1)} tone="medium" />
            <Bar label="Riesgo BAJO" value={ieBajo / Math.max(ieStudents.length, 1)} tone="low" />
          </div>
          <div className="model-note" style={{ marginTop: 10, fontSize: 11 }}>
            Datos del dataset EM 2022 — {ieStudents.length} estudiantes de 2.° sec. en esta IE.
          </div>
        </div>
      </div>
    </div>
  );
}
