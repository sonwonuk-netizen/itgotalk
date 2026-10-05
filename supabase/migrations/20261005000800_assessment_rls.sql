-- 진단 평가 tables: access control (RLS + column privileges).
-- 20261005000600 created the tables without RLS; on Supabase that would let anyone with the
-- anon key read every answer. Rules:
--   anon            → nothing
--   signed-in users → problems only: no answers, model answers, review notes or teacher notes
--   approved staff / admin → everything, through the *_staff views
--   writes          → admin only
-- Grading must happen on the server (service role), never in the browser.

alter table assessments          enable row level security;
alter table assessment_sections  enable row level security;
alter table assessment_parts     enable row level security;
alter table assessment_items     enable row level security;

revoke all on assessments, assessment_sections, assessment_parts, assessment_items from anon, authenticated;

-- Row access: any signed-in user may read content rows; admins may write.
create policy assessments_read  on assessments         for select to authenticated using (true);
create policy sections_read     on assessment_sections for select to authenticated using (true);
create policy parts_read        on assessment_parts    for select to authenticated using (true);
create policy items_read        on assessment_items    for select to authenticated using (true);
create policy assessments_admin on assessments         for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy sections_admin    on assessment_sections for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy parts_admin       on assessment_parts    for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy items_admin       on assessment_items    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Column access: answers and teacher-only text are not selectable by plain users.
grant select on assessments to authenticated;
grant select (id, assessment_id, ord, title, pdf_title, pdf_page) on assessment_sections to authenticated;
grant select on assessment_parts to authenticated;
grant select (id, part_id, ord, label, type, grading, stem, choices, figure, tags) on assessment_items to authenticated;
grant insert, update, delete on assessments, assessment_sections, assessment_parts, assessment_items to authenticated;  -- RLS: admin only

-- Student-facing items: blank ids and kinds (to draw the inputs) without answers.
create or replace view assessment_items_student with (security_barrier = true) as
select i.id, i.part_id, i.ord, i.label, i.type, i.grading, i.stem, i.choices, i.figure, i.tags,
       coalesce((select jsonb_agg(jsonb_build_object('id', b->'id', 'kind', b->'kind'))
                 from jsonb_array_elements(i.blanks) b), '[]'::jsonb) as blanks
from assessment_items i
where auth.uid() is not null;

-- Staff-facing views: answers, model answers, review notes and teacher notes.
-- Rows appear only for approved teachers / org admins and admins.
create or replace view assessment_items_staff with (security_barrier = true) as
select i.* from assessment_items i
where public.staff_org() is not null or public.is_admin();

create or replace view assessment_sections_staff with (security_barrier = true) as
select s.* from assessment_sections s
where public.staff_org() is not null or public.is_admin();

revoke all on assessment_items_student, assessment_items_staff, assessment_sections_staff from anon;
grant select on assessment_items_student, assessment_items_staff, assessment_sections_staff to authenticated;
