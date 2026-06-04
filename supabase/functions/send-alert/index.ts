/**
 * send-alert — Edge Function de Supabase
 * Envía alertas de riesgo académico por email usando Resend.
 *
 * POST /functions/v1/send-alert
 * Body: { to: string[], subject: string, html: string, text: string }
 * Headers: Authorization: Bearer <supabase_anon_key>
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY no configurada en Supabase Secrets." }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const { to, subject, html, text } = await req.json() as {
      to: string[];
      subject: string;
      html: string;
      text?: string;
    };

    if (!to?.length || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Faltan campos: to, subject, html." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Llamar a la API de Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:    "SATRA — Alerta Académica <onboarding@resend.dev>",
        to,
        subject,
        html,
        text: text ?? html.replace(/<[^>]+>/g, ""),
      }),
    });

    const data = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", data);
      return new Response(
        JSON.stringify({ error: "Error de Resend", detail: data }),
        { status: resendRes.status, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, id: data.id, destinatarios: to.length }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Edge Function error:", err);
    return new Response(
      JSON.stringify({ error: "Error interno", detail: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
