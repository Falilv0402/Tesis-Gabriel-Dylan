/**
 * CP059 (Mantis 28448/28449/28451): «Exportación exitosa» del listado de estudiantes en riesgo. El PDF del colegio cortaba
 * la lista en 120 alumnos: con riesgo ALTO en IE 831305 (182 alumnos) salía incompleto. Aquí se ejecuta el generador real
 * y se lee la tabla que se le entrega al PDF. jsPDF y autoTable se sustituyen por registradores.
 */
import type { AlumnoColegio } from "@/types";

type OpcionesTabla = { head: string[][]; body: (string | number)[][] };
const mockTablas: OpcionesTabla[] = [];
const mockTextos: string[] = [];

jest.mock("jspdf", () => {
  class PdfFalso {
    internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 } };
    text(t: unknown) { mockTextos.push(Array.isArray(t) ? t.join(" ") : String(t)); return this; }
    save() { /* no escribe archivos */ }
    constructor() {
      return new Proxy(this, { get: (o, k) => (k in o ? (o as never)[k] : () => o) });
    }
  }
  return { __esModule: true, default: PdfFalso };
});
jest.mock("jspdf-autotable", () => ({
  __esModule: true,
  default: (doc: { lastAutoTable?: { finalY: number } }, opciones: OpcionesTabla) => {
    mockTablas.push(opciones);
    doc.lastAutoTable = { finalY: 200 };   // tabla que termina casi al borde de la página
  },
}));

import { exportColegioPdf } from "@/lib/colegioPdfExport";

function alumnosAlto(n: number): AlumnoColegio[] {
  return Array.from({ length: n }, (_, i) => ({
    n_alumno: i + 1, nombre: `Estudiante ${String(i + 1).padStart(6, "0")}`, salon: "2C", codigo_ie: "831305",
    nivel_riesgo: "ALTO", prob_riesgo: 0.9, conducta_promedio: 15,
    b1_matematica: 11, b1_comunicacion: 13,
  } as unknown as AlumnoColegio));
}

describe("CP059 — PDF del reporte del colegio con el filtro «Nivel de riesgo = ALTO»", () => {
  beforeEach(() => { mockTablas.length = 0; mockTextos.length = 0; });

  test("incluye a los 182 alumnos del filtro, no solo los primeros 120", () => {
    const alto = alumnosAlto(182);
    exportColegioPdf("IE 831305", alto, alto, "1", "prueba@satraapp.com");
    expect(mockTablas).toHaveLength(1);
    expect(mockTablas[0].body).toHaveLength(182);
    expect(mockTablas[0].body[181][1]).toBe("Estudiante 000182");
  });

  test("no muestra ninguna nota de listado cortado", () => {
    const alto = alumnosAlto(182);
    exportColegioPdf("IE 831305", alto, alto, "1", "prueba@satraapp.com");
    expect(mockTextos.some((t) => /primeros 120|Mostrando los primeros/i.test(t))).toBe(false);
  });

  test("con la lista vacía genera igual la tabla, solo con encabezados", () => {
    exportColegioPdf("IE 831305", [], alumnosAlto(3), "1", "prueba@satraapp.com");
    expect(mockTablas[0].body).toHaveLength(0);
    expect(mockTablas[0].head[0].length).toBeGreaterThan(5);
  });
});
