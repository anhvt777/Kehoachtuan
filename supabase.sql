-- Kehoachtuan Supabase schema v6.1.0
-- Run in Supabase SQL Editor. Safe to re-run.

create extension if not exists "uuid-ossp";

create table if not exists public.tasks (
  id text primary key,
  seq bigint,
  week_start date not null,
  group_name text,
  title text,
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

create index if not exists tasks_week_start_idx on public.tasks(week_start);
create index if not exists tasks_updated_idx on public.tasks(updated_at);

create table if not exists public.weekly_forecast (
  id uuid primary key default uuid_generate_v4(),
  week_start date not null,
  staff_id text not null,
  metric_key text not null,
  actual numeric,
  quarter_plan numeric,
  week_plan numeric,
  note text,
  updated_by_id text,
  updated_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists weekly_forecast_uniq on public.weekly_forecast(week_start, staff_id, metric_key);
create index if not exists weekly_forecast_week_idx on public.weekly_forecast(week_start);
