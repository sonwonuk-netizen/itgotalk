-- 고객센터 게시판: 공지사항 (notice) and 자주하는 질문 (faq). Written by 본사 관리자, readable by everyone.
-- body is plain text (shown with line breaks), never HTML.
create table posts (
  id          text primary key default (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  board       text not null check (board in ('notice','faq')),
  title       text not null,
  body        text not null,
  pinned      integer not null default 0,     -- notice: shown on top; faq: shown first
  author_id   text references profiles(id) on delete set null,
  created_at  text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index posts_board on posts (board, pinned desc, created_at desc);
