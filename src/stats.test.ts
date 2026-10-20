import { describe, expect, it } from 'vitest';
import { letters } from './letters';
import {
  emptyStat,
  errorRate,
  letterWeight,
  recordAnswer,
  staleLetters,
  staleness,
  weakLetters,
  type LetterStats,
} from './stats';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 9, 20);

describe('recordAnswer', () => {
  it('counts outcomes and remembers when the letter was seen', () => {
    let stats: LetterStats = {};
    stats = recordAnswer(stats, 3, 'correct', NOW - DAY);
    stats = recordAnswer(stats, 3, 'wrong', NOW);
    stats = recordAnswer(stats, 3, 'hinted', NOW);
    expect(stats[3]).toEqual({ shown: 3, correct: 1, hinted: 1, wrong: 1, lastSeen: NOW });
  });

  it('does not mutate the previous stats', () => {
    const before: LetterStats = { 1: { ...emptyStat(), shown: 1, correct: 1, lastSeen: NOW } };
    const after = recordAnswer(before, 1, 'wrong', NOW);
    expect(before[1]?.wrong).toBe(0);
    expect(after[1]?.wrong).toBe(1);
  });
});

describe('errorRate', () => {
  it('is neutral for an unseen letter', () => {
    expect(errorRate(undefined)).toBeCloseTo(0.5);
  });

  it('grows with mistakes and shrinks with correct answers', () => {
    const bad = { ...emptyStat(), shown: 4, wrong: 4 };
    const good = { ...emptyStat(), shown: 4, correct: 4 };
    expect(errorRate(bad)).toBeGreaterThan(0.5);
    expect(errorRate(good)).toBeLessThan(0.5);
  });

  it('counts a hinted answer as half a mistake', () => {
    const hinted = { ...emptyStat(), shown: 2, hinted: 2 };
    const wrong = { ...emptyStat(), shown: 2, wrong: 2 };
    const correct = { ...emptyStat(), shown: 2, correct: 2 };
    expect(errorRate(hinted)).toBeGreaterThan(errorRate(correct));
    expect(errorRate(hinted)).toBeLessThan(errorRate(wrong));
  });
});

describe('staleness', () => {
  it('is maximal for an unseen letter', () => {
    expect(staleness(undefined, NOW)).toBe(1);
  });

  it('grows with time since the letter was last seen and saturates', () => {
    const seen = (ago: number) => staleness({ ...emptyStat(), shown: 1, lastSeen: NOW - ago }, NOW);
    expect(seen(0)).toBe(0);
    expect(seen(HOUR)).toBeLessThan(seen(DAY));
    expect(seen(DAY)).toBeLessThan(1);
    expect(seen(30 * DAY)).toBe(1);
  });
});

describe('letterWeight', () => {
  it('prefers letters with mistakes over letters answered well at the same time', () => {
    const bad = { ...emptyStat(), shown: 3, wrong: 3, lastSeen: NOW };
    const good = { ...emptyStat(), shown: 3, correct: 3, lastSeen: NOW };
    expect(letterWeight(bad, NOW)).toBeGreaterThan(letterWeight(good, NOW));
  });

  it('prefers letters not seen for a long time', () => {
    const recent = { ...emptyStat(), shown: 3, correct: 3, lastSeen: NOW };
    const old = { ...recent, lastSeen: NOW - 10 * DAY };
    expect(letterWeight(old, NOW)).toBeGreaterThan(letterWeight(recent, NOW));
  });

  it('is always positive', () => {
    const perfect = { ...emptyStat(), shown: 1000, correct: 1000, lastSeen: NOW };
    expect(letterWeight(perfect, NOW)).toBeGreaterThan(0);
  });
});

describe('weakLetters', () => {
  const pool = letters.slice(0, 22);

  it('lists only letters with mistakes, the most error-prone first', () => {
    const stats: LetterStats = {
      0: { shown: 4, correct: 3, hinted: 0, wrong: 1, lastSeen: NOW },
      5: { shown: 2, correct: 0, hinted: 0, wrong: 2, lastSeen: NOW },
      7: { shown: 5, correct: 5, hinted: 0, wrong: 0, lastSeen: NOW },
    };
    expect(weakLetters(stats, pool, 5).map((x) => x.letter.id)).toEqual([5, 0]);
  });

  it('respects the pool and the limit', () => {
    const stats: LetterStats = {
      1: { shown: 1, correct: 0, hinted: 0, wrong: 1, lastSeen: NOW },
      2: { shown: 1, correct: 0, hinted: 0, wrong: 1, lastSeen: NOW },
      24: { shown: 1, correct: 0, hinted: 0, wrong: 1, lastSeen: NOW },
    };
    expect(weakLetters(stats, pool, 1)).toHaveLength(1);
    expect(weakLetters(stats, pool, 5).map((x) => x.letter.id)).not.toContain(24);
  });
});

describe('staleLetters', () => {
  const pool = letters.slice(22);

  it('lists unseen letters first, then the ones seen longest ago', () => {
    const stats: LetterStats = {
      22: { ...emptyStat(), shown: 1, correct: 1, lastSeen: NOW - 2 * DAY },
      23: { ...emptyStat(), shown: 1, correct: 1, lastSeen: NOW - 5 * DAY },
      24: { ...emptyStat(), shown: 1, correct: 1, lastSeen: NOW - 3 * DAY },
      25: { ...emptyStat(), shown: 1, correct: 1, lastSeen: NOW - 4 * DAY },
    };
    expect(staleLetters(stats, pool, NOW, 3).map((x) => x.letter.id)).toEqual([26, 23, 25]);
  });

  it('skips letters seen recently', () => {
    const stats: LetterStats = Object.fromEntries(
      pool.map((l) => [l.id, { ...emptyStat(), shown: 1, correct: 1, lastSeen: NOW - HOUR }]),
    );
    expect(staleLetters(stats, pool, NOW, 5)).toEqual([]);
  });
});
