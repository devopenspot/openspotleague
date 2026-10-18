// Seeded PRNG + shuffle for deterministic random pagination.
// No extra deps: xorshift based on FNV-1a hash of the seed string (UUID).
// Used by spot/event repositories to shuffle ID lists per-visit seed.

export function hashStringToUint32(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function makeSeededRng(seed: string): () => number {
  let state = hashStringToUint32(seed)
  if (state === 0) state = 0x6d2b79f5
  return () => {
    // xorshift32
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4294967296
  }
}

export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const rng = makeSeededRng(seed)
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = out[i]!
    out[i] = out[j]!
    out[j] = tmp
  }
  return out
}
