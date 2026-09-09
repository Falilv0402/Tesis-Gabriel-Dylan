-- ============================================================
-- 0015_avatar_foto_y_materia.sql
-- Pedido de Mathias: foto de perfil real (no solo iniciales con color) y un
-- campo para indicar la materia que enseña el usuario (director/coordinador
-- suelen ser también profesores de un curso específico).
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS materia     text;

-- ─── Storage: bucket público para fotos de perfil ─────────────────────────
-- Público en LECTURA (cualquiera con la URL puede verla, como cualquier
-- avatar de app típica) pero cada usuario solo puede subir/reemplazar/borrar
-- SU PROPIO archivo — se identifica por el primer segmento del path, que el
-- frontend siempre fija como el propio auth.uid().
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatar_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "avatar_own_insert"    ON storage.objects;
DROP POLICY IF EXISTS "avatar_own_update"    ON storage.objects;
DROP POLICY IF EXISTS "avatar_own_delete"    ON storage.objects;

CREATE POLICY "avatar_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "avatar_own_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatar_own_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatar_own_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- Cómo aplicar (si el MCP de Supabase no está conectado en la sesión):
--   1) Entra al SQL Editor de tu proyecto en supabase.com/dashboard
--   2) Pega y corre este archivo completo
--   3) Verifica: select * from storage.buckets where id = 'avatars';
-- ============================================================
