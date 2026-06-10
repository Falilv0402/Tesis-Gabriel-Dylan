"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/constants";

export type ColegioModelSummary = {
  codigo_ie: string;
  nombre_colegio: string;
  n_alumnos: number;
  n_riesgo: number;
  pct_riesgo: number;
  auc_cv: number | null;
  auc_train: number | null;
  f1_train: number | null;
  precision_train: number | null;
  recall_train: number | null;
  accuracy_train: number | null;
  modo_prediccion: string;
};

/**
 * Carga las métricas de TODOS los colegios con modelo propio entrenado
 * (CUBICOL). El listado /v1/colegios solo trae `nombre_ie` para las IE que
 * tienen un `colegio_*.pkl`, así que filtramos por eso. Pensado para la vista
 * del superadmin (pestaña Modelo ML), que supervisa todos los modelos.
 */
export function useColegioModels(enabled: boolean) {
  const [models, setModels]     = useState<ColegioModelSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/v1/colegios`);
      if (!res.ok) { setModels([]); return; }
      const colegios: { id_ie: string; nombre_ie?: string }[] = await res.json();
      const conModelo = colegios.filter((c) => c.nombre_ie); // solo los que tienen .pkl propio

      const out: ColegioModelSummary[] = [];
      for (const c of conModelo) {
        const ie = String(parseInt(String(c.id_ie), 10));
        const r = await fetch(`${apiUrl}/v1/colegio/${ie}/resumen`);
        if (!r.ok) continue;
        const d = await r.json();
        const m = d.metricas ?? {};
        out.push({
          codigo_ie:       ie,
          nombre_colegio:  d.nombre_colegio ?? ie,
          n_alumnos:       d.n_alumnos ?? 0,
          n_riesgo:        d.n_riesgo ?? 0,
          pct_riesgo:      d.pct_riesgo ?? 0,
          auc_cv:          m.auc_cv ?? null,
          auc_train:       m.auc_train ?? null,
          f1_train:        m.f1_train ?? null,
          precision_train: m.precision_train ?? null,
          recall_train:    m.recall_train ?? null,
          accuracy_train:  m.accuracy_train ?? null,
          modo_prediccion: m.modo_prediccion ?? "—",
        });
      }
      setModels(out);
    } catch {
      setModels([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (enabled) void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { models, isLoading };
}
