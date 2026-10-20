import { letters, type Group } from './letters';
import type { Script } from './round';
import type { LetterStat, LetterStats } from './stats';

export type Mode = 'quiz' | 'typed' | 'pairs';

export interface Settings {
  group: Group;
  script: Script;
  autoNext: boolean;
  showAnswerForms: boolean;
}

export interface GameResult {
  finishedAt: number;
  mode: Mode;
  group: Group;
  script: Script;
  score: number;
  hinted: number;
  errors: number;
  total: number;
}

export interface SavedState {
  settings: Settings;
  letterStats: LetterStats;
  history: GameResult[];
}

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const STORAGE_KEY = 'alef-bet';
const VERSION = 1;
export const HISTORY_LIMIT = 200;

export const DEFAULT_SETTINGS: Settings = { group: 'all', script: 'print', autoNext: true, showAnswerForms: false };

export function emptyState(): SavedState {
  return { settings: { ...DEFAULT_SETTINGS }, letterStats: {}, history: [] };
}

/** localStorage, or null when the browser blocks it. */
export function browserStorage(): KeyValueStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadState(storage: KeyValueStorage | null): SavedState {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || data.version !== VERSION) return emptyState();
    return { settings: parseSettings(data.settings), letterStats: parseLetterStats(data.letterStats), history: parseHistory(data.history) };
  } catch {
    return emptyState();
  }
}

export function saveState(storage: KeyValueStorage | null, state: SavedState): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, ...state }));
    return true;
  } catch {
    return false;
  }
}

export function addResult(state: SavedState, result: GameResult): SavedState {
  return { ...state, history: [...state.history, result].slice(-HISTORY_LIMIT) };
}

/** Forget letter statistics and game history, keeping settings. */
export function resetStats(state: SavedState): SavedState {
  return { ...state, letterStats: {}, history: [] };
}

const groups: readonly Group[] = ['all', 'final', 'full'];
const scripts: readonly Script[] = ['print', 'hand', 'mixed'];
const modes: readonly Mode[] = ['quiz', 'typed', 'pairs'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

function parseSettings(value: unknown): Settings {
  const s = isRecord(value) ? value : {};
  return {
    group: oneOf(s.group, groups) ? s.group : DEFAULT_SETTINGS.group,
    script: oneOf(s.script, scripts) ? s.script : DEFAULT_SETTINGS.script,
    autoNext: typeof s.autoNext === 'boolean' ? s.autoNext : DEFAULT_SETTINGS.autoNext,
    showAnswerForms: typeof s.showAnswerForms === 'boolean' ? s.showAnswerForms : DEFAULT_SETTINGS.showAnswerForms,
  };
}

function parseLetterStat(value: unknown): LetterStat | null {
  if (!isRecord(value)) return null;
  const { shown, correct, hinted, wrong, lastSeen } = value;
  if (!isCount(shown) || !isCount(correct) || !isCount(hinted) || !isCount(wrong)) return null;
  if (lastSeen !== null && typeof lastSeen !== 'number') return null;
  return { shown, correct, hinted, wrong, lastSeen };
}

function parseLetterStats(value: unknown): LetterStats {
  if (!isRecord(value)) return {};
  const stats: LetterStats = {};
  for (const [key, raw] of Object.entries(value)) {
    const id = Number(key);
    const stat = parseLetterStat(raw);
    if (Number.isInteger(id) && id >= 0 && id < letters.length && stat) stats[id] = stat;
  }
  return stats;
}

function parseResult(value: unknown): GameResult | null {
  if (!isRecord(value)) return null;
  const { finishedAt, mode, group, script, score, hinted, errors, total } = value;
  if (typeof finishedAt !== 'number' || !oneOf(mode, modes) || !oneOf(group, groups) || !oneOf(script, scripts)) return null;
  if (!isCount(score) || !isCount(hinted) || !isCount(errors) || !isCount(total)) return null;
  return { finishedAt, mode, group, script, score, hinted, errors, total };
}

function parseHistory(value: unknown): GameResult[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((x) => parseResult(x) ?? []).slice(-HISTORY_LIMIT);
}
