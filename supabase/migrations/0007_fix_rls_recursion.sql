-- ============================================================
-- 0007_fix_rls_recursion.sql
-- Arregla recursión infinita en políticas RLS de profiles.
-- El problema: políticas que hacen SELECT FROM profiles para verificar
-- el rol del usuario disparan la misma política infinitamente.
-- Solución: función SECURITY DEFINER que lee el rol sin pasar por RLS.
-- ============================================================

-- ─── 1. Función que devuelve el rol del usuario actual ─────────────────────────
-- SECURITY DEFINER: corre con permisos del owner, bypaseando RLS

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT rol FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_ie()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT codigo_ie FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_my_account_active()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT activo FROM public.profiles WHERE id = auth.uid();
$$;


-- ─── 2. Eliminar TODAS las políticas previas de profiles (idempotente) ──────

DROP POLICY IF EXISTS "superadmin_all_profiles"        ON public.profiles;
DROP POLICY IF EXISTS "admin_manage_own_ie_profiles"   ON public.profiles;
DROP POLICY IF EXISTS "select_own_profile"             ON public.profiles;
DROP POLICY IF EXISTS "users_update_own_profile"       ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_or_admin"   ON public.profiles;
DROP POLICY IF EXISTS "admin_all_profiles"             ON public.profiles;
DROP POLICY IF EXISTS "profiles_select"                ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert"                ON public.profiles;
DROP POLICY IF EXISTS "profiles_update"                ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete"                ON public.profiles;


-- ─── 3. Recrear políticas usando las funciones SECURITY DEFINER ──────────────

-- SELECT: usuario lee su propio perfil, O es superadmin, O es admin de la misma IE
CREATE POLICY "profiles_select"
ON public.profiles FOR SELECT
USING (
  auth.uid() = id
  OR public.get_my_role() = 'superadmin'
  OR (public.get_my_role() = 'admin' AND codigo_ie = public.get_my_ie())
  OR auth.role() = 'authenticated'  -- todos los autenticados pueden ver perfiles básicos (necesario para joins)
);

-- INSERT: solo el trigger o el propio usuario crean perfiles
CREATE POLICY "profiles_insert"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- UPDATE: el propio usuario actualiza su perfil, O un superadmin, O un admin de la misma IE
CREATE POLICY "profiles_update"
ON public.profiles FOR UPDATE
USING (
  auth.uid() = id
  OR public.get_my_role() = 'superadmin'
  OR (public.get_my_role() = 'admin' AND codigo_ie = public.get_my_ie())
)
WITH CHECK (
  auth.uid() = id
  OR public.get_my_role() = 'superadmin'
  OR (public.get_my_role() = 'admin' AND codigo_ie = public.get_my_ie())
);

-- DELETE: solo superadmin
CREATE POLICY "profiles_delete"
ON public.profiles FOR DELETE
USING (public.get_my_role() = 'superadmin');


-- ─── 4. Arreglar también las políticas de audit_log y modelos_versiones ──────

DROP POLICY IF EXISTS "superadmin_read_audit"     ON public.audit_log;
DROP POLICY IF EXISTS "admin_read_audit"           ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_select"           ON public.audit_log;
DROP POLICY IF EXISTS "superadmin_write_modelos"   ON public.modelos_versiones;
DROP POLICY IF EXISTS "admin_write_modelos"        ON public.modelos_versiones;
DROP POLICY IF EXISTS "modelos_versiones_all"      ON public.modelos_versiones;

CREATE POLICY "audit_log_select"
ON public.audit_log FOR SELECT
USING (
  public.get_my_role() = 'superadmin'
  OR public.get_my_role() = 'admin'  -- admin de IE ve auditoría filtrada en frontend
);

CREATE POLICY "modelos_versiones_all"
ON public.modelos_versiones FOR ALL
USING (public.get_my_role() = 'superadmin');


-- ─── 5. Arreglar políticas de anotaciones e intervenciones que también las usaban ─

DROP POLICY IF EXISTS "owner_or_director_update_anotaciones" ON public.anotaciones;
CREATE POLICY "owner_or_director_update_anotaciones"
ON public.anotaciones FOR UPDATE
USING (
  autor_id = auth.uid()
  OR public.get_my_role() = 'director'
)
WITH CHECK (
  autor_id = auth.uid()
  OR public.get_my_role() = 'director'
);

DROP POLICY IF EXISTS "owner_or_director_update_hitos" ON public.plan_hitos;
CREATE POLICY "owner_or_director_update_hitos"
ON public.plan_hitos FOR UPDATE
USING (
  autor_id = auth.uid()
  OR public.get_my_role() = 'director'
)
WITH CHECK (
  autor_id = auth.uid()
  OR public.get_my_role() = 'director'
);

DROP POLICY IF EXISTS "owner_or_director_update_intervenciones" ON public.intervenciones;
CREATE POLICY "owner_or_director_update_intervenciones"
ON public.intervenciones FOR UPDATE
USING (
  registrado_por = auth.uid()
  OR public.get_my_role() = 'director'
);
