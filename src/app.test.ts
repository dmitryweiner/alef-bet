// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startApp } from './app';
import { markByKey, marks } from './nikud';
import { readingWords } from './reading';
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
let stop: (() => void) | undefined;
const start = () => (stop = startApp({ storage, now: () => NOW, random: seededRandom(5) }));

beforeEach(() => {
  document.body.innerHTML = body;
  storage = new MemoryStorage();
  history.replaceState(null, '', location.pathname);
});

afterEach(() => {
  stop?.();
  stop = undefined;
});

const nextHashChange = () => new Promise((resolve) => window.addEventListener('hashchange', resolve, { once: true }));
const activeTab = () => $<HTMLElement>('[data-view].active').dataset.view;

describe('page text', () => {
  it('does not contain removed slogans', () => {
    for (const phrase of ['Печатные и письменные. По одной, в твоём темпе.', 'БУКВЫ В ИГРЕ', 'Маленькие шаги. Новый язык.', '22 буквы · 5 конечных форм · без спешки']) {
      expect(document.body.textContent).not.toContain(phrase);
    }
  });
});

describe('layout', () => {
  it('keeps the settings toggle and the settings panel in one block', () => {
    const box = $('.settings-box');
    expect(box.contains($('#settings-toggle'))).toBe(true);
    expect(box.contains($('#settings-panel'))).toBe(true);
  });

  it('places the letter statistics after the board, outside the settings column', () => {
    start();
    const stats = $('#letter-stats');
    expect($('aside').contains(stats)).toBe(false);
    expect($('#board').compareDocumentPosition(stats) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not duplicate the statistics on the result screen', () => {
    start();
    for (let i = 0; i < 10; i++) answerAndContinue('correct');
    expect(document.querySelector('.result-letter-stats')).toBeNull();
  });
});

describe('navigation', () => {
  it('shows tabs as links to game hashes without numbers', () => {
    const tabs = [...document.querySelectorAll<HTMLAnchorElement>('nav [data-view]')];
    expect(tabs.map((t) => t.getAttribute('href'))).toEqual(['#alphabet', '#nikud', '#pairs', '#guess', '#type', '#read']);
    expect(tabs.map((t) => t.textContent)).toEqual(['Алфавит', 'Некудот', 'Найди пару', 'Угадай букву', 'Впиши название', 'Как читать']);
    for (const t of tabs) expect(t.textContent).not.toMatch(/\d/);
  });

  it('opens the game from the hash on start', () => {
    history.replaceState(null, '', '#pairs');
    start();
    expect(activeTab()).toBe('pairs');
    expect(document.querySelector('.answer.hebrew')).not.toBeNull();
  });

  it('switches the game when the hash changes', async () => {
    start();
    expect(activeTab()).toBe('quiz');
    const changed = nextHashChange();
    location.hash = '#type';
    await changed;
    expect(activeTab()).toBe('typed');
    expect(document.querySelector('#letter-name')).not.toBeNull();
  });

  it('updates the hash when reviewing letters in the alphabet', async () => {
    saveState(storage, { ...emptyState(), settings: { group: 'all', script: 'print', autoNext: false, showAnswerForms: false } });
    start();
    for (let i = 0; i < 10; i++) answerAndContinue('first');
    const changed = nextHashChange();
    $<HTMLButtonElement>('#review').click();
    await changed;
    expect(location.hash).toBe('#alphabet');
    expect(activeTab()).toBe('alphabet');
  });
});

describe('alphabet reference', () => {
  const openAlphabet = () => {
    history.replaceState(null, '', '#alphabet');
    start();
  };

  it('hides the settings and statistics', () => {
    openAlphabet();
    expect($<HTMLElement>('aside').hidden).toBe(true);
    expect($<HTMLElement>('#letter-stats').hidden).toBe(true);
  });

  it('shows the settings again when going back to a game', async () => {
    openAlphabet();
    const changed = nextHashChange();
    location.hash = '#guess';
    await changed;
    expect($<HTMLElement>('aside').hidden).toBe(false);
  });

  it('shows all letters with final forms regardless of the chosen set', () => {
    saveState(storage, { ...emptyState(), settings: { group: 'final', script: 'print', autoNext: true, showAnswerForms: false } });
    openAlphabet();
    expect(document.querySelectorAll('.letter-card')).toHaveLength(27);
  });

  it('describes the selected letter in detail', () => {
    openAlphabet();
    $<HTMLButtonElement>('[data-letter="12"]').click();
    const detail = $('.detail').textContent!;
    expect(detail).toContain('Мем');
    expect(detail).toContain('מם');
    expect(detail).toContain('маим');
    expect(detail).toContain('вода');
    expect(detail).toContain('40');
    expect(detail).toContain('13');
  });

  it('places the letter description above the alphabet', () => {
    openAlphabet();
    expect($('.detail').compareDocumentPosition($('.alphabet-grid')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('lets the player close the description and opens it again on a letter tap', () => {
    openAlphabet();
    $<HTMLButtonElement>('[data-letter="12"]').click();
    $<HTMLButtonElement>('#detail-close').click();
    expect(document.querySelector('.detail')).toBeNull();
    expect(document.querySelector('.letter-card[aria-pressed="true"]')).toBeNull();
    $<HTMLButtonElement>('[data-letter="3"]').click();
    expect($('.detail h3').textContent).toContain('Далет');
  });

  it('opens the description when reviewing letters after a round', async () => {
    saveState(storage, { ...emptyState(), settings: { group: 'all', script: 'print', autoNext: false, showAnswerForms: false } });
    openAlphabet();
    $<HTMLButtonElement>('#detail-close').click();
    const changed = nextHashChange();
    location.hash = '#guess';
    await changed;
    for (let i = 0; i < 10; i++) answerAndContinue('first');
    $<HTMLButtonElement>('#review').click();
    expect(document.querySelector('.detail')).not.toBeNull();
  });

  it('opens related letters from the detail card', () => {
    openAlphabet();
    $<HTMLButtonElement>('[data-letter="12"]').click();
    $<HTMLButtonElement>('.detail [data-letter="23"]').click();
    expect($('.detail h3').textContent).toContain('Мем софит');
  });
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
    autoNext.checked = true;
    autoNext.dispatchEvent(new Event('change'));
    expect(loadState(storage).settings).toMatchObject({ group: 'full', autoNext: true });
  });

  it.each(['#guess', '#type', '#pairs'])('turns auto-advance off by default in %s', (hash) => {
    history.replaceState(null, '', hash);
    start();
    expect($<HTMLInputElement>('#auto-next').checked).toBe(false);
  });

  it('waits for the player before the next question by default', () => {
    start();
    document.querySelector<HTMLButtonElement>('[data-answer]')!.click();
    expect($('#next').textContent).toBe('Далее');
    expect($<HTMLButtonElement>('#pause').hidden).toBe(true);
  });

  it('works when storage is unavailable', () => {
    stop = startApp({ storage: null, now: () => NOW, random: seededRandom(1) });
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

describe('statistics visibility', () => {
  it('hides the letter statistics during a round so they cannot be used as hints', () => {
    start();
    expect($<HTMLElement>('#letter-stats').hidden).toBe(true);
    answerAndContinue('first');
    expect($<HTMLElement>('#letter-stats').hidden).toBe(true);
  });

  it('shows the letter statistics on the result screen and hides them in the next round', () => {
    saveState(storage, { ...emptyState(), settings: { group: 'all', script: 'print', autoNext: false, showAnswerForms: false } });
    start();
    for (let i = 0; i < 10; i++) answerAndContinue('first');
    expect($<HTMLElement>('#letter-stats').hidden).toBe(false);
    $<HTMLButtonElement>('#again').click();
    expect($<HTMLElement>('#letter-stats').hidden).toBe(true);
  });

  it('compares the best result relative to the round length', () => {
    saveState(storage, {
      ...emptyState(),
      history: [
        { finishedAt: NOW, mode: 'quiz', group: 'each', script: 'print', score: 20, hinted: 0, errors: 7, total: 27 },
        { finishedAt: NOW, mode: 'quiz', group: 'all', script: 'print', score: 9, hinted: 0, errors: 1, total: 10 },
      ],
    });
    start();
    expect($('#games-played').textContent).toContain('лучший результат: 9 из 10');
  });
});

describe('whole alphabet round', () => {
  const startEach = () => {
    saveState(storage, { ...emptyState(), settings: { group: 'each', script: 'print', autoNext: false, showAnswerForms: false } });
    start();
  };

  it('is offered in the letter set setting', () => {
    expect([...$<HTMLSelectElement>('#group').options].map((o) => o.value)).toContain('each');
  });

  it('asks about all 27 letters once and saves a 27-question result', () => {
    startEach();
    expect($('.round-head').textContent).toContain('Вопрос 1 из 27');
    expect($('.session').textContent).toContain('из 27');
    const seen = new Set<number>();
    for (let i = 0; i < 27; i++) seen.add(answerAndContinue('correct'));
    expect(seen.size).toBe(27);
    expect($('.big-score').textContent).toContain('27');
    expect($('.result').textContent).toContain('Все буквы узнаны');
    expect(loadState(storage).history.at(-1)).toMatchObject({ group: 'each', score: 27, total: 27 });
  });

  it('works in the typing and pairs games', async () => {
    startEach();
    for (const hash of ['#type', '#pairs']) {
      const changed = nextHashChange();
      location.hash = hash;
      await changed;
      expect($('.round-head').textContent).toContain('из 27');
    }
  });

  it('keeps regular rounds at 10 questions', () => {
    start();
    expect($('.round-head').textContent).toContain('Вопрос 1 из 10');
    expect($('.session').textContent).toContain('из 10');
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

describe('nikud reference', () => {
  const openNikud = () => {
    history.replaceState(null, '', '#nikud');
    start();
  };
  const markButton = (key: string) => $<HTMLButtonElement>(`.letter-card[data-mark="${markByKey(key).id}"]`);

  it('hides the settings and statistics', () => {
    openNikud();
    expect(activeTab()).toBe('nikud');
    expect($<HTMLElement>('aside').hidden).toBe(true);
    expect($<HTMLElement>('#letter-stats').hidden).toBe(true);
  });

  it('shows every mark on a card in print and handwriting', () => {
    openNikud();
    const cards = document.querySelectorAll('.letter-card[data-mark]');
    expect(cards).toHaveLength(marks.length);
    expect(cards[0]!.querySelectorAll('span[lang="he"]')).toHaveLength(2);
    expect(cards[0]!.textContent).toContain(marks[0]!.sample);
  });

  it('describes the selected mark in detail', () => {
    openNikud();
    markButton('holam').click();
    const detail = $('.detail').textContent!;
    expect(detail).toContain('Холам');
    expect(detail).toContain('חולם');
    expect(detail).toContain('«о»');
    expect(detail).toContain(markByKey('holam').example.word);
    expect(detail).toContain('нет');
  });

  it('places the description above the marks', () => {
    openNikud();
    expect($('.detail').compareDocumentPosition($('.alphabet-grid')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens related marks from the detail card', () => {
    openNikud();
    markButton('kamatz').click();
    $<HTMLButtonElement>(`.detail [data-mark="${markByKey('patah').id}"]`).click();
    expect($('.detail h3').textContent).toContain('Патах');
  });

  it('lets the player close the description and opens it again on a mark tap', () => {
    openNikud();
    $<HTMLButtonElement>('#detail-close').click();
    expect(document.querySelector('.detail')).toBeNull();
    markButton('segol').click();
    expect($('.detail h3').textContent).toContain('Сеголь');
  });
});

function readAndContinue(pick: 'first' | 'correct' | 'wrong' = 'first') {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-answer]')];
  const reading = $<HTMLElement>('.letter-stage [data-reading]').dataset.reading!;
  const isCorrect = (b: HTMLButtonElement) => b.getAttribute('aria-label')!.endsWith(`: ${reading}`);
  const button = pick === 'correct' ? buttons.find(isCorrect) : pick === 'wrong' ? buttons.find((b) => !isCorrect(b)) : buttons[0];
  button!.click();
  $<HTMLButtonElement>('#next').click();
  return reading;
}

describe('reading game', () => {
  const openReading = () => {
    history.replaceState(null, '', '#read');
    start();
  };

  it('asks how a word with nikud is read and offers four readings', () => {
    openReading();
    expect(activeTab()).toBe('reading');
    expect($('.prompt h2').textContent).toBe('Как читается это слово?');
    expect($('.letter-stage [data-reading]').textContent).toMatch(/^[\u05d0-\u05ea\u05b0-\u05c7]+$/);
    expect(document.querySelectorAll('[data-answer]')).toHaveLength(4);
    expect($('.round-head').textContent).toContain('Вопрос 1 из 10');
  });

  it('counts a correct reading and explains it', () => {
    openReading();
    const reading = $<HTMLElement>('.letter-stage [data-reading]').dataset.reading!;
    [...document.querySelectorAll<HTMLButtonElement>('[data-answer]')].find((b) => b.getAttribute('aria-label')!.endsWith(`: ${reading}`))!.click();
    expect($('#score').textContent).toBe('1');
    expect($('.feedback.good').textContent).toContain('Верно');
    expect($('.feedback').textContent).toContain(`«${reading}»`);
    const shown = readingWords.find((w) => w.word === $('.letter-stage [data-reading]').textContent)!;
    expect($('.feedback .meaning').textContent).toContain(shown.translation);
    expect(document.querySelector('.answer.correct')).not.toBeNull();
  });

  it('marks a wrong reading and shows the right one with its meaning', () => {
    openReading();
    const wrong = [...document.querySelectorAll<HTMLButtonElement>('[data-answer]')].find(
      (b) => !b.getAttribute('aria-label')!.endsWith(`: ${$<HTMLElement>('.letter-stage [data-reading]').dataset.reading}`),
    )!;
    wrong.click();
    expect(wrong.classList.contains('wrong')).toBe(true);
    expect(document.querySelector('.answer.correct')).not.toBeNull();
    expect($('.feedback.bad .meaning').textContent).toMatch(/^Перевод: /);
  });

  it('gives the vowel as a hint', () => {
    openReading();
    $<HTMLButtonElement>('#hint').click();
    expect($('#hinttext').textContent).toMatch(/читается «[аэиоу]»/);
  });

  it('saves the result without touching letter statistics', () => {
    openReading();
    for (let i = 0; i < 10; i++) readAndContinue('correct');
    expect($('.result').textContent).toContain('Все слова прочитаны');
    const state = loadState(storage);
    expect(state.letterStats).toEqual({});
    expect(state.history).toEqual([{ finishedAt: NOW, mode: 'reading', group: 'all', script: 'print', score: 10, hinted: 0, errors: 0, total: 10 }]);
  });

  it('lists missed words and opens their vowel in the nikud reference', async () => {
    openReading();
    for (let i = 0; i < 10; i++) readAndContinue('wrong');
    expect($('.review').querySelectorAll('span[lang="he"]').length).toBeGreaterThan(0);
    const missed = readingWords.find((w) => w.word === $('.review span[lang="he"]').textContent)!;
    expect($('.review').textContent).toContain(missed.translation);
    const changed = nextHashChange();
    $<HTMLButtonElement>('#review').click();
    await changed;
    expect(location.hash).toBe('#nikud');
    expect(document.querySelector('.detail')).not.toBeNull();
  });

  it('hides the letter set setting and the letter statistics', async () => {
    openReading();
    expect($<HTMLElement>('#group').hidden).toBe(true);
    expect($<HTMLElement>('label[for="group"]').hidden).toBe(true);
    for (let i = 0; i < 10; i++) readAndContinue('first');
    expect($<HTMLElement>('#letter-stats').hidden).toBe(true);
    const changed = nextHashChange();
    location.hash = '#guess';
    await changed;
    expect($<HTMLElement>('#group').hidden).toBe(false);
  });

  it('shows the word in every script after the answer when asked to', () => {
    saveState(storage, { ...emptyState(), settings: { group: 'all', script: 'print', autoNext: false, showAnswerForms: true } });
    openReading();
    const reading = $<HTMLElement>('.letter-stage [data-reading]');
    const word = reading.textContent!;
    document.querySelector<HTMLButtonElement>('[data-answer]')!.click();
    expect(document.querySelectorAll('.answer-forms-grid .glyph')).toHaveLength(3);
    expect($('.answer-forms-grid').textContent).toContain(word);
  });

  it('answers with the number keys', () => {
    openReading();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));
    expect(document.querySelectorAll<HTMLButtonElement>('[data-answer]')[1]!.disabled).toBe(true);
    expect(document.querySelector('#next')).not.toBeNull();
  });
});
