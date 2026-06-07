-- ============================================================
-- 0009_scope_profiles_audit_rls.sql
-- Cierra la fuga de segregación de datos en la capa de seguridad (RLS).
--
-- PROBLEMA (introducido en 0007):
--   La política "profiles_select" terminaba en:
--       OR auth.role() = 'authenticated'
--   lo que permitía que CUALQUIER usuario logueado leyera TODOS los
--   perfiles del sistema (todos los colegios y distritos). El scoping
--   por colegio/distrito solo se aplicaba en el frontend, no en la BD.
--
-- SOLUCIÓN:
--   Un usuario solo puede leer perfiles de:
--     • su propio perfil,
--     • su mismo colegio  (codigo_ie),
--     • su mismo distrito (necesario para las alertas de equipo, que
--       notifican a directores/coordinadores del distrito),
--   y el superadmin ve todos. Como los 'admin' de colegio NO tienen
--   distrito asignado, en la práctica solo ven su propio colegio.
--
--   Además se scopea audit_log: un 'admin' solo ve la auditoría de
--   usuarios de SU colegio (antes la política dejaba ver toda la
--   auditoría y solo el frontend la filtraba).
--
-- Es idempotente: se puede correr varias veces sin error.
-- ============================================================

-- ─── 1. Helpers SECURITY DEFINER (leen sin pasar por RLS → sin recursión) ────

-- Distrito del usuario actual
CREATE OR REPLACE FUNCTION public.get_my_distrito()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT distrito FROM public.profiles WHERE id = auth.uid();
$$;

-- ¿El usuario `target_uid` pertenece al mismo colegio que yo?
-- (Si mi codigo_ie es NULL, nunca da TRUE.)
CREATE OR REPLACE FUNCTION public.same_ie_as_me(target_uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = target_uid
      AND p.codigo_ie IS NOT NULL
      AND p.codigo_ie = (SELECT codigo_ie FROM public.profiles WHERE id = auth.uid())
  );
$$;


-- ─── 2. profiles_select — scoping real por colegio + distrito ────────────────

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select"
ON public.profiles FOR SELECT
USING (
  auth.uid() = id                                                   -- mi propio perfil
  OR public.get_my_role() = 'superadmin'                            -- superadmin: todos
  OR (codigo_ie IS NOT NULL AND codigo_ie = public.get_my_ie())     -- mismo colegio
  OR (distrito  IS NOT NULL AND distrito  = public.get_my_distrito())-- mismo distrito (alertas de equipo)
);


-- ─── 3. audit_log_select — admin solo ve la auditoría de SU colegio ──────────

DROP POLICY IF EXISTS "audit_log_select" ON public.audit_log;

CREATE POLICY "audit_log_select"
ON public.audit_log FOR SELECT
USING (
  public.get_my_role() = 'superadmin'                              -- superadmin: toda
  OR (public.get_my_role() = 'admin'                              -- admin: solo eventos
      AND public.same_ie_as_me(usuario_id))                        --   de usuarios de su IE
);

-- ============================================================
-- Cómo probar tras aplicar (en el SQL editor de Supabase o psql):
--   1) Login como director de un colegio A:
--        select count(*) from profiles;            -- debe contar SOLO su colegio/distrito, no 3000+
--   2) Login como admin del colegio A:
--        select count(*) from profiles;            -- debe contar SOLO usuarios de su IE
--        select count(*) from audit_log;           -- debe contar SOLO auditoría de su IE
--   3) Login como superadmin:
--        select count(*) from profiles;            -- ve todos
--   4) Verificar que la alerta de equipo "Todo el distrito" sigue
--      encontrando destinatarios (loadTeamEmails / sendTeamAlert).
-- ============================================================
