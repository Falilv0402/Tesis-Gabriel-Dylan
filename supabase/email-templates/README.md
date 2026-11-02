# Plantillas de correo de Supabase Auth (SATRA)

Textos en español y con la marca de SATRA para los correos que envía Supabase Auth.
No llevan secretos: se pegan a mano en el panel (Supabase no las toma del repositorio).

**Dónde pegarlas:** Supabase › Authentication › Emails › Templates. Para cada plantilla se
pega el asunto en «Subject» y el HTML en «Message body».

| Plantilla de Supabase | Archivo | Asunto |
| --- | --- | --- |
| Confirm sign up | `confirm-signup.html` | `Confirma tu cuenta en SATRA` |
| Reset password | `recovery.html` | `Restablece tu contraseña de SATRA` |
| Change email address | `email-change.html` | `Confirma tu nuevo correo en SATRA` |

Variables de Supabase usadas: `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}`.
No las cambies. Las demás plantillas (Invite user, Magic link, Reauthentication) no se usan en SATRA.

## Envío con dominio propio (Resend)

Resend solo entrega a destinatarios arbitrarios desde un dominio verificado. Pasos:

1. Resend › Domains › Add Domain › `satraapp.com` (región cercana, p. ej. `us-east-1`).
2. Agregar en Cloudflare (DNS) los registros que Resend muestra (DKIM `TXT`, SPF `TXT` y `MX` del
   subdominio `send`). Sin proxy (nube gris). Volver a Resend › Verify DNS Records.
3. Resend › API Keys › crear una clave nueva (permiso «Sending access», dominio `satraapp.com`).
   Revocar la clave anterior.
4. Supabase › Authentication › Emails › SMTP Settings › Enable custom SMTP:
   remitente `no-reply@satraapp.com`, nombre `SATRA`, host `smtp.resend.com`, puerto `465`,
   usuario `resend`, contraseña = la clave nueva de Resend.
5. Supabase › Edge Functions › Secrets: `RESEND_API_KEY` = la clave nueva y
   `ALERT_FROM` = `SATRA — Alerta Académica <alertas@satraapp.com>`. Volver a desplegar
   `send-alert` (`supabase functions deploy send-alert`).
6. Supabase › Authentication › Rate Limits: subir «emails por hora» si hace falta (con SMTP propio
   el límite inicial es bajo).
