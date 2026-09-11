-- ============================================================
-- borrar_usuarios_prueba_2.sql
-- Segunda pasada: borra 8 cuentas de prueba que sobrevivieron al primer
-- script (scripts/borrar_usuarios_prueba.sql) porque en algún momento de
-- las pruebas de "cambiar rol" quedaron con rol 'admin', y ese script
-- conservaba TODO lo que fuera admin/superadmin.
--
-- Esta vez se identifican por EMAIL exacto (no por rol), justamente porque
-- el rol ya no es un criterio confiable para distinguir "admin real" de
-- "cuenta de prueba que quedó en admin".
--
-- Se corre a mano en el SQL Editor de Supabase. NO es una migración.
--
-- Uso:
--   1) Corre primero el PASO 1 (SELECT) y confirma que son exactamente
--      estos 8 emails, ni uno más ni uno menos.
--   2) Si se ve correcto, corre el PASO 2 completo.
-- ============================================================

-- ─── PASO 1: vista previa -- SOLO LECTURA, no borra nada ────────────────────
select id, email, nombre, rol
from public.profiles
where email in (
  'dylanadmin123@upc.edu.pe',
  'gabriel456@upc.edu.pe',
  'jhon@upc.edu.pe',
  'hanna456@upc.edu.pe',
  'test1@upc.edu.pe',
  'omar@upc.edu.pe',
  'abel@upc.edu.pe',
  'manuel@upc.edu.pe'
)
order by email;


-- ─── PASO 2: borrado real (correr completo, es una sola transacción) ────────
begin;

create temporary table _uids_a_borrar as
  select id from public.profiles
  where email in (
    'dylanadmin123@upc.edu.pe',
    'gabriel456@upc.edu.pe',
    'jhon@upc.edu.pe',
    'hanna456@upc.edu.pe',
    'test1@upc.edu.pe',
    'omar@upc.edu.pe',
    'abel@upc.edu.pe',
    'manuel@upc.edu.pe'
  );

delete from public.anotaciones     where autor_id       in (select id from _uids_a_borrar);
delete from public.intervenciones  where registrado_por in (select id from _uids_a_borrar);
delete from public.plan_hitos      where autor_id        in (select id from _uids_a_borrar);
delete from public.audit_log       where usuario_id      in (select id from _uids_a_borrar);
delete from public.notificaciones  where autor_id in (select id from _uids_a_borrar)
                                       or destinatario_id in (select id from _uids_a_borrar);

delete from auth.users where id in (select id from _uids_a_borrar);

drop table _uids_a_borrar;

commit;
