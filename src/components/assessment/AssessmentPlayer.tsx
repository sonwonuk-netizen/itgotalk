"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveAnswersAction, submitAssessmentAction } from "@/app/s/assessment/actions";
import type { Question } from "@/lib/server/assessment";
import { HomeLogo } from "../HomeLogo";
import { Button } from "../ui";

type Answers = Record<string, Record<string, string>>;

interface Props {
  attemptId: string;
  title: string;
  questions: Question[];
  initialAnswers: Answers;
}

const isAnswered = (q: Question, a: Record<string, string> | undefined) =>
  !!a && q.stem.concat(q.type === "select_many" ? [{ t: "blank", id: "sel", kind: "set" }] : []).some((g) => g.t === "blank" && (a[g.id] ?? "").trim() !== "");

export function AssessmentPlayer({ attemptId, title, questions, initialAnswers }: Props) {
  const firstOpen = questions.findIndex((q) => !isAnswered(q, initialAnswers[q.id]));
  const [index, setIndex] = useState(firstOpen < 0 ? 0 : firstOpen);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const enteredAt = useRef(0);
  const dirty = useRef(false);

  const q = questions[index]!;
  const answeredCount = useMemo(() => questions.filter((x) => isAnswered(x, answers[x.id])).length, [answers, questions]);

  useEffect(() => {
    enteredAt.current = performance.now();
  }, [index]);

  /** Save the current item (answers + seconds on it) before moving. */
  const flush = useCallback(async () => {
    const seconds = Math.round((performance.now() - enteredAt.current) / 1000);
    enteredAt.current = performance.now();
    const given = answers[q.id];
    if (!given || (!dirty.current && seconds === 0)) return true;
    dirty.current = false;
    setSaving("saving");
    const r = await saveAnswersAction(attemptId, q.id, given, seconds);
    if (!r.ok) {
      setSaving("error");
      setError(r.error);
      return false;
    }
    setSaving("saved");
    return true;
  }, [answers, attemptId, q.id]);

  const go = useCallback(
    async (to: number) => {
      if (to < 0 || to >= questions.length) return;
      await flush();
      setShowList(false);
      setIndex(to);
    },
    [flush, questions.length],
  );

  const setBlank = (blankId: string, value: string) => {
    dirty.current = true;
    setSaving("idle");
    setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id], [blankId]: value } }));
  };

  const submit = async () => {
    const left = questions.length - answeredCount;
    const msg = left > 0 ? `아직 풀지 않은 문제가 ${left}개 있어요. 그래도 제출할까요?` : "제출하면 다시 고칠 수 없어요. 제출할까요?";
    if (!window.confirm(msg)) return;
    setSubmitting(true);
    if (!(await flush())) return setSubmitting(false);
    const r = await submitAssessmentAction(attemptId);
    if (r && !r.ok) {
      setError(r.error);
      setSubmitting(false);
    }
  };

  const isLast = index === questions.length - 1;
  const a = answers[q.id] ?? {};

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-brand-100 bg-white/80 px-4 py-3 sm:px-6">
        <HomeLogo
          size="sm"
          onClick={(e) => {
            if (!window.confirm("지금까지 쓴 답은 저장돼요. 나중에 이어서 풀 수 있어요. 나갈까요?")) e.preventDefault();
            else void flush();
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-gray-500">{title}</div>
          <div className="truncate font-bold">{q.sectionNo}. {q.sectionTitle}</div>
        </div>
        <span className="hidden text-sm text-gray-500 sm:inline" aria-live="polite">
          {saving === "saving" ? "저장 중…" : saving === "saved" ? "저장됨 ✓" : saving === "error" ? "저장 실패" : ""}
        </span>
        <button
          type="button"
          onClick={() => setShowList((v) => !v)}
          className="min-h-11 rounded-xl bg-brand-50 px-4 font-semibold text-brand-700 ring-1 ring-brand-200"
          aria-expanded={showList}
        >
          {q.no} / {questions.length}
        </button>
      </header>

      <div className="h-2 bg-white" role="progressbar" aria-valuenow={answeredCount} aria-valuemax={questions.length} aria-label="푼 문제">
        <div className="h-full bg-emerald-400 transition-all" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
      </div>

      {showList && (
        <nav className="border-b bg-white px-4 py-3 sm:px-6" aria-label="문제 목록">
          <div className="mb-2 text-sm text-gray-600">푼 문제 {answeredCount} / {questions.length} · 번호를 누르면 그 문제로 가요</div>
          <div className="flex max-h-64 flex-wrap gap-1.5 overflow-auto">
            {questions.map((x, i) => (
              <button
                key={x.id}
                type="button"
                onClick={() => void go(i)}
                className={`h-10 w-10 rounded-lg text-sm font-semibold ${
                  i === index ? "bg-brand-600 text-white" : isAnswered(x, answers[x.id]) ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
                }`}
                aria-label={`${x.no}번 문제${isAnswered(x, answers[x.id]) ? " (풀었음)" : ""}`}
              >
                {x.no}
              </button>
            ))}
          </div>
        </nav>
      )}

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-3 text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: q.partTitleHtml }} />
        {q.contextHtml && <p className="mb-3 rounded-xl bg-sun-100 px-4 py-2 text-lg" dangerouslySetInnerHTML={{ __html: q.contextHtml }} />}

        <section className="rounded-3xl bg-white p-6 shadow-md" aria-label={`${q.no}번 문제`} data-testid="assessment-question">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-3 text-2xl leading-loose">
            <span className="mr-1 font-black text-brand-600">{q.label}</span>
            {q.stem.map((g, i) =>
              g.t === "br" ? (
                <span key={i} className="h-0 basis-full" aria-hidden />
              ) : g.t === "html" ? (
                <span key={i} dangerouslySetInnerHTML={{ __html: g.html }} />
              ) : (
                <BlankInput
                  key={g.id + q.id}
                  kind={g.kind}
                  free={q.type === "free"}
                  value={a[g.id] ?? ""}
                  onChange={(v) => setBlank(g.id, v)}
                  onEnter={() => void (isLast ? undefined : go(index + 1))}
                  label={`${q.no}번 답${q.stem.filter((s) => s.t === "blank").length > 1 ? ` ${i}` : ""}`}
                />
              ),
            )}
          </div>

          {q.choices && (
            <ChoiceGroup choices={q.choices} value={a.sel ?? ""} onChange={(v) => setBlank("sel", v)} />
          )}

          {q.figure && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={q.figure} alt="문제 그림" className="mt-5 max-h-64 max-w-full" />
          )}
        </section>

        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-red-700">{error}</p>}
      </main>

      <footer className="sticky bottom-0 flex items-center gap-3 border-t bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
        <Button tone="secondary" size="lg" onClick={() => void go(index - 1)} disabled={index === 0 || submitting}>
          ← 이전
        </Button>
        <div className="flex-1" />
        {isLast ? (
          <Button tone="success" size="lg" onClick={() => void submit()} disabled={submitting}>
            {submitting ? "채점 중…" : "제출하기"}
          </Button>
        ) : (
          <>
            <Button tone="ghost" onClick={() => void submit()} disabled={submitting} className="hidden sm:inline-flex">
              제출
            </Button>
            <Button size="lg" onClick={() => void go(index + 1)} disabled={submitting}>
              다음 →
            </Button>
          </>
        )}
      </footer>
    </div>
  );
}

function BlankInput({
  kind, free, value, onChange, onEnter, label,
}: {
  kind: string; free: boolean; value: string; onChange: (v: string) => void; onEnter: () => void; label: string;
}) {
  if (kind === "ox" || kind === "compare") {
    const options = kind === "ox" ? ["O", "X"] : ["<", "=", ">"];
    return (
      <span className="inline-flex gap-1" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === o}
            onClick={() => onChange(value === o ? "" : o)}
            className={`h-12 min-w-12 rounded-xl px-3 text-xl font-black ring-2 transition ${
              value === o ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-gray-700 ring-gray-200 hover:ring-brand-300"
            }`}
          >
            {o === "O" ? "○" : o === "X" ? "×" : o}
          </button>
        ))}
      </span>
    );
  }
  if (free) {
    return (
      <textarea
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="생각을 글로 써 보세요"
        className="mt-1 w-full rounded-xl border-2 border-brand-200 bg-white px-3 py-2 text-lg outline-none focus:border-brand-500"
      />
    );
  }
  const numeric = kind === "int" || kind === "rational" || kind === "decimal";
  const wide = kind === "text" || kind === "expr";
  return (
    <input
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onEnter()}
      inputMode={kind === "int" ? "numeric" : numeric ? "decimal" : "text"}
      autoComplete="off"
      placeholder={kind === "rational" ? "예) 3/4" : kind === "decimal" ? "예) 0.5" : ""}
      className={`h-12 rounded-xl border-2 border-brand-300 bg-brand-50/40 px-3 text-center text-2xl font-bold text-brand-700 outline-none focus:border-brand-600 focus:bg-white ${
        wide ? "w-56 max-w-full" : "w-28"
      }`}
    />
  );
}

function ChoiceGroup({ choices, value, onChange }: { choices: { value: string; html: string }[]; value: string; onChange: (v: string) => void }) {
  const selected = new Set(value.split(",").filter(Boolean));
  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(choices.map((c) => c.value).filter((c) => next.has(c)).join(","));
  };
  return (
    <div className="mt-5 flex flex-wrap gap-3" role="group" aria-label="보기 (모두 고르기)">
      {choices.map((c) => (
        <button
          key={c.value}
          type="button"
          aria-pressed={selected.has(c.value)}
          onClick={() => toggle(c.value)}
          className={`min-h-14 min-w-16 rounded-2xl px-4 text-xl font-bold ring-2 transition ${
            selected.has(c.value) ? "bg-emerald-50 text-emerald-800 ring-emerald-500" : "bg-white ring-gray-200 hover:ring-brand-300"
          }`}
        >
          {selected.has(c.value) && <span className="mr-1">◯</span>}
          <span dangerouslySetInnerHTML={{ __html: c.html }} />
        </button>
      ))}
    </div>
  );
}
