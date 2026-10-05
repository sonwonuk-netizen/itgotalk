"use client";

import { useState } from "react";
import { displayParts, type Blank, type Op } from "@/lib/content/items";
import type { ErrorKind } from "@/lib/engine";
import { MathVisual, type VisualProblem } from "./MathVisual";


export interface ExplainedError extends VisualProblem {
  given: number | null;
  kind: ErrorKind;
}

/** Child-friendly reason for each kind of mistake. */
function reason(e: ExplainedError, pattern: string): string {
  if (pattern === "tap_sequence") return `${e.answer}을(를) 눌러야 할 때 ${e.given ?? "?"}을(를) 눌렀어요. 다음 숫자를 먼저 말하고 찾아봐요.`;
  switch (e.kind) {
    case "off_by_group":
      return e.given! < e.answer ? "한 묶음 덜 셌어요. 몇 번 묶었는지 다시 세어 봐요." : "한 묶음 더 셌어요. 몇 번 묶었는지 다시 세어 봐요.";
    case "blank":
      return "답을 쓰지 않고 넘어갔어요.";
    case "off_by_one":
      return e.given! < e.answer ? "한 칸 덜 갔어요. 뛴 횟수를 다시 세어 봐요." : "한 칸 더 갔어요. 출발한 수는 세지 않아요.";
    case "copied_operand":
      return e.op === "×" ? "수를 그대로 썼어요. 몇씩 몇 묶음인지 곱해야 해요." : "수를 그대로 썼어요. 두 수를 더해야 해요.";
    case "wrong_operation":
      return e.op === "×" ? "두 수를 더했어요. ×는 '몇씩 몇 묶음'이에요." : "빼기를 했어요. ＋는 더하기예요.";
    default:
      return "그림으로 한 번 더 확인해 봐요.";
  }
}

/** Wrong problems as buttons; the selected one is explained with a picture. */
export function WrongAnswersExplorer({ errors, pattern, example }: { errors: ExplainedError[]; pattern: string; example: VisualProblem | null }) {
  const isTap = pattern === "tap_sequence";
  const [selected, setSelected] = useState(0);
  const current = errors[selected] ?? null;
  const problem = isTap ? null : (current ?? example);

  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="틀린 문제">
          {errors.map((e, i) => {
            const p = displayParts({ a: e.a, op: e.op as Op, b: e.b, blank: e.blank as Blank });
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setSelected(i)}
                  aria-pressed={i === selected}
                  className={`min-h-12 rounded-xl px-4 text-xl font-bold ring-2 transition ${
                    i === selected ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-gray-800 ring-gray-200 hover:ring-brand-300"
                  }`}
                >
                  {isTap ? <>{e.answer} 차례에 <span className="line-through opacity-70">{e.given ?? "?"}</span></> : <>{p.before} <span className="line-through opacity-70">{e.given ?? "?"}</span> {p.after}</>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {current && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-lg text-red-800">
          {!isTap && <><b>내 답 {current.given ?? "없음"}</b> → 정답 <b className="text-emerald-700">{current.answer}</b>. </>}{reason(current, pattern)}
        </p>
      )}
      {problem && (
        <div className="rounded-2xl bg-brand-50 p-4">
          <MathVisual key={`${problem.a}${problem.op}${problem.b}${problem.blank}`} problem={problem} pattern={pattern} />
        </div>
      )}
    </div>
  );
}
