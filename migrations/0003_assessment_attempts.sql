-- 진단 평가 응시 기록 (from supabase 20261005000900). Answers are saved as the student goes
-- (resume after reload) and graded on the server at submit. Rows are written by the server only;
-- reads are limited by src/lib/db/scope.ts (student: own; approved staff of the org; admin).

create table assessment_attempts (
  id              text primary key default (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  student_id      text not null references profiles(id),
  assessment_id   text not null references assessments(id),
  started_at      text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  finished_at     text,
  auto_correct    integer,                   -- filled at submit
  auto_total      integer,                   -- auto-graded blanks
  manual_pending  integer                    -- blanks left for the teacher
);
create index assessment_attempts_student on assessment_attempts (student_id, started_at desc);

create table assessment_responses (
  attempt_id  text not null references assessment_attempts(id) on delete cascade,
  item_id     text not null references assessment_items(id),
  blank_id    text not null,
  given       text,
  correct     integer,                       -- 0/1; null = not graded yet / teacher grading
  seconds     integer not null default 0,    -- time spent on the item (sum over visits)
  updated_at  text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (attempt_id, item_id, blank_id)
);
