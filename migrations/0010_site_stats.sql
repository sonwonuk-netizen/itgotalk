-- 방문 통계 for 본사 관리자. Days are Korea time ('YYYY-MM-DD').
-- visitor_key is a hash of an anonymous cookie id *and the day*, so a visitor cannot be followed
-- across days from this table. Only the server writes/reads these (asService); scoped reads are denied.
create table site_visitors_daily (
  day          text not null,
  visitor_key  text not null,
  primary key (day, visitor_key)
);

create table site_page_views_daily (
  day    text not null,
  path   text not null,
  views  integer not null default 0,
  primary key (day, path)
);
