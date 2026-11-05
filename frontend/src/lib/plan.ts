import type { PlanEstado } from "@/hooks/usePlanRevision";

/**
 * Quién puede hacer qué con el plan de seguimiento de un alumno (HU0023):
 *  - El Coordinador propone el plan y lo envía a revisión (también cuando el Director le pidió cambios).
 *  - El Director es quien revisa: aprueba o pide cambios. No envía planes a revisión.
 *  - Quien envió un plan no puede decidir sobre él (CP053): se separan las funciones de quien propone y quien aprueba.
 * La base de datos refuerza lo mismo (migración 0021), esto solo decide qué botones se muestran.
 */
export interface EntradaReglasPlan {
  estado: PlanEstado;
  rol: string;
  tieneHitos: boolean;
  /** Id de quien envió el plan a revisión (plan_estado.enviado_por). */
  enviadoPor: string | null | undefined;
  /** Id de la persona con sesión iniciada. */
  miId: string | null | undefined;
}

export function reglasPlan({ estado, rol, tieneHitos, enviadoPor, miId }: EntradaReglasPlan) {
  const esDirector = rol === "director";
  const editable = estado === "borrador" || estado === "rechazado";
  const esMiEnvio = estado === "en_revision" && !!enviadoPor && enviadoPor === miId;
  return {
    puedeEnviar: editable && tieneHitos && !esDirector,
    puedeDecidir: esDirector && estado === "en_revision" && !esMiEnvio,
    /** El plan está en revisión pero lo envió esta misma persona: debe revisarlo otro Director. */
    esMiEnvio,
    /** El Director tiene un plan listo, pero no se envía a revisión: es quien revisa. */
    directorNoEnvia: esDirector && editable && tieneHitos,
  };
}
