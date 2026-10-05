-- 잇고톡 MVP 스키마 (PostgreSQL / Supabase)
-- 설명은 docs/data-model.md 참고

create extension if not exists "pgcrypto";

-- ── 지역·학교·기관 ─────────────────────────────
create table regions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,            -- 예: 경기 양평군
  is_active   boolean not null default true
);

create table schools (
  id          uuid primary key default gen_random_uuid(),
  region_id   uuid not null references regions(id),
  name        text not null,
  level       text not null check (level in ('elementary','middle','high')),
  is_active   boolean not null default true,
  unique (region_id, name)
);

create table organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  kind         text not null check (kind in ('academy','study_room')),  -- 학원 / 공부방
  invite_code  text not null unique,
  created_at   timestamptz not null default now()
);

-- ── 사용자 ─────────────────────────────────────
-- auth.users(id) 와 1:1 (Supabase Auth)
create table profiles (
  id              uuid primary key,             -- = auth.users.id
  role            text not null check (role in ('student','teacher','org_admin','admin')),
  display_initial text not null,                -- 학생 화면 표시용 이니셜
  full_name       text,                         -- 교사·관리자만 화면에 노출
  grade           int check (grade between 1 and 12),
  school_id       uuid references schools(id),
  organization_id uuid references organizations(id),
  is_approved     boolean not null default false,   -- 교사: 원장 승인 여부
  created_at      timestamptz not null default now()
);

create table guardians (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references profiles(id) on delete cascade,
  phone            text not null,
  consent_at       timestamptz not null,         -- 법정대리인 동의 시각
  report_opt_in    boolean not null default true
);

-- ── 콘텐츠 ─────────────────────────────────────
create table skills (
  id                 text primary key,           -- 예: ADD_P2_COMM
  ord                int  not null unique,       -- 진도 순서
  book               text not null,              -- SA..SH
  week               int,
  name               text not null,
  pattern            text not null check (pattern in ('intro','intuition','commutative','complement10')),
  operand            int,
  hint               text,
  time_rule          text not null default 'per_set' check (time_rule in ('per_set','per_item')),
  time_limit_sec     numeric(5,2) not null default 12,
  practice_required  int not null default 3
);

create table item_sets (
  id        text primary key,                    -- 예: SA-P09
  skill_id  text not null references skills(id),
  page      int  not null,
  ord       int  not null                        -- 스킬 내 순서
);

create table items (
  id        uuid primary key default gen_random_uuid(),
  set_id    text not null references item_sets(id) on delete cascade,
  ord       int  not null,
  a         int  not null,
  op        text not null check (op in ('+','-','×','÷')),
  b         int  not null,
  blank     text not null check (blank in ('result','operand2')),
  answer    int  not null,
  unique (set_id, ord)
);

-- ── 학습 기록 ──────────────────────────────────
create table attempts (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references profiles(id),
  set_id              text not null references item_sets(id),
  mode                text not null check (mode in ('practice','test','diagnostic','race_ai')),
  item_count          int  not null,
  correct_count       int  not null,
  client_elapsed_ms   int  not null,
  server_started_at   timestamptz not null,
  server_finished_at  timestamptz not null,
  elapsed_ms          int  not null,             -- 엔진이 확정한 판정용 시간
  passed              boolean,                   -- test/diagnostic만 값 있음
  wrong_items         jsonb not null default '[]',  -- [{item_id, given}]
  created_at          timestamptz not null default now()
);
create index on attempts (student_id, created_at desc);

create table skill_progress (
  student_id         uuid not null references profiles(id),
  skill_id           text not null references skills(id),
  status             text not null check (status in ('locked','in_progress','passed')),
  current_set_id     text references item_sets(id),
  practice_count     int not null default 0,
  consecutive_fail   int not null default 0,
  best_elapsed_ms    int,
  passed_at          timestamptz,
  primary key (student_id, skill_id)
);

-- ── 교사·리포트 ────────────────────────────────
create table comments (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references profiles(id),
  attempt_id  uuid references attempts(id),
  report_id   uuid,
  body        text not null,
  created_at  timestamptz not null default now()
);

create table reports (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references profiles(id),
  period_start  date not null,
  period_end    date not null,
  lines         jsonb not null,                  -- ["+3 교환법칙: 9/27 …", …]
  share_token   text not null unique,
  expires_at    timestamptz not null,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);

create table teacher_alerts (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references profiles(id),
  skill_id    text not null references skills(id),
  reason      text not null,                     -- 'consecutive_fail_3'
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- ── RLS (요지) ─────────────────────────────────
-- 1) 학생: 자기 attempts/skill_progress만 select/insert
-- 2) 교사/원장(is_approved): 같은 organization_id 학생의 데이터만 select
-- 3) 콘텐츠(skills, item_sets, items): 로그인 사용자 select, admin만 write
-- 4) reports: share_token 경유 공개 조회는 서버 함수(security definer)로만
-- 정책 SQL은 Claude Code가 이 규칙에 따라 작성하고 테스트한다.
