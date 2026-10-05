-- 연산 테스트 덧셈(2위+1위, 2위+2위): one input box per digit of the answer (from supabase 20261005001000).
-- `digits` is the number of boxes. Students see it (box count only, never the answer) through
-- assessment_items_student in src/lib/db/scope.ts.

update assessment_items
set blanks = (
  select json_group_array(
    case when json_extract(b.value, '$.kind') = 'int'
      then json_set(b.value, '$.digits', length(json_extract(b.value, '$.answer')))
      else json(b.value) end)
  from json_each(assessment_items.blanks) b
)
where exists (select 1 from json_each(assessment_items.tags) t where t.value in ('add_2d1d', 'add_2d2d'));
