/**
 * CP045 (Mantis 28477): «Registrar» no estaba deshabilitado sin alumno seleccionado y el clic guardaba una intervención
 * para otro alumno. Causa: al elegir «Seleccionar alumno…» la aplicación volvía sola al alumno de mayor riesgo, así que
 * siempre había un alumno «seleccionado». Aquí se renderiza el formulario real y se prueba la regla de selección.
 */
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AlumnoColegio } from "@/types";
import { SIN_ALUMNO, colegioStudentId, colegioToStudent, resolverAlumnoSeleccionado } from "@/lib/colegio";
import { recommendation } from "@/lib/format";
import { ColegioIntervencionesView } from "@/views/ColegioIntervencionesView";

(globalThis as unknown as { React: unknown }).React = React;

// 40 alumnos con riesgo decreciente: el n.° 1 es el de mayor riesgo y el n.° 35 queda fuera de los 30 primeros del selector
const alumnos: AlumnoColegio[] = Array.from({ length: 40 }, (_, i) => ({
  n_alumno: i + 1, nombre: `Estudiante ${String(i + 1).padStart(6, "0")}`, salon: "3A", codigo_ie: "831305",
  nivel_riesgo: "ALTO", prob_riesgo: 0.99 - i * 0.01, riesgo: 1, n_materias_c: 1,
}) as unknown as AlumnoColegio);

describe("resolverAlumnoSeleccionado", () => {
  test("con un alumno elegido devuelve ese alumno", () => {
    expect(resolverAlumnoSeleccionado(alumnos, colegioStudentId(alumnos[34]))?.n_alumno).toBe(35);
  });

  test("sin elección todavía (valor vacío) usa el de mayor riesgo, como siempre", () => {
    expect(resolverAlumnoSeleccionado(alumnos, "")?.n_alumno).toBe(1);
  });

  test("«sin alumno» (SIN_ALUMNO) no devuelve ninguno: ya no cae al de mayor riesgo", () => {
    expect(resolverAlumnoSeleccionado(alumnos, SIN_ALUMNO)).toBeUndefined();
  });

  test("sin alumnos cargados no devuelve ninguno", () => {
    expect(resolverAlumnoSeleccionado([], "")).toBeUndefined();
  });
});

function formulario(selectedAlumno: AlumnoColegio | undefined, authBusy = false) {
  const props = {
    role: "coordinador", alumnos, selectedAlumno, onSelectAlumno: () => {},
    tipoIntervencion: "tutoria", setTipoIntervencion: () => {}, descIntervencion: "", setDescIntervencion: () => {},
    notifScope: "ie", setNotifScope: () => {}, isSendingAlert: false, profileDistrito: "SAN MIGUEL", profileCodigoIe: "831305",
    interventions: [], interventionStats: null, authBusy, onRegistrar: () => {}, onSendAlert: () => {},
    onUpdateEstado: () => {}, onLoadInterventions: () => {},
  };
  return renderToStaticMarkup(createElement(ColegioIntervencionesView, props as never));
}
const botonRegistrar = (html: string) => /<button class="primary"[^>]*>/.exec(html)![0];

describe("CP045 — formulario «Registrar intervención»", () => {
  test("sin alumno seleccionado «Registrar» está deshabilitado", () => {
    const html = formulario(undefined);
    expect(botonRegistrar(html)).toContain("disabled");
    expect(html).toContain("Seleccionar alumno...");
  });

  test("con un alumno seleccionado «Registrar» está habilitado", () => {
    expect(botonRegistrar(formulario(alumnos[0]))).not.toContain("disabled");
  });

  test("mientras se guarda, «Registrar» se deshabilita y dice «Guardando...»", () => {
    const html = formulario(alumnos[0], true);
    expect(botonRegistrar(html)).toContain("disabled");
    expect(html).toContain("Guardando...");
  });

  test("un alumno fuera de los 30 primeros (llegó desde «Intervenir») aparece en el selector, elegido", () => {
    const html = formulario(alumnos[34]);
    expect(html).toContain(`<option value="${colegioStudentId(alumnos[34])}" selected="">`);
  });
});

describe("CP042 — descripción que se guarda cuando se deja vacía", () => {
  // Datos de un alumno ALTO de IE 831305 (Estudiante 000031, 2C): el reporte del colegio no trae promedio anual
  const estudiante000031 = {
    ...alumnos[0], n_alumno: 31, nombre: "Estudiante 000031", salon: "2C", prob_riesgo: 0.95,
    b1_matematica: 11, b2_matematica: 11.5, b3_matematica: 12.3, b1_comunicacion: 13, b2_comunicacion: 13.3, b3_comunicacion: 13,
  } as unknown as AlumnoColegio;

  test("un alumno ALTO bajo en Matemática recibe «Refuerzo en Matematica…», no el mensaje genérico", () => {
    const estudiante = colegioToStudent(estudiante000031, null);
    expect(estudiante.tipo_riesgo).toBe("Bajo en Matemática");
    expect(recommendation(estudiante)).toBe("Refuerzo en Matematica: practica guiada y seguimiento semanal del progreso.");
  });

  test("las opciones del selector «Tipo de intervención» son las reales (no existe «Tutoría individual»)", () => {
    const html = formulario(alumnos[0]);
    expect(html).toContain("Tutoría académica");
    expect(html).not.toContain("Tutoría individual");
  });
});
