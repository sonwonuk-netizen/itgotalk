const COLORS = ["#fbbf24", "#3b82f6", "#10b981", "#f472b6", "#a78bfa"];

/** CSS-only celebration; deterministic so server and client render the same markup. */
export function Confetti() {
  return (
    <div aria-hidden className="no-print">
      {Array.from({ length: 36 }, (_, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            left: `${(i * 37) % 100}%`,
            background: COLORS[i % COLORS.length],
            animationDelay: `${(i % 9) * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}
