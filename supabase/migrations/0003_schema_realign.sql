-- ============================================================
-- 0003_schema_realign.sql
-- Alinea el schema de Supabase con el código real del frontend.
-- Seguro de re-ejecutar: usa IF NOT EXISTS / IF EXISTS / ON CONFLICT.
-- ============================================================


-- ─── 1. PROFILES — columnas que faltaban ─────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS apellidos    text,
  ADD COLUMN IF NOT EXISTS codigo_ie    text,
  ADD COLUMN IF NOT EXISTS distrito     text,
  ADD COLUMN IF NOT EXISTS avatar_color text;


-- ─── 2. PROFILES — política de auto-actualización del propio perfil ──────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'users_update_own_profile'
  ) THEN
    CREATE POLICY "users_update_own_profile"
    ON public.profiles FOR UPDATE
    USING     (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
  END IF;
END $$;


-- ─── 3. TRIGGER — crear perfil automáticamente al registrar usuario ──────────
--
-- El hook handleRegister() hace signUp() y luego intenta UPDATE el perfil
-- (asume que ya existe). Sin este trigger, ese UPDATE no encuentra ninguna
-- fila y el district/codigo_ie nunca se guarda.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nombre, rol)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
    COALESCE(NEW.raw_user_meta_data->>'rol', 'director')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─── 4. PREDICCIONES — recrear con el schema que usa el frontend ─────────────
--
-- El código usa: estudiante_id TEXT, periodo, probabilidad_riesgo, nivel_riesgo
-- La migración 0001 tenía: estudiante_id UUID FK a estudiantes (tabla que no se usa)

DROP TABLE IF EXISTS public.predicciones CASCADE;

CREATE TABLE public.predicciones (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id       text        NOT NULL,
  periodo             text        NOT NULL,
  probabilidad_riesgo numeric(6,5) NOT NULL
                        CHECK (probabilidad_riesgo >= 0 AND probabilidad_riesgo <= 1),
  nivel_riesgo        text        NOT NULL
                        CHECK (nivel_riesgo IN ('ALTO', 'MEDIO', 'BAJO')),
  modelo_version      text        NOT NULL DEFAULT 'desconocido',
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (estudiante_id, periodo)
);

CREATE INDEX idx_predicciones_estudiante ON public.predicciones(estudiante_id);
CREATE INDEX idx_predicciones_nivel      ON public.predicciones(nivel_riesgo);
CREATE INDEX idx_predicciones_periodo    ON public.predicciones(periodo);

ALTER TABLE public.predicciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_predicciones"
ON public.predicciones FOR SELECT
USING (auth.role() = 'authenticated');

-- INSERT y UPDATE necesarios para el upsert en savePredictionsToSupabase()
CREATE POLICY "authenticated_insert_predicciones"
ON public.predicciones FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update_predicciones"
ON public.predicciones FOR UPDATE
USING (auth.role() = 'authenticated');


-- ─── 5. INTERVENCIONES — recrear con codigo_estudiante TEXT ──────────────────
--
-- El código usa: codigo_estudiante TEXT, tipo, descripcion, estado, registrado_por
-- La migración 0001 tenía: estudiante_id UUID FK a estudiantes

DROP TABLE IF EXISTS public.intervenciones CASCADE;

CREATE TABLE public.intervenciones (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_estudiante text,
  tipo              text        NOT NULL
                      CHECK (tipo IN ('tutoria', 'reunion', 'derivacion', 'seguimiento')),
  descripcion       text        NOT NULL,
  estado            text        NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente', 'en_proceso', 'cerrada')),
  registrado_por    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  fecha             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_intervenciones_estudiante ON public.intervenciones(codigo_estudiante);
CREATE INDEX idx_intervenciones_estado     ON public.intervenciones(estado);
CREATE INDEX idx_intervenciones_registrado ON public.intervenciones(registrado_por);

ALTER TABLE public.intervenciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_manage_intervenciones"
ON public.intervenciones FOR ALL
USING (auth.role() = 'authenticated');


-- ─── 6. TABLAS SIN USO — eliminar ────────────────────────────────────────────
--
-- El frontend no usa una tabla 'estudiantes' separada; trabaja con IDs de texto
-- directamente desde el dataset ML. 'notas_periodos' tampoco se usa.

DROP TABLE IF EXISTS public.notas_periodos CASCADE;
DROP TABLE IF EXISTS public.estudiantes   CASCADE;


-- ─── 7. ANOTACIONES — crear tabla (0002 no fue aplicada) + políticas ─────────

CREATE TABLE IF NOT EXISTS public.anotaciones (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id text        NOT NULL,
  autor_id      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  contenido     text        NOT NULL CHECK (length(contenido) > 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anotaciones_estudiante ON public.anotaciones(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_anotaciones_autor      ON public.anotaciones(autor_id);

ALTER TABLE public.anotaciones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='anotaciones' AND policyname='authenticated_read_anotaciones') THEN
    CREATE POLICY "authenticated_read_anotaciones"
    ON public.anotaciones FOR SELECT
    USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='anotaciones' AND policyname='authenticated_insert_anotaciones') THEN
    CREATE POLICY "authenticated_insert_anotaciones"
    ON public.anotaciones FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' AND autor_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='anotaciones' AND policyname='owner_update_anotaciones') THEN
    CREATE POLICY "owner_update_anotaciones"
    ON public.anotaciones FOR UPDATE
    USING     (autor_id = auth.uid())
    WITH CHECK (autor_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='anotaciones' AND policyname='owner_or_admin_delete_anotaciones') THEN
    CREATE POLICY "owner_or_admin_delete_anotaciones"
    ON public.anotaciones FOR DELETE
    USING (
      autor_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.rol = 'admin' AND p.activo = true
      )
    );
  END IF;
END $$;


-- ─── 8. PLAN_HITOS — hitos de seguimiento por director y estudiante ──────────
--
-- Los milestones del Plan tab actualmente son solo estado local (se pierden al
-- recargar). Esta tabla los persiste correctamente.

CREATE TABLE IF NOT EXISTS public.plan_hitos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  estudiante_id text        NOT NULL,
  texto         text        NOT NULL CHECK (length(texto) > 0),
  fecha_objetivo date,
  completado    boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_hitos_autor      ON public.plan_hitos(autor_id);
CREATE INDEX IF NOT EXISTS idx_plan_hitos_estudiante ON public.plan_hitos(estudiante_id);

ALTER TABLE public.plan_hitos ENABLE ROW LEVEL SECURITY;

-- Cada director solo ve y gestiona sus propios hitos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'plan_hitos'
      AND policyname = 'owner_manage_hitos'
  ) THEN
    CREATE POLICY "owner_manage_hitos"
    ON public.plan_hitos FOR ALL
    USING     (autor_id = auth.uid())
    WITH CHECK (autor_id = auth.uid());
  END IF;
END $$;

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plan_hitos_updated_at ON public.plan_hitos;
CREATE TRIGGER plan_hitos_updated_at
  BEFORE UPDATE ON public.plan_hitos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
