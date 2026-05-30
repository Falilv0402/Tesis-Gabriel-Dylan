"use client";

import { useState, useEffect } from "react";
import type { AlumnoColegio, ColegioResumen } from "@/types";
import { apiUrl } from "@/lib/constants";

export function useMiColegio(codigoIe: string | null) {
  const [alumnos,     setAlumnos]     = useState<AlumnoColegio[]>([]);
  const [resumen,     setResumen]     = useState<ColegioResumen | null>(null);
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [salonFilter, setSalonFilter] = useState<string>("Todos");
  const [nivelFilter, setNivelFilter] = useState<string>("Todos");

  async function loadAlumnos() {
    if (!codigoIe) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (salonFilter !== "Todos") params.set("salon", salonFilter);
      if (nivelFilter !== "Todos") params.set("nivel", nivelFilter);

      const [resRes, predRes] = await Promise.all([
        fetch(`${apiUrl}/v1/colegio/${codigoIe}/resumen`),
        fetch(`${apiUrl}/v1/colegio/${codigoIe}/predicciones?${params}`),
      ]);

      if (resRes.status === 404 || predRes.status === 404) {
        setError("no_data");
        setAlumnos([]);
        setResumen(null);
        return;
      }

      if (resRes.ok)  setResumen(await resRes.json());
      if (predRes.ok) {
        const data = await predRes.json();
        setAlumnos(data.predicciones ?? []);
      }
    } catch {
      setError("connection");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAlumnos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoIe, salonFilter, nivelFilter]);

  const salones = resumen ? Object.keys(resumen.por_salon) : [];

  return {
    alumnos, resumen, isLoading, error,
    salonFilter, setSalonFilter,
    nivelFilter, setNivelFilter,
    salones, loadAlumnos,
  };
}
