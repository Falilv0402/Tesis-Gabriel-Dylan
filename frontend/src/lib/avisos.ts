/**
 * Texto de confirmación cuando se guarda algo que además avisa al equipo del colegio (hito agendado o completado).
 *
 * `avisados` es lo que devuelve `crearNotificacion`: cuántos compañeros recibieron el aviso, 0 si el colegio no
 * tiene otros Directores/Coordinadores activos, o `null` si el aviso no se pudo guardar. Sin este mensaje quien
 * agenda el hito no veía ninguna confirmación (a diferencia de las anotaciones) y, como el aviso nunca llega a
 * quien lo origina, no había manera de saber que el equipo sí había sido notificado (CP050).
 */
export function avisoEquipo(
  accion: string,
  avisados: number | null | undefined,
): { text: string; type: "success" | "info" } {
  if (avisados == null) {
    return avisados === null
      ? { text: `${accion}, pero no se pudo avisar al equipo.`, type: "info" }
      : { text: `${accion}.`, type: "success" };
  }
  if (avisados === 0) {
    return { text: `${accion}. No hay otros Directores/Coordinadores activos en el colegio a quienes avisar.`, type: "success" };
  }
  return {
    text: `${accion}. Se avisó a ${avisados} ${avisados === 1 ? "compañero" : "compañeros"} del equipo.`,
    type: "success",
  };
}
