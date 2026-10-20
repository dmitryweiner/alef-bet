import type { Letter } from './letters';

export type Outcome = 'correct' | 'hinted' | 'wrong';

export interface LetterStat {
  shown: number;
  correct: number;
  hinted: number;
  wrong: number;
  /** Timestamp (ms) of the last answer, null if never answered. */
  lastSeen: number | null;
}

/** Statistics keyed by letter id. */
export type LetterStats = Record<number, LetterStat>;

const HOUR = 60 * 60 * 1000;
/** After this long a letter counts as fully "forgotten". */
export const STALE_AFTER = 3 * 24 * HOUR;
/** Letters seen more recently than this are not listed as long unseen. */
export const STALE_LIST_MIN_AGE = 24 * HOUR;
/** A hinted answer counts as this fraction of a mistake. */
const HINT_PENALTY = 0.5;
/** Weight of the error rate and staleness on top of the base weight 1. */
const ERROR_WEIGHT = 4;
const STALE_WEIGHT = 3;

export function emptyStat(): LetterStat {
  return { shown: 0, correct: 0, hinted: 0, wrong: 0, lastSeen: null };
}

export function recordAnswer(stats: LetterStats, letterId: number, outcome: Outcome, now: number): LetterStats {
  const prev = stats[letterId] ?? emptyStat();
  return { ...stats, [letterId]: { ...prev, shown: prev.shown + 1, [outcome]: prev[outcome] + 1, lastSeen: now } };
}

/** Smoothed share of mistakes (Laplace prior): 0.5 for an unseen letter. */
export function errorRate(stat: LetterStat | undefined): number {
  if (!stat) return 0.5;
  return (stat.wrong + HINT_PENALTY * stat.hinted + 1) / (stat.shown + 2);
}

/** 0 right after the letter was seen, 1 when it is unseen or seen STALE_AFTER ago. */
export function staleness(stat: LetterStat | undefined, now: number): number {
  if (!stat || stat.lastSeen === null) return 1;
  const age = Math.max(0, now - stat.lastSeen);
  return Math.min(1, Math.log1p(age / HOUR) / Math.log1p(STALE_AFTER / HOUR));
}

/** How strongly a letter should be preferred when building a round. */
export function letterWeight(stat: LetterStat | undefined, now: number): number {
  return 1 + ERROR_WEIGHT * errorRate(stat) + STALE_WEIGHT * staleness(stat, now);
}

export interface WeakLetter {
  letter: Letter;
  wrong: number;
  shown: number;
}

/** Letters from the pool with mistakes, ordered by share of wrong answers. */
export function weakLetters(stats: LetterStats, pool: Letter[], limit: number): WeakLetter[] {
  return pool
    .flatMap((letter) => {
      const s = stats[letter.id];
      return s && s.wrong > 0 ? [{ letter, wrong: s.wrong, shown: s.shown }] : [];
    })
    .sort((a, b) => b.wrong / b.shown - a.wrong / a.shown || b.wrong - a.wrong)
    .slice(0, limit);
}

export interface StaleLetter {
  letter: Letter;
  lastSeen: number | null;
}

/** Letters from the pool never seen or not seen for at least a day, oldest first. */
export function staleLetters(stats: LetterStats, pool: Letter[], now: number, limit: number): StaleLetter[] {
  return pool
    .map((letter) => ({ letter, lastSeen: stats[letter.id]?.lastSeen ?? null }))
    .filter((x) => x.lastSeen === null || now - x.lastSeen >= STALE_LIST_MIN_AGE)
    .sort((a, b) => (a.lastSeen ?? -Infinity) - (b.lastSeen ?? -Infinity))
    .slice(0, limit);
}
