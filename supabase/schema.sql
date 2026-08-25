-- ============================================================================
-- SOCIALSPORT / PULSETRACKER - SUPABASE DATABASE SCHEMA COM RLS RIGOROSO
-- Execute este script no SQL Editor do seu projeto no Supabase
-- Garante que cada atleta só consiga salvar e visualizar suas próprias atividades
-- ============================================================================

-- 1. Criação / Recriação da Tabela de Perfis de Atletas (Profiles)
create table if not exists public.profiles (
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

-- 2. Criação / Recriação da Tabela de Atividades / Treinos (Activities)
create table if not exists public.activities (
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

-- 3. Índices para Otimização de Consultas Rápidas por Usuário
create index if not exists idx_activities_user_id on public.activities(user_id);
create index if not exists idx_activities_timestamp on public.activities(timestamp desc);
create index if not exists idx_profiles_user_id on public.profiles(user_id);

-- 4. Habilitar Segurança a Nível de Linha (RLS - Row Level Security)
alter table public.profiles enable row level security;
alter table public.activities enable row level security;

-- 5. Remover políticas antigas se existirem
drop policy if exists "Acesso público anônimo a perfis" on public.profiles;
drop policy if exists "Acesso público anônimo a atividades" on public.activities;
drop policy if exists "Usuários gerenciam seu próprio perfil" on public.profiles;
drop policy if exists "Usuários gerenciam suas próprias atividades" on public.activities;

-- 6. POLÍTICA RIGOROSA: Cada usuário só pode visualizar, inserir, editar e deletar seus próprios dados
create policy "Usuários gerenciam seu próprio perfil"
  on public.profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Usuários gerenciam suas próprias atividades"
  on public.activities for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
