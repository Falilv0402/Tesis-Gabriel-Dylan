-- ============================================================
-- 0017_plan_revision.sql
-- HU nueva (pedido explícito de Mathias, 2026-09-12): hoy Director y
-- Coordinador tienen exactamente los mismos permisos académicos (dashboard,
-- intervenciones, plan de hitos) -- la única diferencia real es que Director
-- administra el rol de su equipo (ver 0016). Se agrega un flujo real de
-- supervisión: el Coordinador arma el plan de hitos de un alumno (como ya
-- podía) y lo envía a revisión; el Director lo aprueba o pide cambios con un
-- comentario. Esto también le da un lugar real a la palabra "equipo" que ya
-- se usaba en HU022 (notificaciones).
--
-- Diseño: UNA fila por alumno (no una tabla de "planes" versionada) --
-- representa el estado de revisión del conjunto de hitos vigente de ese
-- alumno. Agregar/editar hitos (plan_hitos, ver 0004) sigue funcionando
-- igual que hoy y NO reinicia el estado automáticamente -- mantenerlo simple.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.plan_estado (
  estudiante_id       text PRIMARY KEY,
  codigo_ie           text NOT NULL,
  estudiante_nombre   text,
  estado              text NOT NULL DEFAULT 'borrador'
                        CHECK (estado IN ('borrador', 'en_revision', 'aprobado', 'rechazado')),
  enviado_por         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  enviado_por_nombre  text,
  enviado_at          timestamptz,
  revisado_por        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  revisado_por_nombre text,
  revisado_at         timestamptz,
  comentario          text,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_estado_colegio_estado
  ON public.plan_estado(codigo_ie, estado);

-- Reutiliza el trigger genérico ya creado en 0003_schema_realign.sql.
DROP TRIGGER IF EXISTS trg_plan_estado_updated_at ON public.plan_estado;
CREATE TRIGGER trg_plan_estado_updated_at
BEFORE UPDATE ON public.plan_estado
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.plan_estado ENABLE ROW LEVEL SECURITY;

-- Cualquiera del mismo colegio (o superadmin) puede ver el estado.
CREATE POLICY "plan_estado_select_colegio"
ON public.plan_estado FOR SELECT
USING (
  public.get_my_role() = 'superadmin'
  OR codigo_ie = public.get_my_ie()
);

-- Director o Coordinador de ese colegio puede crear la fila (primer envío a
-- revisión de ese alumno) -- solo hacia 'borrador' o 'en_revision', nunca
-- directo a una decisión.
CREATE POLICY "plan_estado_insert_proponer"
ON public.plan_estado FOR INSERT
WITH CHECK (
  codigo_ie = public.get_my_ie()
  AND public.get_my_role() IN ('director', 'coordinador')
  AND estado IN ('borrador', 'en_revision')
);

-- UPDATE: Director/Coordinador puede reenviar a revisión o devolver a
-- borrador; SOLO Director (o admin/superadmin) puede aprobar o rechazar --
-- esta es la regla central de "Coordinador propone, Director aprueba".
CREATE POLICY "plan_estado_update"
ON public.plan_estado FOR UPDATE
USING (codigo_ie = public.get_my_ie() OR public.get_my_role() = 'superadmin')
WITH CHECK (
  (codigo_ie = public.get_my_ie() OR public.get_my_role() = 'superadmin')
  AND (
    (public.get_my_role() IN ('director', 'coordinador') AND estado IN ('borrador', 'en_revision'))
    OR (public.get_my_role() IN ('director', 'admin', 'superadmin') AND estado IN ('aprobado', 'rechazado'))
  )
);

-- ── notificaciones: agregar el tipo 'plan' (envío a revisión / decisión) ────────
-- Localiza el CHECK real sobre la columna `tipo` sin asumir su nombre
-- autogenerado, para no dejar la restricción vieja activa en paralelo.
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT con.conname INTO con_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'notificaciones'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%tipo%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notificaciones DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE public.notificaciones
  ADD CONSTRAINT notificaciones_tipo_check CHECK (tipo IN ('anotacion', 'hito', 'plan'));

-- ============================================================
-- Cómo aplicar (si el MCP de Supabase no está conectado en la sesión):
--   1) Entra al SQL Editor de tu proyecto en supabase.com/dashboard
--   2) Pega y corre este archivo completo
--   3) Verifica: select * from plan_estado limit 5;
--                select conname, pg_get_constraintdef(oid) from pg_constraint
--                  where conrelid = 'public.notificaciones'::regclass and contype = 'c';
-- ============================================================
