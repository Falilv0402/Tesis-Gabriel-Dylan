-- ============================================================
-- 0020_proteger_rol_en_perfiles.sql
-- Cierra dos formas de auto-asignarse un rol que no corresponde.
--
-- PROBLEMA 1 — registro:
--   handle_new_user (0010) copiaba el 'rol' de raw_user_meta_data tal cual.
--   Esos metadatos los manda quien se registra, así que el registro público
--   permitía crear una cuenta con cualquier rol.
--
-- PROBLEMA 2 — actualización del propio perfil:
--   La política profiles_update deja a cada usuario actualizar SU fila
--   (auth.uid() = id) tanto en USING como en WITH CHECK, sin mirar qué
--   columnas cambian. Un usuario con sesión podía ponerse otro rol, moverse
--   a otro colegio (codigo_ie) o a otro distrito, o reactivar su cuenta.
--   El rol y el colegio mandan sobre casi todas las demás políticas y sobre
--   el backend (lee el perfil para decidir qué colegio puede ver cada quien).
--
-- SOLUCIÓN:
--   1) handle_new_user nunca otorga 'admin' ni 'superadmin': desde el
--      registro solo salen 'director' o 'coordinador' (lo demás -> coordinador,
--      el rol de menor privilegio), y un colegio que ya tiene director activo
--      no recibe otro desde el registro.
--   2) Trigger profiles_proteger_campos_sensibles (BEFORE INSERT/UPDATE),
--      independiente de las políticas RLS (que pueden tener otras políticas
--      permisivas sumadas): solo deja cambiar rol / codigo_ie / distrito /
--      activo a quien corresponde. Si no hay usuario autenticado (SQL Editor,
--      service_role, el propio signUp) no estorba.
--   3) Se elimina la política profiles_insert: los perfiles solo los crea el
--      trigger de registro; el frontend nunca inserta en profiles.
--
-- QUIÉN PUEDE QUÉ (actor = usuario autenticado y activo):
--   rol:        superadmin -> cualquiera.
--               admin      -> en su colegio, sin tocar ni otorgar 'superadmin'.
--               director   -> en su colegio, solo entre 'director' y 'coordinador'.
--               cualquier otro (incluido uno mismo) -> no puede.
--   codigo_ie:  superadmin; o el propio usuario SOLO la primera vez (cuando es
--               NULL: así funciona el registro). Si en esa primera asignación
--               era 'director' y el colegio ya tiene uno activo, pasa a
--               'coordinador'.
--   distrito:   superadmin; o el propio usuario solo la primera vez.
--   activo:     nadie puede reactivarse a sí mismo (salvo superadmin).
--
-- CAMBIO DE COMPORTAMIENTO PARA EL FRONTEND: como el registro ya no otorga
-- 'admin', useAdmin.ts (crear usuario) sube el rol con un UPDATE posterior,
-- hecho por quien crea la cuenta (que sí tiene permiso). Va en el mismo commit.
--
-- Es idempotente: se puede correr varias veces sin error.
-- ============================================================

-- ─── 1. Registro: el rol de los metadatos ya no se acepta tal cual ───────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ie  text := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'codigo_ie', '')), '');
  v_rol text := lower(COALESCE(NEW.raw_user_meta_data->>'rol', ''));
BEGIN
  -- Desde el registro solo se puede ser director o coordinador.
  IF v_rol NOT IN ('director', 'coordinador') THEN
    v_rol := 'coordinador';
  END IF;

  -- Un colegio con director activo no recibe otro desde el registro.
  IF v_rol = 'director' AND v_ie IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE ltrim(p.codigo_ie, '0') = ltrim(v_ie, '0') AND p.rol = 'director' AND p.activo
  ) THEN
    v_rol := 'coordinador';
  END IF;

  INSERT INTO public.profiles (id, email, nombre, rol, codigo_ie, distrito)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
    v_rol,
    v_ie,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'distrito', '')), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


-- ─── 2. Campos sensibles de profiles: solo cambian quienes corresponde ───────

CREATE OR REPLACE FUNCTION public.profiles_proteger_campos_sensibles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor     uuid := auth.uid();
  v_rol_actor text;
  v_ie_actor  text;
  v_mismo_ie  boolean;
BEGIN
  -- Sin usuario autenticado: SQL Editor, service_role o el propio signUp.
  IF v_actor IS NULL THEN
    RETURN NEW;
  END IF;

  -- Rol y colegio de quien hace el cambio (si su cuenta está inactiva, no cuenta).
  SELECT p.rol, p.codigo_ie INTO v_rol_actor, v_ie_actor
  FROM public.profiles p
  WHERE p.id = v_actor AND p.activo = true;

  IF TG_OP = 'INSERT' THEN
    IF v_rol_actor = 'superadmin' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Los perfiles solo se crean al registrar la cuenta'
      USING ERRCODE = '42501';
  END IF;

  v_mismo_ie := OLD.codigo_ie IS NOT NULL
                AND v_ie_actor IS NOT NULL
                AND ltrim(OLD.codigo_ie, '0') = ltrim(v_ie_actor, '0');

  -- rol
  IF NEW.rol IS DISTINCT FROM OLD.rol THEN
    IF NOT (
      v_rol_actor = 'superadmin'
      OR (v_rol_actor = 'admin' AND v_mismo_ie
          AND OLD.rol <> 'superadmin' AND NEW.rol <> 'superadmin')
      OR (v_rol_actor = 'director' AND v_mismo_ie
          AND OLD.rol IN ('director', 'coordinador') AND NEW.rol IN ('director', 'coordinador'))
    ) THEN
      RAISE EXCEPTION 'No tienes permiso para cambiar el rol de este usuario'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- codigo_ie
  IF NEW.codigo_ie IS DISTINCT FROM OLD.codigo_ie THEN
    IF v_rol_actor = 'superadmin' THEN
      NULL;
    ELSIF v_actor = OLD.id AND OLD.codigo_ie IS NULL THEN
      -- Primera asignación (registro): un colegio con director no recibe otro.
      IF NEW.rol = 'director' AND NEW.codigo_ie IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id <> OLD.id
          AND ltrim(p.codigo_ie, '0') = ltrim(NEW.codigo_ie, '0')
          AND p.rol = 'director' AND p.activo
      ) THEN
        NEW.rol := 'coordinador';
      END IF;
    ELSE
      RAISE EXCEPTION 'No tienes permiso para cambiar el colegio de este usuario'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- distrito
  IF NEW.distrito IS DISTINCT FROM OLD.distrito THEN
    IF NOT (
      v_rol_actor = 'superadmin'
      OR (v_actor = OLD.id AND OLD.distrito IS NULL)
    ) THEN
      RAISE EXCEPTION 'No tienes permiso para cambiar el distrito de este usuario'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- activo: nadie se reactiva a sí mismo
  IF NEW.activo IS DISTINCT FROM OLD.activo
     AND v_actor = OLD.id AND NEW.activo = true
     AND v_rol_actor IS DISTINCT FROM 'superadmin' THEN
    RAISE EXCEPTION 'No puedes reactivar tu propia cuenta'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_proteger_campos_sensibles ON public.profiles;
CREATE TRIGGER profiles_proteger_campos_sensibles
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_proteger_campos_sensibles();


-- ─── 3. Los perfiles solo los crea el trigger de registro ────────────────────

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;

-- ============================================================
-- Cómo verificar tras aplicar (con cualquier cuenta de profesor/coordinador,
-- desde la consola del navegador de la app ya con sesión iniciada, o con la
-- API REST y el token de esa cuenta):
--   1) PATCH /rest/v1/profiles?id=eq.<mi id>  {"rol":"superadmin"}
--        -> debe responder 403 / error 42501 "No tienes permiso para cambiar el rol".
--   2) PATCH ... {"codigo_ie":"<otro colegio>"}
--        -> debe responder 403 / error 42501.
--   3) PATCH ... {"materia":"Matemática"}
--        -> debe seguir funcionando (campos no sensibles).
--   4) select tgname from pg_trigger where tgrelid='public.profiles'::regclass and not tgisinternal;
--        -> debe incluir profiles_proteger_campos_sensibles.
--
-- Para volver atrás (solo si algo del flujo de registro/usuarios se rompe):
--   drop trigger if exists profiles_proteger_campos_sensibles on public.profiles;
--   (y volver a correr 0010 para restaurar handle_new_user).
-- ============================================================
