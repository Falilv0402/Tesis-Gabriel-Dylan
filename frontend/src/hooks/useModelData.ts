"use client";

import { useEffect, useMemo, useState } from "react";
import type { DatasetSummary, Diagnostico, Evaluation, Importance, Metrics } from "@/types";
import { apiUrl } from "@/lib/constants";

interface LiveMetrics {
  tp: number; fp: number; tn: number; fn: number;
  accuracy: number; precision: number; recall: number; f1: number; n: number;
}

export function useModelData(
  apiConnected: boolean | null,
  setApiConnected: (v: boolean) => void,
  toast: (msg: string, type?: "success" | "error" | "info") => void,
) {
  const [metrics,       setMetrics]       = useState<Metrics>({});
  const [evaluation,    setEvaluation]    = useState<Evaluation>({});
  const [diagnostico,   setDiagnostico]   = useState<Diagnostico | null>(null);
  const [importance,    setImportance]    = useState<Importance[]>([]);
  const [globalSummary, setGlobalSummary] = useState<DatasetSummary>({
    total: 0, risk_counts: { ALTO: 0, MEDIO: 0, BAJO: 0 }, facets: {},
  });
  const [thresholdHigh,   setThresholdHigh]   = useState(70);
  const [thresholdMedium, setThresholdMedium] = useState(45);
  const [modelMessage,    setModelMessage]    = useState("Conectando con el servicio del modelo...");
  const [isLoadingModel,  setIsLoadingModel]  = useState(true);

  async function loadModelMetrics() {
    setIsLoadingModel(true);
    let anySuccess = false;

    try {
      const metricsRes = await fetch(`${apiUrl}/v1/modelo/metricas`);
      if (metricsRes.ok) { setMetrics(await metricsRes.json()); anySuccess = true; }
    } catch { /* se conserva el valor anterior */ }

    try {
      const importanceRes = await fetch(`${apiUrl}/v1/modelo/importancia`);
      if (importanceRes.ok) { setImportance(await importanceRes.json()); anySuccess = true; }
    } catch { /* se conserva el valor anterior */ }

    try {
      const evalRes = await fetch(`${apiUrl}/v1/modelo/evaluacion`);
      if (evalRes.ok) { setEvaluation(await evalRes.json()); anySuccess = true; }
    } catch { /* se conserva el valor anterior */ }

    try {
      const diagRes = await fetch(`${apiUrl}/v1/modelo/diagnostico`);
      if (diagRes.ok) { setDiagnostico(await diagRes.json()); anySuccess = true; }
    } catch { /* se conserva el valor anterior */ }

    try {
      const globalRes = await fetch(`${apiUrl}/v1/predicciones/resumen`);
      if (globalRes.ok) { setGlobalSummary(await globalRes.json()); anySuccess = true; }
    } catch { /* se conserva el valor anterior */ }

    setApiConnected(anySuccess);
    setModelMessage(anySuccess ? "Modelo cargado desde backend ML." : "No se pudo conectar con el servicio del modelo.");
    setIsLoadingModel(false);
  }

  const liveMetrics = useMemo((): LiveMetrics | null => {
    const yTrue = diagnostico?.test_arrays?.y_true ?? [];
    const yProb = diagnostico?.test_arrays?.y_prob ?? [];
    if (yTrue.length === 0 || yTrue.length !== yProb.length) return null;
    const threshold = thresholdHigh / 100;
    let tp = 0, fp = 0, tn = 0, fn = 0;
    for (let i = 0; i < yTrue.length; i++) {
      const pred = yProb[i] >= threshold ? 1 : 0;
      const real = yTrue[i];
      if (pred === 1 && real === 1) tp++;
      else if (pred === 1 && real === 0) fp++;
      else if (pred === 0 && real === 0) tn++;
      else fn++;
    }
    const n = tp + fp + tn + fn;
    const precision = tp / Math.max(tp + fp, 1);
    const recall    = tp / Math.max(tp + fn, 1);
    return {
      tp, fp, tn, fn, n,
      accuracy:  (tp + tn) / Math.max(n, 1),
      precision, recall,
      f1: (2 * precision * recall) / Math.max(precision + recall, 1e-9),
    };
  }, [diagnostico, thresholdHigh]);

  const maxImportance = importance[0]?.importancia ?? 1;
  const topFactors    = importance.slice(0, 4);

  useEffect(() => {
    void loadModelMetrics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    metrics, evaluation, diagnostico, importance, globalSummary,
    thresholdHigh, setThresholdHigh,
    thresholdMedium, setThresholdMedium,
    modelMessage, setModelMessage,
    isLoadingModel,
    liveMetrics, maxImportance, topFactors,
    loadModelMetrics,
  };
}
