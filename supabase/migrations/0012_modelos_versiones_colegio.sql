-- ============================================================
-- 0012_modelos_versiones_colegio.sql
-- Extiende modelos_versiones para que sirva de verdad como historial de
-- reentrenamientos por colegio (HU034) y como base del seguimiento
-- histórico de riesgo en el tiempo (HU024/HU026) — hasta ahora la tabla
-- existía en el schema pero nunca se escribía en ella desde el código.
-- ============================================================

ALTER TABLE public.modelos_versiones
  ADD COLUMN IF NOT EXISTS codigo_ie      text,
  ADD COLUMN IF NOT EXISTS nombre_colegio text,
  ADD COLUMN IF NOT EXISTS n_alumnos      integer,
  ADD COLUMN IF NOT EXISTS n_alto         integer,
  ADD COLUMN IF NOT EXISTS n_medio        integer,
  ADD COLUMN IF NOT EXISTS n_bajo         integer,
  ADD COLUMN IF NOT EXISTS modo_prediccion text,
  ADD COLUMN IF NOT EXISTS registrado_por  uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_modelos_versiones_codigo_ie
  ON public.modelos_versiones(codigo_ie, created_at DESC);

-- ─── RLS: permitir que también admin/director/coordinador (no solo
-- superadmin) registren versiones de SU PROPIO colegio, y lean el
-- historial de su colegio ────────────────────────────────────────────────
-- La política original (0007) solo permitía FOR ALL a superadmin. La carga
-- de Excel del colegio (HU031) ya soporta admin/director/coordinador desde
-- require_admin_de_colegio en el backend (colegio_propio.py) — este INSERT
-- debe reflejar exactamente los mismos roles, o el registro del historial
-- (HU034) queda silenciosamente vacío para esos usuarios (best-effort:
-- no rompe la carga, pero no queda rastro).

DROP POLICY IF EXISTS "modelos_versiones_all" ON public.modelos_versiones;

CREATE POLICY "modelos_versiones_select"
ON public.modelos_versiones FOR SELECT
USING (
  public.get_my_role() = 'superadmin'
  OR (public.get_my_role() IN ('admin', 'director', 'coordinador')
      AND codigo_ie IS NOT NULL
      AND codigo_ie = public.get_my_ie())
);

CREATE POLICY "modelos_versiones_insert"
ON public.modelos_versiones FOR INSERT
WITH CHECK (
  public.get_my_role() = 'superadmin'
  OR (public.get_my_role() IN ('admin', 'director', 'coordinador')
      AND codigo_ie IS NOT NULL
      AND codigo_ie = public.get_my_ie())
);

CREATE POLICY "modelos_versiones_update_delete"
ON public.modelos_versiones FOR ALL
USING (public.get_my_role() = 'superadmin');

-- ============================================================
-- Cómo aplicar (si el MCP de Supabase no está conectado en la sesión):
--   1) Entra al SQL Editor de tu proyecto en supabase.com/dashboard
--   2) Pega y corre este archivo completo
--   3) Verifica: select * from modelos_versiones limit 5;
-- ============================================================
