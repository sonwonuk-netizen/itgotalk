-- Tables the MVP needs beyond db/schema.sql.

-- Server-side clock for one play-through (rule 1: server verifies elapsed time).
-- item_order fixes which items, in which order, the student was shown.
create table play_sessions (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references profiles(id),
  set_id       text not null references item_sets(id),
  mode         text not null check (mode in ('practice','test','diagnostic','race_ai')),
  item_order   jsonb not null,                   -- [item_id, ...]
  ai_target_ms int,                              -- race_ai only: AI finish time
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  attempt_id   uuid references attempts(id)
);
create index on play_sessions (student_id, started_at desc);

-- learning-engine §3 assignReview(): previous skill's set to practise after 3 failed tests.
create table review_assignments (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references profiles(id),
  skill_id      text not null references skills(id),
  set_id        text not null references item_sets(id),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);
create index on review_assignments (student_id) where completed_at is null;

-- Delivery log for parent report links (console now, KakaoTalk later).
create table report_deliveries (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references reports(id) on delete cascade,
  channel     text not null,                     -- 'console' | 'email' | 'kakao'
  recipient   text not null,
  status      text not null check (status in ('sent','failed')),
  detail      text,
  created_at  timestamptz not null default now()
);

alter table comments
  add constraint comments_report_fk foreign key (report_id) references reports(id) on delete cascade,
  add constraint comments_target_chk check (attempt_id is not null or report_id is not null);

create index on skill_progress (student_id);
create index on teacher_alerts (student_id, created_at desc);
