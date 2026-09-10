-- ============================================================
-- borrar_usuarios_prueba.sql
-- Borra TODAS las cuentas de prueba (todo lo que no sea admin/superadmin)
-- y todo lo que registraron: anotaciones, intervenciones (comentarios),
-- planes (plan_hitos), notificaciones y su rastro en audit_log.
--
-- Se corre a mano en el SQL Editor de Supabase. NO es una migración
-- (no va en supabase/migrations/) -- es una limpieza de una sola vez.
--
-- Uso:
--   1) Corre primero el PASO 1 (SELECT) y revisa la lista de emails.
--   2) Si se ve correcta, corre el PASO 2 completo (está en una sola
--      transacción: si algo falla, no se borra nada).
-- ============================================================

-- ─── PASO 1: vista previa -- SOLO LECTURA, no borra nada ────────────────────
select id, email, nombre, rol
from public.profiles
where rol not in ('admin', 'superadmin')
order by rol, email;


-- ─── PASO 2: borrado real (correr completo, es una sola transacción) ────────
begin;

create temporary table _uids_a_borrar as
  select id from public.profiles where rol not in ('admin', 'superadmin');

-- Estas 4 tablas tienen ON DELETE SET NULL desde profiles -- sin este paso
-- las filas se quedarían huérfanas (con el autor en null) en vez de
-- desaparecer. plan_hitos ya es ON DELETE CASCADE, pero se borra igual
-- aquí de forma explícita por prolijidad.
delete from public.anotaciones     where autor_id       in (select id from _uids_a_borrar);
delete from public.intervenciones  where registrado_por in (select id from _uids_a_borrar);
delete from public.plan_hitos      where autor_id        in (select id from _uids_a_borrar);
delete from public.audit_log       where usuario_id      in (select id from _uids_a_borrar);
delete from public.notificaciones  where autor_id in (select id from _uids_a_borrar)
                                       or destinatario_id in (select id from _uids_a_borrar);

-- Borrar de auth.users elimina en cascada la fila de profiles
-- (profiles.id -> auth.users(id) ON DELETE CASCADE, ver 0001_init.sql).
delete from auth.users where id in (select id from _uids_a_borrar);

drop table _uids_a_borrar;

commit;
