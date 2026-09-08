"use client";

import { ShieldCheck, Sparkles } from "lucide-react";

export interface AttentionItem {
  id: string;
  nombre: string;
  detalle: string;
  nivel: "ALTO" | "MEDIO";
  prob: number;
}

interface AttentionBannerProps {
  items: AttentionItem[];
  totalUrgente: number;
  contexto: string;
  onSelect?: (id: string) => void;
  onIntervenir?: (id: string) => void;
}

/**
 * Resumen ejecutivo accionable — el primer elemento del dashboard. Responde
 * directamente a "qué necesita mi atención hoy" antes que cualquier tabla o
 * gráfico, con un CTA de intervención a un clic de distancia.
 */
export function AttentionBanner({ items, totalUrgente, contexto, onSelect, onIntervenir }: AttentionBannerProps) {
  const enCalma = totalUrgente === 0;

  return (
    <div className={`attention-banner${enCalma ? " is-calm" : ""}`}>
      <div className="attention-banner-top">
        <div>
          <div className="attention-banner-heading">
            {enCalma ? <ShieldCheck size={13} /> : <Sparkles size={13} />}
            Resumen ejecutivo
          </div>
          <div className="attention-banner-title">
            {enCalma ? "Sin casos urgentes por ahora" : "Casos que necesitan tu atención hoy"}
          </div>
          <div className="attention-banner-sub">
            {enCalma
              ? `Ningún estudiante ${contexto} está en riesgo ALTO o MEDIO con el filtro actual. Buen momento para revisar seguimientos abiertos.`
              : `Priorizados por probabilidad de riesgo ${contexto}. Elige un caso para ver su detalle o regístralo directamente como intervención.`}
          </div>
        </div>
        <div className="attention-banner-stat">
          <strong>{totalUrgente}</strong>
          <span>{totalUrgente === 1 ? "caso urgente" : "casos urgentes"}</span>
        </div>
      </div>

      {items.length > 0 && (
        <div className="attention-scroll">
          {items.map((it) => (
            <div
              key={it.id}
              className="attention-chip"
              onClick={onSelect ? () => onSelect(it.id) : undefined}
              title={onSelect ? "Ver detalle" : undefined}
            >
              <span className={`attention-chip-level ${it.nivel === "ALTO" ? "high" : "medium"}`}>
                {it.nivel} · {(it.prob * 100).toFixed(0)}%
              </span>
              <span className="attention-chip-name">{it.nombre}</span>
              <span className="attention-chip-meta">{it.detalle}</span>
              {onIntervenir && (
                <button
                  className="attention-chip-btn"
                  onClick={(e) => { e.stopPropagation(); onIntervenir(it.id); }}
                >
                  Intervenir
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {totalUrgente > items.length && (
        <div className="attention-banner-more">
          + {totalUrgente - items.length} caso{totalUrgente - items.length === 1 ? "" : "s"} más con el filtro actual — revisa la tabla completa abajo.
        </div>
      )}
    </div>
  );
}
