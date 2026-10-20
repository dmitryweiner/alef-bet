import type { Letter } from './letters';
import { letterWeight, type LetterStats } from './stats';

export type Random = () => number;

/** Small deterministic PRNG (mulberry32) for tests. */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: Random): T[] {
  return weightedOrder(items, () => 1, rng);
}

/** Random permutation where heavier items tend to come first (Efraimidis–Spirakis). */
export function weightedOrder<T>(items: readonly T[], weight: (item: T) => number, rng: Random): T[] {
  return items
    .map((item) => ({ item, key: Math.pow(1 - rng(), 1 / weight(item)) }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.item);
}

/**
 * Letters for a round. Error-prone and long-unseen letters are more likely to be picked.
 * A small pool is repeated in full passes, never showing the same letter twice in a row.
 */
export function pickRoundLetters(pool: readonly Letter[], stats: LetterStats, now: number, count: number, rng: Random): Letter[] {
  const weight = (l: Letter) => letterWeight(stats[l.id], now);
  const result: Letter[] = [];
  while (result.length < count) {
    const pass = weightedOrder(pool, weight, rng);
    if (pass.length > 1 && pass[0] === result.at(-1)) [pass[0], pass[1]] = [pass[1]!, pass[0]!];
    result.push(...pass);
  }
  return result.slice(0, count);
}
