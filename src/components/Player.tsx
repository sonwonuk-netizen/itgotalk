"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { finishPlayAction, startPlayAction } from "@/app/s/actions";
import { displayParts } from "@/lib/content/items";
import type { AttemptMode } from "@/lib/engine";
import type { PlayStart } from "@/lib/server/learning";
import { HomeLogo } from "./HomeLogo";
import { NumberPad } from "./NumberPad";
import { TapBoard } from "./TapBoard";
import { Avatar, Button } from "./ui";

const noopSubscribe = () => () => {};

const MODE_TITLE: Record<AttemptMode, string> = {
  practice: "연습",
  test: "테스트",
  diagnostic: "진단 테스트",
  race_ai: "AI랑 시합",
};

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const tenth = Math.floor((ms % 1000) / 100);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenth}`;
}

interface Props {
  setId: string;
  mode: AttemptMode;
  initial: string;
  /** Shown on the ready screen before the session exists. */
  title: string;
  /** Diagnostic: refresh the page to load the next skill instead of opening the result. */
  onDiagnosticFinished?: () => void;
}

type Phase = "ready" | "playing" | "submitting";

export function Player({ setId, mode, initial, title, onDiagnosticFinished }: Props) {
  const router = useRouter();
  // false during SSR and until hydration, so an early tap is not silently lost.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [starting, setStarting] = useState(false);
  const [phase, setPhase] = useState<Phase>("ready");
  const [play, setPlay] = useState<PlayStart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<"none" | "right" | "wrong">("none");
  const [tries, setTries] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const startRef = useRef(0);
  const answersRef = useRef<{ itemId: string; given: number | null }[]>([]);
  const lockRef = useRef(false);

  // Display clock. The submitted time is measured separately with performance.now().
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => setElapsed(performance.now() - startRef.current), 100);
    return () => clearInterval(id);
  }, [phase]);

  const begin = async () => {
    setError(null);
    setStarting(true);
    const res = await startPlayAction(setId, mode);
    setStarting(false);
    if (!res.ok) return setError(res.error);
    answersRef.current = [];
    setPlay(res.data);
    setIndex(0);
    setInput("");
    setTries(0);
    setPhase("playing");
    startRef.current = performance.now();
  };

  const finish = useCallback(
    async (p: PlayStart) => {
      const clientElapsedMs = Math.round(performance.now() - startRef.current);
      setElapsed(clientElapsedMs);
      setPhase("submitting");
      const res = await finishPlayAction({ sessionId: p.sessionId, answers: answersRef.current, clientElapsedMs });
      if (!res.ok) {
        setError(res.error);
        setPhase("ready");
        return;
      }
      if (p.mode === "diagnostic" && onDiagnosticFinished) onDiagnosticFinished();
      else router.push(`/s/result/${res.data.attemptId}`);
    },
    [onDiagnosticFinished, router],
  );

  const advance = useCallback(
    (p: PlayStart, given: number | null) => {
      answersRef.current.push({ itemId: p.items[index]!.id, given });
      setInput("");
      setTries(0);
      setFeedback("none");
      if (index + 1 >= p.items.length) void finish(p);
      else setIndex(index + 1);
    },
    [finish, index],
  );

  const confirm = useCallback(() => {
    if (!play || phase !== "playing" || input === "" || lockRef.current) return;
    const item = play.items[index]!;
    const value = Number(input);
    if (play.mode !== "practice") return advance(play, value);

    // Practice: instant feedback; wrong → retry; after 2 wrong tries the answer is shown.
    const firstTry = tries === 0;
    if (value === item.answer) {
      if (firstTry) answersRef.current.push({ itemId: item.id, given: value });
      lockRef.current = true;
      setFeedback("right");
      setTimeout(() => {
        lockRef.current = false;
        setInput("");
        setTries(0);
        setFeedback("none");
        if (index + 1 >= play.items.length) void finish(play);
        else setIndex(index + 1);
      }, 350);
    } else {
      if (firstTry) answersRef.current.push({ itemId: item.id, given: value });
      setTries(tries + 1);
      setFeedback("wrong");
      setInput("");
    }
  }, [advance, finish, index, input, phase, play, tries]);

  const digit = useCallback((d: string) => {
    setFeedback((f) => (f === "wrong" ? "none" : f));
    setInput((v) => (v.length >= 3 ? v : v === "0" ? d : v + d));
  }, []);
  const del = useCallback(() => setInput((v) => v.slice(0, -1)), []);

  useEffect(() => {
    if (phase !== "playing" || play?.pattern === "tap_sequence") return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) digit(e.key);
      else if (e.key === "Backspace") del();
      else if (e.key === "Enter") confirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirm, del, digit, phase, play?.pattern]);

  if (phase === "ready" || !play) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-6 text-center">
        <div className="text-xl font-semibold text-brand-700">{MODE_TITLE[mode]}</div>
        <h1 className="text-4xl font-black">{title}</h1>
        {mode === "test" && <p className="text-lg text-gray-600">틀려도 괜찮아요. 끝까지 풀면 결과를 알려 줄게요.</p>}
        {mode === "race_ai" && <p className="text-lg text-gray-600">🤖 로봇보다 먼저 다 풀어 볼까요?</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2 text-red-700">{error}</p>}
        <Button size="lg" onClick={begin} disabled={!hydrated || starting} className="min-w-60">
          시작!
        </Button>
      </div>
    );
  }

  // TapBoard reports progress up to items.length after the last tap, so clamp to stay on a real item.
  const item = play.items[Math.min(index, play.items.length - 1)]!;
  const parts = displayParts(item);
  const reveal = play.mode === "practice" && tries >= 2;
  const aiProgress = play.aiTargetMs ? Math.min(1, elapsed / play.aiTargetMs) : 0;
  const myProgress = (phase === "submitting" ? play.items.length : index) / play.items.length;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <HomeLogo
          size="sm"
          onClick={(e) => {
            // Leaving mid-play abandons this run (nothing is saved), so ask first.
            if (!window.confirm("지금 나가면 이번 풀이는 저장되지 않아요. 홈으로 갈까요?")) e.preventDefault();
          }}
        />
        <Avatar initial={initial} />
        <div className="min-w-0 flex-1 truncate text-lg font-semibold">
          {play.skillName}{play.pattern === "tap_sequence" ? "" : ` · 세트 ${play.setNo}`} <span className="text-gray-500">({MODE_TITLE[play.mode]})</span>
        </div>
        <div className="rounded-xl bg-white px-4 py-2 font-mono text-xl tabular-nums shadow-sm" aria-label="기록">
          기록 {clock(elapsed)}
        </div>
      </header>

      {play.mode === "race_ai" && (
        <div className="space-y-2 px-4 sm:px-6" aria-label="시합 진행">
          <RaceBar label={initial} value={myProgress} color="bg-sun-400" />
          <RaceBar label="🤖" value={aiProgress} color="bg-brand-500" />
        </div>
      )}

      {play.pattern === "tap_sequence" ? (
        <TapBoard
          items={play.items}
          onProgress={setIndex}
          onDone={(answers) => {
            answersRef.current = answers;
            void finish(play);
          }}
        />
      ) : (
      <div className="grid flex-1 grid-cols-1 items-center gap-6 px-4 py-4 sm:px-6 md:grid-cols-[1fr_minmax(280px,380px)]">
        <section className="flex flex-col items-center justify-center gap-4">
          <div
            data-testid="problem"
            data-a={item.a}
            data-op={item.op}
            data-b={item.b}
            data-blank={item.blank}
            className="flex flex-wrap items-center justify-center gap-4 text-[clamp(56px,10vw,96px)] font-black tabular-nums"
          >
            <span>{parts.before}</span>
            <span
              className={`inline-flex min-w-[1.6em] items-center justify-center rounded-2xl border-4 px-3 ${
                feedback === "wrong"
                  ? "animate-shake border-red-400 bg-red-50 text-red-600"
                  : feedback === "right"
                    ? "border-emerald-400 bg-emerald-50 text-emerald-600"
                    : "border-brand-500 bg-white text-brand-700"
              }`}
              aria-live="polite"
              aria-label="답 칸"
            >
              {input || " "}
            </span>
            {parts.after && <span>{parts.after}</span>}
          </div>
          <div className="h-8 text-xl font-semibold" aria-live="polite">
            {feedback === "wrong" && !reveal && <span className="text-red-600">한 번 더!</span>}
            {feedback === "right" && <span className="text-emerald-600">좋아요!</span>}
            {reveal && feedback !== "right" && <span className="text-amber-700">정답은 {item.answer}이에요. 입력해 볼까요?</span>}
          </div>
          <div className="text-lg text-gray-500">문항 {index + 1} / {play.items.length}</div>
        </section>
        <section>
          <NumberPad onDigit={digit} onDelete={del} onConfirm={confirm} confirmDisabled={input === "" || phase !== "playing"} />
        </section>
      </div>
      )}

      {play.hint && (
        <footer className="border-t border-brand-100 bg-white/70 px-6 py-3 text-lg text-gray-700">
          <span className="font-semibold text-brand-700">힌트</span> {play.hint}
        </footer>
      )}

      {phase === "submitting" && (
        <div className="fixed inset-0 flex items-center justify-center bg-white/70 text-2xl font-bold">결과를 확인하는 중…</div>
      )}
    </div>
  );
}

function RaceBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 text-center text-lg font-bold">{label}</span>
      <div className="h-5 flex-1 overflow-hidden rounded-full bg-white ring-1 ring-gray-200">
        <div className={`h-full ${color} transition-[width] duration-100`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}
