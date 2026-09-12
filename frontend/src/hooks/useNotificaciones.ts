"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type NotificacionRow = {
  id: string;
  tipo: "anotacion" | "hito" | "plan";
  estudiante_id: string | null;
  estudiante_nombre: string | null;
  mensaje: string;
  autor_nombre: string | null;
  leido: boolean;
  created_at: string;
};

interface CrearNotificacionParams {
  codigoIe: string | null | undefined;
  tipo: "anotacion" | "hito" | "plan";
  estudianteId: string;
  estudianteNombre: string;
  mensaje: string;
  autorNombre: string;
}

interface NotificarDirigidaParams {
  codigoIe: string | null | undefined;
  destinatarioId: string;
  estudianteId: string;
  estudianteNombre: string;
  mensaje: string;
  autorNombre: string;
}

/**
 * Notificaciones entre directores/coordinadores del mismo colegio: cuando
 * uno agrega una anotación o agenda un hito, los demás lo ven aquí (no solo
 * el toast local de quien lo hizo). Ver migración 0013_notificaciones.sql.
 */
export function useNotificaciones(session: User | null) {
  const [notificaciones, setNotificaciones] = useState<NotificacionRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    if (!session) { setNotificaciones([]); setUnreadCount(0); return; }
    const { data, error } = await supabase
      .from("notificaciones")
      .select("id, tipo, estudiante_id, estudiante_nombre, mensaje, autor_nombre, leido, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    // Best-effort: si la migracion 0013 aun no se aplico, la tabla no existe
    // y esto falla en silencio (la bandeja simplemente queda vacia).
    if (error) { setNotificaciones([]); setUnreadCount(0); return; }
    setNotificaciones(data ?? []);
    setUnreadCount((data ?? []).filter((n) => !n.leido).length);
  }, [session]);

  useEffect(() => { void load(); }, [load]);

  // Realtime: refresca la bandeja apenas llega una notificacion nueva para
  // este usuario, sin esperar a que abra el panel o recargue la pagina.
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`notificaciones-${session.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificaciones", filter: `destinatario_id=eq.${session.id}` },
        () => void load()
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [session, load]);

  async function marcarLeida(id: string) {
    setNotificaciones((prev) => prev.map((n) => n.id === id ? { ...n, leido: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
    await supabase.from("notificaciones").update({ leido: true }).eq("id", id);
  }

  async function marcarTodasLeidas() {
    const pendientes = notificaciones.filter((n) => !n.leido).map((n) => n.id);
    if (pendientes.length === 0) return;
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leido: true })));
    setUnreadCount(0);
    await supabase.from("notificaciones").update({ leido: true }).in("id", pendientes);
  }

  /** Crea una fila por cada director/coordinador activo del mismo colegio (menos el autor). */
  async function crearNotificacion({
    codigoIe, tipo, estudianteId, estudianteNombre, mensaje, autorNombre,
  }: CrearNotificacionParams) {
    if (!session || !codigoIe) return;
    const ieNorm = String(parseInt(codigoIe, 10));
    const { data: destinatarios } = await supabase
      .from("profiles")
      .select("id")
      .eq("activo", true)
      .in("rol", ["director", "coordinador"])
      .neq("id", session.id)
      .or(`codigo_ie.eq.${codigoIe},codigo_ie.eq.${ieNorm}`);
    if (!destinatarios || destinatarios.length === 0) return;

    const filas = destinatarios.map((d) => ({
      codigo_ie: codigoIe,
      tipo,
      estudiante_id: estudianteId,
      estudiante_nombre: estudianteNombre,
      mensaje,
      autor_id: session.id,
      autor_nombre: autorNombre,
      destinatario_id: d.id,
    }));
    // Best-effort: si la migracion 0013 no se aplico, esto falla en
    // silencio y no debe romper el flujo de guardar la anotacion/hito.
    await supabase.from("notificaciones").insert(filas);
  }

  /** Notifica a UN destinatario puntual (ej. avisar al Coordinador que
   * envió un plan a revisión cuál fue la decisión del Director) -- a
   * diferencia de crearNotificacion, que siempre le avisa a todo el equipo. */
  async function notificarDirigida({
    codigoIe, destinatarioId, estudianteId, estudianteNombre, mensaje, autorNombre,
  }: NotificarDirigidaParams) {
    if (!session || !codigoIe || !destinatarioId || destinatarioId === session.id) return;
    await supabase.from("notificaciones").insert({
      codigo_ie: codigoIe,
      tipo: "plan",
      estudiante_id: estudianteId,
      estudiante_nombre: estudianteNombre,
      mensaje,
      autor_id: session.id,
      autor_nombre: autorNombre,
      destinatario_id: destinatarioId,
    });
  }

  return { notificaciones, unreadCount, loadNotificaciones: load, marcarLeida, marcarTodasLeidas, crearNotificacion, notificarDirigida };
}
