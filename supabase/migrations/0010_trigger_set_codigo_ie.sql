-- ============================================================
-- 0010_trigger_set_codigo_ie.sql
-- Corrige el bug "El perfil se creó pero no se pudo asignar el colegio".
--
-- CAUSA RAÍZ:
--   El trigger handle_new_user solo guardaba nombre y rol desde los
--   metadatos del usuario, pero ignoraba codigo_ie y distrito.
--   Cuando handleCreateUser (frontend) hacía signUp con esos campos en
--   options.data, el trigger creaba el perfil con codigo_ie = NULL.
--   Luego el frontend intentaba un UPDATE para setear codigo_ie, pero:
--     • Si el rol del creador es 'admin': la política profiles_update
--       exige que codigo_ie = get_my_ie() en la fila a actualizar.
--       Como la fila tiene NULL, la condición falla silenciosamente
--       → el UPDATE afecta 0 filas → el loop de 12 reintentos no termina
--       → toast de error después de 4.8 s.
--     • Si signUp reemplaza la sesión (email-confirm desactivado), el
--       UPDATE corre como el nuevo usuario antes de que el perfil exista.
--
-- SOLUCIÓN:
--   Leer codigo_ie y distrito desde raw_user_meta_data en el trigger
--   (SECURITY DEFINER → bypasea RLS → sin race condition, sin reintentos).
--   El frontend ya pasa esos valores como options.data.
--   No se necesita ningún UPDATE posterior.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nombre, rol, codigo_ie, distrito)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
    COALESCE(NEW.raw_user_meta_data->>'rol', 'director'),
    -- NULLIF convierte la cadena vacía "" a NULL correctamente
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'codigo_ie', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'distrito',  '')), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- El trigger ya existe (creado en 0003), solo se actualiza la función.
-- No hace falta recrearlo.
