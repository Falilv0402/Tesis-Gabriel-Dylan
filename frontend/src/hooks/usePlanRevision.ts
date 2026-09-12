"use client";

/**
 * usePlanRevision -- Coordinador propone el plan de hitos de un alumno,
 * Director lo aprueba o pide cambios. Ver migración 0017_plan_revision.sql.
 */
import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type PlanEstado = "borrador" | "en_revision" | "aprobado" | "rechazado";

export type PlanEstadoRow = {
  estudiante_id: string;
  codigo_ie: string;
  estudiante_nombre: string | null;
  estado: PlanEstado;
  enviado_por: string | null;
  enviado_por_nombre: string | null;
  enviado_at: string | null;
  revisado_por: string | null;
  revisado_por_nombre: string | null;
  revisado_at: string | null;
  comentario: string | null;
};

interface CrearNotificacionFn {
  (params: {
    codigoIe: string | null | undefined;
    tipo: "anotacion" | "hito" | "plan";
    estudianteId: string;
    estudianteNombre: string;
    mensaje: string;
    autorNombre: string;
  }): Promise<void>;
}

interface NotificarDirigidaFn {
  (params: {
    codigoIe: string | null | undefined;
    destinatarioId: string;
    estudianteId: string;
    estudianteNombre: string;
    mensaje: string;
    autorNombre: string;
  }): Promise<void>;
}

export function usePlanRevision(
  session: User | null,
  toast: (msg: string, type?: "success" | "error" | "info") => void,
  insertAudit: (accion: string, tabla?: string, detalle?: object) => Promise<void>,
  crearNotificacion: CrearNotificacionFn,
  notificarDirigida: NotificarDirigidaFn,
) {
  const [planEstado, setPlanEstado] = useState<PlanEstadoRow | null>(null);
  const [isLoadingPlanEstado, setIsLoadingPlanEstado] = useState(false);
  const [isEnviandoRevision, setIsEnviandoRevision] = useState(false);
  const [planesPendientes, setPlanesPendientes] = useState<PlanEstadoRow[]>([]);
  const [isDecidiendoPlan, setIsDecidiendoPlan] = useState(false);

  async function loadPlanEstado(estudianteId: string) {
    if (!estudianteId) { setPlanEstado(null); return; }
    setIsLoadingPlanEstado(true);
    const { data, error } = await supabase
      .from("plan_estado")
      .select("*")
      .eq("estudiante_id", estudianteId)
      .maybeSingle();
    // Best-effort: si la migracion 0017 aun no se aplico, la tabla no existe
    // y el plan simplemente se muestra como "borrador" (comportamiento actual).
    setPlanEstado(error ? null : (data as PlanEstadoRow | null));
    setIsLoadingPlanEstado(false);
  }

  async function enviarARevision(
    estudianteId: string, codigoIe: string, estudianteNombre: string, autorNombre: string,
  ) {
    if (!session || !estudianteId) return;
    setIsEnviandoRevision(true);
    const { data, error } = await supabase
      .from("plan_estado")
      .upsert({
        estudiante_id: estudianteId,
        codigo_ie: codigoIe,
        estudiante_nombre: estudianteNombre,
        estado: "en_revision",
        enviado_por: session.id,
        enviado_por_nombre: autorNombre,
        enviado_at: new Date().toISOString(),
        revisado_por: null, revisado_por_nombre: null, revisado_at: null, comentario: null,
      }, { onConflict: "estudiante_id" })
      .select()
      .single();
    if (error) {
      toast("No se pudo enviar el plan a revisión (sin permiso).", "error");
      setIsEnviandoRevision(false);
      return;
    }
    setPlanEstado(data as PlanEstadoRow);
    await insertAudit("Enviar plan a revision", "plan_estado", { estudiante_id: estudianteId });
    toast("Plan enviado a revisión.", "success");
    void crearNotificacion({
      codigoIe, tipo: "plan", estudianteId, estudianteNombre,
      mensaje: `${autorNombre} envió a revisión el plan de ${estudianteNombre}.`,
      autorNombre,
    });
    setIsEnviandoRevision(false);
  }

  async function decidirPlan(
    row: PlanEstadoRow, decision: "aprobado" | "rechazado", comentario: string, miNombre: string,
  ) {
    if (!session) return;
    setIsDecidiendoPlan(true);
    const { data, error } = await supabase
      .from("plan_estado")
      .update({
        estado: decision,
        revisado_por: session.id,
        revisado_por_nombre: miNombre,
        revisado_at: new Date().toISOString(),
        comentario: comentario.trim() || null,
      })
      .eq("estudiante_id", row.estudiante_id)
      .select()
      .single();
    if (error) {
      toast("No se pudo registrar la decisión (sin permiso).", "error");
      setIsDecidiendoPlan(false);
      return;
    }
    setPlanEstado(data as PlanEstadoRow);
    setPlanesPendientes((prev) => prev.filter((p) => p.estudiante_id !== row.estudiante_id));
    await insertAudit(decision === "aprobado" ? "Aprobar plan" : "Rechazar plan", "plan_estado", { estudiante_id: row.estudiante_id });
    toast(decision === "aprobado" ? "Plan aprobado." : "Se pidieron cambios al plan.", "success");
    // Best-effort: si el plan lo envió el propio Director, no hay a quién avisar.
    if (row.enviado_por && row.enviado_por !== session.id) {
      const nombreAlumno = row.estudiante_nombre ?? "el alumno";
      void notificarDirigida({
        codigoIe: row.codigo_ie,
        destinatarioId: row.enviado_por,
        estudianteId: row.estudiante_id,
        estudianteNombre: nombreAlumno,
        mensaje: decision === "aprobado"
          ? `${miNombre} aprobó el plan de ${nombreAlumno}.`
          : `${miNombre} pidió cambios al plan de ${nombreAlumno}${comentario.trim() ? `: "${comentario.trim()}"` : "."}`,
        autorNombre: miNombre,
      });
    }
    setIsDecidiendoPlan(false);
  }

  async function loadPlanesPendientes(codigoIe: string | null | undefined) {
    if (!codigoIe) { setPlanesPendientes([]); return; }
    // Sin filtro de codigo_ie aquí a propósito: el codigo_ie de un alumno
    // puede venir con o sin ceros a la izquierda respecto al del perfil
    // (ver migración 0018), así que un .eq()/.or() por texto puede no
    // encontrarlo. La política RLS de plan_estado ya normaliza eso (ltrim)
    // y limita las filas a las del propio colegio -- es la fuente de verdad.
    const { data, error } = await supabase
      .from("plan_estado")
      .select("*")
      .eq("estado", "en_revision")
      .order("enviado_at", { ascending: true });
    setPlanesPendientes(error ? [] : (data as PlanEstadoRow[]));
  }

  return {
    planEstado, isLoadingPlanEstado, loadPlanEstado, enviarARevision, isEnviandoRevision,
    planesPendientes, loadPlanesPendientes, decidirPlan, isDecidiendoPlan,
  };
}
