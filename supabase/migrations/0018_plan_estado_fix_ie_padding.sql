-- ============================================================
-- 0018_plan_estado_fix_ie_padding.sql
-- Bug real encontrado al verificar 0017 en vivo: el `codigo_ie` de un
-- alumno (tal como lo devuelve el modelo del colegio, ej. "0831305", CON
-- cero inicial) no siempre coincide en formato con `profiles.codigo_ie`
-- del usuario (ej. "831305", SIN cero) -- el mismo desfase de padding ya
-- visto en otras partes de la app (ver Fase 14/17 del plan de ejecución).
-- Las políticas de 0017 comparaban con igualdad estricta y por eso
-- "Enviar a revisión" fallaba con 42501 (RLS) para cuentas cuyo perfil
-- normalizó el código sin ceros.
--
-- De paso, verificando esto en vivo se encontró que la MISMA falla ya
-- afectaba a `notificaciones` (0013_notificaciones.sql) desde que esa
-- tabla existe: agendar un hito o anotación insertaba la notificación con
-- el `codigo_ie` del ALUMNO (con cero) y la política comparaba contra el
-- `codigo_ie` del PERFIL (sin cero) -- fallaba en silencio (best-effort)
-- y nadie lo notó porque no rompía el flujo de guardar el hito/anotación.
-- HU022 (notificaciones de equipo) llevaba tiempo sin funcionar de verdad
-- para cualquier cuenta en esta situación.
--
-- Fix: comparar ambos lados quitando ceros a la izquierda (ltrim), igual
-- que ya hace el resto del código (frontend y backend) para este mismo
-- código de colegio.
-- ============================================================

DROP POLICY IF EXISTS "notificaciones_insert_same_colegio" ON public.notificaciones;

CREATE POLICY "notificaciones_insert_same_colegio"
ON public.notificaciones FOR INSERT
WITH CHECK (
  public.get_my_ie() IS NOT NULL
  AND ltrim(codigo_ie, '0') = ltrim(public.get_my_ie(), '0')
);

DROP POLICY IF EXISTS "plan_estado_select_colegio"   ON public.plan_estado;
DROP POLICY IF EXISTS "plan_estado_insert_proponer"  ON public.plan_estado;
DROP POLICY IF EXISTS "plan_estado_update"           ON public.plan_estado;

CREATE POLICY "plan_estado_select_colegio"
ON public.plan_estado FOR SELECT
USING (
  public.get_my_role() = 'superadmin'
  OR ltrim(codigo_ie, '0') = ltrim(public.get_my_ie(), '0')
);

CREATE POLICY "plan_estado_insert_proponer"
ON public.plan_estado FOR INSERT
WITH CHECK (
  ltrim(codigo_ie, '0') = ltrim(public.get_my_ie(), '0')
  AND public.get_my_role() IN ('director', 'coordinador')
  AND estado IN ('borrador', 'en_revision')
);

CREATE POLICY "plan_estado_update"
ON public.plan_estado FOR UPDATE
USING (
  public.get_my_role() = 'superadmin'
  OR ltrim(codigo_ie, '0') = ltrim(public.get_my_ie(), '0')
)
WITH CHECK (
  (public.get_my_role() = 'superadmin' OR ltrim(codigo_ie, '0') = ltrim(public.get_my_ie(), '0'))
  AND (
    (public.get_my_role() IN ('director', 'coordinador') AND estado IN ('borrador', 'en_revision'))
    OR (public.get_my_role() IN ('director', 'admin', 'superadmin') AND estado IN ('aprobado', 'rechazado'))
  )
);

-- ============================================================
-- Cómo aplicar: pega y corre este archivo completo en el SQL Editor de
-- Supabase (después de 0017). Verifica reintentando "Enviar a revisión"
-- y agregar un hito/anotación en la app -- ambos deben dejar de dar el
-- error 42501 (antes fallaban en silencio para las notificaciones).
-- ============================================================
