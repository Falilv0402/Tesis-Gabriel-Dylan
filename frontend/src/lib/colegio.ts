import type { AlumnoColegio, ColegioResumen, RiskLevel, Student } from "@/types";

/**
 * Materias del colegio que se muestran/grafican — las 7 áreas académicas
 * ponderadas por el colegio (ver AREAS_PONDERADAS en parse_excels.py), en el
 * mismo orden y con el mismo peso que usa el índice de riesgo y el modelo.
 * Conducta se muestra aparte (es anual, no por bimestre).
 */
export const MATERIAS_COLEGIO = [
  { key: "matematica",      label: "Matemática" },
  { key: "comunicacion",    label: "Comunicación" },
  { key: "cta",             label: "Ciencia y Tec." },
  { key: "personal_social", label: "Personal Social" },
  { key: "english",         label: "Inglés" },
  { key: "arte",            label: "Arte y Cultura" },
  { key: "ed_fisica",       label: "Ed. Física" },
] as const;

export type Bimestre = "1" | "2" | "3" | "4";

/** Deriva el año/grado a partir del salón: "1A"→1° Sec, "P6B"→6° Primaria. */
export function anioFromSalon(salon: string): { label: string; rank: number } {
  if (/^p/i.test(salon)) return { label: "6° Primaria", rank: 0 };
  const m = salon.match(/^(\d+)/);
  if (m) return { label: `${m[1]}° Secundaria`, rank: Number(m[1]) };
  return { label: salon, rank: 99 };
}

/** Lista ordenada de años de secundaria presentes en un conjunto de alumnos. */
export function aniosDeSalones(alumnos: AlumnoColegio[]): string[] {
  const map = new Map<string, number>();
  for (const a of alumnos) {
    const { label, rank } = anioFromSalon(a.salon);
    if (!map.has(label)) map.set(label, rank);
  }
  return [...map.entries()].sort((x, y) => x[1] - y[1]).map(([label]) => label);
}

/** Deriva la sección (A/B/...) a partir del salón: "5A"→"A", "P6B"→"B". */
export function seccionFromSalon(salon: string): string {
  const m = salon.trim().toUpperCase().match(/([A-Z])$/);
  return m ? m[1] : "—";
}

/** Lista ordenada de secciones presentes en un conjunto de alumnos (A, B, ...). */
export function seccionesDeSalones(alumnos: AlumnoColegio[]): string[] {
  const set = new Set<string>();
  for (const a of alumnos) set.add(seccionFromSalon(a.salon));
  return [...set].sort();
}

/** Convierte una nota numérica (0-20) a la escala literal AD/A/B/C con color. */
export function notaInfo(v: number | string | null | undefined): { label: string; letra: string; color: string } {
  if (v == null || v === "") return { label: "—", letra: "—", color: "var(--text-muted)" };
  const n = Number(v);
  if (Number.isNaN(n)) return { label: "—", letra: "—", color: "var(--text-muted)" };
  if (n >= 18) return { label: `AD · ${n.toFixed(0)}`, letra: "AD", color: "#16a34a" };
  if (n >= 14) return { label: `A · ${n.toFixed(0)}`,  letra: "A",  color: "#2563eb" };
  if (n >= 11) return { label: `B · ${n.toFixed(0)}`,  letra: "B",  color: "#d97706" };
  return { label: `C · ${n.toFixed(0)}`, letra: "C", color: "#dc2626" };
}

/** Lee la nota de una materia en un bimestre dado (b{N}_{materia}). */
export function notaBimestre(a: AlumnoColegio, materia: string, bimestre: Bimestre): number | null {
  const v = (a as Record<string, number | string | null | undefined>)[`b${bimestre}_${materia}`];
  return v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v);
}

/** Lee el promedio anual de una materia (pp_{materia}). */
export function notaAnual(a: AlumnoColegio, materia: string): number | null {
  const v = (a as Record<string, number | string | null | undefined>)[`pp_${materia}`];
  return v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v);
}

/**
 * Bimestre "por defecto" a mostrar: el más reciente que tenga alguna nota
 * real, no siempre "1". Sin esto, un colegio que solo cargó el Excel del
 * 4° bimestre (p.ej. una carga de prueba parcial) mostraba la tabla vacía
 * de entrada — el selector arrancaba en Bimestre 1, que no tenía ningún dato,
 * y parecía que el sistema no había guardado nada.
 */
export function mejorBimestreConDatos(alumnos: AlumnoColegio[], materias: string[]): Bimestre {
  for (const b of ["4", "3", "2", "1"] as const) {
    const hayDato = alumnos.some((a) => materias.some((m) => notaBimestre(a, m, b) != null));
    if (hayDato) return b;
  }
  return "1";
}

/**
 * Nota efectiva a mostrar en un bimestre. Si el alumno tiene la nota de ese
 * bimestre, se usa. Si el salón NO tiene desglose por bimestre en esa materia
 * (p.ej. el "consolidado anual" de 6° B) pero sí promedio anual, se usa el
 * anual en cada bimestre y se marca `anual = true` para indicarlo en la UI.
 */
export function notaCelda(
  a: AlumnoColegio, materia: string, bimestre: Bimestre,
): { value: number | null; anual: boolean } {
  const directa = notaBimestre(a, materia, bimestre);
  if (directa != null) return { value: directa, anual: false };
  // Solo caemos al anual si NO hay ningún bimestre para esa materia (consolidado);
  // si falta solo un bimestre puntual, se respeta el vacío.
  const algunBimestre = (["1", "2", "3", "4"] as const).some((b) => notaBimestre(a, materia, b) != null);
  if (algunBimestre) return { value: null, anual: false };
  const anual = notaAnual(a, materia);
  return anual != null ? { value: anual, anual: true } : { value: null, anual: false };
}

/** Celda lista para mostrar: etiqueta AD/A/B/C (con marca "ᵃ" si es la nota anual) + color. */
export function gradeCell(
  a: AlumnoColegio, materia: string, bimestre: Bimestre,
): { label: string; color: string; anual: boolean } {
  const { value, anual } = notaCelda(a, materia, bimestre);
  const info = notaInfo(value);
  return { label: anual && value != null ? `${info.label} ᵃ` : info.label, color: info.color, anual };
}

type MetricasColegio = ColegioResumen["metricas"];

export type ResultadoModelo = {
  tipo: "pronostico" | "cierre_anual" | "descriptivo" | "legacy";
  /** Texto corto para el encabezado del colegio. */
  titulo: string;
  /** Líneas para el medidor del alumno (qué significa el porcentaje). */
  gauge: [string, string];
  /** Explicación en lenguaje llano de lo que está viendo el director. */
  explicacion: string;
  bimestreCargado: number;
  bimestrePronosticado: number | null;
};

/**
 * Traduce lo que el modelo del colegio hizo con los bimestres cargados a un
 * texto que cualquier director entienda. Antes el encabezado decía siempre
 * "alerta temprana B1-B3 → B4", aunque se hubieran subido los 4 bimestres (no
 * queda nada que pronosticar) o uno solo (no se puede pronosticar nada): el
 * sistema parecía describir lo ya ocurrido en vez de anticipar.
 */
export function describirResultado(m?: MetricasColegio | null): ResultadoModelo {
  const cargados = m?.bimestres_cargados ?? [];
  const k = cargados.length ? Math.max(...cargados) : 0;
  const n = m?.bimestre_pronosticado ?? null;
  const modo = m?.modo_prediccion ?? "";

  if (m?.tipo_resultado === "pronostico" && n) {
    return {
      tipo: "pronostico", bimestreCargado: k, bimestrePronosticado: n,
      titulo: `Pronóstico del ${n}.° bimestre · a partir de B1–B${k}`,
      gauge: ["Riesgo en el", `${n}.° bimestre`],
      explicacion:
        `Estás viendo un pronóstico: el sistema usa las notas de B1–B${k} para estimar quién estará en riesgo ` +
        `en el ${n}.° bimestre, cuando todavía hay tiempo de intervenir. Se confirma al subir las notas del ${n}.° bimestre.`,
    };
  }
  if (m?.tipo_resultado === "cierre_anual") {
    return {
      tipo: "cierre_anual", bimestreCargado: 4, bimestrePronosticado: null,
      titulo: "Cierre de año · B1–B4 cargados",
      gauge: ["Riesgo del año", "(retrospectivo)"],
      explicacion:
        "Ya están los 4 bimestres, así que no queda un bimestre por pronosticar. El porcentaje indica qué tan consistente " +
        "es el patrón de riesgo de cada alumno; en su ficha ves en cuántos bimestres estuvo realmente en riesgo.",
    };
  }
  if (m?.tipo_resultado === "descriptivo" || modo.startsWith("descriptivo")) {
    return {
      tipo: "descriptivo", bimestreCargado: k, bimestrePronosticado: null,
      titulo: "Situación actual · sin pronóstico",
      gauge: ["Índice de riesgo", "(sin pronóstico)"],
      explicacion:
        "Todavía no se puede pronosticar: hacen falta al menos 2 bimestres cargados y suficientes alumnos con y sin riesgo. " +
        "Mientras tanto, los porcentajes son un índice de las notas actuales, no una predicción.",
    };
  }
  // Modelos entrenados antes de que se guardara el tipo de resultado.
  return {
    tipo: "legacy", bimestreCargado: k, bimestrePronosticado: null,
    titulo: "alerta temprana B1-B3 → B4",
    gauge: ["Probabilidad de", "riesgo"],
    explicacion: "",
  };
}

const AREAS_LECTURA = [
  { label: "Matemática",   keys: ["matematica", "mat_prim"] },
  { label: "Comunicación", keys: ["comunicacion", "lenguaje"] },
] as const;

/**
 * Qué decirle a quien sube los Excel sobre el nombre con el que quedó el colegio. El colegio lo fija el código IE
 * de la cuenta, no el contenido del Excel; lo que sí depende de dónde se lea es el NOMBRE, y el "Reporte
 * consolidado" (el formato de Trapiche) no lo trae en el archivo. `aviso` = el nombre quedó como el de por defecto.
 */
export function describirNombreColegio(
  origen: string | null | undefined, nombre: string,
): { texto: string; aviso: boolean } | null {
  switch (origen) {
    case "manual":
      return { texto: `Nombre del colegio: «${nombre}» (el que indicaste).`, aviso: false };
    case "excel":
      return { texto: `Nombre del colegio: «${nombre}» (tomado del encabezado del Excel).`, aviso: false };
    case "modelo_anterior":
      return { texto: `Nombre del colegio: «${nombre}» (se conservó el ya registrado; los reportes consolidados no traen el nombre del colegio).`, aviso: false };
    case "por_defecto":
      return {
        texto: `No se encontró el nombre del colegio: quedó como «${nombre}». Los reportes consolidados no lo traen. Escríbelo en el campo «Nombre del colegio» y vuelve a subir los Excel.`,
        aviso: true,
      };
    default:
      return null; // modelo entrenado antes de que se registrara el origen
  }
}

export type LecturaAlumno = { titular: string; tendencias: string[]; nota: string };

/**
 * Lectura en lenguaje llano de la situación de un alumno: qué dice el modelo
 * y en qué se apoya (en cuántos bimestres estuvo en riesgo y cómo van sus
 * notas de Matemática y Comunicación). Hace visible que el sistema anticipa,
 * no solo muestra notas.
 */
export function lecturaAlumno(a: AlumnoColegio, m?: MetricasColegio | null): LecturaAlumno {
  const res = describirResultado(m);
  const umbral = m?.umbral_riesgo_nota ?? 13;
  const k = res.bimestreCargado || a.bimestres_evaluados || 0;
  const enRiesgo = a.bimestres_en_riesgo;
  const porc = `${Math.round(a.prob_riesgo * 100)}%`;

  let titular: string;
  if (res.tipo === "pronostico" && res.bimestrePronosticado) {
    titular = `${porc} de probabilidad de estar en riesgo en el ${res.bimestrePronosticado}.° bimestre.`;
    if (enRiesgo != null && k > 0) titular += ` Ya estuvo en riesgo en ${enRiesgo} de ${k} bimestres.`;
  } else if (res.tipo === "cierre_anual" && enRiesgo != null && k > 0) {
    if (enRiesgo >= k) titular = `Propenso a cerrar el año en riesgo: estuvo en riesgo en los ${k} bimestres.`;
    else if (enRiesgo >= Math.ceil(k * 0.75)) titular = `Propenso a cerrar el año en riesgo: en riesgo en ${enRiesgo} de ${k} bimestres.`;
    else if (enRiesgo >= 2) titular = `Año con riesgo intermitente: en riesgo en ${enRiesgo} de ${k} bimestres.`;
    else titular = `Año estable: en riesgo en ${enRiesgo} de ${k} bimestres.`;
  } else {
    titular = res.tipo === "descriptivo"
      ? "Sin pronóstico: solo se muestra la situación actual."
      : `${porc} de probabilidad de riesgo.`;
  }

  const tendencias: string[] = [];
  for (const area of AREAS_LECTURA) {
    const serie: number[] = [];
    for (let b = 1; b <= Math.max(k, 1); b++) {
      const v = area.keys.map((key) => notaBimestre(a, key, String(b) as Bimestre)).find((x) => x != null);
      if (v != null) serie.push(v);
    }
    if (serie.length < 2) continue;
    const ultima = serie[serie.length - 1];
    const delta = ultima - serie[0];
    const tendencia = delta <= -1 ? "en baja" : delta >= 1 ? "en alza" : "estable";
    // "estable" a secas suena tranquilizador aunque el alumno siga en nota de riesgo.
    const enRiesgoAhora = ultima <= umbral ? ", en nivel de riesgo" : "";
    tendencias.push(`${area.label}: ${serie.map((v) => Number(v.toFixed(1))).join(" → ")} (${tendencia}${enRiesgoAhora})`);
  }

  return {
    titular, tendencias,
    nota: `Se considera "en riesgo" una nota de ${umbral} o menos en Matemática o Comunicación.`,
  };
}

/**
 * ID estable del alumno de colegio para llaves de BD (anotaciones/plan/intervenciones).
 * n_alumno es solo el número de lista DENTRO del salón (no único en todo el
 * colegio): sin el salón, alumnos de secciones distintas con el mismo número
 * de lista colisionaban en el mismo ID (p.ej. "0249-9" existía en 11 salones
 * a la vez), causando que se mostrara el alumno equivocado al seleccionar uno.
 */
export function colegioStudentId(a: AlumnoColegio): string {
  return `${a.codigo_ie}-${a.salon}-${a.n_alumno}`;
}

/**
 * HU012: factores de riesgo de un alumno del modelo propio del colegio.
 * No hay SHAP por instancia aquí (la muestra por colegio es muy chica para
 * que una explicación por instancia sea confiable) -- en su lugar, se usa
 * como proxy el promedio B1-B3 de cada área (las mismas features tempranas
 * que usa el modelo real) y se muestran las más bajas, que es justamente lo
 * que más eleva la probabilidad de riesgo.
 */
export function factoresRiesgoColegio(
  a: AlumnoColegio,
): { label: string; promedio: number | null; enRiesgo: boolean }[] {
  const factores: { label: string; promedio: number | null; enRiesgo: boolean }[] = MATERIAS_COLEGIO.map((m) => {
    const notas = (["1", "2", "3"] as const)
      .map((b) => notaBimestre(a, m.key, b))
      .filter((n): n is number => n != null);
    const promedio = notas.length > 0
      ? notas.reduce((s, n) => s + n, 0) / notas.length
      : notaAnual(a, m.key);
    return { label: m.label, promedio, enRiesgo: promedio != null && promedio <= 13 };
  });
  const conducta = a.conducta_promedio != null ? Number(a.conducta_promedio) : null;
  factores.push({ label: "Conducta", promedio: conducta, enRiesgo: conducta != null && conducta <= 13 });

  return factores
    .filter((f) => f.promedio != null)
    .sort((x, y) => (x.promedio ?? 99) - (y.promedio ?? 99));
}

/** Clasifica el tipo de riesgo del alumno de colegio según sus promedios. */
export function tipoRiesgoColegio(a: AlumnoColegio): string {
  const mat = a.pp_matematica;
  const com = a.pp_comunicacion;
  const bajoMat = typeof mat === "number" && mat <= 13;
  const bajoCom = typeof com === "number" && com <= 13;
  if (bajoMat && bajoCom) return "Bajo en varias áreas";
  if (bajoMat)            return "Bajo en Matemática";
  if (bajoCom)            return "Bajo en Comunicación";
  if (a.nivel_riesgo === "BAJO") return "Sin alerta";
  return "Seguimiento académico";
}

/**
 * Adapta un alumno de colegio a la forma `Student` para reutilizar los hooks
 * compartidos (anotaciones, plan de hitos, intervenciones) que operan por id.
 * Los campos propios de EM 2022 (M500, ISE) van en 0 — no se muestran en las
 * vistas de colegio; solo viaja la identidad y el riesgo.
 */
export function colegioToStudent(a: AlumnoColegio, distrito: string | null): Student {
  return {
    id:                  colegioStudentId(a),
    id_ie:               a.codigo_ie,
    nombre:              a.nombre,
    sexo:                "—",
    ise:                 0,
    distrito:            distrito ?? "—",
    M500_L:              0,
    M500_CN:             0,
    probabilidad_riesgo: a.prob_riesgo,
    nivel_riesgo:        a.nivel_riesgo as RiskLevel,
    tipo_riesgo:         tipoRiesgoColegio(a),
    periodo:             "Colegio",
  };
}
