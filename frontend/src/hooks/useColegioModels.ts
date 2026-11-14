"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/constants";
import { supabase } from "@/lib/supabase";

export type ColegioModelSummary = {
  codigo_ie: string;
  nombre_colegio: string;
  n_alumnos: number;
  n_riesgo: number;
  pct_riesgo: number;
  n_alto: number;
  n_medio: number;
  n_bajo: number;
  auc_cv: number | null;
  auc_train: number | null;
  f1_train: number | null;
  precision_train: number | null;
  recall_train: number | null;
  accuracy_train: number | null;
  n_splits_cv: number | null;
  modo_prediccion: string;
  tipo_resultado: string | null;
  trained_at: string | null;
};

/**
 * Carga las métricas de TODOS los colegios con modelo propio entrenado
 * (CUBICOL). El listado /v1/colegios solo trae `nombre_ie` para las IE que
 * tienen un `colegio_*.pkl`, así que filtramos por eso. Pensado para la vista
 * del superadmin (pestaña Modelos), que supervisa todos los modelos.
 *
 * `failed` cuenta los colegios cuyo resumen no se pudo leer, para que la vista
 * avise en vez de mostrar una lista que parece completa y no lo es.
 */
export function useColegioModels(enabled: boolean) {
  const [models, setModels]       = useState<ColegioModelSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed]       = useState(0);
  const [loadError, setLoadError] = useState(false);

  async function load() {
    setIsLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`${apiUrl}/v1/colegios`);
      if (!res.ok) { setModels([]); setLoadError(true); return; }
      const colegios: { id_ie: string; nombre_ie?: string }[] = await res.json();
      const conModelo = colegios.filter((c) => c.nombre_ie); // solo los que tienen .pkl propio

      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined;

      // En paralelo: cada resumen carga un modelo en el servidor y, uno tras otro,
      // la pestaña tardaba lo que suman todos.
      const resultados = await Promise.all(conModelo.map(async (c): Promise<ColegioModelSummary | null> => {
        const ie = String(parseInt(String(c.id_ie), 10));
        try {
          const r = await fetch(`${apiUrl}/v1/colegio/${ie}/resumen`, { headers: authHeaders });
          if (!r.ok) return null;
          const d = await r.json();
          const m = d.metricas ?? {};
          const nivel = d.por_nivel ?? {};
          return {
            codigo_ie:       ie,
            nombre_colegio:  d.nombre_colegio ?? c.nombre_ie ?? ie,
            n_alumnos:       d.n_alumnos ?? 0,
            n_riesgo:        d.n_riesgo ?? 0,
            pct_riesgo:      d.pct_riesgo ?? 0,
            n_alto:          nivel.ALTO ?? 0,
            n_medio:         nivel.MEDIO ?? 0,
            n_bajo:          nivel.BAJO ?? 0,
            auc_cv:          m.auc_cv ?? null,
            auc_train:       m.auc_train ?? null,
            f1_train:        m.f1_train ?? null,
            precision_train: m.precision_train ?? null,
            recall_train:    m.recall_train ?? null,
            accuracy_train:  m.accuracy_train ?? null,
            n_splits_cv:     m.n_splits_cv ?? null,
            modo_prediccion: m.modo_prediccion ?? "—",
            tipo_resultado:  m.tipo_resultado ?? null,
            trained_at:      d.trained_at ?? null,
          };
        } catch {
          return null;
        }
      }));

      const ok = resultados.filter((r): r is ColegioModelSummary => r !== null);
      ok.sort((a, b) => a.nombre_colegio.localeCompare(b.nombre_colegio, "es"));
      setModels(ok);
      setFailed(resultados.length - ok.length);
    } catch {
      setModels([]);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (enabled) void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { models, isLoading, failed, loadError, reload: load };
}
