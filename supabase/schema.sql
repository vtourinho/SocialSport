-- ============================================================================
-- SOCIALSPORT / PULSETRACKER - SUPABASE DATABASE SCHEMA
-- Execute este script no SQL Editor do seu projeto no Supabase
-- ============================================================================

-- 1. Criação da Tabela de Perfis de Atletas (Profiles)
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nickname text not null,
  email text,
  phone text,
  age integer default 30,
  weight numeric(5,2) default 70.0,
  height integer default 175,
  gender text default 'M',
  city text,
  state text default 'SP',
  photo_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Criação da Tabela de Atividades / Treinos (Activities)
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  local_id text,
  profile_id uuid references public.profiles(id) on delete set null,
  mode text not null check (mode in ('run', 'bike')),
  title text not null,
  date_formatted text not null,
  timestamp bigint not null,
  duration_seconds numeric(10,2) not null,
  duration_formatted text not null,
  distance_meters numeric(10,2) not null,
  distance_km text not null,
  avg_pace text,
  avg_speed text not null,
  max_speed text not null,
  calories integer not null default 0,
  splits jsonb default '[]'::jsonb,
  points jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Índices para Otimização de Consultas
create index if not exists idx_activities_mode on public.activities(mode);
create index if not exists idx_activities_timestamp on public.activities(timestamp desc);
create index if not exists idx_activities_profile on public.activities(profile_id);

-- 4. Habilitar Segurança por Linha (RLS - Row Level Security)
alter table public.profiles enable row level security;
alter table public.activities enable row level security;

-- Políticas de Acesso Anônimo (Permite leitura e gravação segura via Anon Key)
create policy "Acesso público anônimo a perfis"
  on public.profiles for all
  using (true)
  with check (true);

create policy "Acesso público anônimo a atividades"
  on public.activities for all
  using (true)
  with check (true);
