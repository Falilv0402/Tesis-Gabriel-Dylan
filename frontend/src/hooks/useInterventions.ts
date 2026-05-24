"use client";

import { useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { ShapData, Student } from "@/types";
import { supabase } from "@/lib/supabase";
import { recommendation, shortId } from "@/lib/format";
import { generateStudentPdf } from "@/lib/studentPdfExport";
import { useAnnotations } from "@/hooks/useAnnotations";

export type Intervention = {
  id: string;
  codigo_estudiante: string | null;
  tipo: string;
  descripcion: string;
  estado: string;
  fecha: string;
  registrado_por?: string | null;
  autor_nombre?: string | null;
  autor_email?: string | null;
  es_propia?: boolean;
};

export function useInterventions(
  session:          User | null,
  selected:         Student | undefined,
  profileCodigoIe:  string | null,
  profileDistrito:  string | null,
  notifScopeProp:   "distrito" | "ie",
  role:             string,
  toast:            (msg: string, type?: "success" | "error" | "info") => void,
  insertAudit:      (accion: string, tabla?: string, detalle?: object) => Promise<void>,
) {
  const [interventions,      setInterventions]      = useState<Intervention[]>([]);
  const [tipoIntervencion,   setTipoIntervencion]   = useState<"tutoria" | "reunion" | "derivacion" | "seguimiento">("tutoria");
  const [descIntervencion,   setDescIntervencion]   = useState("");
  const [notifScope,         setNotifScope]         = useState<"distrito" | "ie">(notifScopeProp);
  const [isSendingAlert,     setIsSendingAlert]     = useState(false);
  const [teamEmails,         setTeamEmails]         = useState<{ email: string; nombre: string | null }[]>([]);
  const [isGeneratingStudentPdf, setIsGeneratingStudentPdf] = useState(false);

  // Annotations delegated to sub-hook
  const annotationsHook = useAnnotations(session, selected, insertAudit, toast);

  // ── Stats ────────────────────────────────────────────────────────────────
  const interventionStats = useMemo(() => {
    if (interventions.length === 0) return null;
    const byTipo:   Record<string, { total: number; cerradas: number }> = {};
    const byEstado: Record<string, number> = {};
    for (const i of interventions) {
      const tipo = i.tipo || "sin tipo";
      byTipo[tipo] = byTipo[tipo] ?? { total: 0, cerradas: 0 };
      byTipo[tipo].total++;
      if (i.estado === "cerrada") byTipo[tipo].cerradas++;
      byEstado[i.estado] = (byEstado[i.estado] ?? 0) + 1;
    }
    const total     = interventions.length;
    const cerradas  = byEstado["cerrada"]   ?? 0;
    const enProceso = byEstado["en_proceso"] ?? 0;
    const pendientes= byEstado["pendiente"] ?? 0;
    return { total, cerradas, enProceso, pendientes, byTipo, tasaCierre: cerradas / Math.max(total, 1) };
  }, [interventions]);

  // ── CRUD ─────────────────────────────────────────────────────────────────
  async function loadInterventions() {
    if (!session) return;
    const { data } = await supabase
      .from("intervenciones")
      .select("id, codigo_estudiante, tipo, descripcion, estado, fecha, registrado_por, profiles(nombre, email)")
      .order("fecha", { ascending: false })
      .limit(100);
    if (data) {
      setInterventions(
        data.map((i: Record<string, unknown>) => {
          const p = i.profiles as { nombre?: string; email?: string } | null;
          return {
            id:                i.id as string,
            codigo_estudiante: i.codigo_estudiante as string | null,
            tipo:              i.tipo as string,
            descripcion:       i.descripcion as string,
            estado:            i.estado as string,
            fecha:             i.fecha as string,
            registrado_por:    i.registrado_por as string | null,
            autor_nombre:      p?.nombre ?? null,
            autor_email:       p?.email  ?? null,
            es_propia:         i.registrado_por === session.id,
          };
        })
      );
    }
  }

  async function handleRegistrarIntervencion(authBusy: boolean, setAuthBusy: (v: boolean) => void) {
    if (!selected || !session) return;
    setAuthBusy(true);
    const desc = descIntervencion.trim() || recommendation(selected);
    const { error } = await supabase.from("intervenciones").insert({
      codigo_estudiante: selected.id,
      tipo:             tipoIntervencion,
      descripcion:      desc,
      estado:           "pendiente",
      registrado_por:   session.id,
    });
    if (!error) {
      await insertAudit("Registrar intervencion", "intervenciones", { estudiante: selected.id, tipo: tipoIntervencion });
      toast("Intervencion registrada en la base de datos.");
      setDescIntervencion("");
      void loadInterventions();
    } else {
      toast("Error al guardar la intervencion.", "error");
    }
    setAuthBusy(false);
  }

  // ── Team alert ───────────────────────────────────────────────────────────
  async function loadTeamEmails() {
    if (!profileDistrito || !session) return;
    let query = supabase
      .from("profiles")
      .select("email, nombre")
      .eq("activo", true)
      .neq("id", session.id)
      .not("email", "is", null);
    if (notifScope === "ie" && profileCodigoIe) {
      query = query.eq("codigo_ie", profileCodigoIe);
    } else {
      query = query.eq("distrito", profileDistrito);
    }
    const { data, error } = await query;
    if (!error && data) setTeamEmails(data as { email: string; nombre: string | null }[]);
  }

  async function sendTeamAlert() {
    if (!selected || !session) return;
    setIsSendingAlert(true);
    let query = supabase
      .from("profiles")
      .select("email, nombre")
      .eq("activo", true)
      .neq("id", session.id)
      .not("email", "is", null);
    if (notifScope === "ie" && profileCodigoIe) {
      query = query.eq("codigo_ie", profileCodigoIe);
    } else {
      query = query.eq("distrito", profileDistrito);
    }
    const { data } = await query;
    const recipients: { email: string; nombre: string | null }[] = data ?? [];

    if (recipients.length === 0) {
      toast("No hay otros usuarios registrados en tu " + (notifScope === "ie" ? "IE" : "distrito") + ".", "info");
      setIsSendingAlert(false);
      return;
    }

    const to      = recipients.map((r) => r.email).join(",");
    const subject = encodeURIComponent(`[SATRA] Alerta de riesgo académico — Estudiante ${shortId(selected.id)} · ${selected.distrito}`);
    const body    = encodeURIComponent(
      `Estimado/a equipo,\n\n` +
      `Se ha registrado una intervención sobre el siguiente estudiante:\n\n` +
      `  • Estudiante:       ${shortId(selected.id)}\n` +
      `  • Nivel de riesgo:  ${selected.nivel_riesgo}\n` +
      `  • Probabilidad:     ${(selected.probabilidad_riesgo * 100).toFixed(1)}%\n` +
      `  • Tipo de alerta:   ${selected.tipo_riesgo}\n` +
      `  • Distrito:         ${selected.distrito}\n` +
      `  • Puntaje Lectura:  ${selected.M500_L.toFixed(0)}\n` +
      `  • Puntaje Ciencias: ${selected.M500_CN.toFixed(0)}\n` +
      `  • ISE:              ${selected.ise.toFixed(2)}\n\n` +
      `Acción recomendada: ${recommendation(selected)}\n\n` +
      `Por favor coordinen el seguimiento de este caso.\n\n` +
      `— Sistema SATRA · ${new Date().toLocaleDateString("es-PE", { dateStyle: "long" })}`
    );
    window.open(`mailto:${to}?subject=${subject}&body=${body}`);
    toast(`Correo preparado para ${recipients.length} destinatario${recipients.length > 1 ? "s" : ""}.`, "success");
    await insertAudit("Enviar alerta por email", "intervenciones", {
      estudiante: selected.id, destinatarios: recipients.length, scope: notifScope,
    });
    setIsSendingAlert(false);
  }

  // ── PDF export ───────────────────────────────────────────────────────────
  async function exportStudentPdf(shapData: ShapData | null, sessionEmail: string) {
    if (!selected) return;
    setIsGeneratingStudentPdf(true);
    try {
      await generateStudentPdf(selected, shapData, annotationsHook.annotations, sessionEmail);
      await insertAudit("Exportar PDF individual", "reportes", { id_estudiante: selected.id });
      toast("Reporte individual generado", "success");
    } finally {
      setIsGeneratingStudentPdf(false);
    }
  }

  return {
    interventions, setInterventions,
    tipoIntervencion, setTipoIntervencion,
    descIntervencion, setDescIntervencion,
    notifScope, setNotifScope,
    isSendingAlert, teamEmails,
    isGeneratingStudentPdf,
    interventionStats,
    // annotations
    annotations:          annotationsHook.annotations,
    annotationText:       annotationsHook.annotationText,
    setAnnotationText:    annotationsHook.setAnnotationText,
    isSavingAnnotation:   annotationsHook.isSavingAnnotation,
    loadAnnotations:      annotationsHook.loadAnnotations,
    saveAnnotation:       annotationsHook.saveAnnotation,
    // actions
    loadInterventions, handleRegistrarIntervencion,
    loadTeamEmails, sendTeamAlert, exportStudentPdf,
  };
}
