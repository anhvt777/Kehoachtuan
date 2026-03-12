-- v6.7 patch: đồng bộ danh mục + cho phép cập nhật báo cáo từ web anon key

-- 1) app_config: lưu danh mục dùng chung giữa desktop/mobile
create table if not exists public.app_config (
  config_key text primary key,
  config_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='app_config' and policyname='app_config_select_anon'
  ) then
    create policy app_config_select_anon on public.app_config for select to anon using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='app_config' and policyname='app_config_insert_anon'
  ) then
    create policy app_config_insert_anon on public.app_config for insert to anon with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='app_config' and policyname='app_config_update_anon'
  ) then
    create policy app_config_update_anon on public.app_config for update to anon using (true) with check (true);
  end if;
end $$;

create index if not exists idx_app_config_updated_at on public.app_config(updated_at desc);

-- 2) reports: bảo đảm web anon key có quyền đọc/ghi/cập nhật báo cáo
create table if not exists public.reports (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  type text,
  name text,
  deadline timestamptz,
  lead_id text,
  created_by_id text,
  status text,
  note text,
  collaborators jsonb not null default '[]'::jsonb,
  parts jsonb not null default '{}'::jsonb
);

-- nếu bảng đã có rồi thì chỉ thêm cột nào còn thiếu
alter table public.reports add column if not exists created_at timestamptz not null default now();
alter table public.reports add column if not exists updated_at timestamptz not null default now();
alter table public.reports add column if not exists type text;
alter table public.reports add column if not exists name text;
alter table public.reports add column if not exists deadline timestamptz;
alter table public.reports add column if not exists lead_id text;
alter table public.reports add column if not exists created_by_id text;
alter table public.reports add column if not exists status text;
alter table public.reports add column if not exists note text;
alter table public.reports add column if not exists collaborators jsonb not null default '[]'::jsonb;
alter table public.reports add column if not exists parts jsonb not null default '{}'::jsonb;

alter table public.reports enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='reports' and policyname='reports_select_anon'
  ) then
    create policy reports_select_anon on public.reports for select to anon using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='reports' and policyname='reports_insert_anon'
  ) then
    create policy reports_insert_anon on public.reports for insert to anon with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='reports' and policyname='reports_update_anon'
  ) then
    create policy reports_update_anon on public.reports for update to anon using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='reports' and policyname='reports_delete_anon'
  ) then
    create policy reports_delete_anon on public.reports for delete to anon using (true);
  end if;
end $$;

create index if not exists idx_reports_deadline on public.reports(deadline);
create index if not exists idx_reports_updated_at on public.reports(updated_at desc);
