/**
 * Superadmin → pestaña «Modelos»: con el modelo nacional EM2022 apagado el superadmin entraba y no veía
 * ninguna métrica de los colegios. Se renderiza la vista tal como la recibe, con los datos de los 4 colegios
 * con modelo propio, y se comprueba que cada colegio aparece con sus porcentajes y que los estados
 * (cargando, sin modelos, error, lista incompleta) se avisan en vez de dejar la pantalla en blanco.
 */
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ModelosColegios } from "@/views/modelo/ModelosColegios";
import { navItems } from "@/lib/constants";
import type { ColegioModelSummary } from "@/hooks/useColegioModels";

(globalThis as unknown as { React: unknown }).React = React;

function modelo(over: Partial<ColegioModelSummary>): ColegioModelSummary {
  return {
    codigo_ie: "249", nombre_colegio: "Joseph And Mery",
    n_alumnos: 103, n_riesgo: 30, pct_riesgo: 29.1, n_alto: 10, n_medio: 20, n_bajo: 73,
    auc_cv: 0.91, auc_train: 0.97, f1_train: 0.8, precision_train: 0.78, recall_train: 0.82, accuracy_train: 0.88,
    n_splits_cv: 5, modo_prediccion: "pronostico", tipo_resultado: "pronostico", trained_at: "2026-11-04T10:00:00Z",
    ...over,
  };
}

const COLEGIOS = [
  modelo({}),
  modelo({ codigo_ie: "831305", nombre_colegio: "Cole Andres Avelino Trapiche", n_alumnos: 182, n_riesgo: 90, pct_riesgo: 49.5, n_alto: 40, n_medio: 50, n_bajo: 92, auc_cv: 0.9637 }),
  modelo({ codigo_ie: "864785", nombre_colegio: "Cole Rafael Hoyos La Victoria", n_alumnos: 83, n_riesgo: 20, pct_riesgo: 24.1, n_alto: 5, n_medio: 15, n_bajo: 63, auc_cv: 0.9009 }),
  modelo({ codigo_ie: "9001", nombre_colegio: "Cole Andres Avelino La Perla", n_alumnos: 58, n_riesgo: 12, pct_riesgo: 20.7, n_alto: 2, n_medio: 10, n_bajo: 46, auc_cv: 0.62, tipo_resultado: "cierre_anual" }),
];

function render(over: Partial<React.ComponentProps<typeof ModelosColegios>> = {}) {
  return renderToStaticMarkup(createElement(ModelosColegios, {
    models: COLEGIOS, isLoading: false, failed: 0, loadError: false, onReload: () => {}, ...over,
  }));
}

describe("Superadmin: pestaña de modelos de colegio", () => {
  test("el superadmin tiene la pestaña aunque el modelo nacional EM2022 esté apagado", () => {
    const item = navItems.find((n) => n.id === "modelo");
    expect(item).toBeDefined();
    expect(item?.roles).toEqual(["superadmin"]);
  });

  test("lista los 4 colegios con alumnos, % en riesgo y AUC CV", () => {
    const html = render();
    for (const c of COLEGIOS) {
      expect(html).toContain(c.nombre_colegio);
      expect(html).toContain(`IE ${c.codigo_ie}`);
    }
    expect(html).toContain("29.1%");
    expect(html).toContain("49.5%");
    expect(html).toContain("96.4%"); // AUC CV 0.9637 con el formato del resto de la app (pct)
    expect(html).toContain("Cierre anual");
  });

  test("resumen de arriba: nº de colegios, alumnos y % en riesgo del total", () => {
    const html = render();
    expect(html).toContain("Colegios con modelo");
    // 103 + 182 + 83 + 58 = 426 alumnos; 30 + 90 + 20 + 12 = 152 en riesgo → 35,7 %
    expect(html).toContain("426");
    expect(html).toContain("35.7%");
    expect(html).toContain("152 de 426 alumnos");
  });

  test("el AUC bajo se pinta en rojo y el alto en verde", () => {
    const html = render();
    expect(html).toContain("#fee2e2"); // 62 % < 70 %
    expect(html).toContain("#dcfce7"); // ≥ 85 %
  });

  test("mientras carga no muestra tabla ni «sin modelos»", () => {
    const html = render({ models: [], isLoading: true });
    expect(html).toContain("Cargando los modelos");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("Todavía no hay colegios");
  });

  test("sin colegios con modelo lo dice", () => {
    const html = render({ models: [] });
    expect(html).toContain("Todavía no hay colegios con modelo propio");
    expect(html).not.toContain("<table");
  });

  test("si no se pudo listar los colegios avisa y ofrece reintentar", () => {
    const html = render({ models: [], loadError: true });
    expect(html).toContain("No se pudo obtener la lista de colegios");
    expect(html).toContain("Reintentar");
    expect(html).not.toContain("Todavía no hay colegios");
  });

  test("si falta algún colegio por leer, avisa que la lista está incompleta", () => {
    const html = render({ failed: 1 });
    expect(html).toContain("No se pudo leer 1 colegio");
    expect(html).toContain("incompleta");
    expect(html).toContain("Cole Andres Avelino Trapiche"); // los demás se siguen mostrando
  });
});
