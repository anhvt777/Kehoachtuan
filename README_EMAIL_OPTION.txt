Kehoachtuan v6.5.1 - Email option for notifications

What is added:
- Danh mục > Cán bộ now has: StaffID, Name, Email BIDV, Gmail dự phòng, Email nhận thông báo
- You can choose quick source: BIDV / Gmail / Tuỳ chỉnh
- When Storage mode = Supabase, clicking Lưu danh mục auto syncs chosen notify email to staff_directory.email
- If your Supabase table has columns email_bidv, email_gmail, notify_email, the web will sync/load them too

Recommended SQL migration (run once in Supabase SQL Editor):

alter table public.staff_directory
  add column if not exists email_bidv text,
  add column if not exists email_gmail text,
  add column if not exists notify_email text;

update public.staff_directory
set email_bidv = coalesce(email_bidv, email),
    notify_email = coalesce(notify_email, email);

How it works now:
- Email digest can continue reading public.staff_directory.email (auto updated from Email nhận thông báo)
- So you can switch recipient from BIDV to Gmail on the web without changing Edge Function code.
