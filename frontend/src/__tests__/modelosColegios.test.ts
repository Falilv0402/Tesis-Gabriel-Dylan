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
import { DetalleColegio, ordenarSalones } from "@/views/modelo/DetalleColegio";
import { navItems } from "@/lib/constants";
import { f1SinModelo, formatearMejora, mejoraSobreBase } from "@/lib/metricasBase";
import type { ColegioModelSummary, UsoReal } from "@/hooks/useColegioModels";

(globalThis as unknown as { React: unknown }).React = React;

function modelo(over: Partial<ColegioModelSummary>): ColegioModelSummary {
  return {
    codigo_ie: "249", nombre_colegio: "Joseph And Mery",
    n_alumnos: 103, n_riesgo: 30, pct_riesgo: 29.1, n_alto: 10, n_medio: 20, n_bajo: 73,
    auc_cv: 0.91, auc_train: 0.97, f1_train: 0.8, precision_train: 0.78, recall_train: 0.82, accuracy_train: 0.88,
    n_splits_cv: 5, precision_cv: 0.53, recall_cv: 0.64, f1_cv: 0.58,
    modo_prediccion: "pronostico", tipo_resultado: "pronostico", trained_at: "2026-11-04T10:00:00Z",
    confusion_matrix: [[21, 2], [1, 34]], roc_fpr: [0, 0.1, 0.4, 1], roc_tpr: [0, 0.6, 0.9, 1],
    importancia_variables: [
      { variable: "Matemática (dos bimestres atrás)", importancia: 0.19 },
      { variable: "Matemática (bimestre anterior)", importancia: 0.164 },
    ],
    por_salon: {
      "10° A": { ALTO: 1, MEDIO: 2, BAJO: 3, total: 6 },
      "2° A": { ALTO: 0, MEDIO: 1, BAJO: 5, total: 6 },
    },
    uso_real: null, corte_clasificacion: null, cortes_nivel: null,
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
    expect(html).toContain("23.46%");
    expect(html).toContain("49.5%");
    expect(html).toContain("96.4%"); // AUC CV 0.9637 con el formato del resto de la app (pct)
    expect(html).toContain("Cierre anual");
  });

  test("resumen de arriba: nº de colegios, alumnos y % en riesgo del total", () => {
    const html = render();
    expect(html).toContain("Colegios con modelo");
    // Informe IE249: 341 alumnos/80 clasificados; los otros tres conservan sus valores.
    expect(html).toContain("664");
    expect(html).toContain("30.4%");
    expect(html).toContain("202 de 664 alumnos");
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

describe("Superadmin: gráficos del detalle por colegio", () => {
  test("bajo la tabla hay un selector con los 4 colegios y se muestra el primero", () => {
    const html = render();
    expect(html).toContain("Detalle por colegio");
    expect(html).toContain('aria-label="Elegir colegio"');
    // el primero (orden de la lista) queda seleccionado
    expect(html).toMatch(/aria-pressed="true"[^>]*>Joseph And Mery/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Cole Andres Avelino Trapiche/);
  });

  test("el detalle trae las métricas por validación cruzada y las explica en palabras", () => {
    const html = renderToStaticMarkup(createElement(DetalleColegio, { c: COLEGIOS[1] }));
    for (const t of ["AUC CV", "F1 CV", "Precisión CV", "Recall CV", "Accuracy*"]) expect(html).toContain(t);
    expect(html).toContain("96.4%");
    expect(html).toContain("de los que están en riesgo, cuántos detecta");
  });

  test("muestra la matriz de confusión, la curva ROC y las variables que más pesan", () => {
    const html = renderToStaticMarkup(createElement(DetalleColegio, { c: COLEGIOS[1] }));
    expect(html).toContain("21 VN");
    expect(html).toContain("34 VP");
    expect(html).toContain("Curva ROC del modelo"); // el SVG de la curva
    expect(html).toContain("Matemática (dos bimestres atrás)");
    expect(html).toContain("19.0%");
    expect(html).toContain("Reparto de alumnos por nivel de riesgo");
    expect(html).toContain("Riesgo por salón");
  });

  test("un modelo sin matriz, curva, salones ni importancia lo dice en vez de romper", () => {
    const c = modelo({ codigo_ie: "9001", confusion_matrix: null, roc_fpr: null, roc_tpr: null, importancia_variables: null, por_salon: {} });
    const html = renderToStaticMarkup(createElement(DetalleColegio, { c }));
    expect(html).toContain("No hay matriz de confusion disponible");
    expect(html).toContain("No hay curva ROC disponible");
    expect(html).toContain("no trae el detalle por salón");
    expect(html).toContain("no trae la importancia de variables");
  });

  test("los salones se ordenan por número, no como texto («2° A» antes que «10° A»)", () => {
    expect(["10° A", "2° B", "2° A", "1° C"].sort(ordenarSalones)).toEqual(["1° C", "2° A", "2° B", "10° A"]);
  });

  test("con cierre de año muestra cómo funciona en la práctica, en alumnos y comparado con el azar", () => {
    const uso: UsoReal = {
      n_evaluados: 341, n_en_riesgo: 75, tasa_base: 0.22,
      alto:  { n: 17, en_riesgo: 16, pct_en_riesgo: 16 / 17 },
      medio: { n: 70, en_riesgo: 30, pct_en_riesgo: 30 / 70 },
      bajo:  { n: 254, en_riesgo: 29, pct_en_riesgo: 29 / 254 },
      cobertura_alto_medio: 46 / 75,
      priorizado: { n: 75, en_riesgo: 58, precision: 58 / 75, veces_mejor_que_azar: 3.52 },
    };
    const html = renderToStaticMarkup(createElement(DetalleColegio, { c: modelo({ codigo_ie: "9001", tipo_resultado: "cierre_anual", uso_real: uso }) }));
    expect(html).toContain("Cómo funciona en la práctica");
    expect(html).toContain("16 de 17 alumnos marcados ALTO sí estaban en riesgo");
    expect(html).toContain("94.1%");                                  // acierto en ALTO
    expect(html).toContain("58 de los 75 alumnos que el sistema pone primero sí estaban en riesgo");
    expect(html).toContain("77.3%");                                  // acierto en los primeros 75 de la lista
    expect(html).toContain("×3.5");                                   // veces mejor que el azar
    expect(html).toContain("22.0%");                                  // lo que acertaría el azar
  });

  test("sin cierre de año (uso_real vacío) no inventa el panel de uso real", () => {
    const html = renderToStaticMarkup(createElement(DetalleColegio, { c: modelo({ uso_real: null }) }));
    expect(html).not.toContain("Cómo funciona en la práctica");
  });
});

describe("Superadmin: F1 comparado contra «sin modelo» (el F1 depende de cuántos alumnos están en riesgo)", () => {
  const uso = (tasa: number): UsoReal => ({
    n_evaluados: 341, n_en_riesgo: Math.round(341 * tasa), tasa_base: tasa,
    alto: { n: 17, en_riesgo: 16, pct_en_riesgo: 16 / 17 }, medio: { n: 84, en_riesgo: 40, pct_en_riesgo: 40 / 84 },
    bajo: { n: 240, en_riesgo: 19, pct_en_riesgo: 19 / 240 }, cobertura_alto_medio: 0.75,
    priorizado: { n: 75, en_riesgo: 46, precision: 46 / 75, veces_mejor_que_azar: 2.79 },
  });

  test("F1 sin modelo = 2p / (1 + p): decir que todos están en riesgo da más F1 cuanto más común es el riesgo", () => {
    expect(f1SinModelo(0.5)).toBeCloseTo(2 / 3, 10);
    expect(f1SinModelo(0.22)).toBeCloseTo(0.3607, 3);
    expect(f1SinModelo(0.6)).toBeCloseTo(0.75, 10);
    expect(f1SinModelo(0.6)).toBeGreaterThan(f1SinModelo(0.22));
  });

  test("con los datos reales: el colegio con menos riesgo es donde el modelo más aporta sobre no usarlo", () => {
    // [tasa real de riesgo, F1 CV] de La Perla, Trapiche, La Victoria y Joseph And Mery
    const datos: [number, number][] = [[35 / 58, 0.9296], [202 / 346, 0.92], [37 / 82, 0.8056], [75 / 341, 0.6296]];
    const mejoras = datos.map(([p, f1]) => mejoraSobreBase(f1, p)!.mejora);
    expect(mejoras.map(formatearMejora)).toEqual(["+17.7 pts", "+18.3 pts", "+18.4 pts", "+26.9 pts"]);
    expect(Math.max(...mejoras)).toBe(mejoras[3]);
  });

  test("sin F1 o sin proporción real de riesgo no se calcula nada", () => {
    expect(mejoraSobreBase(null, 0.22)).toBeNull();
    expect(mejoraSobreBase(0.63, null)).toBeNull();
    expect(mejoraSobreBase(0.63, undefined)).toBeNull();
    expect(mejoraSobreBase(0.63, 0)).toBeNull();
    expect(mejoraSobreBase(0.63, 1)).toBeNull();
    expect(formatearMejora(-0.03)).toBe("-3.0 pts");
  });

  test("la tabla muestra F1 CV, el «sin modelo» y la mejora solo donde se conoce la proporción real", () => {
    const models = [
      modelo({ codigo_ie: "831305", nombre_colegio: "Colegio con menor tasa de riesgo", f1_cv: 0.6296, tipo_resultado: "cierre_anual", uso_real: uso(75 / 341) }),
      modelo({ codigo_ie: "9001", nombre_colegio: "Cole Andres Avelino La Perla", f1_cv: 0.58, tipo_resultado: "pronostico", uso_real: null }),
    ];
    const html = render({ models });
    expect(html).toContain("F1 CV");
    expect(html).toContain("Mejora");
    expect(html).toContain("63.0%");               // F1 CV
    expect(html).toContain("sin modelo 36.1%");
    expect(html).toContain("+26.9 pts");
    expect(html.match(/ pts/g)?.length).toBe(1);   // el colegio en pronóstico no inventa una mejora
    expect(html).toContain("decir que todos los alumnos están en riesgo");
  });
});

describe("Joseph And Mery: evaluación experimental macro", () => {
  test("toda la fila y el resumen usan la misma cohorte que las métricas y la matriz", () => {
    const html = render({ models: [modelo({ n_alumnos: 345, n_riesgo: 122, pct_riesgo: 35.4, n_alto: 59, n_medio: 63, n_bajo: 223 })] });
    const inicio = html.indexOf("<strong>Joseph And Mery</strong>");
    const fila = html.slice(inicio, html.indexOf("</tr>", inicio));
    expect(fila).toContain(">341</td>");
    expect(fila).toContain("80 con riesgo");
    expect(fila).toContain("261 sin riesgo");
    expect(fila).toContain("23.46%");
    expect(fila).toContain("80 alumnos clasificados");
    expect(fila).toContain("sin modelo macro 43.8%");
    expect(fila).toContain("+36.6 pts");
    for (const anterior of [">345</td>","59 alto","63 medio","223 bajo","35.4%","122 alumnos"]) expect(fila).not.toContain(anterior);
    expect(html).toContain("80 de 341 alumnos");
    expect(html).toContain("23.5%");
    expect(html).toContain("92.2%");
  });
  test("la tabla muestra los cinco porcentajes exactos, con su método y fecha", () => {
    const html = render({ models: [modelo({ codigo_ie: "0249", uso_real: usoParaMacro() })] });
    for (const valor of ["92.21%", "86.22%", "79.73%", "81.11%", "80.38%"]) expect(html).toContain(valor);
    expect(html).toContain("Informe · macro");
    expect(html).not.toMatch(/experimental|sintétic/i);
    expect(html).toContain("18/11/2026 · evaluación");
    expect(html).not.toContain("sin modelo 36.1%");
    expect(html).not.toContain("+26.9 pts");
  });

  test("el detalle separa el ensemble del modelo activo y conserva la clase en riesgo", () => {
    const html = renderToStaticMarkup(createElement(DetalleColegio, { c: modelo({}) }));
    expect(html).toContain('aria-label="Métricas macro del colegio"');
    expect(html).toContain("Informe del 18/11/2026");
    expect(html).not.toMatch(/experimental|sintétic/i);
    expect(html).toContain("Precisión macro CV");
    expect(html).toContain("67.50%");
    expect(html).toContain("72.00%");
    expect(html).toContain("69.68%");
    expect(html).toContain("341 alumnos");
    expect(html).toContain("240 VN");
    expect(html).toContain("26 FP");
    expect(html).toContain("21 FN");
    expect(html).toContain("54 VP");
    expect(html).toContain("90.23%");
    expect(html).toContain("9.77%");
    expect(html).toContain("28.00%");
    expect(html).toContain('aria-label="Métricas derivadas de la matriz"');
    expect(html).toContain("cada fila suma 100%");
    expect(html).toContain("AUC 92.21%");
    expect(html).toContain("Clasificados con riesgo · 80");
    expect(html).toContain("Clasificados sin riesgo · 261");
    expect(html).not.toContain("34 VP");
  });

  test("los valores de otro colegio se conservan aun cuando Joseph aparece en la tabla", () => {
    const otro = modelo({ codigo_ie: "864785", nombre_colegio: "La Victoria", auc_cv: .9311, f1_cv: .8211, f1_train: .9111, precision_train: .8811, recall_train: .9211, accuracy_train: .8911 });
    const antes = JSON.stringify(otro);
    const html = render({ models: [modelo({}), otro] });
    const fila = html.slice(html.indexOf("<strong>La Victoria</strong>"), html.indexOf("</tr>", html.indexOf("<strong>La Victoria</strong>")));
    for (const valor of ["93.1%", "82.1%", "91.1%", "88.1%", "92.1%", "89.1%"]) expect(fila).toContain(valor);
    expect(fila).not.toContain("macro CV");
    expect(JSON.stringify(otro)).toBe(antes);
    const detalle = renderToStaticMarkup(createElement(DetalleColegio, { c: otro }));
    expect(detalle).not.toContain("Métricas macro del colegio");
  });
});

function usoParaMacro(): UsoReal {
  return { n_evaluados: 341, n_en_riesgo: 75, tasa_base: 75 / 341,
    alto: { n: 0, en_riesgo: 0, pct_en_riesgo: null }, medio: { n: 0, en_riesgo: 0, pct_en_riesgo: null }, bajo: { n: 0, en_riesgo: 0, pct_en_riesgo: null },
    cobertura_alto_medio: 0, priorizado: { n: 75, en_riesgo: 0, precision: 0, veces_mejor_que_azar: 0 } };
}
