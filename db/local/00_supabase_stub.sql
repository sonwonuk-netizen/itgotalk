-- Local-only stand-in for what Supabase provides out of the box.
-- Applied before supabase/migrations/* when running on PGlite. Never run this on Supabase.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

-- Supabase Auth keeps credentials here. Locally we store a scrypt hash written by the app.
create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null unique,
  encrypted_password  text not null,
  created_at          timestamptz not null default now()
);

-- Same contract as Supabase: the JWT subject of the current request.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;
