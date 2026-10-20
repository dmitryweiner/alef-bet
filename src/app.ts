import { formatAgo, pluralRu } from './format';
import { BASE_LETTER_COUNT, letterPool, letters, type Group, type Letter } from './letters';
import { matchesName, normalizeName } from './names';
import { createQuestions, type Question, type Script } from './round';
import { letterDetails } from './reference';
import { hashForView, viewFromHash, type View } from './routes';
import { pickRoundLetters, type Random } from './selection';
import { recordAnswer, staleLetters, weakLetters, type Outcome } from './stats';
import { addResult, loadState, resetStats, saveState, type KeyValueStorage, type Mode, type SavedState } from './storage';

export interface AppOptions {
  storage: KeyValueStorage | null;
  now?: () => number;
  random?: Random;
}

const ROUND_LENGTH = 10;
const STATS_LIST_LIMIT = 5;
const modeNames: Record<Mode, string> = { quiz: 'Угадай букву', typed: 'Впиши название', pairs: 'Найди пару' };

function required<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Не найден элемент ${selector}`);
  return el;
}

function glyph(l: Letter, type: 'print' | 'hand', cls = '', attrs = ''): string {
  return `<span lang="he" dir="rtl" class="${type === 'hand' ? 'hand ' : ''}${cls}"${attrs}>${l.char}</span>`;
}

/** Starts the game on the current page; returns a function that removes global listeners. */
export function startApp({ storage, now = Date.now, random = Math.random }: AppOptions): () => void {
  const board = required<HTMLElement>('#board');
  const aside = required<HTMLElement>('aside');
  const statsPanel = required<HTMLElement>('#letter-stats');
  const group = required<HTMLSelectElement>('#group');
  const script = required<HTMLSelectElement>('#script');
  const autoNext = required<HTMLInputElement>('#auto-next');
  const showAnswerForms = required<HTMLInputElement>('#show-answer-forms');

  let saved: SavedState = loadState(storage);
  let view: View = viewFromHash(location.hash);
  let questions: Question[] = [];
  let index = 0;
  let score = 0;
  let hintedScore = 0;
  let answered = false;
  let misses: Letter[] = [];
  let selected = 0;
  let handReady = false;
  let advanceTimer: ReturnType<typeof setTimeout> | undefined;

  group.value = saved.settings.group;
  script.value = saved.settings.script;
  autoNext.checked = saved.settings.autoNext;
  showAnswerForms.checked = saved.settings.showAnswerForms;

  const persist = () => saveState(storage, saved);
  const pool = () => letterPool(group.value as Group);
  const currentQuestion = (): Question => {
    const q = questions[index];
    if (!q) throw new Error('Нет текущего вопроса');
    return q;
  };

  function saveSettings() {
    saved = {
      ...saved,
      settings: { group: group.value as Group, script: script.value as Script, autoNext: autoNext.checked, showAnswerForms: showAnswerForms.checked },
    };
    persist();
  }

  function cancelAdvance() {
    clearTimeout(advanceTimer);
    advanceTimer = undefined;
  }

  function nextQuestion() {
    if (!answered) return;
    cancelAdvance();
    index++;
    answered = false;
    if (index === ROUND_LENGTH && view !== 'alphabet') {
      saved = addResult(saved, {
        finishedAt: now(), mode: view, group: group.value as Group, script: script.value as Script,
        score, hinted: hintedScore, errors: misses.length, total: ROUND_LENGTH,
      });
      persist();
      renderStatsPanel();
    }
    render();
  }

  function begin() {
    cancelAdvance();
    const p = pool();
    questions = createQuestions(pickRoundLetters(p, saved.letterStats, now(), ROUND_LENGTH, random), p, script.value as Script, random);
    index = 0;
    score = 0;
    hintedScore = 0;
    misses = [];
    answered = false;
    renderStatsPanel();
    render();
  }

  function roundStatsText() {
    return `Самостоятельно: ${score} · С подсказкой: ${hintedScore} · Ошибки: ${misses.length}`;
  }

  function updateScores() {
    required('#score').textContent = String(score);
    required('#hinted-score').textContent = String(hintedScore);
    const stats = document.querySelector('#round-stats');
    if (stats) stats.textContent = roundStatsText();
  }

  function weakLettersHtml() {
    const weak = weakLetters(saved.letterStats, pool(), STATS_LIST_LIMIT);
    if (!weak.length) return '<p class="stats-empty">Пока без ошибок.</p>';
    return `<ul class="stats-list">${weak.map((w) => `<li>${glyph(w.letter, 'print')}<span>${w.letter.name}</span><small>ошибок: ${w.wrong} из ${w.shown}</small></li>`).join('')}</ul>`;
  }

  function staleLettersHtml() {
    const stale = staleLetters(saved.letterStats, pool(), now(), STATS_LIST_LIMIT);
    if (!stale.length) return '<p class="stats-empty">Все буквы недавно повторялись.</p>';
    return `<ul class="stats-list">${stale.map((s) => `<li>${glyph(s.letter, 'print')}<span>${s.letter.name}</span><small>${formatAgo(s.lastSeen, now())}</small></li>`).join('')}</ul>`;
  }

  function renderStatsPanel() {
    const { history } = saved;
    const best = history.reduce((max, r) => Math.max(max, r.score), 0);
    const last = history.at(-1);
    statsPanel.innerHTML = `<div class="eyebrow">ТВОЯ СТАТИСТИКА</div><h3>Чаще ошибаешься</h3><div id="weak-letters">${weakLettersHtml()}</div><h3>Давно не встречались</h3><div id="stale-letters">${staleLettersHtml()}</div><p id="games-played" class="stats-games">${history.length ? `Сыграно ${history.length} ${pluralRu(history.length, ['раунд', 'раунда', 'раундов'])} · лучший результат: ${best} из ${ROUND_LENGTH}` : 'Сыгранных раундов пока нет.'}</p>${last ? `<p class="stats-games">Последний: «${modeNames[last.mode]}» — ${last.score} из ${last.total}</p>` : ''}<p class="setting-note">Такие буквы чаще попадают в новый раунд.</p>`;
  }

  function stageHtml(q: Question) {
    const font = view !== 'pairs' && q.type === 'print' ? ' ' + q.font : '';
    return `${glyph(q.letter, q.type, 'glyph' + font, ` data-letter-id="${q.letter.id}"`)}<span class="stage-label">${q.type === 'hand' ? 'письменная' : 'печатная'}</span>`;
  }

  function render() {
    updateScores();
    document.querySelectorAll<HTMLElement>('[data-view]').forEach((b) => {
      b.classList.toggle('active', b.dataset.view === view);
      b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false');
    });
    const reference = view === 'alphabet';
    aside.hidden = reference;
    statsPanel.hidden = reference;
    board.parentElement?.classList.toggle('reference', reference);
    if (reference) return renderAlphabet();
    if (index >= ROUND_LENGTH) return renderResult();
    const q = currentQuestion();
    const pairing = view === 'pairs';
    const typing = view === 'typed';
    const answers = typing
      ? `<form id="name-form" class="name-form"><label for="letter-name">Название буквы по-русски</label><div class="name-controls"><input id="letter-name" type="text" maxlength="60" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="done" aria-describedby="name-help input-error"><button class="primary" type="submit">Проверить</button></div><p id="name-help" class="input-help">Для конечных форм добавь «софит».</p><p id="input-error" class="input-error" aria-live="polite"></p></form>`
      : `<div class="answers">${q.options.map((l, i) => `<button class="answer ${pairing ? 'hebrew' : ''}" data-answer="${l.id}" aria-label="Вариант ${i + 1}${pairing ? '' : ': ' + l.name}">${pairing ? glyph(l, q.type === 'print' ? 'hand' : 'print') : l.name}<span class="key">${i + 1}</span></button>`).join('')}</div>`;
    board.innerHTML = `<div class="round-head"><span>Вопрос ${index + 1} из ${ROUND_LENGTH}</span><span class="pill">${pairing ? 'ДВА НАЧЕРТАНИЯ' : typing ? 'ВСПОМНИ НАЗВАНИЕ' : 'ЗНАКОМСТВО С БУКВАМИ'}</span></div><div class="round-stats" id="round-stats">${roundStatsText()}</div><div class="progress" role="progressbar" aria-label="Пройдено вопросов" aria-valuemin="0" aria-valuemax="${ROUND_LENGTH}" aria-valuenow="${index}"><div style="width:${(index * 100) / ROUND_LENGTH}%"></div></div><div class="prompt"><h2>${pairing ? 'Найди ту же букву' : 'Как называется эта буква?'}</h2><div class="sub">${pairing ? `Выбери ${q.type === 'print' ? 'письменную' : 'печатную'} пару` : typing ? 'Впиши название и нажми «Проверить»' : 'Нажми на правильное название'}</div></div><div class="letter-stage">${stageHtml(q)}</div>${answers}<div id="response" aria-live="polite"></div><button class="hint" id="hint">Нужна подсказка?</button><p class="hinttext" id="hinttext" ${q.hintUsed ? '' : 'hidden'}>${q.hintUsed ? q.letter.gameHint : ''}</p>`;
    board.querySelectorAll<HTMLElement>('[data-answer]').forEach((b) => b.addEventListener('click', () => answer(Number(b.dataset.answer))));
    if (typing) {
      const field = required<HTMLInputElement>('#letter-name');
      field.value = q.draft ?? '';
      field.oninput = () => {
        q.draft = field.value;
        required('#input-error').textContent = '';
      };
      required<HTMLFormElement>('#name-form').onsubmit = (e) => {
        e.preventDefault();
        answer(field.value);
      };
      field.focus({ preventScroll: true });
    }
    required<HTMLButtonElement>('#hint').onclick = () => {
      if (answered) return;
      q.hintUsed = true;
      const h = required<HTMLElement>('#hinttext');
      h.hidden = false;
      h.textContent = q.letter.gameHint;
    };
    if (!handReady && (pairing || q.type === 'hand')) fontNotice();
  }

  function fontNotice() {
    const n = document.createElement('p');
    n.className = 'error';
    n.textContent = 'Загружается письменный шрифт…';
    board.prepend(n);
    board.querySelectorAll<HTMLButtonElement>('[data-answer]').forEach((b) => (b.disabled = true));
  }

  function updateAnswerForms() {
    const container = document.querySelector('.letter-stage');
    if (!container || !answered || view === 'alphabet' || index >= questions.length) return;
    const enabled = showAnswerForms.checked;
    container.classList.toggle('show-forms', enabled);
    const q = currentQuestion();
    if (!enabled) {
      container.innerHTML = stageHtml(q);
      return;
    }
    const letter = q.letter;
    container.innerHTML = `<div class="answer-forms-grid"><div>${glyph(letter, 'print', 'glyph print-sans')}<span>Без засечек</span></div><div>${glyph(letter, 'print', 'glyph print-serif')}<span>С засечками</span></div><div>${handReady ? glyph(letter, 'hand', 'glyph') : '<span class="font-pending">Шрифт загружается…</span>'}<span>Рукописная</span></div></div>`;
  }

  function nextLabel() {
    return index === ROUND_LENGTH - 1 ? 'Результат' : 'Далее';
  }

  function configureAdvance() {
    cancelAdvance();
    if (!answered || index >= questions.length || view === 'alphabet') return;
    const next = document.querySelector<HTMLButtonElement>('#next');
    const pause = document.querySelector<HTMLButtonElement>('#pause');
    if (!next || !pause) return;
    const enabled = autoNext.checked;
    const ok = currentQuestion().correct;
    next.textContent = nextLabel() + (enabled ? ` · ${ok ? '1,5' : '3'} с` : '');
    pause.hidden = !enabled;
    pause.disabled = false;
    pause.textContent = 'Пауза';
    if (enabled) advanceTimer = setTimeout(nextQuestion, ok ? 1500 : 3000);
  }

  function answer(value: number | string) {
    if (answered || index >= ROUND_LENGTH || view === 'alphabet') return;
    const q = currentQuestion();
    const typing = view === 'typed';
    if (typing && !normalizeName(String(value))) {
      required('#input-error').textContent = 'Сначала впиши название буквы.';
      required<HTMLInputElement>('#letter-name').focus();
      return;
    }
    if (!typing && !q.options.some((l) => l.id === value)) throw new Error('Недопустимый вариант');
    if (!handReady && (view === 'pairs' || q.type === 'hand')) return;
    answered = true;
    const ok = typing ? matchesName(q.letter, String(value)) : value === q.letter.id;
    q.correct = ok;
    if (ok) {
      if (q.hintUsed) hintedScore++;
      else score++;
    } else misses.push(q.letter);
    const outcome: Outcome = !ok ? 'wrong' : q.hintUsed ? 'hinted' : 'correct';
    saved = { ...saved, letterStats: recordAnswer(saved.letterStats, q.letter.id, outcome, now()) };
    persist();
    renderStatsPanel();
    board.querySelectorAll<HTMLButtonElement>('[data-answer]').forEach((b) => {
      b.disabled = true;
      const n = Number(b.dataset.answer);
      if (n === q.letter.id) b.classList.add('correct');
      else if (n === value) b.classList.add('wrong');
    });
    if (typing) {
      const field = required<HTMLInputElement>('#letter-name');
      field.readOnly = true;
      field.classList.add(ok ? 'correct' : 'wrong');
      required<HTMLButtonElement>('#name-form button').disabled = true;
    }
    updateScores();
    required<HTMLElement>('#hint').hidden = true;
    required<HTMLElement>('#hinttext').hidden = true;
    required('#response').innerHTML = `<div class="feedback ${ok ? 'good' : 'bad'}"><strong>${ok ? (q.hintUsed ? 'Верно, с подсказкой!' : 'Верно, самостоятельно!') : 'Запомним на следующий раз:'} ${q.letter.name} ${glyph(q.letter, 'print')}</strong>${q.letter.sound}<div class="feedback-actions"><button id="next" class="primary">${nextLabel()}</button><button id="pause" class="pause" aria-label="Остановить автоматический переход">Пауза</button></div></div>`;
    updateAnswerForms();
    const next = required<HTMLButtonElement>('#next');
    const pause = required<HTMLButtonElement>('#pause');
    next.onclick = nextQuestion;
    pause.onclick = () => {
      cancelAdvance();
      next.textContent = nextLabel();
      pause.textContent = 'На паузе';
      pause.disabled = true;
    };
    configureAdvance();
    if (typing) next.focus({ preventScroll: true });
  }

  function renderResult() {
    const unique = [...new Map([...misses, ...questions.filter((q) => q.hintUsed).map((q) => q.letter)].map((l) => [l.id, l])).values()];
    board.innerHTML = `<div class="result"><div class="result-icon" aria-hidden="true">${score >= 8 ? '✦' : 'א'}</div><h2>${score === ROUND_LENGTH ? 'Все буквы узнаны!' : score >= 7 ? 'Отличный раунд!' : 'Ещё немного практики'}</h2><div class="big-score">${score}<span class="sub"> / ${ROUND_LENGTH}</span></div><div class="result-stats"><span>Самостоятельно: <b>${score}</b></span><span>С подсказкой: <b>${hintedScore}</b></span><span>Ошибки: <b>${misses.length}</b></span></div><p>${score === ROUND_LENGTH ? 'Попробуй письменные буквы или следующий набор.' : 'Каждая попытка помогает запомнить форму.<br>Можно повторить раунд без спешки.'}</p><button class="primary" id="again">Сыграть ещё раз</button>${unique.length ? `<div class="review"><strong>Буквы для повторения</strong><p>${unique.map((l) => `<span>${glyph(l, 'print')} ${l.name}</span>`).join('')}</p><button class="hint" id="review">Рассмотреть в алфавите</button></div>` : ''}</div>`;
    required<HTMLButtonElement>('#again').onclick = begin;
    const r = document.querySelector<HTMLButtonElement>('#review');
    if (r)
      r.onclick = () => {
        selected = unique[0]?.id ?? 0;
        navigate('alphabet');
      };
  }

  function letterCards(list: Letter[]) {
    return `<div class="alphabet-grid">${list.map((x) => `<button class="letter-card ${x.id === selected ? 'selected' : ''}" data-letter="${x.id}" aria-label="${x.name}" aria-pressed="${x.id === selected}"><span class="forms">${glyph(x, 'print')}${glyph(x, 'hand')}</span><small>${x.name}</small></button>`).join('')}</div>`;
  }

  function letterChips(list: Letter[]) {
    return list.map((x) => `<button class="letter-chip" data-letter="${x.id}">${glyph(x, 'print')} ${x.name}</button>`).join(' ');
  }

  function detailHtml(l: Letter) {
    const d = letterDetails(l);
    const final = l.id >= BASE_LETTER_COUNT;
    const word = [...d.example.word].map((c) => (c === l.char ? `<b>${c}</b>` : c)).join('');
    const facts = [
      `<dt>Как звучит</dt><dd>${l.sound}</dd>`,
      `<dt>Пример</dt><dd><span class="example-word" lang="he" dir="rtl">${word}</span> ${d.example.transcription} — «${d.example.translation}»</dd>`,
      d.order ? `<dt>Место в алфавите</dt><dd>${d.order}-я буква из ${BASE_LETTER_COUNT}</dd>` : '',
      `<dt>Числовое значение</dt><dd>${d.value}${final ? ', как у обычной формы' : ''}</dd>`,
      d.pair ? `<dt>${final ? 'Обычная форма' : 'Конечная форма'}</dt><dd>${letterChips([d.pair])}</dd>` : '',
      d.similar.length ? `<dt>Похожи на вид</dt><dd>${letterChips(d.similar)}</dd>` : '',
      d.soundsLike.length ? `<dt>Звучат так же</dt><dd>${letterChips(d.soundsLike)}</dd>` : '',
    ].join('');
    return `<div class="detail" aria-live="polite"><h3>${l.name} <span class="hebrew-name" lang="he" dir="rtl">${d.hebrewName}</span></h3><div class="both"><div>${glyph(l, 'print', 'glyph')}<small>печатная</small></div><div>${glyph(l, 'hand', 'glyph')}<small>письменная</small></div></div><p>${l.hint}</p><dl class="facts">${facts}</dl></div>`;
  }

  function renderAlphabet() {
    const l = letters[selected] ?? letters[0]!;
    board.innerHTML = `<div class="round-head"><span>Твой справочник</span><span class="pill">${BASE_LETTER_COUNT} БУКВЫ + ${letters.length - BASE_LETTER_COUNT} КОНЕЧНЫХ</span></div><h2>Печатная + письменная</h2><p class="sub">Нажми на букву: узнай её название, звук и пример слова.</p>${letterCards(letters.slice(0, BASE_LETTER_COUNT))}<h3 class="alphabet-section">Конечные формы</h3>${letterCards(letters.slice(BASE_LETTER_COUNT))}${detailHtml(l)}<p class="sub">Бет/вет, каф/хаф, пей/фей и шин/син — варианты звучания одной буквы. В игре мы используем её основное название. Почерк от руки может немного отличаться от образца.</p>`;
    board.querySelectorAll<HTMLElement>('[data-letter]').forEach(
      (b) =>
        (b.onclick = () => {
          selected = Number(b.dataset.letter);
          renderAlphabet();
        }),
    );
    if (!handReady) fontNotice();
  }

  function navigate(v: View) {
    view = v;
    begin();
    if (location.hash !== hashForView(v)) location.hash = hashForView(v);
  }

  function onHashChange() {
    const v = viewFromHash(location.hash);
    if (v === view) return;
    view = v;
    begin();
  }

  window.addEventListener('hashchange', onHashChange);
  group.onchange = () => {
    saveSettings();
    begin();
  };
  script.onchange = () => {
    saveSettings();
    begin();
  };
  showAnswerForms.onchange = () => {
    saveSettings();
    updateAnswerForms();
  };
  autoNext.onchange = () => {
    saveSettings();
    configureAdvance();
  };
  const resetButton = required<HTMLButtonElement>('#reset-stats');
  const resetDialog = required<HTMLElement>('#reset-dialog');
  resetButton.onclick = () => {
    resetButton.hidden = true;
    resetDialog.innerHTML = '<p class="reset-question">Удалить статистику по буквам и результаты раундов? Настройки останутся.</p><div class="reset-actions"><button type="button" id="reset-confirm" class="reset-confirm">Сбросить</button><button type="button" id="reset-cancel" class="reset-button">Отмена</button></div>';
    required<HTMLButtonElement>('#reset-confirm').onclick = () => {
      saved = resetStats(saved);
      persist();
      renderStatsPanel();
      resetDialog.innerHTML = '<p class="reset-question">Статистика сброшена.</p>';
      resetButton.hidden = false;
    };
    const cancel = required<HTMLButtonElement>('#reset-cancel');
    cancel.onclick = () => {
      resetDialog.innerHTML = '';
      resetButton.hidden = false;
      resetButton.focus();
    };
    cancel.focus();
  };
  const settingsToggle = required<HTMLButtonElement>('#settings-toggle');
  settingsToggle.onclick = () => {
    const open = settingsToggle.getAttribute('aria-expanded') !== 'true';
    settingsToggle.setAttribute('aria-expanded', String(open));
    required('#settings-panel').classList.toggle('is-open', open);
  };
  function onKeyDown(e: KeyboardEvent) {
    if (!(e.target instanceof Element) || e.target.matches('select,input,textarea') || e.ctrlKey || e.altKey || e.metaKey) return;
    if (['1', '2', '3', '4'].includes(e.key) && (view === 'quiz' || view === 'pairs') && index < ROUND_LENGTH && !answered) {
      const b = board.querySelectorAll<HTMLButtonElement>('[data-answer]')[Number(e.key) - 1];
      if (b && !b.disabled) b.click();
    }
  }
  document.addEventListener('keydown', onKeyDown);

  begin();
  loadHandwritingFont();
  registerModelContextTools();
  return () => {
    cancelAdvance();
    window.removeEventListener('hashchange', onHashChange);
    document.removeEventListener('keydown', onKeyDown);
  };

  function loadHandwritingFont() {
    if (!document.fonts?.load) {
      handReady = true;
      return;
    }
    document.fonts
      .load('40px HebrewHand', 'אבג')
      .then((fonts) => {
        if (!fonts.length) throw new Error('Font unavailable');
        handReady = true;
        if (!answered) render();
        else updateAnswerForms();
      })
      .catch(() => {
        const n = document.createElement('p');
        n.className = 'error';
        n.textContent = 'Не удалось загрузить письменный шрифт. Обнови страницу. Печатные буквы доступны для тренировки.';
        board.querySelectorAll('.error').forEach((e) => e.remove());
        board.prepend(n);
      });
  }

  function registerModelContextTools() {
    const modelContext = (document as Document & { modelContext?: { registerTool?: (tool: unknown) => unknown } }).modelContext;
    if (!modelContext?.registerTool) return;
    const tools = [
      {
        name: 'read_alphabet_game',
        description: 'Read the current Hebrew alphabet exercise state.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: () => ({
          view, group: group.value, script: script.value, question: index < ROUND_LENGTH ? index + 1 : null,
          score, hintedScore, errors: misses.length, hintUsed: questions[index]?.hintUsed ?? false, answered,
        }),
      },
      {
        name: 'start_alphabet_round',
        description: 'Start a new 10-question round and reset the current round score.',
        inputSchema: { type: 'object', properties: { mode: { type: 'string', enum: ['quiz', 'pairs', 'typed'] } }, required: ['mode'], additionalProperties: false },
        execute: (input: { mode?: unknown } | undefined) => {
          if (!input || !['quiz', 'pairs', 'typed'].includes(String(input.mode))) throw new Error('mode must be quiz, pairs or typed');
          navigate(input.mode as Mode);
          return { view, question: 1, score };
        },
      },
    ];
    for (const t of tools) {
      try {
        Promise.resolve(modelContext.registerTool(t)).catch(() => {});
      } catch {
        // Registration is optional.
      }
    }
  }
}
