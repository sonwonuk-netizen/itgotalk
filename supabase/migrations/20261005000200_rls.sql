-- Row Level Security (schema.sql "RLS 요지" 1–4).
-- Server code writes engine results with the service role; every read on behalf of a
-- user runs as `authenticated` with auth.uid() set, so these policies are the boundary.

-- ── helpers (security definer: they read profiles without recursing into its policies) ──
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

-- Organization of the current user if they are an approved teacher or org admin.
create or replace function public.staff_org() returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from profiles
  where id = auth.uid() and role in ('teacher','org_admin') and is_approved
$$;

-- Organization of the current user if they are an approved org admin (원장).
create or replace function public.admin_org() returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from profiles
  where id = auth.uid() and role = 'org_admin' and is_approved
$$;

-- Own organization, any role (students see their academy's name).
create or replace function public.my_org() returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from profiles where id = auth.uid()
$$;

-- Student is the caller, or the caller is approved staff of the student's organization, or admin.
create or replace function public.can_view_student(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select sid = auth.uid()
      or public.is_admin()
      or exists (
        select 1 from profiles s
        where s.id = sid and s.role = 'student'
          and s.organization_id is not null
          and s.organization_id = public.staff_org()
      )
$$;

create or replace function public.is_staff_of(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (sid <> auth.uid() and public.can_view_student(sid))
$$;

-- Parent link: the only path to a report without logging in (rule 4).
create or replace function public.get_report_by_token(token text)
returns table (
  report_id uuid, student_initial text, organization_name text,
  period_start date, period_end date, lines jsonb, expires_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select r.id, p.display_initial, o.name, r.period_start, r.period_end, r.lines, r.expires_at
  from reports r
  join profiles p on p.id = r.student_id
  left join organizations o on o.id = p.organization_id
  where r.share_token = token and r.expires_at > now()
$$;

create or replace function public.get_report_comments_by_token(token text)
returns table (body text, author_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.body, a.full_name, c.created_at
  from reports r
  join comments c on c.report_id = r.id
  join profiles a on a.id = c.author_id
  where r.share_token = token and r.expires_at > now()
  order by c.created_at
$$;

-- ── grants (RLS narrows these) ──
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on regions, schools to anon;
grant execute on function public.get_report_by_token(text) to anon, authenticated;
grant execute on function public.get_report_comments_by_token(text) to anon, authenticated;

-- ── enable RLS everywhere ──
alter table regions            enable row level security;
alter table schools            enable row level security;
alter table organizations      enable row level security;
alter table profiles           enable row level security;
alter table guardians          enable row level security;
alter table skills             enable row level security;
alter table item_sets          enable row level security;
alter table items              enable row level security;
alter table attempts           enable row level security;
alter table skill_progress     enable row level security;
alter table comments           enable row level security;
alter table reports            enable row level security;
alter table teacher_alerts     enable row level security;
alter table play_sessions      enable row level security;
alter table review_assignments enable row level security;
alter table report_deliveries  enable row level security;

-- Regions/schools: public list for signup; admin writes.
create policy regions_read  on regions for select to anon, authenticated using (true);
create policy regions_admin on regions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy schools_read  on schools for select to anon, authenticated using (true);
create policy schools_admin on schools for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Organizations: members see their own; org admin updates it; admin manages all.
create policy orgs_read  on organizations for select to authenticated using (id = public.my_org() or public.is_admin());
create policy orgs_owner on organizations for update to authenticated
  using (id = public.admin_org()) with check (id = public.admin_org());
create policy orgs_admin on organizations for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Profiles: self; approved staff see students of their org; org admin sees/approves own teachers.
create policy profiles_read on profiles for select to authenticated using (
  id = auth.uid()
  or public.is_admin()
  or (role = 'student' and organization_id = public.staff_org())
  or (organization_id = public.admin_org())
);
create policy profiles_approve on profiles for update to authenticated
  using (role = 'teacher' and organization_id = public.admin_org())
  with check (role = 'teacher' and organization_id = public.admin_org());
create policy profiles_admin on profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy guardians_read on guardians for select to authenticated using (public.can_view_student(student_id));

-- Content: any signed-in user reads; admin writes.
create policy skills_read     on skills    for select to authenticated using (true);
create policy item_sets_read  on item_sets for select to authenticated using (true);
create policy items_read      on items     for select to authenticated using (true);
create policy skills_admin    on skills    for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy item_sets_admin on item_sets for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy items_admin     on items     for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Learning records: student sees/inserts own; staff of the org read.
create policy attempts_read   on attempts for select to authenticated using (public.can_view_student(student_id));
create policy attempts_insert on attempts for insert to authenticated with check (student_id = auth.uid());
create policy progress_read   on skill_progress for select to authenticated using (public.can_view_student(student_id));
create policy progress_insert on skill_progress for insert to authenticated with check (student_id = auth.uid());
create policy sessions_read   on play_sessions for select to authenticated using (public.can_view_student(student_id));
create policy reviews_read    on review_assignments for select to authenticated using (public.can_view_student(student_id));

-- Comments: staff of the student read/write; students read comments on their attempts.
create policy comments_read on comments for select to authenticated using (
  exists (select 1 from attempts a where a.id = comments.attempt_id and public.can_view_student(a.student_id))
  or exists (select 1 from reports r where r.id = comments.report_id and public.is_staff_of(r.student_id))
);
create policy comments_write on comments for insert to authenticated with check (
  author_id = auth.uid() and (
    exists (select 1 from attempts a where a.id = comments.attempt_id and public.is_staff_of(a.student_id))
    or exists (select 1 from reports r where r.id = comments.report_id and public.is_staff_of(r.student_id))
  )
);

-- Reports: staff only (parents go through get_report_by_token).
create policy reports_read on reports for select to authenticated using (public.is_staff_of(student_id));

create policy alerts_read   on teacher_alerts for select to authenticated using (public.is_staff_of(student_id));
create policy alerts_update on teacher_alerts for update to authenticated
  using (public.is_staff_of(student_id)) with check (public.is_staff_of(student_id));

create policy deliveries_admin on report_deliveries for select to authenticated using (public.is_admin());
