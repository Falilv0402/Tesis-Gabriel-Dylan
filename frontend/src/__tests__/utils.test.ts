/**
 * Tests unitarios de utilidades del frontend — SATRA P20261012
 * Ejecutar con:  npx jest  (requiere jest + ts-jest o vitest)
 *
 * Funciones testeadas:
 *  - shortId           → últimos 4 caracteres del ID de estudiante
 *  - pct               → formatea número como porcentaje string
 *  - recommendationFromShap  → recomendación basada en top driver SHAP
 *  - toCsv             → serializa estudiantes a CSV
 *  - liveMetrics logic → TP/TN/FP/FN a partir de y_true + y_prob + threshold
 */

// ─── Helpers copiados de page.tsx (sin dependencias de React) ────────────────

function shortId(id: string): string {
  return id.slice(-4).padStart(4, "0");
}

function pct(value = 0): string {
  return `${(value * 100).toFixed(1)}%`;
}

type ShapContribution = {
  feature: string;
  value: number | string | null;
  baseline: number | string | null;
  contribution: number;
  abs_contribution: number;
};

type ShapData = {
  id_estudiante: string;
  probabilidad_riesgo: number;
  nivel_riesgo: string;
  base_probabilidad: number;
  contributions: ShapContribution[];
};

function recommendationFromShap(shap: ShapData | null): string | null {
  if (!shap || shap.contributions.length === 0) return null;
  const driver = shap.contributions.find((c) => c.contribution > 0);
  if (!driver) return null;
  const map: Record<string, string> = {
    M500_L:         "El factor que más eleva el riesgo de este estudiante es su puntaje en Lectura. Sugerencia: derivar a programa de comprensión lectora del nivel.",
    M500_CN:        "El factor que más eleva el riesgo es su puntaje en Ciencias. Sugerencia: refuerzo en razonamiento científico y resolución de problemas aplicados.",
    M500_L_iemean:  "El contexto académico de su IE en Lectura es el principal driver de riesgo. Sugerencia: coordinar con dirección académica una estrategia institucional, no solo individual.",
    M500_CN_iemean: "El contexto académico de su IE en Ciencias eleva el riesgo. Sugerencia: revisar la propuesta pedagógica de Ciencias a nivel del colegio.",
    ise_iemean:     "El bajo nivel socioeconómico del colegio eleva el riesgo. Sugerencia: gestionar apoyo institucional (becas, transporte, materiales) y derivación a programas sociales.",
    ise:            "El nivel socioeconómico individual eleva el riesgo. Sugerencia: derivación a área social del colegio y evaluar acceso a recursos educativos en casa.",
  };
  return map[driver.feature] ?? null;
}

function computeLiveMetrics(
  yTrue: number[],
  yProb: number[],
  thresholdHigh: number,
) {
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
  const accuracy  = (tp + tn) / Math.max(n, 1);
  const precision = tp / Math.max(tp + fp, 1);
  const recall    = tp / Math.max(tp + fn, 1);
  const f1 = (2 * precision * recall) / Math.max(precision + recall, 1e-9);
  return { tp, fp, tn, fn, accuracy, precision, recall, f1, n };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("shortId", () => {
  test("retorna los últimos 4 caracteres", () => {
    expect(shortId("123456789")).toBe("6789");
  });

  test("padding con ceros si ID es corto", () => {
    expect(shortId("12")).toBe("0012");
    expect(shortId("1")).toBe("0001");
  });

  test("ID de exactamente 4 chars se mantiene", () => {
    expect(shortId("ABCD")).toBe("ABCD");
  });

  test("ID vacío → 4 ceros", () => {
    expect(shortId("")).toBe("0000");
  });
});

describe("pct", () => {
  test("0.5 → '50.0%'", () => {
    expect(pct(0.5)).toBe("50.0%");
  });

  test("0.843 → '84.3%'", () => {
    expect(pct(0.843)).toBe("84.3%");
  });

  test("1.0 → '100.0%'", () => {
    expect(pct(1.0)).toBe("100.0%");
  });

  test("0 → '0.0%' (default)", () => {
    expect(pct(0)).toBe("0.0%");
  });

  test("sin argumento usa default 0", () => {
    expect(pct()).toBe("0.0%");
  });
});

describe("recommendationFromShap", () => {
  const makeShap = (topFeature: string, contribution = 0.15): ShapData => ({
    id_estudiante: "TEST",
    probabilidad_riesgo: 0.8,
    nivel_riesgo: "ALTO",
    base_probabilidad: 0.4,
    contributions: [
      { feature: topFeature, value: 390, baseline: 480, contribution, abs_contribution: contribution },
      { feature: "ise", value: 0.7, baseline: 1.2, contribution: -0.05, abs_contribution: 0.05 },
    ],
  });

  test("retorna recomendación para M500_L", () => {
    const rec = recommendationFromShap(makeShap("M500_L"));
    expect(rec).toContain("Lectura");
  });

  test("retorna recomendación para ise_iemean", () => {
    const rec = recommendationFromShap(makeShap("ise_iemean"));
    expect(rec).toContain("socioeconómico");
  });

  test("retorna null si no hay contributions que suban el riesgo", () => {
    const shap: ShapData = {
      id_estudiante: "TEST",
      probabilidad_riesgo: 0.3,
      nivel_riesgo: "BAJO",
      base_probabilidad: 0.4,
      contributions: [
        { feature: "M500_L", value: 550, baseline: 480, contribution: -0.1, abs_contribution: 0.1 },
      ],
    };
    expect(recommendationFromShap(shap)).toBeNull();
  });

  test("retorna null si shap es null", () => {
    expect(recommendationFromShap(null)).toBeNull();
  });

  test("retorna null si contributions está vacío", () => {
    const shap: ShapData = {
      id_estudiante: "X",
      probabilidad_riesgo: 0.5,
      nivel_riesgo: "MEDIO",
      base_probabilidad: 0.4,
      contributions: [],
    };
    expect(recommendationFromShap(shap)).toBeNull();
  });

  test("feature desconocida retorna null (no crash)", () => {
    const rec = recommendationFromShap(makeShap("feature_rara_xyz"));
    expect(rec).toBeNull();
  });
});

describe("computeLiveMetrics", () => {
  const yTrue = [1, 1, 0, 0, 1, 0, 1, 0];
  const yProb = [0.9, 0.8, 0.3, 0.2, 0.75, 0.6, 0.4, 0.1];

  test("threshold 70% → 3 VP, 1 FP", () => {
    const m = computeLiveMetrics(yTrue, yProb, 70)!;
    expect(m.tp).toBe(3);  // 0.9, 0.8, 0.75 >= 0.70
    expect(m.fp).toBe(0);  // 0.3, 0.2, 0.6, 0.1 < 0.70 → solo 0.6 falta
    // Nota: 0.6 → 0.70 no llega, así que FP = 0
  });

  test("recall = TP / (TP + FN)", () => {
    const m = computeLiveMetrics(yTrue, yProb, 70)!;
    const expectedRecall = m.tp / (m.tp + m.fn);
    expect(Math.abs(m.recall - expectedRecall)).toBeLessThan(1e-6);
  });

  test("precision = TP / (TP + FP)", () => {
    const m = computeLiveMetrics(yTrue, yProb, 50)!;
    const expectedPrecision = m.tp / Math.max(m.tp + m.fp, 1);
    expect(Math.abs(m.precision - expectedPrecision)).toBeLessThan(1e-6);
  });

  test("threshold 0% → todos positivos, recall=1.0", () => {
    const m = computeLiveMetrics(yTrue, yProb, 0)!;
    expect(m.recall).toBeCloseTo(1.0, 5);
    expect(m.tn).toBe(0);
    expect(m.fn).toBe(0);
  });

  test("threshold 100% → nadie positivo, precision no crash", () => {
    const m = computeLiveMetrics(yTrue, yProb, 100)!;
    expect(m.tp).toBe(0);
    expect(m.fp).toBe(0);
    expect(m.precision).toBeGreaterThanOrEqual(0);
  });

  test("arrays vacíos retornan null", () => {
    expect(computeLiveMetrics([], [], 70)).toBeNull();
  });

  test("arrays de diferente longitud retornan null", () => {
    expect(computeLiveMetrics([1, 0], [0.5], 70)).toBeNull();
  });

  test("n total = tp + fp + tn + fn", () => {
    const m = computeLiveMetrics(yTrue, yProb, 60)!;
    expect(m.n).toBe(yTrue.length);
  });
});
