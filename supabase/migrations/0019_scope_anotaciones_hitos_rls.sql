-- ============================================================
-- 0019_scope_anotaciones_hitos_rls.sql
-- Cierra la misma fuga de segregación de datos que 0009 (profiles/audit_log)
-- y 0014 (intervenciones), esta vez en `anotaciones` y `plan_hitos` — quedaron
-- afuera de esas dos rondas anteriores.
--
-- PROBLEMA (desde 0002/0004, nunca corregido):
--   "authenticated_read_anotaciones" y "authenticated_read_hitos" eran
--   USING (auth.role() = 'authenticated') -- cualquier Director/Coordinador
--   logueado podía leer las anotaciones privadas y los hitos de plan de
--   CUALQUIER colegio, no solo el suyo, llamando directo a la API REST de
--   Supabase con su propio token (sin pasar por la UI, que sí filtra por
--   colegio). Encontrado revisando seguridad de cara a la auditoría externa.
--
--   De paso, "owner_or_director_update_anotaciones" y
--   "owner_or_director_update_hitos" (0006/0007) dejaban que CUALQUIER
--   Director -- de cualquier colegio -- editara/marcara como completado el
--   hito o la anotación de un estudiante ajeno, por el mismo motivo (el rol
--   se validaba, el colegio no). Y "owner_or_admin_delete_anotaciones" (0002)
--   dejaba que cualquier 'admin' -- de cualquier colegio -- borrara
--   anotaciones ajenas.
--
-- SOLUCIÓN:
--   Igual que profiles/audit_log/intervenciones: agrega codigo_ie/distrito a
--   cada fila (poblados por trigger desde el perfil del autor si el insert no
--   los trae) y scopea SELECT/INSERT/UPDATE/DELETE por esas columnas.
-- ============================================================

-- ─── 1. Columnas de scope + backfill ──────────────────────────────────────────

ALTER TABLE public.anotaciones
  ADD COLUMN IF NOT EXISTS codigo_ie text,
  ADD COLUMN IF NOT EXISTS distrito  text;

ALTER TABLE public.plan_hitos
  ADD COLUMN IF NOT EXISTS codigo_ie text,
  ADD COLUMN IF NOT EXISTS distrito  text;

CREATE INDEX IF NOT EXISTS idx_anotaciones_codigo_ie ON public.anotaciones(codigo_ie);
CREATE INDEX IF NOT EXISTS idx_anotaciones_distrito  ON public.anotaciones(distrito);
CREATE INDEX IF NOT EXISTS idx_plan_hitos_codigo_ie   ON public.plan_hitos(codigo_ie);
CREATE INDEX IF NOT EXISTS idx_plan_hitos_distrito    ON public.plan_hitos(distrito);

-- Backfill: se asume el colegio/distrito de quien escribió la fila (autor_id)
-- -- es la mejor aproximación disponible, igual que en 0014.
UPDATE public.anotaciones a
SET codigo_ie = p.codigo_ie,
    distrito  = p.distrito
FROM public.profiles p
WHERE a.autor_id = p.id
  AND a.codigo_ie IS NULL
  AND a.distrito  IS NULL;

UPDATE public.plan_hitos h
SET codigo_ie = p.codigo_ie,
    distrito  = p.distrito
FROM public.profiles p
WHERE h.autor_id = p.id
  AND h.codigo_ie IS NULL
  AND h.distrito  IS NULL;

-- ─── 2. Triggers: autocompletan el scope si el insert no lo trae ─────────────

CREATE OR REPLACE FUNCTION public.set_anotacion_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.codigo_ie IS NULL AND NEW.distrito IS NULL THEN
    SELECT codigo_ie, distrito INTO NEW.codigo_ie, NEW.distrito
    FROM public.profiles WHERE id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_anotacion_scope ON public.anotaciones;
CREATE TRIGGER trg_set_anotacion_scope
BEFORE INSERT ON public.anotaciones
FOR EACH ROW
EXECUTE FUNCTION public.set_anotacion_scope();

CREATE OR REPLACE FUNCTION public.set_hito_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.codigo_ie IS NULL AND NEW.distrito IS NULL THEN
    SELECT codigo_ie, distrito INTO NEW.codigo_ie, NEW.distrito
    FROM public.profiles WHERE id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_hito_scope ON public.plan_hitos;
CREATE TRIGGER trg_set_hito_scope
BEFORE INSERT ON public.plan_hitos
FOR EACH ROW
EXECUTE FUNCTION public.set_hito_scope();

-- ─── 3. anotaciones: RLS scopeada ─────────────────────────────────────────────

DROP POLICY IF EXISTS "authenticated_read_anotaciones"        ON public.anotaciones;
DROP POLICY IF EXISTS "authenticated_insert_anotaciones"       ON public.anotaciones;
DROP POLICY IF EXISTS "owner_or_director_update_anotaciones"   ON public.anotaciones;
DROP POLICY IF EXISTS "owner_or_admin_delete_anotaciones"      ON public.anotaciones;

CREATE POLICY "anotaciones_select_scoped"
ON public.anotaciones FOR SELECT
USING (
  public.get_my_role() = 'superadmin'
  OR (codigo_ie IS NOT NULL AND codigo_ie = public.get_my_ie())
  OR (codigo_ie IS NULL AND distrito IS NOT NULL AND distrito = public.get_my_distrito())
);

CREATE POLICY "anotaciones_insert_scoped"
ON public.anotaciones FOR INSERT
WITH CHECK (
  autor_id = auth.uid()
  AND (
    public.get_my_role() = 'superadmin'
    OR codigo_ie IS NULL   -- el trigger lo completa si viene vacío
    OR codigo_ie = public.get_my_ie()
  )
);

CREATE POLICY "anotaciones_update_scoped"
ON public.anotaciones FOR UPDATE
USING (
  public.get_my_role() = 'superadmin'
  OR autor_id = auth.uid()
  OR (
    public.get_my_role() = 'director'
    AND (
      (codigo_ie IS NOT NULL AND codigo_ie = public.get_my_ie())
      OR (codigo_ie IS NULL AND distrito IS NOT NULL AND distrito = public.get_my_distrito())
    )
  )
)
WITH CHECK (
  public.get_my_role() = 'superadmin'
  OR autor_id = auth.uid()
  OR (
    public.get_my_role() = 'director'
    AND (
      (codigo_ie IS NOT NULL AND codigo_ie = public.get_my_ie())
      OR (codigo_ie IS NULL AND distrito IS NOT NULL AND distrito = public.get_my_distrito())
    )
  )
);

CREATE POLICY "anotaciones_delete_scoped"
ON public.anotaciones FOR DELETE
USING (
  autor_id = auth.uid()
  OR public.get_my_role() = 'superadmin'
  OR (
    public.get_my_role() = 'admin'
    AND codigo_ie IS NOT NULL
    AND codigo_ie = public.get_my_ie()
  )
);

-- ─── 4. plan_hitos: RLS scopeada ──────────────────────────────────────────────

DROP POLICY IF EXISTS "authenticated_read_hitos"          ON public.plan_hitos;
DROP POLICY IF EXISTS "owner_insert_hitos"                 ON public.plan_hitos;
DROP POLICY IF EXISTS "owner_or_director_update_hitos"     ON public.plan_hitos;

CREATE POLICY "hitos_select_scoped"
ON public.plan_hitos FOR SELECT
USING (
  public.get_my_role() = 'superadmin'
  OR (codigo_ie IS NOT NULL AND codigo_ie = public.get_my_ie())
  OR (codigo_ie IS NULL AND distrito IS NOT NULL AND distrito = public.get_my_distrito())
);

CREATE POLICY "hitos_insert_scoped"
ON public.plan_hitos FOR INSERT
WITH CHECK (
  autor_id = auth.uid()
  AND (
    public.get_my_role() = 'superadmin'
    OR codigo_ie IS NULL   -- el trigger lo completa si viene vacío
    OR codigo_ie = public.get_my_ie()
  )
);

CREATE POLICY "hitos_update_scoped"
ON public.plan_hitos FOR UPDATE
USING (
  public.get_my_role() = 'superadmin'
  OR autor_id = auth.uid()
  OR (
    public.get_my_role() = 'director'
    AND (
      (codigo_ie IS NOT NULL AND codigo_ie = public.get_my_ie())
      OR (codigo_ie IS NULL AND distrito IS NOT NULL AND distrito = public.get_my_distrito())
    )
  )
)
WITH CHECK (
  public.get_my_role() = 'superadmin'
  OR autor_id = auth.uid()
  OR (
    public.get_my_role() = 'director'
    AND (
      (codigo_ie IS NOT NULL AND codigo_ie = public.get_my_ie())
      OR (codigo_ie IS NULL AND distrito IS NOT NULL AND distrito = public.get_my_distrito())
    )
  )
);

-- "owner_delete_hitos" (0004) ya era owner-only -- sin fuga, se deja igual.

-- ============================================================
-- Cómo probar tras aplicar:
--   1) Login como Director/Coordinador de un colegio propio (ej. La Victoria):
--        select count(*) from anotaciones;   -- solo las de ESE colegio
--        select count(*) from plan_hitos;    -- solo los de ESE colegio
--   2) Login como Director/Coordinador de OTRO colegio: cuenta debe ser
--      distinta (y no debe poder ver ni editar los del paso 1).
--   3) Login como superadmin: ve todas.
--   4) Guardar una anotación / agregar un hito nuevo y confirmar que
--      aparece con el codigo_ie correcto (el trigger lo completa).
--   5) Un Director marcando el hito de OTRO usuario de su MISMO colegio
--      como completado debe seguir funcionando (fix de toggleMilestone).
-- ============================================================
