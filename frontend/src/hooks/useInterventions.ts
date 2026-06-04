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

    // Obtener destinatarios del mismo distrito o IE
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

    const to      = recipients.map((r) => r.email);
    const subject = `[SATRA] Alerta de riesgo académico — Estudiante ···${shortId(selected.id)} · ${selected.distrito}`;
    const accion  = recommendation(selected);
    const fecha   = new Date().toLocaleDateString("es-PE", { dateStyle: "long" });

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#0f1f3d;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="color:#fff;margin:0;font-size:18px">⚠️ Alerta de Riesgo Académico</h2>
          <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">Sistema SATRA · UPC · P20261012</p>
        </div>
        <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
          <p style="margin:0 0 16px;color:#1e293b">Estimado/a equipo,</p>
          <p style="margin:0 0 16px;color:#475569">
            Se ha registrado una intervención sobre el siguiente estudiante en el sistema SATRA:
          </p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
            ${[
              ["Estudiante",       `···${shortId(selected.id)}`],
              ["Nivel de riesgo",  selected.nivel_riesgo],
              ["Probabilidad",     `${(selected.probabilidad_riesgo * 100).toFixed(1)}%`],
              ["Tipo de alerta",   selected.tipo_riesgo],
              ["Distrito",         selected.distrito],
              ["Puntaje Lectura",  selected.M500_L.toFixed(0)],
              ["Puntaje Ciencias", selected.M500_CN.toFixed(0)],
              ["ISE",              selected.ise.toFixed(2)],
            ].map(([k, v]) => `
              <tr>
                <td style="padding:8px 12px;background:#f1f5f9;border:1px solid #e2e8f0;font-weight:600;font-size:13px;color:#374151;width:40%">${k}</td>
                <td style="padding:8px 12px;background:#fff;border:1px solid #e2e8f0;font-size:13px;color:#1e293b">${v}</td>
              </tr>`).join("")}
          </table>
          <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:12px 16px;margin-bottom:20px">
            <strong style="color:#92400e;font-size:13px">Acción recomendada:</strong>
            <p style="color:#78350f;margin:4px 0 0;font-size:13px">${accion}</p>
          </div>
          <p style="color:#64748b;font-size:12px;margin:0">
            Por favor coordinen el seguimiento de este caso.<br>
            — Sistema SATRA · ${fecha}
          </p>
        </div>
      </div>
    `;

    try {
      // Llamar a la Edge Function de Supabase (API key de Resend queda en el servidor)
      const { data: fnData, error: fnError } = await supabase.functions.invoke("send-alert", {
        body: { to, subject, html },
      });

      if (fnError || !fnData?.ok) {
        // Fallback al mailto: si la Edge Function falla
        console.warn("Edge Function falló, usando mailto fallback:", fnError);
        const mailto = `mailto:${to.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
          `Estimado equipo,\n\nSe requiere intervención para el estudiante ···${shortId(selected.id)}.\n` +
          `Nivel: ${selected.nivel_riesgo} (${(selected.probabilidad_riesgo * 100).toFixed(1)}%)\n\n` +
          `Acción recomendada: ${accion}\n\n— SATRA · ${fecha}`
        )}`;
        window.open(mailto);
        toast(`Correo preparado para ${recipients.length} destinatario${recipients.length > 1 ? "s" : ""}. (modo manual)`, "info");
      } else {
        toast(`Alerta enviada automáticamente a ${recipients.length} destinatario${recipients.length > 1 ? "s" : ""}.`, "success");
      }
    } catch {
      // Si hay error de conexión, abrir mailto como fallback
      const mailto = `mailto:${to.join(",")}?subject=${encodeURIComponent(subject)}`;
      window.open(mailto);
      toast("Email preparado en tu cliente de correo.", "info");
    }

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
