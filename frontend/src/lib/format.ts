import type { Student } from "@/types";
import type { ShapData } from "@/types";
import { AVATAR_COLORS } from "@/lib/constants";

/** Formatea un número con N decimales. Devuelve "—" si el valor no es numérico. */
export function fmt(value: unknown, decimals = 2): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(decimals)
    : "—";
}

export function pct(value = 0): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Muestra solo los últimos 4 dígitos del ID de estudiante */
export function shortId(id: string): string {
  return id.slice(-4).padStart(4, "0");
}

export function riskClass(level: string): string {
  if (level === "ALTO") return "risk high";
  if (level === "MEDIO") return "risk medium";
  return "risk low";
}

export function getAvatarColor(email: string, saved?: string): string {
  if (saved) return saved;
  return AVATAR_COLORS[email.charCodeAt(0) % AVATAR_COLORS.length];
}

export function getInitials(nombre: string, apellidos: string, email: string): string {
  if (nombre || apellidos) {
    const n = nombre.trim()[0] ?? "";
    const a = apellidos.trim()[0] ?? "";
    return (n + a).toUpperCase() || email[0].toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function recommendation(student: Student): string {
  if (student.nivel_riesgo === "BAJO")
    return "Mantener seguimiento regular y revisar evolucion en el siguiente periodo.";
  if (student.nivel_riesgo === "MEDIO")
    return "Programar monitoreo academico y refuerzo preventivo.";
  if (student.tipo_riesgo === "Bajo en Lectura")
    return "Refuerzo en comprension lectora — impacta directamente el desempeno matematico.";
  if (student.tipo_riesgo === "Bajo en Ciencias")
    return "Refuerzo en razonamiento cientifico y aplicacion de conceptos.";
  if (student.tipo_riesgo === "Rendimiento multiple")
    return "Intervencion prioritaria: refuerzo en lectura y ciencias, coordinacion con familia.";
  if (student.tipo_riesgo === "Contexto socioecon.")
    return "Considerar soporte socioeconomico y derivacion a programas de apoyo institucional.";
  return "Monitoreo academico continuo y revision periodica.";
}

/** Recomendación contextual derivada del SHAP individual del estudiante. */
export function recommendationFromShap(shap: ShapData | null): string | null {
  if (!shap || shap.contributions.length === 0) return null;
  const driver = shap.contributions.find((c) => c.contribution > 0);
  if (!driver) return null;
  const map: Record<string, string> = {
    M500_L:
      "El factor que más eleva el riesgo de este estudiante es su puntaje en Lectura. Sugerencia: derivar a programa de comprensión lectora del nivel.",
    M500_CN:
      "El factor que más eleva el riesgo es su puntaje en Ciencias. Sugerencia: refuerzo en razonamiento científico y resolución de problemas aplicados.",
    M500_L_iemean:
      "El contexto académico de su IE en Lectura es el principal driver de riesgo. Sugerencia: coordinar con dirección académica una estrategia institucional, no solo individual.",
    M500_CN_iemean:
      "El contexto académico de su IE en Ciencias eleva el riesgo. Sugerencia: revisar la propuesta pedagógica de Ciencias a nivel del colegio.",
    ise_iemean:
      "El bajo nivel socioeconómico del colegio eleva el riesgo. Sugerencia: gestionar apoyo institucional (becas, transporte, materiales) y derivación a programas sociales.",
    ise: "El nivel socioeconómico individual eleva el riesgo. Sugerencia: derivación a área social del colegio y evaluar acceso a recursos educativos en casa.",
    sexo: "El modelo detecta un patrón estadístico por sexo en este perfil. Tratar este caso como cualquier otro de su nivel de riesgo — el sexo no debe condicionar la intervención.",
    Distrito:
      "El distrito del estudiante eleva la probabilidad de riesgo según el modelo. Tener en cuenta el contexto territorial al planificar la intervención.",
    tamanio_ie:
      "El tamaño de la IE influye en el riesgo. Considerar acompañamiento personalizado.",
  };
  return map[driver.feature] ?? null;
}

export function toCsv(students: Student[]): string {
  const headers = [
    "id", "sexo", "ise", "distrito", "M500_L", "M500_CN",
    "probabilidad_riesgo", "nivel_riesgo", "tipo_riesgo", "grupo_m_real",
  ];
  return [
    headers.join(","),
    ...students.map((s) =>
      headers.map((h) => String(s[h as keyof Student] ?? "")).join(",")
    ),
  ].join("\n");
}
