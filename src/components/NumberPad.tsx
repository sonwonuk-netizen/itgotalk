"use client";

const KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "⌫", "0", "확인"] as const;

/** 0–9 pad with delete and confirm; keys are ≥72px for small hands on a tablet. */
export function NumberPad({
  onDigit,
  onDelete,
  onConfirm,
  confirmDisabled,
}: {
  onDigit: (d: string) => void;
  onDelete: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-3" role="group" aria-label="숫자 패드">
      {KEYS.map((k) => {
        const isConfirm = k === "확인";
        const isDelete = k === "⌫";
        return (
          <button
            key={k}
            type="button"
            aria-label={isDelete ? "지우기" : k}
            disabled={isConfirm && confirmDisabled}
            onClick={(e) => {
              e.preventDefault();
              if (isConfirm) onConfirm();
              else if (isDelete) onDelete();
              else onDigit(k);
            }}
            className={`flex h-[clamp(64px,13vh,96px)] items-center justify-center touch-manipulation rounded-2xl text-4xl font-bold shadow-sm transition active:scale-95 ${
              isConfirm
                ? "bg-brand-600 text-2xl text-white disabled:bg-gray-300"
                : isDelete
                  ? "bg-gray-200 text-gray-700"
                  : "bg-white text-gray-800 ring-1 ring-gray-200"
            }`}
          >
            {k}
          </button>
        );
      })}
    </div>
  );
}
