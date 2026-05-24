-- Tabla de anotaciones del director sobre estudiantes
-- estudiante_id es text porque los IDs del dataset son códigos tipo "0119"

create table if not exists public.anotaciones (
  id          uuid        primary key default gen_random_uuid(),
  estudiante_id text      not null,
  autor_id    uuid        references public.profiles(id) on delete set null,
  contenido   text        not null check (length(contenido) > 0),
  created_at  timestamptz not null default now()
);

create index if not exists idx_anotaciones_estudiante on public.anotaciones(estudiante_id);
create index if not exists idx_anotaciones_autor      on public.anotaciones(autor_id);

alter table public.anotaciones enable row level security;

-- Cualquier usuario autenticado puede leer las anotaciones
create policy "authenticated_read_anotaciones"
on public.anotaciones for select
using (auth.role() = 'authenticated');

-- Cualquier usuario autenticado puede crear una anotación a su nombre
create policy "authenticated_insert_anotaciones"
on public.anotaciones for insert
with check (auth.role() = 'authenticated' and autor_id = auth.uid());

-- Sólo el autor o un admin pueden borrar
create policy "owner_or_admin_delete_anotaciones"
on public.anotaciones for delete
using (
  autor_id = auth.uid() or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.rol = 'admin' and p.activo = true
  )
);
