-- ============================================================
-- 0013_notificaciones.sql
-- HU nueva (pedido explícito de Mathias, 2026-09-08): cuando un director o
-- coordinador agrega una anotación o agenda un hito de seguimiento sobre un
-- alumno, los DEMÁS directores/coordinadores del mismo colegio reciben una
-- notificación en la bandeja del sistema — antes solo existía un "toast"
-- local de la propia sesión (useToast.ts), nada persistido ni visible para
-- otros usuarios.
--
-- Modelo "fan-out": una fila por destinatario (mismo patrón que
-- intervenciones/modelos_versiones), para que la RLS de lectura sea trivial
-- (destinatario_id = auth.uid()) y cada quien pueda marcar SU copia como
-- leída sin afectar la de los demás.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notificaciones (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_ie         text NOT NULL,
  tipo              text NOT NULL CHECK (tipo IN ('anotacion', 'hito')),
  estudiante_id     text,
  estudiante_nombre text,
  mensaje           text NOT NULL,
  autor_id          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  autor_nombre      text,
  destinatario_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leido             boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_destinatario
  ON public.notificaciones(destinatario_id, created_at DESC);

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

-- Cada quien lee y marca como leída únicamente SU propia copia.
CREATE POLICY "notificaciones_select_own"
ON public.notificaciones FOR SELECT
USING (destinatario_id = auth.uid());

CREATE POLICY "notificaciones_update_own"
ON public.notificaciones FOR UPDATE
USING (destinatario_id = auth.uid())
WITH CHECK (destinatario_id = auth.uid());

-- Solo se pueden crear notificaciones hacia el PROPIO colegio (mismo
-- codigo_ie de quien las crea) — evita que alguien note a usuarios de un
-- colegio ajeno. superadmin no necesita esta ruta (no gestiona alumnos).
CREATE POLICY "notificaciones_insert_same_colegio"
ON public.notificaciones FOR INSERT
WITH CHECK (
  public.get_my_ie() IS NOT NULL
  AND codigo_ie = public.get_my_ie()
);

-- ============================================================
-- Cómo aplicar (si el MCP de Supabase no está conectado en la sesión):
--   1) Entra al SQL Editor de tu proyecto en supabase.com/dashboard
--   2) Pega y corre este archivo completo
--   3) Verifica: select * from notificaciones limit 5;
-- ============================================================
