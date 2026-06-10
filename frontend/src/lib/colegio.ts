import type { AlumnoColegio, RiskLevel, Student } from "@/types";

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

/** ID estable del alumno de colegio para llaves de BD (anotaciones/plan/intervenciones). */
export function colegioStudentId(a: AlumnoColegio): string {
  return `${a.codigo_ie}-${a.n_alumno}`;
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
