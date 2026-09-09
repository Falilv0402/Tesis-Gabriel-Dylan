-- ============================================================
-- 0014_scope_intervenciones_rls.sql
-- Cierra otra fuga de segregación de datos, igual a la de 0009 pero en
-- `intervenciones` (que quedó afuera de esa migración).
--
-- PROBLEMA (desde 0001, nunca corregido):
--   "authenticated_read_intervenciones" era USING (auth.role() = 'authenticated')
--   -- cualquier director/coordinador logueado veía la bitácora COMPLETA de
--   TODOS los colegios y distritos, no solo el suyo. Reportado por Mathias
--   probando con la cuenta de "Cole Rafael Hoyos — La Victoria": la bitácora
--   mostraba intervenciones de Joseph & Mary (IE 0249) mezcladas.
--
-- SOLUCIÓN:
--   Igual que profiles (0009): agrega codigo_ie/distrito a cada fila y
--   scopea SELECT/INSERT/UPDATE por esas columnas. Un trigger las autocompleta
--   desde el perfil del que registra si el frontend no las manda explícitas
--   (defensa en profundidad: nunca deja una fila "huérfana" sin scope, ni
--   rompe el INSERT mientras el frontend viejo todavía no las envía).
-- ============================================================

ALTER TABLE public.intervenciones
  ADD COLUMN IF NOT EXISTS codigo_ie text,
  ADD COLUMN IF NOT EXISTS distrito  text;

CREATE INDEX IF NOT EXISTS idx_intervenciones_codigo_ie ON public.intervenciones(codigo_ie);
CREATE INDEX IF NOT EXISTS idx_intervenciones_distrito  ON public.intervenciones(distrito);

-- Backfill de filas existentes: se asume el colegio/distrito de quien la
-- registró (registrado_por) -- es la mejor aproximación disponible, ya que
-- el esquema original nunca guardó a qué colegio/distrito pertenecía cada
-- intervención.
UPDATE public.intervenciones i
SET codigo_ie = p.codigo_ie,
    distrito  = p.distrito
FROM public.profiles p
WHERE i.registrado_por = p.id
  AND i.codigo_ie IS NULL
  AND i.distrito  IS NULL;

-- ─── Trigger: autocompleta el scope si el insert no lo trae ──────────────────
CREATE OR REPLACE FUNCTION public.set_intervencion_scope()
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

DROP TRIGGER IF EXISTS trg_set_intervencion_scope ON public.intervenciones;
CREATE TRIGGER trg_set_intervencion_scope
BEFORE INSERT ON public.intervenciones
FOR EACH ROW
EXECUTE FUNCTION public.set_intervencion_scope();

-- ─── RLS scopeada ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read_intervenciones"   ON public.intervenciones;
DROP POLICY IF EXISTS "authenticated_insert_intervenciones" ON public.intervenciones;
DROP POLICY IF EXISTS "owner_or_director_update_intervenciones" ON public.intervenciones;
DROP POLICY IF EXISTS "authenticated_manage_intervenciones" ON public.intervenciones;

CREATE POLICY "intervenciones_select_scoped"
ON public.intervenciones FOR SELECT
USING (
  public.get_my_role() = 'superadmin'
  OR (codigo_ie IS NOT NULL AND codigo_ie = public.get_my_ie())
  OR (codigo_ie IS NULL AND distrito IS NOT NULL AND distrito = public.get_my_distrito())
);

CREATE POLICY "intervenciones_insert_scoped"
ON public.intervenciones FOR INSERT
WITH CHECK (
  public.get_my_role() = 'superadmin'
  OR codigo_ie IS NULL   -- el trigger lo completa si viene vacío
  OR codigo_ie = public.get_my_ie()
);

CREATE POLICY "intervenciones_update_scoped"
ON public.intervenciones FOR UPDATE
USING (
  public.get_my_role() = 'superadmin'
  OR registrado_por = auth.uid()
  OR (
    public.get_my_role() = 'director'
    AND (
      (codigo_ie IS NOT NULL AND codigo_ie = public.get_my_ie())
      OR (codigo_ie IS NULL AND distrito IS NOT NULL AND distrito = public.get_my_distrito())
    )
  )
);

-- ============================================================
-- Cómo probar tras aplicar:
--   1) Login como director/coordinador de un colegio propio (ej. La Victoria):
--        select count(*) from intervenciones;  -- solo las de ESE colegio
--   2) Login como director/coordinador sin colegio propio (solo distrito EM2022):
--        select count(*) from intervenciones;  -- solo las de SU distrito
--   3) Login como superadmin: ve todas.
--   4) Registrar una intervención nueva y confirmar que aparece en la
--      bitácora del mismo colegio (el trigger/frontend le puso el scope).
-- ============================================================
