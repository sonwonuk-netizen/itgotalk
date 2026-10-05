/** mulberry32: small deterministic PRNG so a seed reproduces the same order. */
export function seededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive a numeric seed from any string (e.g. a session id). */
export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Fisher–Yates shuffle with a seed, then repair so the same problem (by `key`)
 * never appears twice in a row. 2+3 and 3+2 have different keys.
 */
export function shuffleItems<T>(items: readonly T[], seed: number, key: (item: T) => string): T[] {
  const rand = seededRandom(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return separateRepeats(out, key);
}

/** Greedy repair: whenever two neighbours share a key, pull forward the next item that fits. */
function separateRepeats<T>(list: T[], key: (item: T) => string): T[] {
  const out = [...list];
  for (let i = 1; i < out.length; i++) {
    if (key(out[i]!) !== key(out[i - 1]!)) continue;
    const j = out.findIndex((x, k) => k > i && key(x) !== key(out[i - 1]!));
    if (j >= 0) {
      const [moved] = out.splice(j, 1);
      out.splice(i, 0, moved!);
      continue;
    }
    // No later item fits: move this duplicate to the first earlier gap that separates it.
    const [dup] = out.splice(i, 1);
    const k = dup!;
    let at = 0;
    while (at <= out.length) {
      const prevOk = at === 0 || key(out[at - 1]!) !== key(k);
      const nextOk = at === out.length || key(out[at]!) !== key(k);
      if (prevOk && nextOk) break;
      at++;
    }
    out.splice(Math.min(at, out.length), 0, k);
  }
  return out;
}
