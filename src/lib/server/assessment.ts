import "server-only";
import { asService, asUser, type Tx } from "@/lib/db/client";
import { gradeBlank, summarize, type BlankKind, type BlankSpec } from "@/lib/assessment/grade";
import { choiceToHtml, richToHtml } from "@/lib/assessment/render";

/** One screen of the 진단 평가 player. HTML is pre-rendered (KaTeX) on the server. */
export interface Question {
  id: string;
  no: number; // 1-based position in the test
  label: string;
  type: "fill" | "select_many" | "free";
  sectionNo: number;
  sectionTitle: string;
  partTitleHtml: string;
  /** Instruction shared by several items (e.g. "다음 두 수의 크기를 비교하세요"). */
  contextHtml: string | null;
  /** digits: number of one-digit boxes for this blank (연산 테스트 덧셈), otherwise a single input. */
  stem: ({ t: "html"; html: string } | { t: "br" } | { t: "blank"; id: string; kind: BlankKind; digits?: number })[];
  choices: { value: string; html: string }[] | null;
  figure: string | null;
}

export class AssessmentError extends Error {}

/** In the data, " / " separates sub-questions printed on separate lines in the PDF. */
function splitLines(rich: string): Question["stem"] {
  const out: Question["stem"] = [];
  rich.split(/(?:^|\s)\/(?:\s|$)/).forEach((part, i) => {
    if (i > 0) out.push({ t: "br" });
    if (part.trim()) out.push({ t: "html", html: richToHtml(part.trim()) });
  });
  return out;
}

interface ItemRow {
  id: string; label: string; type: string; grading: "auto" | "manual" | "mixed";
  stem: ({ t: "rich"; v: string } | { t: "blank"; id: string })[];
  blanks: { id: string; kind: BlankKind; digits?: number }[];
  choices: string[] | null; figure: string | null;
  part_title: string; section_no: number; section_title: string;
}

async function currentAssessment(tx: Tx) {
  const { rows } = await tx.query<{ id: string; title: string; subtitle: string | null }>(
    "select id, title, subtitle from assessments order by created_at desc limit 1",
  );
  return rows[0] ?? null;
}

/** Problems in order, read through the student view — answers never leave the server here. */
async function loadQuestions(tx: Tx, assessmentId: string): Promise<Question[]> {
  const { rows } = await tx.query<ItemRow>(
    `select i.id, i.label, i.type, i.grading, i.stem, i.blanks, i.choices, i.figure,
            p.title as part_title, s.ord as section_no, s.title as section_title
     from assessment_items_student i
     join assessment_parts p on p.id = i.part_id
     join assessment_sections s on s.id = p.section_id
     where s.assessment_id = $1
     order by s.ord, p.ord, i.ord`,
    [assessmentId],
  );
  const out: Question[] = [];
  let context: { part: string; html: string } | null = null;
  for (const r of rows) {
    if (r.type === "group") {
      // A heading item ("2. 다음 두 수의 크기…") becomes the instruction of the items after it in the part.
      context = { part: r.part_title + r.section_no, html: r.stem.map((g) => (g.t === "rich" ? richToHtml(g.v) : "")).join(" ") };
      continue;
    }
    if (context && context.part !== r.part_title + r.section_no) context = null;
    const kinds = new Map(r.blanks.map((b) => [b.id, b.kind]));
    const digits = new Map(r.blanks.map((b) => [b.id, b.digits]));
    out.push({
      id: r.id,
      no: out.length + 1,
      label: r.label,
      type: r.type as Question["type"],
      sectionNo: r.section_no,
      sectionTitle: r.section_title,
      partTitleHtml: richToHtml(r.part_title),
      contextHtml: context?.html ?? null,
      stem: r.stem.flatMap((g) => (g.t === "rich" ? splitLines(g.v) : [{ t: "blank" as const, id: g.id, kind: kinds.get(g.id) ?? "text", ...(digits.get(g.id) ? { digits: digits.get(g.id) } : {}) }])),
      choices: r.choices ? r.choices.map((c) => ({ value: c, html: choiceToHtml(c) })) : null,
      figure: r.figure ? `/assessment-figures/${r.figure.replace(/^figures\//, "")}` : null,
    });
  }
  return out;
}

export async function loadAssessmentIntro(studentId: string) {
  return asUser(studentId, async (tx) => {
    const a = await currentAssessment(tx);
    if (!a) return null;
    const questions = await loadQuestions(tx, a.id);
    const { rows: attempts } = await tx.query<{ id: string; started_at: Date; finished_at: Date | null; auto_correct: number | null; auto_total: number | null; manual_pending: number | null }>(
      "select id, started_at, finished_at, auto_correct, auto_total, manual_pending from assessment_attempts where student_id = $1 and assessment_id = $2 order by started_at desc",
      [studentId, a.id],
    );
    const sections = [...new Map(questions.map((q) => [q.sectionNo, q.sectionTitle])).entries()];
    return { assessment: a, questionCount: questions.length, sections, attempts };
  });
}

/** Resume the unfinished attempt, or start a new one. */
export async function startAssessment(studentId: string): Promise<string> {
  return asService(async (tx) => {
    const a = await currentAssessment(tx);
    if (!a) throw new AssessmentError("진단 평가가 아직 준비되지 않았어요.");
    const open = await tx.query<{ id: string }>(
      "select id from assessment_attempts where student_id = $1 and assessment_id = $2 and finished_at is null order by started_at desc limit 1",
      [studentId, a.id],
    );
    if (open.rows[0]) return open.rows[0].id;
    const { rows } = await tx.query<{ id: string }>(
      "insert into assessment_attempts (student_id, assessment_id) values ($1, $2) returning id",
      [studentId, a.id],
    );
    return rows[0]!.id;
  });
}

/** Questions + answers saved so far, for the player. Only the owner, only while unfinished. */
export async function loadAttemptForPlay(studentId: string, attemptId: string) {
  return asUser(studentId, async (tx) => {
    const { rows } = await tx.query<{ assessment_id: string; finished_at: Date | null; started_at: Date }>(
      "select assessment_id, finished_at, started_at from assessment_attempts where id = $1 and student_id = $2",
      [attemptId, studentId],
    );
    const attempt = rows[0];
    if (!attempt) return null;
    const a = await currentAssessment(tx);
    const questions = await loadQuestions(tx, attempt.assessment_id);
    const saved = await tx.query<{ item_id: string; blank_id: string; given: string | null; seconds: number }>(
      "select item_id, blank_id, given, seconds from assessment_responses where attempt_id = $1",
      [attemptId],
    );
    const answers: Record<string, Record<string, string>> = {};
    const seconds: Record<string, number> = {};
    for (const r of saved.rows) {
      (answers[r.item_id] ??= {})[r.blank_id] = r.given ?? "";
      seconds[r.item_id] = Math.max(seconds[r.item_id] ?? 0, r.seconds);
    }
    return { finished: !!attempt.finished_at, title: a ? `${a.title} · ${a.subtitle ?? ""}` : "진단 평가", questions, answers, seconds };
  });
}

async function ownOpenAttempt(tx: Tx, studentId: string, attemptId: string) {
  const { rows } = await tx.query<{ assessment_id: string; finished_at: Date | null }>(
    "select assessment_id, finished_at from assessment_attempts where id = $1 and student_id = $2 for update",
    [attemptId, studentId],
  );
  const a = rows[0];
  if (!a) throw new AssessmentError("평가 기록을 찾을 수 없어요.");
  if (a.finished_at) throw new AssessmentError("이미 제출한 평가예요.");
  return a;
}

/** Autosave one item's answers (and time spent) while the student moves through the test. */
export async function saveAnswers(studentId: string, attemptId: string, itemId: string, given: Record<string, string>, secondsDelta: number) {
  await asService(async (tx) => {
    await ownOpenAttempt(tx, studentId, attemptId);
    const { rows } = await tx.query<{ blanks: { id: string }[] }>("select blanks from assessment_items where id = $1", [itemId]);
    const item = rows[0];
    if (!item) throw new AssessmentError("문항을 찾을 수 없어요.");
    const delta = Math.max(0, Math.min(3600, Math.round(secondsDelta) || 0));
    for (const b of item.blanks) {
      const value = given[b.id];
      if (value === undefined) continue;
      await tx.query(
        `insert into assessment_responses (attempt_id, item_id, blank_id, given, seconds) values ($1,$2,$3,$4,$5)
         on conflict (attempt_id, item_id, blank_id) do update
           set given = excluded.given, seconds = assessment_responses.seconds + $5, updated_at = now()`,
        [attemptId, itemId, b.id, value.slice(0, 500), delta],
      );
    }
  });
}

/** Grade every blank on the server (answers read with the service role) and close the attempt. */
export async function submitAssessment(studentId: string, attemptId: string) {
  return asService(async (tx) => {
    const attempt = await ownOpenAttempt(tx, studentId, attemptId);
    const { rows: items } = await tx.query<{ id: string; grading: "auto" | "manual" | "mixed"; blanks: BlankSpec[] }>(
      `select i.id, i.grading, i.blanks from assessment_items i
       join assessment_parts p on p.id = i.part_id join assessment_sections s on s.id = p.section_id
       where s.assessment_id = $1 and i.type <> 'group'`,
      [attempt.assessment_id],
    );
    const { rows: saved } = await tx.query<{ item_id: string; blank_id: string; given: string | null }>(
      "select item_id, blank_id, given from assessment_responses where attempt_id = $1",
      [attemptId],
    );
    const given = new Map(saved.map((r) => [`${r.item_id}#${r.blank_id}`, r.given]));
    const results: (boolean | null)[] = [];
    for (const it of items) {
      for (const b of it.blanks) {
        const g = given.get(`${it.id}#${b.id}`) ?? null;
        const correct = gradeBlank(b, g, it.grading);
        results.push(correct);
        await tx.query(
          `insert into assessment_responses (attempt_id, item_id, blank_id, given, correct) values ($1,$2,$3,$4,$5)
           on conflict (attempt_id, item_id, blank_id) do update set correct = excluded.correct`,
          [attemptId, it.id, b.id, g, correct],
        );
      }
    }
    const s = summarize(results);
    await tx.query(
      "update assessment_attempts set finished_at = now(), auto_correct = $2, auto_total = $3, manual_pending = $4 where id = $1",
      [attemptId, s.autoCorrect, s.autoTotal, s.manualPending],
    );
    return s;
  });
}

export type ItemStatus = "correct" | "wrong" | "pending" | "blank";

/** Per-section and per-item result for the student (no answers shown). */
export async function loadAttemptResult(userId: string, attemptId: string) {
  return asUser(userId, async (tx) => {
    const { rows } = await tx.query<{ student_id: string; assessment_id: string; finished_at: Date | null; started_at: Date; auto_correct: number; auto_total: number; manual_pending: number }>(
      "select student_id, assessment_id, finished_at, started_at, auto_correct, auto_total, manual_pending from assessment_attempts where id = $1",
      [attemptId],
    );
    const attempt = rows[0];
    if (!attempt) return null;
    const questions = await loadQuestions(tx, attempt.assessment_id);
    const { rows: resp } = await tx.query<{ item_id: string; given: string | null; correct: boolean | null; seconds: number }>(
      "select item_id, given, correct, seconds from assessment_responses where attempt_id = $1",
      [attemptId],
    );
    const byItem = new Map<string, typeof resp>();
    for (const r of resp) byItem.set(r.item_id, [...(byItem.get(r.item_id) ?? []), r]);
    const items = questions.map((q) => {
      const rs = byItem.get(q.id) ?? [];
      const answered = rs.some((r) => (r.given ?? "").trim() !== "");
      let status: ItemStatus;
      if (!answered) status = "blank";
      else if (rs.some((r) => r.correct === false)) status = "wrong";
      else if (rs.some((r) => r.correct === null)) status = "pending";
      else status = "correct";
      return { id: q.id, no: q.no, label: q.label, sectionNo: q.sectionNo, sectionTitle: q.sectionTitle, status, seconds: Math.max(0, ...rs.map((r) => r.seconds)) };
    });
    const sections = [...new Map(items.map((i) => [i.sectionNo, i.sectionTitle])).entries()].map(([no, title]) => {
      const list = items.filter((i) => i.sectionNo === no);
      return {
        no, title, total: list.length,
        correct: list.filter((i) => i.status === "correct").length,
        pending: list.filter((i) => i.status === "pending").length,
        seconds: list.reduce((s, i) => s + i.seconds, 0),
      };
    });
    return { attempt, items, sections };
  });
}

/** Teacher review: questions with the student's answers and the answer key (staff views only). */
export async function loadAttemptReview(staffId: string, attemptId: string) {
  return asUser(staffId, async (tx) => {
    const { rows } = await tx.query<{ student_id: string; assessment_id: string; finished_at: Date | null; auto_correct: number | null; auto_total: number | null; manual_pending: number | null }>(
      "select student_id, assessment_id, finished_at, auto_correct, auto_total, manual_pending from assessment_attempts where id = $1",
      [attemptId],
    );
    const attempt = rows[0];
    if (!attempt) return null;
    const { rows: keys } = await tx.query<{ id: string; blanks: BlankSpec[]; model_answer: string | null }>(
      `select i.id, i.blanks, i.model_answer from assessment_items_staff i`,
    );
    if (keys.length === 0) return null; // not staff
    const key = new Map(keys.map((k) => [k.id, k]));
    const questions = await loadQuestions(tx, attempt.assessment_id);
    const { rows: resp } = await tx.query<{ item_id: string; blank_id: string; given: string | null; correct: boolean | null }>(
      "select item_id, blank_id, given, correct from assessment_responses where attempt_id = $1",
      [attemptId],
    );
    const given = new Map(resp.map((r) => [`${r.item_id}#${r.blank_id}`, r]));
    return {
      attempt,
      items: questions.map((q) => ({
        ...q,
        modelAnswer: key.get(q.id)?.model_answer ?? null,
        blanks: (key.get(q.id)?.blanks ?? []).map((b) => ({
          id: b.id, kind: b.kind, answer: b.answer,
          given: given.get(`${q.id}#${b.id}`)?.given ?? null,
          correct: given.get(`${q.id}#${b.id}`)?.correct ?? null,
        })),
      })),
    };
  });
}
