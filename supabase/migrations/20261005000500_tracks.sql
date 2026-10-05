-- Learning tracks in 학습자료실 (덧셈과 뺄셈, 구구단, 1~9 빨리 누르기 …).
-- Each track has its own progression, diagnostic and "current skill"; skills.ord stays globally unique.
create table tracks (
  id              text primary key,
  ord             int  not null unique,
  name            text not null,
  description     text,
  icon            text,
  has_diagnostic  boolean not null default true
);

insert into tracks (id, ord, name, description, icon, has_diagnostic)
values ('add', 1, '덧셈과 뺄셈', '10 이하 덧셈부터 한 단계씩', '/site/icon-addsub.png', true)
on conflict (id) do nothing;

alter table skills add column track_id text references tracks(id);
update skills set track_id = 'add' where track_id is null;
alter table skills alter column track_id set not null;
create index on skills (track_id, ord);

-- New patterns: multiplication tables and the number-tapping game.
alter table skills drop constraint skills_pattern_check;
alter table skills add constraint skills_pattern_check
  check (pattern in ('intro','intuition','commutative','complement10','times_table','times_mixed','tap_sequence'));

alter table tracks enable row level security;
grant select on tracks to anon, authenticated;
grant insert, update, delete on tracks to authenticated;
create policy tracks_read  on tracks for select to anon, authenticated using (true);
create policy tracks_admin on tracks for all to authenticated using (public.is_admin()) with check (public.is_admin());
