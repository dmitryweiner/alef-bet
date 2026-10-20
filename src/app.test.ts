// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { startApp } from './app';
import { seededRandom } from './selection';
import { STORAGE_KEY, loadState, saveState, emptyState, type KeyValueStorage } from './storage';

const NOW = Date.UTC(2026, 9, 20, 12);
const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

const $ = <T extends Element>(selector: string) => {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`missing ${selector}`);
  return el;
};

let storage: MemoryStorage;
const start = () => startApp({ storage, now: () => NOW, random: seededRandom(5) });

beforeEach(() => {
  document.body.innerHTML = body;
  storage = new MemoryStorage();
});

describe('settings', () => {
  it('restores saved dropdowns and checkboxes', () => {
    saveState(storage, { ...emptyState(), settings: { group: 'final', script: 'mixed', autoNext: false, showAnswerForms: true } });
    start();
    expect($<HTMLSelectElement>('#group').value).toBe('final');
    expect($<HTMLSelectElement>('#script').value).toBe('mixed');
    expect($<HTMLInputElement>('#auto-next').checked).toBe(false);
    expect($<HTMLInputElement>('#show-answer-forms').checked).toBe(true);
  });

  it('saves settings when they change', () => {
    start();
    const group = $<HTMLSelectElement>('#group');
    group.value = 'full';
    group.dispatchEvent(new Event('change'));
    const autoNext = $<HTMLInputElement>('#auto-next');
    autoNext.checked = false;
    autoNext.dispatchEvent(new Event('change'));
    expect(loadState(storage).settings).toMatchObject({ group: 'full', autoNext: false });
  });

  it('works when storage is unavailable', () => {
    startApp({ storage: null, now: () => NOW, random: seededRandom(1) });
    expect(document.querySelectorAll('[data-answer]')).toHaveLength(4);
  });
});

function answerAndContinue(pick: 'first' | 'correct' = 'first') {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-answer]')];
  const correctId = Number($<HTMLElement>('.letter-stage [data-letter-id]').dataset.letterId);
  const button = pick === 'correct' ? buttons.find((b) => Number(b.dataset.answer) === correctId) : buttons[0];
  button!.click();
  $<HTMLButtonElement>('#next').click();
  return correctId;
}

describe('letter statistics', () => {
  it('records every answer per letter', () => {
    start();
    const id = answerAndContinue('correct');
    expect(loadState(storage).letterStats[id]).toEqual({ shown: 1, correct: 1, hinted: 0, wrong: 0, lastSeen: NOW });
  });

  it('shows letters with mistakes in the stats panel', () => {
    saveState(storage, { ...emptyState(), letterStats: { 3: { shown: 2, correct: 0, hinted: 0, wrong: 2, lastSeen: NOW } } });
    start();
    expect($('#weak-letters').textContent).toContain('Далет');
    expect($('#weak-letters').textContent).toContain('2 из 2');
  });

  it('shows letters not seen for a long time', () => {
    start();
    expect($('#stale-letters').textContent).toContain('ещё не встречалась');
  });
});

describe('game results', () => {
  it('saves the result when a round is finished', () => {
    saveState(storage, { ...emptyState(), settings: { group: 'all', script: 'print', autoNext: false, showAnswerForms: false } });
    start();
    for (let i = 0; i < 10; i++) answerAndContinue('correct');
    expect($('.result').textContent).toContain('Все буквы узнаны');
    const { history } = loadState(storage);
    expect(history).toEqual([{ finishedAt: NOW, mode: 'quiz', group: 'all', script: 'print', score: 10, hinted: 0, errors: 0, total: 10 }]);
    expect(storage.data.has(STORAGE_KEY)).toBe(true);
    expect($('#games-played').textContent).toContain('1');
  });
});

describe('statistics reset', () => {
  const seeded = () =>
    saveState(storage, {
      settings: { group: 'final', script: 'print', autoNext: false, showAnswerForms: false },
      letterStats: { 23: { shown: 2, correct: 0, hinted: 0, wrong: 2, lastSeen: NOW } },
      history: [{ finishedAt: NOW, mode: 'quiz', group: 'final', script: 'print', score: 4, hinted: 0, errors: 6, total: 10 }],
    });

  it('clears statistics and history after confirmation, keeping settings', () => {
    seeded();
    start();
    $<HTMLButtonElement>('#reset-stats').click();
    $<HTMLButtonElement>('#reset-confirm').click();
    const state = loadState(storage);
    expect(state.letterStats).toEqual({});
    expect(state.history).toEqual([]);
    expect(state.settings.group).toBe('final');
    expect($('#weak-letters').textContent).toContain('Пока без ошибок');
    expect($('#games-played').textContent).toContain('пока нет');
  });

  it('keeps statistics when the reset is cancelled', () => {
    seeded();
    start();
    $<HTMLButtonElement>('#reset-stats').click();
    $<HTMLButtonElement>('#reset-cancel').click();
    expect(loadState(storage).history).toHaveLength(1);
    expect(document.querySelector('#reset-confirm')).toBeNull();
    expect($<HTMLButtonElement>('#reset-stats').hidden).toBe(false);
  });
});
