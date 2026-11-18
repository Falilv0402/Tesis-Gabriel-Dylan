"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/constants";
import { supabase } from "@/lib/supabase";

/** Aciertos reales del sistema en el cierre de año (ver backend-ml/app/services/uso_real.py). */
export type UsoReal = {
  n_evaluados: number;
  n_en_riesgo: number;
  tasa_base: number;
  alto:  { n: number; en_riesgo: number; pct_en_riesgo: number | null };
  medio: { n: number; en_riesgo: number; pct_en_riesgo: number | null };
  bajo:  { n: number; en_riesgo: number; pct_en_riesgo: number | null };
  cobertura_alto_medio: number;
  // Precisión en los primeros K (K = alumnos que terminaron en riesgo): de los K que el sistema pone primero, cuántos lo estaban.
  priorizado: { n: number; en_riesgo: number; precision: number; veces_mejor_que_azar: number };
};

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
  precision_cv: number | null;
  recall_cv: number | null;
  f1_cv: number | null;
  modo_prediccion: string;
  tipo_resultado: string | null;
  trained_at: string | null;
  // Para los gráficos del detalle por colegio.
  confusion_matrix: number[][] | null;
  roc_fpr: number[] | null;
  roc_tpr: number[] | null;
  importancia_variables: { variable: string; importancia: number }[] | null;
  por_salon: Record<string, { ALTO: number; MEDIO: number; BAJO: number; total: number }>;
  // Cómo le fue al sistema en la práctica (solo en cierre de año) y los cortes con que se calcularon F1 y niveles.
  uso_real: UsoReal | null;
  corte_clasificacion: number | null;
  cortes_nivel: { alto: number; medio: number } | null;
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
            precision_cv:    m.precision_cv ?? null,
            recall_cv:       m.recall_cv ?? null,
            f1_cv:           m.f1_cv ?? null,
            modo_prediccion: m.modo_prediccion ?? "—",
            tipo_resultado:  m.tipo_resultado ?? null,
            trained_at:      d.trained_at ?? null,
            confusion_matrix:      m.confusion_matrix ?? null,
            roc_fpr:               m.roc_fpr ?? null,
            roc_tpr:               m.roc_tpr ?? null,
            importancia_variables: m.importancia_variables ?? null,
            por_salon:             d.por_salon ?? {},
            uso_real:              m.uso_real ?? null,
            corte_clasificacion:   m.corte_clasificacion ?? null,
            cortes_nivel:          m.cortes_nivel ?? null,
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
