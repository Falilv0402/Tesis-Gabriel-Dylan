-- ============================================================
-- 0008_check_director_exists.sql
-- Permite verificar si un colegio (codigo_ie) ya tiene director
-- sin necesidad de estar autenticado. Necesario para el flujo
-- de registro donde el usuario todavía no tiene sesión.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ie_has_director(p_codigo_ie text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER       -- corre con permisos del owner, ignora RLS
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE codigo_ie = p_codigo_ie
      AND rol = 'director'
      AND activo = true
  );
$$;

-- Permitir que tanto usuarios anónimos como autenticados puedan llamar la función
GRANT EXECUTE ON FUNCTION public.ie_has_director(text) TO anon, authenticated;
