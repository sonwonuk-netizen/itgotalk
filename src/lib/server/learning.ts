import "server-only";
import { randomInt } from "node:crypto";
import { asService, type Tx } from "@/lib/db/client";
import { itemKey, type Blank, type Op } from "@/lib/content/items";
import {
  aiTargetElapsedMs,
  applyAttempt,
  canStartTest,
  diagnosticPlacement,
  initialProgress,
  isPass,
  nextDiagnosticSkill,
  resolveElapsedMs,
  shuffleItems,
  type AttemptMode,
  type DiagnosticResults,
  type Effect,
} from "@/lib/engine";
import { loadProgress, loadSetItems, loadSkills, loadTracks, setNumber, type SkillInfo, type SkillPattern } from "./content";

export interface PlayItem {
  id: string;
  a: number;
  op: Op;
  b: number;
  blank: Blank;
  /** Only sent in practice mode, which gives instant feedback. */
  answer?: number;
}

export interface PlayStart {
  sessionId: string;
  mode: AttemptMode;
  setId: string;
  skillName: string;
  trackId: string;
  /** Drives the play UI: equations with a number pad, or the 1~9 tapping board. */
  pattern: SkillPattern;
  hint: string;
  setNo: number;
  items: PlayItem[];
  /** race_ai: how long the AI takes for the whole set. */
  aiTargetMs?: number;
}

export class PlayError extends Error {}

export interface StudentRef {
  id: string;
}

async function diagnosticResults(tx: Tx, studentId: string, trackId: string): Promise<DiagnosticResults> {
  const { rows } = await tx.query<{ skill_id: string; passed: boolean }>(
    `select skill_id, passed from (
       select s.skill_id, a.passed, row_number() over (partition by s.skill_id order by a.created_at desc) as rn
       from attempts a join item_sets s on s.id = a.set_id join skills k on k.id = s.skill_id
       where a.student_id = $1 and a.mode = 'diagnostic' and k.track_id = $2
     ) where rn = 1`,
    [studentId, trackId],
  );
  return Object.fromEntries(rows.map((r) => [r.skill_id, r.passed]));
}

/** Progress rows of one track only. */
async function trackProgress(tx: Tx, studentId: string, trackSkills: SkillInfo[]) {
  const ids = new Set(trackSkills.map((s) => s.id));
  return (await loadProgress(tx, studentId)).filter((p) => ids.has(p.skillId));
}

/** The track diagnostic's next representative set, or done when the student already has progress there. */
export async function nextDiagnosticSet(tx: Tx, studentId: string, trackId: string, skills?: SkillInfo[]) {
  const all = skills ?? (await loadSkills(tx, trackId));
  if ((await trackProgress(tx, studentId, all)).length > 0) return { done: true as const };
  const results = await diagnosticResults(tx, studentId, trackId);
  const nextId = nextDiagnosticSkill(all.map((s) => s.id), results);
  const skill = all.find((s) => s.id === nextId);
  return {
    done: false as const,
    next: skill ? { skillId: skill.id, setId: skill.setIds[0]!, name: skill.name } : null,
    tested: Object.keys(results).length,
    total: all.length,
  };
}

/** Which mode/set combinations a student may start right now. Throws PlayError otherwise. */
async function assertCanStart(tx: Tx, studentId: string, skill: SkillInfo, setId: string, mode: AttemptMode) {
  if (mode === "diagnostic") {
    const d = await nextDiagnosticSet(tx, studentId, skill.trackId);
    if (d.done || d.next?.setId !== setId) throw new PlayError("지금은 진단 테스트를 볼 수 없어요.");
    return;
  }
  const progress = await trackProgress(tx, studentId, await loadSkills(tx, skill.trackId));
  if (progress.length === 0) throw new PlayError("먼저 이 과정을 시작해요.");
  const row = progress.find((p) => p.skillId === skill.id);
  const isCurrent = row?.status === "in_progress" && row.currentSetId === setId;
  const isPassedSkill = row?.status === "passed";

  if (mode === "test") {
    if (!isCurrent || !row) throw new PlayError("지금 단계의 세트만 테스트할 수 있어요.");
    if (!canStartTest(row, skill)) throw new PlayError(`연습을 ${skill.practiceRequired}번 마치면 테스트가 열려요.`);
    return;
  }
  if (mode === "practice") {
    const { rows } = await tx.query(
      "select 1 from review_assignments where student_id = $1 and set_id = $2 and completed_at is null",
      [studentId, setId],
    );
    if (isCurrent || isPassedSkill || rows.length > 0) return;
    throw new PlayError("아직 열리지 않은 세트예요.");
  }
  if (mode === "race_ai") {
    if (isCurrent || isPassedSkill) return;
    throw new PlayError("아직 열리지 않은 세트예요.");
  }
}

export async function startPlay(student: StudentRef, setId: string, mode: AttemptMode): Promise<PlayStart> {
  return asService(async (tx) => {
    const skills = await loadSkills(tx);
    const skill = skills.find((s) => s.setIds.includes(setId));
    if (!skill) throw new PlayError("세트를 찾을 수 없어요.");
    await assertCanStart(tx, student.id, skill, setId, mode);

    const items = await loadSetItems(tx, setId);
    // Practice keeps book order; test-like modes are shuffled (learning-engine §6).
    // The tapping board is always shuffled — in order it would be trivial.
    const ordered = mode === "practice" && skill.pattern !== "tap_sequence" ? items : shuffleItems(items, randomInt(2 ** 31), itemKey);

    let aiTargetMs: number | undefined;
    if (mode === "race_ai") {
      const { rows } = await tx.query<{ elapsed_ms: number }>(
        `select a.elapsed_ms from attempts a join item_sets s on s.id = a.set_id
         where a.student_id = $1 and s.skill_id = $2 and a.mode = 'test'
         order by a.created_at desc limit 5`,
        [student.id, skill.id],
      );
      aiTargetMs = aiTargetElapsedMs(rows.map((r) => r.elapsed_ms).reverse(), skill, items.length);
    }

    const { rows } = await tx.query<{ id: string }>(
      "insert into play_sessions (student_id, set_id, mode, item_order, ai_target_ms) values ($1,$2,$3,$4,$5) returning id",
      [student.id, setId, mode, JSON.stringify(ordered.map((i) => i.id)), aiTargetMs ?? null],
    );
    return {
      sessionId: rows[0]!.id,
      mode,
      setId,
      skillName: skill.name,
      trackId: skill.trackId,
      pattern: skill.pattern,
      hint: skill.hint,
      setNo: setNumber(skill, setId),
      items: ordered.map(({ id, a, op, b, blank, answer }) => ({ id, a, op, b, blank, ...(mode === "practice" ? { answer } : {}) })),
      aiTargetMs,
    };
  });
}

export interface FinishInput {
  sessionId: string;
  /** One entry per item in the order shown. In practice, `given` is the first try. */
  answers: { itemId: string; given: number | null }[];
  clientElapsedMs: number;
}

export interface FinishResult {
  attemptId: string;
  mode: AttemptMode;
  passed: boolean | null;
  diagnostic?: { done: boolean };
}

/**
 * Grades on the server, verifies time against the server clock, stores the Attempt
 * (pass or fail) and applies the engine's progress effects.
 *
 * D1 has no transactions: a conditional update claims the session first, so a double submit
 * (two tabs, a retried request) records at most one Attempt.
 */
export async function finishPlay(student: StudentRef, input: FinishInput): Promise<FinishResult> {
  return asService(async (tx) => {
    const finishedAt = new Date();
    const { rows: sess } = await tx.query<{ set_id: string; mode: AttemptMode; item_order: string[]; started_at: Date; finished_at: Date | null }>(
      "select set_id, mode, item_order, started_at, finished_at from play_sessions where id = $1 and student_id = $2",
      [input.sessionId, student.id],
    );
    const session = sess[0];
    if (!session) throw new PlayError("풀이 기록을 찾을 수 없어요.");
    if (session.finished_at) throw new PlayError("이미 제출한 풀이예요.");

    const order = session.item_order;
    if (input.answers.length !== order.length || input.answers.some((a, i) => a.itemId !== order[i])) {
      throw new PlayError("답안이 문제와 맞지 않아요.");
    }

    const items = new Map((await loadSetItems(tx, session.set_id)).map((i) => [i.id, i]));
    const wrong = [];
    let correct = 0;
    for (const a of input.answers) {
      const item = items.get(a.itemId);
      if (!item) throw new PlayError("문항이 바뀌었어요. 다시 시작해 주세요.");
      if (a.given === item.answer) correct++;
      else wrong.push({ item_id: item.id, a: item.a, op: item.op, b: item.b, blank: item.blank, answer: item.answer, given: a.given });
    }

    const trackId = (await tx.query<{ track_id: string }>(
      "select k.track_id from item_sets s join skills k on k.id = s.skill_id where s.id = $1",
      [session.set_id],
    )).rows[0]!.track_id;
    const skills = await loadSkills(tx, trackId);
    const skillIdx = skills.findIndex((s) => s.setIds.includes(session.set_id));
    const skill = skills[skillIdx]!;
    const elapsedMs = resolveElapsedMs({
      clientElapsedMs: input.clientElapsedMs,
      serverStartedAt: new Date(session.started_at),
      serverFinishedAt: finishedAt,
    });
    const judged = session.mode === "test" || session.mode === "diagnostic";
    const passed = judged ? isPass({ itemCount: order.length, correctCount: correct, elapsedMs }, skill) : null;

    const claimed = await tx.query(
      "update play_sessions set finished_at = $2 where id = $1 and finished_at is null returning id",
      [input.sessionId, finishedAt],
    );
    if (claimed.rows.length === 0) throw new PlayError("이미 제출한 풀이예요.");

    const { rows: att } = await tx.query<{ id: string }>(
      `insert into attempts (student_id, set_id, mode, item_count, correct_count, client_elapsed_ms,
         server_started_at, server_finished_at, elapsed_ms, passed, wrong_items)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
      [student.id, session.set_id, session.mode, order.length, correct, Math.max(0, Math.round(input.clientElapsedMs) || 0),
        session.started_at, finishedAt, elapsedMs, passed, JSON.stringify(wrong)],
    );
    const attemptId = att[0]!.id;
    await tx.query("update play_sessions set attempt_id = $2 where id = $1", [input.sessionId, attemptId]);

    if (session.mode === "diagnostic") {
      const d = await nextDiagnosticSet(tx, student.id, trackId, skills);
      if (!d.done && !d.next) await placeAfterDiagnostic(tx, student.id, trackId, skills);
      return { attemptId, mode: session.mode, passed, diagnostic: { done: !d.done && !d.next } };
    }

    if (session.mode === "practice") {
      await tx.query(
        "update review_assignments set completed_at = $3 where student_id = $1 and set_id = $2 and completed_at is null",
        [student.id, session.set_id, finishedAt],
      );
    }

    await applyProgress(tx, student.id, skills, skillIdx, session.set_id, session.mode, passed, elapsedMs);
    return { attemptId, mode: session.mode, passed };
  });
}

async function applyProgress(
  tx: Tx, studentId: string, skills: SkillInfo[], skillIdx: number, setId: string,
  mode: AttemptMode, passed: boolean | null, elapsedMs: number,
) {
  const skill = skills[skillIdx]!;
  const progress = await loadProgress(tx, studentId);
  const row = progress.find((p) => p.skillId === skill.id);
  // Only attempts on the current set move progress; replays of passed sets are just records.
  if (!row || row.status !== "in_progress" || row.currentSetId !== setId) return;

  const prev = skills[skillIdx - 1];
  const next = skills[skillIdx + 1];
  const { state, effects } = applyAttempt(row, { mode, passed }, {
    skill,
    setIds: skill.setIds,
    previousSkill: prev?.setIds.length ? { id: prev.id, reviewSetId: prev.setIds[prev.setIds.length - 1]! } : undefined,
    nextSkill: next?.setIds.length ? { id: next.id, firstSetId: next.setIds[0]! } : undefined,
  });

  const best = mode === "test" && passed ? Math.min(row.bestElapsedMs ?? Infinity, elapsedMs) : row.bestElapsedMs;
  await tx.query(
    `update skill_progress set status = $3, current_set_id = $4, practice_count = $5, consecutive_fail = $6, best_elapsed_ms = $7
     where student_id = $1 and skill_id = $2`,
    [studentId, skill.id, state.status, state.currentSetId, state.practiceCount, state.consecutiveFail, best],
  );
  for (const e of effects) await persistEffect(tx, studentId, e);
}

async function persistEffect(tx: Tx, studentId: string, e: Effect) {
  switch (e.type) {
    case "open_set":
      return; // already reflected in current_set_id
    case "skill_passed":
      await tx.query("update skill_progress set passed_at = $3 where student_id = $1 and skill_id = $2", [studentId, e.skillId, new Date()]);
      return;
    case "start_skill":
      await tx.query(
        `insert into skill_progress (student_id, skill_id, status, current_set_id) values ($1,$2,'in_progress',$3)
         on conflict (student_id, skill_id) do update set status = 'in_progress', current_set_id = $3, practice_count = 0, consecutive_fail = 0`,
        [studentId, e.skillId, e.setId],
      );
      return;
    case "assign_review":
      await tx.query(
        "insert into review_assignments (student_id, skill_id, set_id) values ($1,$2,$3)",
        [studentId, e.skillId, e.setId],
      );
      return;
    case "notify_teacher":
      await tx.query("insert into teacher_alerts (student_id, skill_id, reason) values ($1,$2,$3)", [studentId, e.skillId, e.reason]);
      return;
  }
}

async function placeAfterDiagnostic(tx: Tx, studentId: string, trackId: string, skills: SkillInfo[]) {
  const results = await diagnosticResults(tx, studentId, trackId);
  await insertProgress(tx, studentId, skills, diagnosticPlacement(skills.map((s) => s.id), results));
}

/**
 * Starts a track without a diagnostic (e.g. 1~9 빨리 누르기): first skill in progress, rest locked.
 * Tracks with a diagnostic must go through it instead.
 */
export async function startTrack(student: StudentRef, trackId: string): Promise<void> {
  await asService(async (tx) => {
    const track = (await loadTracks(tx)).find((t) => t.id === trackId);
    if (!track) throw new PlayError("과정을 찾을 수 없어요.");
    if (track.hasDiagnostic) throw new PlayError("이 과정은 진단 테스트부터 시작해요.");
    const skills = await loadSkills(tx, trackId);
    if ((await trackProgress(tx, student.id, skills)).length > 0) return;
    await insertProgress(tx, student.id, skills, { startSkillId: skills[0]?.id ?? null, passedSkillIds: [] });
  });
}

async function insertProgress(tx: Tx, studentId: string, skills: SkillInfo[], placement: Parameters<typeof initialProgress>[1]) {
  for (const r of initialProgress(skills, placement)) {
    await tx.query(
      `insert into skill_progress (student_id, skill_id, status, current_set_id, passed_at)
       values ($1,$2,$3,$4, case when $3 = 'passed' then $5 end) on conflict do nothing`,
      [studentId, r.skillId, r.status, r.currentSetId, new Date()],
    );
  }
}
