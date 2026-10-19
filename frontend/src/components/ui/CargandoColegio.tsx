"use client";

import { Loader } from "lucide-react";
import { Panel } from "@/components/ui/Primitives";

/**
 * Se muestra mientras se consultan los datos del colegio. Hasta que la consulta termina no se sabe si el colegio
 * tiene modelo o no, así que no debe decirse "Sin modelo propio configurado" (ni mostrar un error de conexión).
 */
export function CargandoColegio({ mensaje = "Cargando los datos de tu colegio…" }: { mensaje?: string }) {
  return (
    <section className="full-col">
      <Panel title="Cargando">
        <div className="empty-state-large" role="status" aria-live="polite">
          <Loader size={40} style={{ color: "var(--accent)", marginBottom: 12, animation: "spin 1s linear infinite" }} />
          <h3 style={{ margin: "0 0 6px" }}>{mensaje}</h3>
          <p className="model-note" style={{ maxWidth: 380 }}>Esto toma solo unos segundos.</p>
        </div>
      </Panel>
    </section>
  );
}
