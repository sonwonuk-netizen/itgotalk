-- 진단 평가 응시 기록. Answers are saved as the student goes (resume after reload) and graded
-- on the server at submit. Rows are written by the server only (service role).

create table assessment_attempts (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references profiles(id),
  assessment_id   text not null references assessments(id),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  auto_correct    int,                       -- filled at submit
  auto_total      int,                       -- auto-graded blanks
  manual_pending  int                        -- blanks left for the teacher
);
create index on assessment_attempts (student_id, started_at desc);

create table assessment_responses (
  attempt_id  uuid not null references assessment_attempts(id) on delete cascade,
  item_id     text not null references assessment_items(id),
  blank_id    text not null,
  given       text,
  correct     boolean,                       -- null = not graded yet / teacher grading
  seconds     int not null default 0,        -- time spent on the item (sum over visits)
  updated_at  timestamptz not null default now(),
  primary key (attempt_id, item_id, blank_id)
);

alter table assessment_attempts  enable row level security;
alter table assessment_responses enable row level security;
grant select on assessment_attempts, assessment_responses to authenticated;

-- Student reads own attempts; approved staff of the student's organization and admins read too.
create policy assessment_attempts_read on assessment_attempts for select to authenticated
  using (public.can_view_student(student_id));
create policy assessment_responses_read on assessment_responses for select to authenticated
  using (exists (select 1 from assessment_attempts a where a.id = attempt_id and public.can_view_student(a.student_id)));
