import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfusionMatrix } from "@/components/charts/ConfusionMatrix";

(globalThis as unknown as { React: unknown }).React = React;

test("los porcentajes se calculan por clase real y conservan los cuatro conteos", () => {
  const html = renderToStaticMarkup(React.createElement(ConfusionMatrix, { matrix: [[240, 26], [21, 54]], showPercentages: true }));
  for (const value of ["240 VN", "26 FP", "21 FN", "54 VP", "90.23%", "9.77%", "28.00%", "72.00%"])
    expect(html).toContain(value);
});

test("los demás colegios conservan la matriz sin porcentajes por defecto", () => {
  const html = renderToStaticMarkup(React.createElement(ConfusionMatrix, { matrix: [[21, 2], [1, 34]] }));
  for (const value of ["21 VN", "2 FP", "1 FN", "34 VP"]) expect(html).toContain(value);
  expect(html).not.toContain("%");
  expect(html).not.toContain("rgba");
});

test("una clase sin alumnos no muestra un porcentaje indefinido", () => {
  const html = renderToStaticMarkup(React.createElement(ConfusionMatrix, { matrix: [[0, 0], [1, 3]], showPercentages: true }));
  expect(html).toContain("Sin alumnos");
  expect(html).toContain("75.00%");
  expect(html).not.toMatch(/NaN|Infinity/);
});
