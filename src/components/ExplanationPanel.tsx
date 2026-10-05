import type { ExplanationView } from "@/lib/server/explain";
import { formatSec } from "./ui";
import { WrongAnswersExplorer } from "./WrongAnswersExplorer";

const ERROR_SUMMARY: Record<string, string> = {
  off_by_one: "한 칸씩 덜 가거나 더 가는 실수가 많았어요.",
  off_by_group: "한 묶음씩 덜 세거나 더 세는 실수가 많았어요.",
  copied_operand: "더하지 않고 수를 그대로 쓴 실수가 있었어요.",
  wrong_operation: "더하기 대신 빼기를 한 실수가 있었어요.",
  blank: "답을 비워 둔 문제가 있었어요.",
  other: "",
};

/** "What was hard and why" — shown after the diagnostic, a failed test, or from home. */
export function ExplanationPanel({ view }: { view: ExplanationView }) {
  const d = view.diagnosis;
  return (
    <section className="space-y-5 rounded-3xl bg-white p-6 text-left shadow-md" aria-label="설명">
      {d && d.weakness === "accuracy" && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-red-50 p-4">
          <span className="rounded-full bg-red-500 px-3 py-1 text-sm font-bold text-white">정확도</span>
          <p className="text-lg">
            <b>{d.itemCount}문제 중 {d.correctCount}문제</b>를 맞혔어요. 개념을 먼저 다져요.{" "}
            {view.skill.pattern === "tap_sequence" ? "순서를 건너뛰거나 다른 숫자를 누른 적이 있어요." : d.mainError && ERROR_SUMMARY[d.mainError]}
          </p>
        </div>
      )}
      {d && d.weakness === "speed" && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-sun-100 p-4">
          <span className="rounded-full bg-amber-500 px-3 py-1 text-sm font-bold text-white">속도</span>
          <p className="text-lg">
            모두 맞혔어요! 기준 <b>{formatSec(d.limitMs)}</b>, 내 기록 <b>{formatSec(d.elapsedMs)}</b>
            {d.overMs > 0 ? <> — <b>{formatSec(d.overMs)}</b>만 줄이면 통과예요.</> : " — 조금만 더 빠르게 해 봐요."}
          </p>
        </div>
      )}

      {view.explanation && (
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-brand-700">{view.explanation.title}</h2>
          <p className="whitespace-pre-line text-lg leading-relaxed text-gray-800">{view.explanation.body}</p>
          {view.explanation.tip && (
            <p className="rounded-xl bg-emerald-50 px-4 py-2 text-lg text-emerald-800">🗣️ {view.explanation.tip}</p>
          )}
        </div>
      )}

      <WrongAnswersExplorer
        errors={(d?.errors ?? []).map((e) => ({ a: e.a, op: e.op, b: e.b, blank: e.blank, answer: e.answer, given: e.given, kind: e.kind }))}
        pattern={view.skill.pattern}
        example={view.example}
      />
    </section>
  );
}
