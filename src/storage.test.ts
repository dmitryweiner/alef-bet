import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  HISTORY_LIMIT,
  STORAGE_KEY,
  addResult,
  emptyState,
  loadState,
  resetStats,
  saveState,
  type GameResult,
  type KeyValueStorage,
  type SavedState,
} from './storage';

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

const result = (score: number, finishedAt = 1): GameResult => ({
  finishedAt,
  mode: 'quiz',
  group: 'all',
  script: 'print',
  score,
  hinted: 0,
  errors: 10 - score,
  total: 10,
});

describe('loadState', () => {
  it('returns defaults when nothing is stored or storage is unavailable', () => {
    expect(loadState(new MemoryStorage())).toEqual(emptyState());
    expect(loadState(null)).toEqual(emptyState());
    expect(emptyState().settings).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults for corrupted JSON', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{oops');
    expect(loadState(storage)).toEqual(emptyState());
  });

  it('returns defaults when storage throws', () => {
    const storage: KeyValueStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
    };
    expect(loadState(storage)).toEqual(emptyState());
  });

  it('round-trips saved state', () => {
    const storage = new MemoryStorage();
    const state: SavedState = {
      settings: { group: 'final', script: 'mixed', autoNext: false, showAnswerForms: true },
      letterStats: { 3: { shown: 2, correct: 1, hinted: 0, wrong: 1, lastSeen: 123 } },
      history: [result(7)],
    };
    expect(saveState(storage, state)).toBe(true);
    expect(loadState(storage)).toEqual(state);
  });

  it('replaces invalid fields with defaults and drops invalid entries', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        settings: { group: 'nope', script: 'hand', autoNext: 'yes' },
        letterStats: { 2: { shown: 1, correct: 1, hinted: 0, wrong: 0, lastSeen: 5 }, 99: { shown: 1 }, 4: 'bad' },
        history: [result(5), { score: 'x' }],
      }),
    );
    const state = loadState(storage);
    expect(state.settings).toEqual({ ...DEFAULT_SETTINGS, script: 'hand' });
    expect(Object.keys(state.letterStats)).toEqual(['2']);
    expect(state.history).toEqual([result(5)]);
  });
});

describe('loadState with the "each" set', () => {
  it('keeps the setting and 27-question results', () => {
    const storage = new MemoryStorage();
    const state: SavedState = {
      settings: { ...DEFAULT_SETTINGS, group: 'each' },
      letterStats: {},
      history: [{ ...result(20), group: 'each', errors: 7, total: 27 }],
    };
    saveState(storage, state);
    expect(loadState(storage)).toEqual(state);
  });
});

describe('saveState', () => {
  it('reports failure instead of throwing when storage is full', () => {
    const storage: KeyValueStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(saveState(storage, emptyState())).toBe(false);
    expect(saveState(null, emptyState())).toBe(false);
  });
});

describe('addResult', () => {
  it('appends results and keeps only the latest ones', () => {
    let state = emptyState();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) state = addResult(state, result(i % 11, i));
    expect(state.history).toHaveLength(HISTORY_LIMIT);
    expect(state.history.at(-1)?.finishedAt).toBe(HISTORY_LIMIT + 4);
    expect(state.history[0]?.finishedAt).toBe(5);
  });
});

describe('resetStats', () => {
  it('clears letter statistics and history but keeps settings', () => {
    const settings = { group: 'final', script: 'hand', autoNext: false, showAnswerForms: true } as const;
    const state: SavedState = {
      settings,
      letterStats: { 1: { shown: 1, correct: 0, hinted: 0, wrong: 1, lastSeen: 1 } },
      history: [result(3)],
    };
    expect(resetStats(state)).toEqual({ settings, letterStats: {}, history: [] });
    expect(state.history).toHaveLength(1);
  });
});
