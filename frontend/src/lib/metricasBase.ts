/**
 * Comparar el F1 de colegios distintos no es justo: el F1 depende de cuántos alumnos están en riesgo. Si el 60 % de
 * un colegio terminó en riesgo, basta con decir «todos están en riesgo» para sacar un F1 de 75 %; si solo el 22 %
 * terminó en riesgo, ese mismo truco da 36 %. Por eso se compara cada F1 contra lo que saldría SIN modelo.
 */

/** F1 que saldría marcando a TODOS los alumnos como «en riesgo»: 2p / (1 + p), con p = proporción realmente en riesgo. */
export function f1SinModelo(tasaBase: number): number {
  return (2 * tasaBase) / (1 + tasaBase);
}

export type MejoraSobreBase = {
  /** F1 sin modelo (0-1). */
  base: number;
  /** Puntos de F1 (0-1) que el modelo añade sobre `base`; se muestra ×100 como «puntos». */
  mejora: number;
};

/** null si falta el F1 o la proporción real de riesgo, o si esta no permite calcular (0 % o 100 %). */
export function mejoraSobreBase(f1: number | null | undefined, tasaBase: number | null | undefined): MejoraSobreBase | null {
  if (f1 == null || tasaBase == null || !(tasaBase > 0 && tasaBase < 1)) return null;
  const base = f1SinModelo(tasaBase);
  return { base, mejora: f1 - base };
}

/** «+26.9 pts» / «-3.0 pts». */
export function formatearMejora(mejora: number): string {
  const puntos = 100 * mejora;
  return `${puntos >= 0 ? "+" : "-"}${Math.abs(puntos).toFixed(1)} pts`;
}
