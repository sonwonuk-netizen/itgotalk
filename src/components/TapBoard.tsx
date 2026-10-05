"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlayItem } from "@/lib/server/learning";

/**
 * 1~9 빨리 누르기: the items are the numbers to tap, laid out in the server's shuffled order.
 * The child taps 1, 2, 3… in order. For grading, each item's `given` is the number tapped
 * first when that item was the target — a mistake-free run gives every item its own value.
 */
export function TapBoard({
  items,
  onProgress,
  onDone,
}: {
  items: PlayItem[];
  onProgress: (doneCount: number) => void;
  onDone: (answers: { itemId: string; given: number }[]) => void;
}) {
  const order = [...items].sort((x, y) => x.a - y.a); // targets: smallest first
  const [step, setStep] = useState(0);
  const [shake, setShake] = useState<string | null>(null);
  const firstTap = useRef(new Map<string, number>());
  const finished = useRef(false);

  const tap = useCallback(
    (item: PlayItem) => {
      if (finished.current) return;
      const target = order[step];
      if (!target) return;
      if (!firstTap.current.has(target.id)) firstTap.current.set(target.id, item.a);
      if (item.id !== target.id) {
        setShake(item.id);
        setTimeout(() => setShake(null), 300);
        return;
      }
      const next = step + 1;
      setStep(next);
      onProgress(next);
      if (next >= order.length) {
        finished.current = true;
        onDone(items.map((it) => ({ itemId: it.id, given: firstTap.current.get(it.id) ?? it.a })));
      }
    },
    [items, onDone, onProgress, order, step],
  );

  // Keyboard: pressing a digit taps that number.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const item = items.find((it) => String(it.a) === e.key);
      if (item) tap(item);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, tap]);

  const doneIds = new Set(order.slice(0, step).map((it) => it.id));
  const target = order[step];

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-6">
      <p className="text-2xl font-bold" aria-live="polite">
        {target ? <>다음 숫자: <span className="text-4xl font-black text-brand-700">{target.a}</span></> : "끝!"}
      </p>
      <div className="grid w-full max-w-md grid-cols-3 gap-3" role="group" aria-label="숫자 판">
        {items.map((it) => {
          const done = doneIds.has(it.id);
          return (
            <button
              key={it.id}
              type="button"
              aria-label={`숫자 ${it.a}`}
              disabled={done}
              onClick={() => tap(it)}
              className={`flex aspect-square touch-manipulation items-center justify-center rounded-2xl text-5xl font-black shadow-sm transition active:scale-95 ${
                done ? "bg-emerald-100 text-emerald-400" : "bg-white text-gray-800 ring-2 ring-brand-200 hover:ring-brand-400"
              } ${shake === it.id ? "animate-shake bg-red-100 ring-red-400" : ""}`}
            >
              {done ? "✓" : it.a}
            </button>
          );
        })}
      </div>
    </div>
  );
}
