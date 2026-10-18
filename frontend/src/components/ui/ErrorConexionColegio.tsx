"use client";

import { RefreshCcw, WifiOff } from "lucide-react";
import { Panel } from "@/components/ui/Primitives";

/**
 * Se muestra cuando el servidor que procesa el análisis del colegio no responde (HU009-3). Antes, en ese caso,
 * el director veía "Sin modelo propio configurado", que no era cierto: el modelo existe, pero no se pudo consultar.
 */
export function ErrorConexionColegio({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="full-col">
      <Panel title="Error de conexión">
        <div className="empty-state-large" role="alert">
          <WifiOff size={48} style={{ opacity: 0.4, marginBottom: 12, color: "#dc2626" }} />
          <h3 style={{ margin: "0 0 6px" }}>No se pudo procesar la solicitud</h3>
          <p className="model-note" style={{ marginBottom: 14, maxWidth: 440 }}>
            Error de conexión con el servidor: no se pudieron cargar los datos de tu colegio. Revisa tu conexión a internet
            o inténtalo de nuevo en unos minutos; si el problema continúa, avisa al administrador del sistema.
          </p>
          <button className="primary" onClick={onRetry}>
            <RefreshCcw size={14} /> Reintentar
          </button>
        </div>
      </Panel>
    </section>
  );
}
