"use client";

import { Plus, Scale, X } from "lucide-react";
import type { Student } from "@/types";
import { shortId, pct } from "@/lib/format";

interface ComparatorModalProps {
  show: boolean;
  comparatorIds: string[];
  classifiedStudents: Student[];
  filtered: Student[];
  onClose: () => void;
  onToggle: (id: string) => void;
}

export function ComparatorModal({
  show, comparatorIds, classifiedStudents, filtered, onClose, onToggle,
}: ComparatorModalProps) {
  if (!show || comparatorIds.length === 0) return null;

  return (
    <div
      className="comparator-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Comparador de estudiantes"
      onClick={onClose}
    >
      <div className="comparator-panel" onClick={(e) => e.stopPropagation()}>
        <div className="comparator-header">
          <Scale size={16} />
          <strong>Comparador de estudiantes</strong>
          <button className="comparator-close" onClick={onClose} aria-label="Cerrar comparador">
            <X size={16} />
          </button>
        </div>

        <div className="comparator-grid" style={{ gridTemplateColumns: `repeat(${comparatorIds.length}, 1fr)` }}>
          {comparatorIds.map((cid) => {
            const st = classifiedStudents.find((s) => s.id === cid);
            if (!st) return null;
            const riskColor = st.nivel_riesgo === "ALTO" ? "#ef4444" : st.nivel_riesgo === "MEDIO" ? "#f59e0b" : "#22c55e";
            return (
              <div key={cid} className="comparator-card">
                <div className="comparator-card-header" style={{ background: riskColor }}>
                  <strong style={{ color: "#fff" }}>Est. {shortId(st.id)}</strong>
                  <span className="risk low" style={{ background: "rgba(255,255,255,0.25)", color: "#fff" }}>
                    {st.nivel_riesgo}
                  </span>
                </div>
                <div className="comparator-card-body">
                  <div className="comparator-row"><span>Probabilidad</span><strong>{pct(st.probabilidad_riesgo)}</strong></div>
                  <div className="comparator-row"><span>Sexo</span><strong>{st.sexo}</strong></div>
                  <div className="comparator-row"><span>Distrito</span><strong>{st.distrito}</strong></div>
                  <div className="comparator-row"><span>ISE</span><strong>{st.ise.toFixed(2)}</strong></div>
                  <div className="comparator-row">
                    <span>M500 Lectura</span>
                    <strong style={{ color: st.M500_L < 450 ? "#ef4444" : "#22c55e" }}>{st.M500_L.toFixed(0)}</strong>
                  </div>
                  <div className="comparator-row">
                    <span>M500 Ciencias</span>
                    <strong style={{ color: st.M500_CN < 450 ? "#ef4444" : "#22c55e" }}>{st.M500_CN.toFixed(0)}</strong>
                  </div>
                  <div className="comparator-row"><span>Tipo riesgo</span><strong style={{ fontSize: 11 }}>{st.tipo_riesgo}</strong></div>
                </div>
                <button className="comparator-remove" onClick={() => onToggle(cid)} aria-label="Quitar del comparador">
                  <X size={12} /> Quitar
                </button>
              </div>
            );
          })}
        </div>

        {comparatorIds.length < 3 && (
          <div className="comparator-add-row">
            <label htmlFor="comparator-add-select">
              <Plus size={13} /> Agregar otro estudiante
            </label>
            <select
              id="comparator-add-select"
              value=""
              onChange={(e) => { if (e.target.value) onToggle(e.target.value); }}
            >
              <option value="">— Elige del ranking —</option>
              {filtered
                .filter((s) => !comparatorIds.includes(s.id))
                .slice(0, 50)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    Est. {shortId(s.id)} · {s.nivel_riesgo} · {pct(s.probabilidad_riesgo)} · {s.distrito}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div className="model-note" style={{ marginTop: 8, fontSize: 11, textAlign: "center" }}>
          {comparatorIds.length >= 3
            ? "Máximo alcanzado (3 estudiantes). Quita uno para añadir otro."
            : `${comparatorIds.length} de 3 estudiantes seleccionados.`}
        </div>
      </div>
    </div>
  );
}
