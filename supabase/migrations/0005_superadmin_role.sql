-- ============================================================
-- 0005_superadmin_role.sql
-- Introduce el rol 'superadmin' con acceso total al sistema.
-- Los 'admin' quedan limitados a su propio colegio (codigo_ie).
-- ============================================================

-- ─── 1. Ampliar CHECK constraint para incluir 'superadmin' ───────────────────

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_rol_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_rol_check
  CHECK (rol IN ('superadmin', 'admin', 'director'));


-- ─── 2. Promover al admin actual a superadmin ────────────────────────────────

UPDATE public.profiles
SET rol = 'superadmin'
WHERE email = 'admin@tesis.pe';


-- ─── 3. Actualizar trigger de auto-creación de perfil ───────────────────────
-- (sigue defaulteando a 'director' para registros públicos)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nombre, rol)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
    COALESCE(NEW.raw_user_meta_data->>'rol', 'director')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


-- ─── 4. Actualizar políticas RLS de profiles ─────────────────────────────────

-- Eliminar políticas antiguas basadas en 'admin'
DROP POLICY IF EXISTS "admin_all_profiles"           ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "users_update_own_profile"     ON public.profiles;

-- Superadmin: acceso total
CREATE POLICY "superadmin_all_profiles"
ON public.profiles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.rol = 'superadmin' AND p.activo = true
  )
);

-- Cualquier usuario autenticado puede leer su propio perfil
CREATE POLICY "select_own_profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Admin de colegio: puede ver y gestionar solo los perfiles de su IE
CREATE POLICY "admin_manage_own_ie_profiles"
ON public.profiles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.rol = 'admin'
      AND p.activo = true
      AND p.codigo_ie IS NOT NULL
      AND p.codigo_ie = profiles.codigo_ie
  )
);

-- Cada usuario puede actualizar su propio perfil
CREATE POLICY "users_update_own_profile"
ON public.profiles FOR UPDATE
USING     (auth.uid() = id)
WITH CHECK (auth.uid() = id);


-- ─── 5. Actualizar políticas que referencian 'admin' en otras tablas ─────────

-- audit_log: superadmin puede leer todo
DROP POLICY IF EXISTS "admin_read_audit" ON public.audit_log;

CREATE POLICY "superadmin_read_audit"
ON public.audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.rol = 'superadmin' AND p.activo = true
  )
);

-- modelos_versiones: solo superadmin puede escribir
DROP POLICY IF EXISTS "admin_write_modelos" ON public.modelos_versiones;

CREATE POLICY "superadmin_write_modelos"
ON public.modelos_versiones FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.rol = 'superadmin' AND p.activo = true
  )
);
