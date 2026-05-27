-- ============================================================
-- 0006_coordinador_role.sql
-- Añade el rol 'coordinador' con acceso de visualización total
-- pero edición limitada a sus propios registros.
-- El director puede editar todos los registros de su IE.
-- ============================================================

-- ─── 1. Añadir 'coordinador' al CHECK de rol ─────────────────────────────────

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_rol_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_rol_check
  CHECK (rol IN ('superadmin', 'admin', 'director', 'coordinador'));


-- ─── 2. Anotaciones: director puede editar cualquier anotación ───────────────

DROP POLICY IF EXISTS "owner_update_anotaciones" ON public.anotaciones;

CREATE POLICY "owner_or_director_update_anotaciones"
ON public.anotaciones FOR UPDATE
USING (
  autor_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.rol = 'director'
      AND p.activo = true
  )
)
WITH CHECK (
  autor_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.rol = 'director'
      AND p.activo = true
  )
);


-- ─── 3. Plan hitos: director puede marcar/editar cualquier hito ──────────────

DROP POLICY IF EXISTS "owner_update_hitos" ON public.plan_hitos;

CREATE POLICY "owner_or_director_update_hitos"
ON public.plan_hitos FOR UPDATE
USING (
  autor_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.rol = 'director'
      AND p.activo = true
  )
)
WITH CHECK (
  autor_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.rol = 'director'
      AND p.activo = true
  )
);


-- ─── 4. Intervenciones: director puede actualizar estado de cualquiera ────────

DROP POLICY IF EXISTS "authenticated_manage_intervenciones" ON public.intervenciones;

-- Todos los autenticados pueden leer e insertar
CREATE POLICY "authenticated_read_intervenciones"
ON public.intervenciones FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_insert_intervenciones"
ON public.intervenciones FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Solo el registrador o un director puede actualizar el estado
CREATE POLICY "owner_or_director_update_intervenciones"
ON public.intervenciones FOR UPDATE
USING (
  registrado_por = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.rol = 'director'
      AND p.activo = true
  )
);
