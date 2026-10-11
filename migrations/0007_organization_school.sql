-- The school an academy/공부방 serves. Student signup picks region → school, and the student joins the
-- organization linked to that school (no invite code). Teachers still join with the invite code.
alter table organizations add column school_id text references schools(id);
create index organizations_school on organizations (school_id);
