import informe from "@/data/evaluacion-joseph-mary.json";

/** Instantánea del informe experimental. No reemplaza las métricas del API. */
export function evaluacionColegio(codigoIe: string | null | undefined) {
  const codigo = codigoIe?.trim();
  if (!codigo || !/^\d+$/.test(codigo) || codigo.replace(/^0+/, "") !== informe.codigo_ie) return null;
  return informe.ensemble;
}

export function porcentajeEvaluacion(value: number): string {
  return `${(100 * value).toFixed(2)}%`;
}
