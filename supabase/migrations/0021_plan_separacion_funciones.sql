-- ============================================================
-- 0021_plan_separacion_funciones.sql
-- Observación de las pruebas (Mantis, CP053 / HU0023): un Director podía enviar
-- a revisión un plan de seguimiento y luego aprobarlo él mismo. Con eso el
-- flujo "el Coordinador propone, el Director aprueba" no separaba funciones:
-- quien armaba y enviaba el plan también lo daba por bueno.
--
-- Reglas que ahora impone la base de datos (la app solo decide qué botones
-- mostrar; ver frontend/src/lib/plan.ts):
--   1. El Director revisa; NO envía planes a revisión.
--   2. Quien envió un plan a revisión no puede aprobarlo ni pedir cambios.
--   3. Solo se decide sobre un plan que está en revisión.
--   4. Quedan registrados quién envió y quién decidió con el id de la sesión,
--      no con lo que mande el cliente (no se puede falsear el remitente para
--      saltarse la regla 2).
--
-- No cambia los planes que ya existen. Sin usuario autenticado (SQL Editor,
-- service_role) no valida nada, igual que el trigger de profiles (0020).
-- ============================================================

CREATE OR REPLACE FUNCTION public.plan_estado_separar_funciones()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor     uuid := auth.uid();
  v_rol_actor text;
  v_cambia    boolean;
BEGIN
  -- Sin usuario autenticado: SQL Editor o service_role.
  IF v_actor IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.rol INTO v_rol_actor
  FROM public.profiles p
  WHERE p.id = v_actor AND p.activo = true;

  v_cambia := TG_OP = 'INSERT' OR NEW.estado IS DISTINCT FROM OLD.estado;

  -- Envío a revisión.
  IF NEW.estado = 'en_revision' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'en_revision') THEN
    IF v_rol_actor = 'director' THEN
      RAISE EXCEPTION 'El Director revisa los planes: no los envía a revisión'
        USING ERRCODE = '42501';
    END IF;
    NEW.enviado_por := v_actor;
    NEW.enviado_at  := now();
  END IF;

  -- Decisión (aprobar o pedir cambios).
  IF TG_OP = 'UPDATE' AND v_cambia AND NEW.estado IN ('aprobado', 'rechazado') THEN
    IF OLD.estado IS DISTINCT FROM 'en_revision' THEN
      RAISE EXCEPTION 'Solo se puede decidir sobre un plan que está en revisión'
        USING ERRCODE = '42501';
    END IF;
    IF OLD.enviado_por IS NOT NULL AND OLD.enviado_por = v_actor THEN
      RAISE EXCEPTION 'Quien envió el plan a revisión no puede aprobarlo ni pedir cambios'
        USING ERRCODE = '42501';
    END IF;
    NEW.revisado_por := v_actor;
    NEW.revisado_at  := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plan_estado_separar_funciones ON public.plan_estado;
CREATE TRIGGER trg_plan_estado_separar_funciones
BEFORE INSERT OR UPDATE ON public.plan_estado
FOR EACH ROW EXECUTE FUNCTION public.plan_estado_separar_funciones();

-- ============================================================
-- Cómo aplicar: pega y corre este archivo completo en el SQL Editor de
-- Supabase (después de 0020).
-- Verifica con dos cuentas del mismo colegio (Coordinador + Director):
--   a) el Director ya no ve "Enviar a revisión" (y si lo forzara por la API: 42501);
--   b) el Coordinador envía el plan y el Director lo aprueba o pide cambios;
--   c) el Coordinador no puede aprobar (policy) y quien envió no puede decidir (trigger).
-- Nota: un plan aprobado ANTES de esta migración por quien lo envió (p. ej. el
-- de IE 9001 de las pruebas) se queda como está; reabrirlo es decisión del colegio.
-- ============================================================
