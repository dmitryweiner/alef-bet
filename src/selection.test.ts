import { describe, expect, it } from 'vitest';
import { letters } from './letters';
import { ROUND_LENGTH, pickRoundLetters, roundLetters, seededRandom, weightedOrder } from './selection';
import { emptyStat, type LetterStats } from './stats';

const NOW = Date.UTC(2026, 9, 20);

describe('seededRandom', () => {
  it('is deterministic and stays in [0, 1)', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('weightedOrder', () => {
  it('returns a permutation of the input', () => {
    const items = [1, 2, 3, 4, 5];
    const order = weightedOrder(items, () => 1, seededRandom(1));
    expect([...order].sort()).toEqual(items);
  });

  it('puts heavier items first more often', () => {
    const rng = seededRandom(7);
    let heavyFirst = 0;
    for (let i = 0; i < 1000; i++) {
      if (weightedOrder(['light', 'heavy'], (x) => (x === 'heavy' ? 9 : 1), rng)[0] === 'heavy') heavyFirst++;
    }
    expect(heavyFirst).toBeGreaterThan(850);
  });
});

describe('pickRoundLetters', () => {
  it('picks distinct letters when the pool is large enough', () => {
    const picked = pickRoundLetters(letters.slice(0, 22), {}, NOW, 10, seededRandom(3));
    expect(picked).toHaveLength(10);
    expect(new Set(picked.map((l) => l.id)).size).toBe(10);
  });

  it('repeats letters of a small pool without showing the same letter twice in a row', () => {
    const pool = letters.slice(22);
    for (let seed = 0; seed < 50; seed++) {
      const picked = pickRoundLetters(pool, {}, NOW, 10, seededRandom(seed));
      expect(picked).toHaveLength(10);
      for (const l of pool) expect(picked.filter((x) => x.id === l.id)).toHaveLength(2);
      for (let i = 1; i < picked.length; i++) expect(picked[i]?.id).not.toBe(picked[i - 1]?.id);
    }
  });

  it('includes error-prone and long-unseen letters more often', () => {
    const pool = letters.slice(0, 22);
    const stats: LetterStats = {};
    for (const l of pool) stats[l.id] = { ...emptyStat(), shown: 10, correct: 10, lastSeen: NOW };
    stats[4] = { shown: 10, correct: 2, hinted: 0, wrong: 8, lastSeen: NOW };
    delete stats[9];
    const rng = seededRandom(11);
    const counts = new Map<number, number>();
    for (let i = 0; i < 500; i++) {
      for (const l of pickRoundLetters(pool, stats, NOW, 10, rng)) counts.set(l.id, (counts.get(l.id) ?? 0) + 1);
    }
    const typical = counts.get(0) ?? 0;
    expect(counts.get(4) ?? 0).toBeGreaterThan(typical * 1.3);
    expect(counts.get(9) ?? 0).toBeGreaterThan(typical * 1.3);
  });
});

describe('roundLetters', () => {
  it('picks a regular round of weighted letters from the chosen set', () => {
    const picked = roundLetters('final', {}, NOW, seededRandom(1));
    expect(picked).toHaveLength(ROUND_LENGTH);
    for (const l of picked) expect(l.id).toBeGreaterThanOrEqual(22);
  });

  it('shows every letter, final forms included, exactly once in the "each" set', () => {
    const picked = roundLetters('each', {}, NOW, seededRandom(2));
    expect(picked).toHaveLength(27);
    expect(new Set(picked.map((l) => l.id)).size).toBe(27);
  });

  it('ignores statistics and shuffles the "each" set uniformly', () => {
    const stats: LetterStats = { 4: { shown: 10, correct: 0, hinted: 0, wrong: 10, lastSeen: 0 } };
    const rng = seededRandom(9);
    let first = 0;
    for (let i = 0; i < 2700; i++) if (roundLetters('each', stats, NOW, rng)[0]?.id === 4) first++;
    expect(first).toBeLessThan(200);
    expect(roundLetters('each', {}, NOW, seededRandom(3)).map((l) => l.id)).not.toEqual(letters.map((l) => l.id));
  });
});
