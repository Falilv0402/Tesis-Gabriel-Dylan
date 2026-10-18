/**
 * Tests de describirResultado / lecturaAlumno (lib/colegio.ts): traducen lo que
 * hizo el modelo del colegio (pronóstico, cierre de año o descriptivo) a texto
 * que un director entienda.
 */
import { describirNombreColegio, describirResultado, formatearFechaModelo, historialRiesgo, lecturaAlumno } from "@/lib/colegio";
import type { AlumnoColegio } from "@/types";

const alumno = (extra: Record<string, unknown> = {}): AlumnoColegio =>
  ({
    n_alumno: 1, nombre: "Pérez, Ana", salon: "3A", codigo_ie: "831305",
    nivel_riesgo: "ALTO", prob_riesgo: 0.96, riesgo: 1, n_materias_c: 2,
    ...extra,
  }) as AlumnoColegio;

describe("describirResultado", () => {
  test("pronóstico: nombra el bimestre pronosticado y los cargados", () => {
    const r = describirResultado({ tipo_resultado: "pronostico", bimestres_cargados: [1, 2, 3], bimestre_pronosticado: 4 });
    expect(r.tipo).toBe("pronostico");
    expect(r.titulo).toBe("Pronóstico del 4.° bimestre · a partir de B1–B3");
    expect(r.gauge).toEqual(["Riesgo en el", "4.° bimestre"]);
    expect(r.bimestrePronosticado).toBe(4);
    expect(r.explicacion).toContain("todavía no tiene los 4 bimestres cargados (hay B1–B3)");
  });

  test("cierre de año: ya no hay bimestre que pronosticar", () => {
    const r = describirResultado({ tipo_resultado: "cierre_anual", bimestres_cargados: [1, 2, 3, 4], bimestre_pronosticado: null });
    expect(r.tipo).toBe("cierre_anual");
    expect(r.bimestrePronosticado).toBeNull();
    expect(r.explicacion).toMatch(/4 bimestres/);
  });

  test("descriptivo: avisa que no es una predicción", () => {
    const r = describirResultado({ tipo_resultado: "descriptivo", modo_prediccion: "descriptivo (PP anual)" });
    expect(r.tipo).toBe("descriptivo");
    expect(r.explicacion).toMatch(/no una predicción/);
    expect(r.explicacion).toContain("todavía no tiene los 4 bimestres cargados — el modelo está operando con datos limitados");
  });

  test("modelo viejo sin tipo_resultado: 'descriptivo...' se reconoce por el texto del modo", () => {
    expect(describirResultado({ modo_prediccion: "descriptivo (sin bimestres suficientes)" }).tipo).toBe("descriptivo");
  });

  test("modelo viejo predictivo sin tipo_resultado: conserva el texto de antes", () => {
    const r = describirResultado({ modo_prediccion: "predictivo (B1-B3 → B4)" });
    expect(r.tipo).toBe("legacy");
    expect(r.titulo).toBe("alerta temprana B1-B3 → B4");
  });

  test("sin métricas no rompe", () => {
    expect(describirResultado(null).tipo).toBe("legacy");
    expect(describirResultado(undefined).tipo).toBe("legacy");
  });
});

describe("lecturaAlumno", () => {
  const pron = { tipo_resultado: "pronostico" as const, bimestres_cargados: [1, 2, 3], bimestre_pronosticado: 4, umbral_riesgo_nota: 13 };

  test("pronóstico: porcentaje, bimestres en riesgo y tendencia en baja", () => {
    const a = alumno({
      bimestres_en_riesgo: 3, bimestres_evaluados: 3,
      b1_matematica: 11, b2_matematica: 10, b3_matematica: 9,
      b1_comunicacion: 12, b2_comunicacion: 12.2, b3_comunicacion: 12.4,
    });
    const l = lecturaAlumno(a, pron);
    expect(l.titular).toBe("96% de probabilidad de estar en riesgo en el 4.° bimestre. Ya estuvo en riesgo en 3 de 3 bimestres.");
    expect(l.tendencias).toEqual([
      "Matemática: 11 → 10 → 9 (en baja, en nivel de riesgo)",
      "Comunicación: 12 → 12.2 → 12.4 (estable, en nivel de riesgo)",
    ]);
    expect(l.nota).toContain("13 o menos");
  });

  test("estable por encima del umbral no dice que esté en riesgo", () => {
    const l = lecturaAlumno(alumno({ b1_matematica: 16, b2_matematica: 16.4, b3_matematica: 16.2 }), pron);
    expect(l.tendencias[0]).toBe("Matemática: 16 → 16.4 → 16.2 (estable)");
  });

  test("tendencia en alza", () => {
    const l = lecturaAlumno(alumno({ b1_matematica: 10, b2_matematica: 12, b3_matematica: 14 }), pron);
    expect(l.tendencias[0]).toBe("Matemática: 10 → 12 → 14 (en alza)");
  });

  test("usa las columnas de primaria (mat_prim / lenguaje) si no hay las de secundaria", () => {
    const l = lecturaAlumno(alumno({ b1_mat_prim: 15, b2_mat_prim: 13, b3_lenguaje: 14, b1_lenguaje: 16 }), pron);
    expect(l.tendencias.some((t) => t.startsWith("Matemática: 15 → 13"))).toBe(true);
    expect(l.tendencias.some((t) => t.startsWith("Comunicación: 16 → 14"))).toBe(true);
  });

  const cierre = { tipo_resultado: "cierre_anual" as const, bimestres_cargados: [1, 2, 3, 4], bimestre_pronosticado: null };

  test("cierre de año: 4 de 4 → propenso a cerrar el año en riesgo", () => {
    const l = lecturaAlumno(alumno({ bimestres_en_riesgo: 4 }), cierre);
    expect(l.titular).toBe("Propenso a cerrar el año en riesgo: estuvo en riesgo en los 4 bimestres.");
  });

  test("cierre de año: 3 de 4 → propenso; 2 → intermitente; 1 → estable", () => {
    expect(lecturaAlumno(alumno({ bimestres_en_riesgo: 3 }), cierre).titular).toMatch(/^Propenso a cerrar el año en riesgo: en riesgo en 3 de 4/);
    expect(lecturaAlumno(alumno({ bimestres_en_riesgo: 2 }), cierre).titular).toMatch(/^Año con riesgo intermitente/);
    expect(lecturaAlumno(alumno({ bimestres_en_riesgo: 1 }), cierre).titular).toMatch(/^Año estable: en riesgo en 1 de 4/);
  });

  test("descriptivo: no promete pronóstico", () => {
    const l = lecturaAlumno(alumno(), { tipo_resultado: "descriptivo" });
    expect(l.titular).toBe("Sin pronóstico: solo se muestra la situación actual.");
  });

  test("sin series suficientes no inventa tendencias", () => {
    expect(lecturaAlumno(alumno({ b1_matematica: 10 }), pron).tendencias).toEqual([]);
  });
});

describe("describirNombreColegio", () => {
  test("cada origen explica de dónde salió el nombre", () => {
    expect(describirNombreColegio("manual", "Mi Colegio")).toEqual({ texto: "Nombre del colegio: «Mi Colegio» (el que indicaste).", aviso: false });
    expect(describirNombreColegio("excel", "Joseph And Mery")?.texto).toContain("encabezado del Excel");
    const previo = describirNombreColegio("modelo_anterior", "Cole Trapiche");
    expect(previo?.aviso).toBe(false);
    expect(previo?.texto).toContain("los reportes consolidados no traen el nombre");
  });

  test("por defecto avisa y dice qué hacer", () => {
    const r = describirNombreColegio("por_defecto", "Colegio 9001");
    expect(r?.aviso).toBe(true);
    expect(r?.texto).toContain("«Colegio 9001»");
    expect(r?.texto).toContain("campo «Nombre del colegio»");
  });

  test("modelo viejo sin origen no inventa nada", () => {
    expect(describirNombreColegio(undefined, "X")).toBeNull();
    expect(describirNombreColegio(null, "X")).toBeNull();
  });
});

describe("formatearFechaModelo", () => {
  test("fecha válida se formatea en español", () => {
    expect(formatearFechaModelo("2026-10-18T04:11:00")).toMatch(/2026/);
    expect(formatearFechaModelo("2026-10-18T04:11:00", false)).not.toMatch(/\d:\d/);
  });
  test("nula, vacía o inválida: 'Fecha no disponible'", () => {
    expect(formatearFechaModelo(null)).toBe("Fecha no disponible");
    expect(formatearFechaModelo(undefined)).toBe("Fecha no disponible");
    expect(formatearFechaModelo("")).toBe("Fecha no disponible");
    expect(formatearFechaModelo("no-es-fecha")).toBe("Fecha no disponible");
  });
});

describe("historialRiesgo", () => {
  test("marca cada bimestre según el umbral en Matemática o Comunicación", () => {
    const h = historialRiesgo(alumno({
      b1_matematica: 15, b1_comunicacion: 16,   // sin riesgo
      b2_matematica: 12, b2_comunicacion: 16,   // en riesgo (mate ≤ 13)
      b3_matematica: 16, b3_comunicacion: 13,   // en riesgo (com = umbral)
    }));
    expect(h.filas.map((f) => f.estado)).toEqual(["sin_riesgo", "en_riesgo", "en_riesgo", "sin_datos"]);
    expect(h.hayDatos).toBe(true);
    expect(h.enRiesgo).toBe(2);
    expect(h.evaluados).toBe(3);
  });
  test("con una sola área con nota, basta esa para evaluar", () => {
    expect(historialRiesgo(alumno({ b1_matematica: 10 })).filas[0].estado).toBe("en_riesgo");
    expect(historialRiesgo(alumno({ b1_comunicacion: 18 })).filas[0].estado).toBe("sin_riesgo");
  });
  test("usa las columnas de primaria si no hay las de secundaria", () => {
    const h = historialRiesgo(alumno({ b1_mat_prim: 12, b1_lenguaje: 17 }));
    expect(h.filas[0]).toMatchObject({ matematica: 12, comunicacion: 17, estado: "en_riesgo" });
  });
  test("sin ninguna nota: no hay datos históricos", () => {
    const h = historialRiesgo(alumno());
    expect(h.hayDatos).toBe(false);
    expect(h.filas.every((f) => f.estado === "sin_datos")).toBe(true);
  });
  test("respeta un umbral distinto", () => {
    expect(historialRiesgo(alumno({ b1_matematica: 14 }), 14).filas[0].estado).toBe("en_riesgo");
    expect(historialRiesgo(alumno({ b1_matematica: 14 }), 13).filas[0].estado).toBe("sin_riesgo");
  });
});
