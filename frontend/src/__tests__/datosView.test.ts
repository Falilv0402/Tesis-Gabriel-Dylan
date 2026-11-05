/**
 * Pantalla Datos del Administrador, renderizada de verdad (react-dom/server) con los datos que tenía cada colegio de las pruebas:
 *  - CP057 (Mantis 28444/28446/28447): «Histórico de reentrenamientos» no mostraba ningún botón de Exportar CSV.
 *  - CP074 (Mantis 28480): un colegio sin modelo entrenado debe ver «Sin modelo entrenado», no otra cosa.
 */
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DatosView } from "@/views/DatosView";

// ts-jest compila el JSX de las vistas a React.createElement: se expone React como global (Next lo hace solo).
(globalThis as unknown as { React: unknown }).React = React;

const ref = { current: null };
const modelo = {
  nombre_colegio: "Cole Andres Avelino La Perla", n_alumnos: 58, n_riesgo: 36, pct_riesgo: 62.1,
  auc_cv: 0.9702, auc_train: 0.98, f1_train: 0.9577, precision_train: 0.9444, recall_train: 0.9714,
  accuracy_train: 0.9483, n_splits_cv: 5, confusion_matrix: null, roc_fpr: null, roc_tpr: null,
  modo_prediccion: "cierre de año · validación retrospectiva (B1-B4 cargados)", salones: ["P6A"],
  trained_at: "2026-10-19T02:50:27", por_nivel: { ALTO: 33, MEDIO: 3, BAJO: 22 },
  advertencias_carga: [], importancia_variables: null,
};
const version = {
  id: "v1", version: "2026-10-19T02:50:27", created_at: "2026-10-19T02:50:27Z",
  n_alumnos: 58, n_alto: 33, n_medio: 3, n_bajo: 22, accuracy: 0.9483, auc_roc: 0.9702,
};

// recharts avisa de que no puede medir el gráfico fuera de un navegador: no afecta a lo que se comprueba
beforeAll(() => { jest.spyOn(console, "warn").mockImplementation(() => undefined); });

function pantalla(extra: Record<string, unknown>) {
  const props = {
    fileInputRef: ref, uploadResult: "", setUploadResult: () => {}, csvValidation: null, isValidating: false,
    scheduleFreq: "", setScheduleFreq: () => {}, nextUpdate: null, scheduleMsg: "", onValidateCsv: () => {}, onSaveSchedule: () => {},
    colegioFileRef: ref, colegioUploadIe: "", setColegioUploadIe: () => {}, colegioUploadStatus: "idle", colegioUploadMsg: "",
    colegioUploadResult: null, onUploadColegioExcels: () => {}, role: "admin", profileCodigoIe: "9001", setTab: () => {},
    colegioStatsCargada: true, colegioModelStats: modelo, modelosVersiones: [], colegioRespaldo: null,
    restaurandoModelo: false, onRestaurarModelo: () => {},
    ...extra,
  };
  return renderToStaticMarkup(createElement(DatosView, props as never));
}

// Recorta el HTML al botón «Exportar CSV» para mirar si está deshabilitado
const botonExportar = (html: string) => {
  const i = html.indexOf("Exportar CSV");
  const inicio = html.lastIndexOf("<button", i);
  return html.slice(inicio, i);
};

describe("CP057 — Histórico de reentrenamientos del Administrador", () => {
  test("con el histórico vacío (lo que vio el tester) el botón «Exportar CSV» ya aparece, deshabilitado y con aviso", () => {
    const html = pantalla({ modelosVersiones: [] });
    expect(html).toContain("Histórico de reentrenamientos");
    expect(html).toContain("Sin datos históricos");
    expect(html).toContain("Exportar CSV");
    expect(botonExportar(html)).toContain("disabled");
    expect(html).toContain("Se habilita en cuanto haya una versión registrada.");
  });

  test("con una versión registrada (La Perla ya tiene una) el botón «Exportar CSV» está habilitado", () => {
    const html = pantalla({ modelosVersiones: [version] });
    expect(html).toContain("Exportar CSV");
    expect(botonExportar(html)).not.toContain("disabled");
    expect(html).not.toContain("Sin datos históricos");
  });
});

describe("CP074 — colegio sin modelo entrenado (IE 999001)", () => {
  test("el Administrador ve «Colegio IE 999001 — Sin modelo entrenado» y no el ranking de variables ni el histórico", () => {
    const html = pantalla({ profileCodigoIe: "999001", colegioModelStats: null, modelosVersiones: [] });
    expect(html).toContain("Colegio IE 999001 — Sin modelo entrenado");
    expect(html).toContain("Sin modelo entrenado");
    expect(html).not.toContain("Importancia de variables");
    expect(html).not.toContain("Histórico de reentrenamientos");
  });

  test("mientras carga no dice «Sin modelo entrenado» (no se sabe aún si hay modelo)", () => {
    const html = pantalla({ profileCodigoIe: "999001", colegioModelStats: null, colegioStatsCargada: false });
    expect(html).not.toContain("Sin modelo entrenado");
  });
});
