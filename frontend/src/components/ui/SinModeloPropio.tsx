"use client";

import { Database, School } from "lucide-react";
import { Panel } from "@/components/ui/Primitives";
import type { Tab } from "@/types";

/**
 * Reemplaza el antiguo fallback al modelo nacional EM2022 cuando un colegio
 * todavía no tiene su modelo propio entrenado (EM2022_HABILITADO = false en
 * lib/constants.ts). Antes, en ese caso, se mostraba el dataset nacional
 * completo -- confuso, porque no tenía relación real con el colegio del
 * usuario.
 */
export function SinModeloPropio({ setTab }: { setTab: (tab: Tab) => void }) {
  return (
    <section className="full-col">
      <Panel title="Sin modelo propio configurado">
        <div className="empty-state-large">
          <School size={48} style={{ opacity: 0.4, marginBottom: 12 }} />
          <h3 style={{ margin: "0 0 6px" }}>Tu colegio todavía no tiene el modelo propio configurado</h3>
          <p className="model-note" style={{ marginBottom: 14, maxWidth: 420 }}>
            Sube el Excel de notas y conducta de tu colegio en la sección "Datos" para que
            SATRA entrene el modelo y empieces a ver el dashboard, los estudiantes y las
            intervenciones.
          </p>
          <button className="primary" onClick={() => setTab("datos")}>
            <Database size={14} /> Ir a Datos
          </button>
        </div>
      </Panel>
    </section>
  );
}
