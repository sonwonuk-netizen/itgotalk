// Loads schema.sql + seed.sql into a fresh in-memory Postgres (PGlite) and checks the data.
//   node content/assessment/tools/verify_db.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = await PGlite.create();
await db.exec(readFileSync(path.join(dir, "schema.sql"), "utf8"));
await db.exec(readFileSync(path.join(dir, "seed.sql"), "utf8"));

const one = async (sql) => (await db.query(sql)).rows;
const json = JSON.parse(readFileSync(path.join(dir, "assessment_4-7.json"), "utf8"));
const [counts] = await one(`select
  (select count(*)::int from assessments) a, (select count(*)::int from assessment_sections) s,
  (select count(*)::int from assessment_parts) p, (select count(*)::int from assessment_items) i,
  (select coalesce(sum(jsonb_array_length(blanks)),0)::int from assessment_items) b`);
console.log("rows:", counts);

const fail = [];
if (counts.s !== json.stats.sections) fail.push("section count");
if (counts.i !== json.stats.items) fail.push("item count");
if (counts.b !== json.stats.blanks) fail.push("blank count");

// every blank referenced in a stem has an answer spec
const orphan = await one(`
  select i.id, g->>'id' as blank from assessment_items i, jsonb_array_elements(i.stem) g
  where g->>'t' = 'blank' and not exists (select 1 from jsonb_array_elements(i.blanks) b where b->>'id' = g->>'id')`);
if (orphan.length) fail.push("stem blanks without answers: " + JSON.stringify(orphan));

// auto-graded blanks must have an answer
const noAnswer = await one(`
  select i.id, b->>'id' as blank from assessment_items i, jsonb_array_elements(i.blanks) b
  where i.grading = 'auto' and coalesce(b->>'answer','') = ''`);
if (noAnswer.length) fail.push("auto items without answers: " + JSON.stringify(noAnswer));

console.log("per section:", (await one(`select s.ord, s.title, count(i.*)::int items
  from assessment_sections s join assessment_parts p on p.section_id = s.id join assessment_items i on i.part_id = p.id
  group by s.ord, s.title order by s.ord`)).map((r) => `${r.ord}.${r.title}=${r.items}`).join(" | "));
console.log("grading:", await one(`select grading, count(*)::int n from assessment_items group by grading order by grading`));
console.log("needs review:", (await one(`select count(*)::int n from assessment_items where review_note is not null`))[0].n);
console.log("sample:", JSON.stringify((await one(`select label, stem, blanks from assessment_items where id like '%s05-p2-02'`))[0]));
await db.close();
console.log(fail.length ? "FAIL: " + fail.join("; ") : "PASS: schema + seed load cleanly and are consistent");
process.exit(fail.length ? 1 : 0);
