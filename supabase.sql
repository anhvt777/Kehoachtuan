-- Supabase schema for shared task tracking
-- Create table: tasks

create table if not exists public.tasks (
  id text primary key,
  seq bigint,
  week_start date,
  group_name text,
  title text,
  deadline date,
  status text,
  owner_id text,
  owner_name text,
  note text,
  result text,
  kpi text,
  metric text,
  commit numeric,
  actual numeric,
  priority text,
  carry_over text,
  assigned_by_id text,
  assigned_by_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tasks_week_start_idx on public.tasks(week_start);
create index if not exists tasks_owner_idx on public.tasks(owner_id);

-- If you enable RLS, you must add policies; quick start (NOT secure) is to disable RLS:
-- alter table public.tasks disable row level security;
