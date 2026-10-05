-- 연산 테스트 덧셈(2위+1위, 2위+2위): one input box per digit of the answer.
-- `digits` is the number of boxes. It is exposed to students (box count only, never the answer).

update assessment_items i
set blanks = (
  select jsonb_agg(case when b->>'kind' = 'int' then b || jsonb_build_object('digits', length(b->>'answer')) else b end)
  from jsonb_array_elements(i.blanks) b
)
where i.tags && array['add_2d1d', 'add_2d2d']::text[];

-- Student view now also carries `digits` (still no answers).
create or replace view assessment_items_student with (security_barrier = true) as
select i.id, i.part_id, i.ord, i.label, i.type, i.grading, i.stem, i.choices, i.figure, i.tags,
       coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', b->'id', 'kind', b->'kind', 'digits', b->'digits')))
                 from jsonb_array_elements(i.blanks) b), '[]'::jsonb) as blanks
from assessment_items i
where auth.uid() is not null;
