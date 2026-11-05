/**
 * CP062 (Mantis 28434): el PDF del Estudiante 000012 (P6A, IE 864785) tomaba las notas ausentes como 0 y las metía en
 * el promedio de los factores de riesgo. Aquí se ejecuta el generador real del PDF con el registro real de ese alumno
 * y se leen las dos tablas que comparó el tester («Notas por bimestre» y «Factores de riesgo») y los textos del PDF.
 * jsPDF y autoTable se sustituyen por registradores: lo que se comprueba es qué contenido se le entrega al PDF.
 */
import type { AlumnoColegio } from "@/types";
import { colegioToStudent, factoresRiesgoColegio, tipoRiesgoColegio } from "@/lib/colegio";

type OpcionesTabla = { head: string[][]; body: (string | number)[][] };
const mockTablas: OpcionesTabla[] = [];
const mockTextos: string[] = [];

jest.mock("jspdf", () => {
  class PdfFalso {
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    text(t: unknown) { mockTextos.push(Array.isArray(t) ? t.join(" ") : String(t)); return this; }
    splitTextToSize(t: string) { return [t]; }
    save() { /* no escribe archivos */ }
    constructor() {
      // cualquier otro método de dibujo (colores, fuentes, líneas) no hace nada y devuelve el mismo objeto
      return new Proxy(this, { get: (o, k) => (k in o ? (o as never)[k] : () => o) });
    }
  }
  return { __esModule: true, default: PdfFalso };
});
jest.mock("jspdf-autotable", () => ({
  __esModule: true,
  default: (doc: { lastAutoTable?: { finalY: number } }, opciones: OpcionesTabla) => {
    mockTablas.push(opciones);
    doc.lastAutoTable = { finalY: 120 };
  },
}));

import { generateStudentPdf } from "@/lib/studentPdfExport";

// Registro real del modelo de producción (IE 864785) tras reentrenar con la corrección.
const REAL: Record<string, unknown> = {
  n_alumno: 12, nombre: "Estudiante 000012", salon: "P6A", codigo_ie: "864785", nivel_riesgo: "MEDIO",
  prob_riesgo: 0.692346213144633, riesgo: 0, bimestres_en_riesgo: 1, bimestres_evaluados: 4, n_materias_c: 0,
  promedio_materias: 14.74404761904762, conducta_promedio: 16.0,
  b1_english: 16, b2_english: 13, b3_english: null, b4_english: null,
  b1_matematica: 14.5, b2_matematica: 12.25, b3_matematica: null, b4_matematica: null,
  b1_arte: 15, b2_arte: 16, b3_arte: 15, b4_arte: null,
  b1_personal_social: 18, b2_personal_social: 15, b3_personal_social: null, b4_personal_social: null,
  b1_cta: 14, b2_cta: 14, b3_cta: null, b4_cta: null,
  b1_ed_fisica: 15, b2_ed_fisica: 15, b3_ed_fisica: null, b4_ed_fisica: null,
  b1_comunicacion: 15, b2_comunicacion: 14, b3_comunicacion: null, b4_comunicacion: null,
};

// El mismo alumno como lo guardaba el modelo anterior: con 0 donde el reporte del colegio no tenía nota.
const CON_CEROS: Record<string, unknown> = { ...REAL, b3_comunicacion: 0, b3_personal_social: 0, b4_arte: 0 };

async function pdfDe(datos: Record<string, unknown>) {
  mockTablas.length = 0;
  mockTextos.length = 0;
  const alumno = datos as unknown as AlumnoColegio;
  await generateStudentPdf(colegioToStudent(alumno, null), null, [], "prueba@satraapp.com", alumno);
  return {
    factores: mockTablas.find((t) => t.head[0][0] === "Área"),
    notas: mockTablas.find((t) => t.head[0][0] === "Materia"),
    textos: [...mockTextos],
  };
}

describe.each([
  ["datos actuales (ausentes = sin nota)", REAL],
  ["datos del modelo anterior (ausentes = 0)", CON_CEROS],
])("CP062 — PDF del Estudiante 000012 con %s", (_nombre, datos) => {
  test("«Notas por bimestre» muestra «—» donde no hay nota y nunca un 0", async () => {
    const { notas } = await pdfDe(datos);
    expect(notas).toBeDefined();
    const fila = (materia: string) => notas!.body.find((f) => String(f[0]).startsWith(materia))!;
    expect(fila("Comunicación").slice(1)).toEqual(["15", "14", "—", "—"]);
    expect(fila("Personal Social").slice(1)).toEqual(["18", "15", "—", "—"]);
    expect(fila("Arte").slice(1)).toEqual(["15", "16", "15", "—"]);
    expect(notas!.body.flat().map(String)).not.toContain("0");
  });

  test("«Factores de riesgo» no incluye el 9.7 ni el 11.0 que salían al contar los ceros", async () => {
    const { factores } = await pdfDe(datos);
    expect(factores).toBeDefined();
    const mostrados = factores!.body.map((f) => `${f[0]}=${f[1]}`);
    expect(mostrados.join(" | ")).not.toMatch(/9\.7|11\.0/);
    // Los 3 factores más bajos con las notas reales: Matemática (14.5+12.25)/2, Ciencia y Tecnología y Comunicación/Inglés
    expect(mostrados[0]).toBe("Matemática=13.4");
  });

  test("el promedio de cada área usa solo las notas que existen: Comunicación 14.5 y Personal Social 16.5", () => {
    const f = factoresRiesgoColegio(datos as unknown as AlumnoColegio);
    expect(f.find((x) => x.label === "Comunicación")?.promedio).toBeCloseTo(14.5);   // antes (15+14+0)/3 = 9.7
    expect(f.find((x) => x.label === "Personal Social")?.promedio).toBeCloseTo(16.5); // antes (18+15+0)/3 = 11.0
  });

  test("el encabezado del PDF muestra el promedio anual y la conducta del alumno", async () => {
    const { textos } = await pdfDe(datos);
    expect(textos).toContain("14.7");
    expect(textos).toContain("16.0");
  });
});

test("tipoRiesgoColegio: un 0 en el promedio anual no cuenta como nota baja", () => {
  const base = { n_alumno: 1, nombre: "E", salon: "1A", codigo_ie: "1", nivel_riesgo: "BAJO", prob_riesgo: 0.1, riesgo: 0, n_materias_c: 0 };
  expect(tipoRiesgoColegio({ ...base, pp_matematica: 0, pp_comunicacion: 0 } as unknown as AlumnoColegio)).toBe("Sin alerta");
  expect(tipoRiesgoColegio({ ...base, pp_matematica: 10, pp_comunicacion: 0 } as unknown as AlumnoColegio)).toBe("Bajo en Matemática");
  expect(tipoRiesgoColegio({ ...base, pp_matematica: 10, pp_comunicacion: 12 } as unknown as AlumnoColegio)).toBe("Bajo en varias áreas");
});
