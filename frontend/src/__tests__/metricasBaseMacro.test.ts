import { mejoraMacroSobreBase, formatearMejora } from "@/lib/metricasBase";

test("la base macro se calcula sobre la clase mayoritaria real, no sobre los clasificados", () => {
  const resultado = mejoraMacroSobreBase(.8037950664136622,75/341)!;
  // Predecir siempre «sin riesgo»: VN=266, FN=75, VP=FP=0.
  expect(resultado.base).toBeCloseTo((2*266/(2*266+75)+0)/2,12);
  expect(formatearMejora(resultado.mejora)).toBe("+36.6 pts");
  expect(mejoraMacroSobreBase(.8037950664136622,266/341)?.base).toBeCloseTo(resultado.base,12);
});

test("sin ambas clases o sin F1 no presenta una mejora macro", () => {
  for (const tasa of [null,undefined,0,1,-.1,1.1]) expect(mejoraMacroSobreBase(.8,tasa)).toBeNull();
  expect(mejoraMacroSobreBase(null,.22)).toBeNull();
});
