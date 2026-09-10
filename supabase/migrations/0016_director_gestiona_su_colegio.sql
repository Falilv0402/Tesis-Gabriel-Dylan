-- ============================================================
-- 0016_director_gestiona_su_colegio.sql
-- Permite que el Director de un colegio (no solo el Admin/Superadmin)
-- gestione a su propio equipo: cambiar el rol entre Director y
-- Coordinador, y activar/desactivar cuentas -- siempre dentro de SU
-- MISMO colegio (codigo_ie), y solo entre esos dos roles (nunca puede
-- tocar cuentas admin/superadmin ni promover a nadie a esos roles).
--
-- Antes: profiles_update solo dejaba tocar otros perfiles a superadmin
-- o a un admin de la misma IE. El director no podía cambiar el rol de
-- nadie, ni siquiera dentro de su propio colegio.
--
-- Es idempotente: se puede correr varias veces sin error.
-- ============================================================

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

CREATE POLICY "profiles_update"
ON public.profiles FOR UPDATE
USING (
  auth.uid() = id
  OR public.get_my_role() = 'superadmin'
  OR (public.get_my_role() = 'admin' AND codigo_ie = public.get_my_ie())
  OR (
    public.get_my_role() = 'director'
    AND codigo_ie = public.get_my_ie()
    AND rol IN ('director', 'coordinador')
  )
)
WITH CHECK (
  auth.uid() = id
  OR public.get_my_role() = 'superadmin'
  OR (public.get_my_role() = 'admin' AND codigo_ie = public.get_my_ie())
  OR (
    public.get_my_role() = 'director'
    AND codigo_ie = public.get_my_ie()
    AND rol IN ('director', 'coordinador')
  )
);

-- ============================================================
-- Cómo probar tras aplicar (SQL editor de Supabase):
--   1) Login como Director del colegio A, con un Coordinador también
--      en el colegio A:
--        update profiles set rol = 'director' where id = '<id del coordinador>';
--        -- debe funcionar (mismo colegio, director<->coordinador)
--   2) El mismo Director intenta tocar un Admin o alguien de OTRO colegio:
--        update profiles set rol = 'coordinador' where id = '<id de un admin>';
--        -- debe fallar (0 filas afectadas) por RLS
--   3) El mismo Director intenta promoverse a sí mismo o a otro a 'admin':
--        update profiles set rol = 'admin' where id = '<id cualquiera>';
--        -- debe fallar (0 filas afectadas) por el WITH CHECK
-- ============================================================
