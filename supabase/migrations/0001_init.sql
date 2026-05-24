create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nombre text,
  rol text not null default 'director' check (rol in ('admin', 'director')),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.estudiantes (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  nombre text,
  grado int not null,
  seccion text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notas_periodos (
  id uuid primary key default gen_random_uuid(),
  estudiante_id uuid not null references public.estudiantes(id) on delete cascade,
  periodo text not null,
  promedio_notas numeric(5,2) not null,
  nota_matematica numeric(5,2) not null,
  nota_comunicacion numeric(5,2) not null,
  porcentaje_asistencia numeric(5,2) not null,
  nivel_conducta int not null check (nivel_conducta between 1 and 5),
  nivel_participacion int not null check (nivel_participacion between 1 and 5),
  tendencia_notas int not null check (tendencia_notas in (-1, 0, 1)),
  created_at timestamptz not null default now()
);

create table if not exists public.predicciones (
  id uuid primary key default gen_random_uuid(),
  estudiante_id uuid not null references public.estudiantes(id) on delete cascade,
  notas_periodo_id uuid references public.notas_periodos(id) on delete set null,
  probabilidad numeric(6,5) not null check (probabilidad >= 0 and probabilidad <= 1),
  nivel text not null check (nivel in ('ALTO', 'MEDIO', 'BAJO')),
  modelo_version text not null,
  fecha timestamptz not null default now()
);

create table if not exists public.intervenciones (
  id uuid primary key default gen_random_uuid(),
  estudiante_id uuid not null references public.estudiantes(id) on delete cascade,
  prediccion_id uuid references public.predicciones(id) on delete set null,
  tipo text not null check (tipo in ('tutoria', 'reunion', 'derivacion', 'seguimiento')),
  descripcion text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_proceso', 'cerrada')),
  registrado_por uuid references public.profiles(id),
  fecha timestamptz not null default now()
);

create table if not exists public.modelos_versiones (
  id uuid primary key default gen_random_uuid(),
  version text unique not null,
  accuracy numeric,
  precision_score numeric,
  recall numeric,
  f1 numeric,
  auc_roc numeric,
  cv_f1_mean numeric,
  cv_f1_std numeric,
  storage_path text,
  activo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.profiles(id) on delete set null,
  accion text not null,
  tabla text,
  detalle jsonb,
  ip text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.estudiantes enable row level security;
alter table public.notas_periodos enable row level security;
alter table public.predicciones enable row level security;
alter table public.intervenciones enable row level security;
alter table public.modelos_versiones enable row level security;
alter table public.audit_log enable row level security;

create policy "profiles_select_own_or_admin"
on public.profiles for select
using (
  auth.uid() = id or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.rol = 'admin' and p.activo = true
  )
);

create policy "admin_all_profiles"
on public.profiles for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.rol = 'admin' and p.activo = true
  )
);

create policy "authenticated_read_estudiantes"
on public.estudiantes for select
using (auth.role() = 'authenticated');

create policy "admin_write_estudiantes"
on public.estudiantes for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.rol = 'admin' and p.activo = true
  )
);

create policy "authenticated_read_notas"
on public.notas_periodos for select
using (auth.role() = 'authenticated');

create policy "admin_write_notas"
on public.notas_periodos for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.rol = 'admin' and p.activo = true
  )
);

create policy "authenticated_read_predicciones"
on public.predicciones for select
using (auth.role() = 'authenticated');

create policy "admin_write_predicciones"
on public.predicciones for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.rol = 'admin' and p.activo = true
  )
);

create policy "authenticated_manage_intervenciones"
on public.intervenciones for all
using (auth.role() = 'authenticated');

create policy "authenticated_read_modelos"
on public.modelos_versiones for select
using (auth.role() = 'authenticated');

create policy "admin_write_modelos"
on public.modelos_versiones for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.rol = 'admin' and p.activo = true
  )
);

create policy "admin_read_audit"
on public.audit_log for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.rol = 'admin' and p.activo = true
  )
);

