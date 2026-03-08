Supabase SQL (run in SQL Editor) to enable Reports tab realtime:

create table if not exists public.reports (
  id text primary key,
  created_at timestamptz default now(),
  type text,
  name text,
  deadline timestamptz,
  lead_id text,
  created_by_id text,
  status text,
  note text,
  collaborators jsonb,
  parts jsonb
);

-- Quick internal use (no auth):
alter table public.reports disable row level security;
