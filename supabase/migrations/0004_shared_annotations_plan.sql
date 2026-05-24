-- ============================================================
-- 0004_shared_annotations_plan.sql
-- Permite que directores del mismo colegio vean las anotaciones
-- y los hitos de plan de otros directores sobre el mismo estudiante.
-- ============================================================

-- ─── plan_hitos: separar SELECT (compartido) de escritura (solo autor) ────────

-- Eliminar política ALL que solo dejaba ver al autor
DROP POLICY IF EXISTS "owner_manage_hitos" ON public.plan_hitos;

-- SELECT: cualquier usuario autenticado puede leer (verá los de todos los directores)
CREATE POLICY "authenticated_read_hitos"
ON public.plan_hitos FOR SELECT
USING (auth.role() = 'authenticated');

-- INSERT: solo puede crear hitos propios
CREATE POLICY "owner_insert_hitos"
ON public.plan_hitos FOR INSERT
WITH CHECK (autor_id = auth.uid());

-- UPDATE: solo puede modificar sus propios hitos
CREATE POLICY "owner_update_hitos"
ON public.plan_hitos FOR UPDATE
USING     (autor_id = auth.uid())
WITH CHECK (autor_id = auth.uid());

-- DELETE: solo puede eliminar sus propios hitos
CREATE POLICY "owner_delete_hitos"
ON public.plan_hitos FOR DELETE
USING (autor_id = auth.uid());
