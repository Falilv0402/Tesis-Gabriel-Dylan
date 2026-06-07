"use client";

import { useEffect, useState } from "react";
import type { AlumnoColegio, ColegioResumen } from "@/types";
import { apiUrl } from "@/lib/constants";

/**
 * Carga los datos del modelo INTERNO del colegio (IE con datos propios) para
 * el director/coordinador de esa IE. Si la IE no tiene modelo entrenado el
 * backend responde 404 y `hasModel` queda en false (la app cae al modelo
 * nacional EM 2022).
 */
export function useColegio(codigoIe: string | null) {
  const [alumnos,  setAlumnos]  = useState<AlumnoColegio[]>([]);
  const [resumen,  setResumen]  = useState<ColegioResumen | null>(null);
  const [hasModel, setHasModel] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function load() {
    if (!codigoIe) { setHasModel(false); setAlumnos([]); setResumen(null); return; }
    // EM 2022 guarda la IE como entero; el modelo del colegio acepta ambos
    // formatos, pero normalizamos para consistencia.
    const ie = String(parseInt(codigoIe, 10));
    setIsLoading(true);
    setError(null);
    try {
      const [resRes, predRes] = await Promise.all([
        fetch(`${apiUrl}/v1/colegio/${ie}/resumen`),
        fetch(`${apiUrl}/v1/colegio/${ie}/predicciones`),
      ]);
      if (resRes.status === 404 || predRes.status === 404) {
        setHasModel(false);
        setAlumnos([]);
        setResumen(null);
        return;
      }
      if (resRes.ok) {
        setResumen(await resRes.json());
        setHasModel(true);
      }
      if (predRes.ok) {
        const data = await predRes.json();
        setAlumnos((data.predicciones ?? []) as AlumnoColegio[]);
      }
    } catch {
      setError("connection");
      setHasModel(false);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoIe]);

  return { alumnos, resumen, hasModel, isLoading, error, reload: load };
}
