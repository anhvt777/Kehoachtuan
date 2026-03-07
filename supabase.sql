-- Kehoachtuan - Supabase schema (tasks)
-- Run this in Supabase SQL Editor.
-- Notes:
-- 1) For quick testing: you may disable RLS on table tasks.
-- 2) After stable: enable RLS + policies.

create extension if not exists "pgcrypto";

create table if not exists public.tasks (
  id uuid primary key,
  seq bigint,
  week_start date not null,
  group_name text,
  title text not null,
  deadline date,
  status text,
  priority text,
  kpi text,
  metric text,
  commit numeric,
  actual numeric,
  carry_over text,
  owner_id text,
  owner_name text,
  note text,
  assigned_by_id text,
  assigned_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional index for queries
create index if not exists tasks_week_start_idx on public.tasks (week_start);
create index if not exists tasks_owner_id_idx on public.tasks (owner_id);

-- Optional: keep updated_at fresh when row updates (if you update via SQL)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at on public.tasks;
create trigger trg_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

-- RLS (optional)
-- alter table public.tasks enable row level security;
-- Example policy (allow all for anon) - NOT recommended for production
-- create policy "anon_all" on public.tasks for all using (true) with check (true);
