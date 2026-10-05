-- Explanations shown after a diagnostic (or failed test), chosen by the weakness found.
-- Seeded from content/explanations.csv; editable via the admin CSV upload.
create table skill_explanations (
  skill_id  text not null references skills(id) on delete cascade,
  weakness  text not null check (weakness in ('accuracy','speed')),
  title     text not null,
  body      text not null,
  tip       text,
  primary key (skill_id, weakness)
);

alter table skill_explanations enable row level security;
grant select, insert, update, delete on skill_explanations to authenticated;
create policy explanations_read  on skill_explanations for select to authenticated using (true);
create policy explanations_admin on skill_explanations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
