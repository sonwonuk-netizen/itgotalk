"use client";

import { useEffect, useState } from "react";

export interface VisualProblem {
  a: number;
  op: string;
  b: number;
  blank: "result" | "operand2";
  answer: number;
}


const STEP_MS = 650;

/** Advances 0..total one step at a time; `replay` restarts. */
function useSteps(total: number, resetKey: string) {
  const [state, setState] = useState({ key: resetKey, step: 0 });
  const step = state.key === resetKey ? state.step : 0;
  useEffect(() => {
    if (step >= total) return;
    const t = setTimeout(() => setState({ key: resetKey, step: step + 1 }), step === 0 ? 400 : STEP_MS);
    return () => clearTimeout(t);
  }, [step, total, resetKey]);
  return { step, replay: () => setState({ key: resetKey, step: 0 }) };
}

/** Picture explanation for one problem, chosen by the skill's pattern. */
export function MathVisual({ problem, pattern }: { problem: VisualProblem; pattern: string }) {
  if (problem.op === "×") return <Groups a={problem.a} b={problem.b} />;
  if (pattern === "complement10" || problem.blank === "operand2") return <TenFrame problem={problem} />;
  if (problem.op !== "+") return <p className="text-gray-500">그림 설명은 덧셈 문제부터 준비되어 있어요.</p>;
  if (pattern === "commutative" && problem.a < problem.b) return <SwapThenJump problem={problem} />;
  return <NumberLine start={problem.a} jumps={problem.b} />;
}

/** Number line 0..max with animated jumps: "a에서 오른쪽으로 b칸". */
export function NumberLine({ start, jumps }: { start: number; jumps: number }) {
  const max = Math.max(10, start + jumps);
  const { step, replay } = useSteps(jumps, `${start}+${jumps}`);
  const W = 680;
  const pad = 30;
  const x = (n: number) => pad + (n * (W - pad * 2)) / max;
  const y = 120;
  const landed = start + step;

  return (
    <figure className="space-y-3">
      <svg viewBox={`0 0 ${W} 170`} className="w-full" role="img" aria-label={`${start}에서 오른쪽으로 ${jumps}칸 가면 ${start + jumps}`}>
        <line x1={pad - 10} x2={W - pad + 10} y1={y} y2={y} stroke="#94a3b8" strokeWidth={3} />
        {Array.from({ length: max + 1 }, (_, n) => (
          <g key={n}>
            <line x1={x(n)} x2={x(n)} y1={y - 8} y2={y + 8} stroke="#94a3b8" strokeWidth={2} />
            <text
              x={x(n)} y={y + 34} textAnchor="middle" fontSize={22}
              fontWeight={n === start || n === landed ? 800 : 500}
              fill={n === landed && step > 0 ? "#059669" : n === start ? "#2563eb" : "#475569"}
            >
              {n}
            </text>
          </g>
        ))}
        {Array.from({ length: step }, (_, i) => {
          const x1 = x(start + i);
          const x2 = x(start + i + 1);
          return (
            <g key={i} className="animate-pop" style={{ transformOrigin: `${(x1 + x2) / 2}px ${y}px` }}>
              <path d={`M ${x1} ${y - 6} Q ${(x1 + x2) / 2} ${y - 70} ${x2} ${y - 6}`} fill="none" stroke="#f59e0b" strokeWidth={4} markerEnd="url(#arrow)" />
              <text x={(x1 + x2) / 2} y={y - 48} textAnchor="middle" fontSize={18} fontWeight={700} fill="#b45309">{i + 1}</text>
            </g>
          );
        })}
        <circle cx={x(start)} cy={y} r={10} fill="#2563eb" />
        {step > 0 && <circle cx={x(landed)} cy={y} r={10} fill="#10b981" />}
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
          </marker>
        </defs>
      </svg>
      <figcaption className="flex flex-wrap items-center justify-center gap-3 text-xl">
        <span>
          <b className="text-brand-600">{start}</b>에서 오른쪽으로 <b className="text-amber-600">{jumps}칸</b>
          {step >= jumps && <> → <b className="text-emerald-600">{start + jumps}</b></>}
        </span>
        <ReplayButton onClick={replay} />
      </figcaption>
    </figure>
  );
}

/** Commutative: show a + b = b + a with dots, then jump from the bigger number. */
function SwapThenJump({ problem }: { problem: VisualProblem }) {
  const { a, b } = problem;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-center gap-4 text-2xl font-bold">
        <Dots n={a} color="bg-sky-400" /> <span>+</span> <Dots n={b} color="bg-amber-400" />
        <span className="mx-2 text-gray-400">=</span>
        <Dots n={b} color="bg-amber-400" /> <span>+</span> <Dots n={a} color="bg-sky-400" />
      </div>
      <p className="text-center text-lg">
        {a} + {b}는 순서를 바꿔 <b className="text-brand-700">{b} + {a}</b>로 생각해요. 큰 수 {b}에서 출발!
      </p>
      <NumberLine start={b} jumps={a} />
    </div>
  );
}

function Dots({ n, color }: { n: number; color: string }) {
  return (
    <span className="inline-flex max-w-[11rem] flex-wrap gap-1 rounded-xl bg-white p-2 ring-1 ring-gray-200" aria-label={`${n}개`}>
      {Array.from({ length: n }, (_, i) => <span key={i} className={`h-5 w-5 rounded-full ${color}`} />)}
    </span>
  );
}

/** 10의 보수: a cells filled, the empty ones count up to the answer. */
function TenFrame({ problem }: { problem: VisualProblem }) {
  const filled = problem.a;
  const empty = 10 - filled;
  const { step, replay } = useSteps(empty, `ten-${filled}`);
  return (
    <figure className="space-y-3">
      <div className="mx-auto grid w-fit grid-cols-5 gap-2 rounded-2xl bg-white p-3 ring-2 ring-gray-300" role="img" aria-label={`10칸 중 ${filled}칸이 차 있고 빈 칸은 ${empty}칸`}>
        {Array.from({ length: 10 }, (_, i) => {
          const isFilled = i < filled;
          const counted = !isFilled && i - filled < step;
          return (
            <div key={i} className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 text-xl font-bold">
              {isFilled ? (
                <span className="h-10 w-10 rounded-full bg-sky-400" />
              ) : counted ? (
                <span className="animate-pop flex h-10 w-10 items-center justify-center rounded-full bg-amber-300 text-amber-900">{i - filled + 1}</span>
              ) : null}
            </div>
          );
        })}
      </div>
      <figcaption className="flex flex-wrap items-center justify-center gap-3 text-xl">
        <span>
          <b className="text-sky-600">{filled}칸</b>이 차 있어요. 10이 되려면 빈 칸 {step >= empty ? <b className="text-emerald-600">{empty}칸</b> : "몇 칸?"}
        </span>
        <ReplayButton onClick={replay} />
      </figcaption>
    </figure>
  );
}

function ReplayButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-h-11 rounded-full bg-white px-4 text-base font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
      ↻ 다시 보기
    </button>
  );
}

/** a × b = "a씩 b묶음": groups appear one by one while skip-counting the total. */
function Groups({ a, b }: { a: number; b: number }) {
  const { step, replay } = useSteps(b, `${a}x${b}`);
  const colors = ["bg-sky-400", "bg-amber-400", "bg-emerald-400", "bg-pink-400", "bg-violet-400"];
  return (
    <figure className="space-y-3">
      <div className="flex flex-wrap justify-center gap-3" role="img" aria-label={`${a}씩 ${b}묶음은 ${a * b}`}>
        {Array.from({ length: b }, (_, g) => (
          <div
            key={g}
            className={`flex flex-col items-center gap-1 rounded-2xl bg-white p-2 ring-2 transition ${g < step ? "ring-brand-300" : "opacity-25 ring-gray-200"}`}
          >
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: a }, (_, i) => <span key={i} className={`h-4 w-4 rounded-full ${colors[g % colors.length]}`} />)}
            </div>
            <span className={`text-lg font-black ${g < step ? "text-brand-700" : "text-transparent"}`}>{a * (g + 1)}</span>
          </div>
        ))}
      </div>
      <figcaption className="flex flex-wrap items-center justify-center gap-3 text-xl">
        <span>
          <b className="text-brand-600">{a}씩</b> <b className="text-amber-600">{b}묶음</b>
          {step >= b && <> → <b className="text-emerald-600">{a * b}</b></>}
        </span>
        <ReplayButton onClick={replay} />
      </figcaption>
    </figure>
  );
}
