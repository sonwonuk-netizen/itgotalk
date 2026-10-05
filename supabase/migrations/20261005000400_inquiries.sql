-- 상담신청 (site /qa). Written by the server after validation; only admins read them.
create table inquiries (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null,
  topic       text not null,
  message     text not null,
  consent_at  timestamptz not null,
  handled_at  timestamptz,
  created_at  timestamptz not null default now()
);

alter table inquiries enable row level security;
grant select, update on inquiries to authenticated;
create policy inquiries_admin_read   on inquiries for select to authenticated using (public.is_admin());
create policy inquiries_admin_update on inquiries for update to authenticated using (public.is_admin()) with check (public.is_admin());
