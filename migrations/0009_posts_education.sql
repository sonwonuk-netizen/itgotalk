-- 교육이야기 (education) joins the 고객센터 boards. SQLite cannot change a CHECK constraint in place,
-- so the table is rebuilt with the same columns.
create table posts_new (
  id          text primary key default (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  board       text not null check (board in ('notice','faq','education')),
  title       text not null,
  body        text not null,
  pinned      integer not null default 0,
  author_id   text references profiles(id) on delete set null,
  created_at  text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
insert into posts_new (id, board, title, body, pinned, author_id, created_at, updated_at)
  select id, board, title, body, pinned, author_id, created_at, updated_at from posts;
drop table posts;
alter table posts_new rename to posts;
create index posts_board on posts (board, pinned desc, created_at desc);

-- The story that was hard-coded on /education, now editable by 본사 관리자.
insert into posts (board, title, body, pinned, created_at, updated_at) values (
  'education',
  '1편-"읽고 말하는 수학"',
  '수학교과는 그 내용과 개념을 읽고 말할 수 있어야 합니다.
읽고 말하는 수학은 아이들이 수학을 읽고 말할 수 있도록 돕습니다.
읽고 말하는 수학은 기초 연산에서 법칙적 사고에 이르는 학습 구조를 낮은 수준의 언어에서 추상적인 언어에 이르는 과정을 언어로 표현하도록 합니다.
읽고 말하는 수학은 초등 과정에서 중학 과정까지 통찰할 수 있도록 돕습니다.
교육에 관한 문의를 환영합니다.
실력 테스트에서 맞춤형 과정 설계까지 친절하게 상담해 드리겠습니다.',
  1,
  '2025-07-21T00:00:00.000Z',
  '2025-07-21T00:00:00.000Z'
);
