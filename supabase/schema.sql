-- ============================================================================
-- SOCIALSPORT / PULSETRACKER - SCHEMA DEFINITIVO DO SUPABASE
-- Copie e cole TODO este código no SQL Editor do Supabase e clique em RUN
-- ============================================================================

-- 1. Remove tabelas antigas para recriar com a coluna user_id correta
drop table if exists public.activities cascade;
drop table if exists public.profiles cascade;

-- 2. Criação da Tabela de Perfis de Atletas (Profiles)
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
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

-- 3. Criação da Tabela de Atividades / Treinos (Activities)
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  local_id text,
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

-- 4. Índices para Otimização de Consultas Rápidas por Usuário
create index idx_activities_user_id on public.activities(user_id);
create index idx_activities_timestamp on public.activities(timestamp desc);
create index idx_profiles_user_id on public.profiles(user_id);

-- 5. Habilitar Segurança a Nível de Linha (RLS - Row Level Security)
alter table public.profiles enable row level security;
alter table public.activities enable row level security;

-- 6. POLÍTICAS DE PRIVACIDADE: Cada usuário só gerencia e acessa seus próprios dados
create policy "Usuários gerenciam seu próprio perfil"
  on public.profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Usuários gerenciam suas próprias atividades"
  on public.activities for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
