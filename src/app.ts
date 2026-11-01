import { formatAgo, pluralRu } from './format';
import { BASE_LETTER_COUNT, letterPool, letters, type Group, type Letter } from './letters';
import { matchesName, normalizeName } from './names';
import { createQuestions, type Question, type Script } from './round';
import { markDetails, marks, type Mark, type MarkSection } from './nikud';
import { createReadingQuestions, type ReadingQuestion } from './reading';
import { letterDetails } from './reference';
import { hashForView, isGame, viewFromHash, type View } from './routes';
import { ROUND_LENGTH, roundLetters, type Random } from './selection';
import { recordAnswer, staleLetters, weakLetters, type Outcome } from './stats';
import { addResult, loadState, resetStats, saveState, type GameResult, type KeyValueStorage, type Mode, type SavedState } from './storage';

export interface AppOptions {
  storage: KeyValueStorage | null;
  now?: () => number;
  random?: Random;
}

const STATS_LIST_LIMIT = 5;
const modeNames: Record<Mode, string> = { quiz: 'Угадай букву', typed: 'Впиши название', pairs: 'Найди пару', reading: 'Как читать' };


function required<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Не найден элемент ${selector}`);
  return el;
}

function hebrew(text: string, type: 'print' | 'hand', cls = '', attrs = ''): string {
  return `<span lang="he" dir="rtl" class="${type === 'hand' ? 'hand ' : ''}${cls}"${attrs}>${text}</span>`;
}

const sectionNames: Record<MarkSection, string> = {
  vowel: 'Гласные',
  full: `Гласные с буквами ${hebrew('ו', 'print')} и ${hebrew('י', 'print')}`,
  reduced: 'Сокращённые гласные',
  other: 'Другие знаки',
};

function glyph(l: Letter, type: 'print' | 'hand', cls = '', attrs = ''): string {
  return hebrew(l.char, type, cls, attrs);
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
  let readings: ReadingQuestion[] = [];
  let index = 0;
  let score = 0;
  let hintedScore = 0;
  let errors = 0;
  let answered = false;
  let selected = 0;
  let selectedMark = 0;
  let detailOpen = true;
  let handReady = false;
  let advanceTimer: ReturnType<typeof setTimeout> | undefined;

  group.value = saved.settings.group;
  script.value = saved.settings.script;
  autoNext.checked = saved.settings.autoNext;
  showAnswerForms.checked = saved.settings.showAnswerForms;

  const persist = () => saveState(storage, saved);
  const pool = () => letterPool(group.value as Group);
  const roundLength = () => (view === 'reading' ? readings.length : questions.length);
  const currentQuestion = (): Question => {
    const q = questions[index];
    if (!q) throw new Error('Нет текущего вопроса');
    return q;
  };
  const currentReading = (): ReadingQuestion => {
    const q = readings[index];
    if (!q) throw new Error('Нет текущего слова');
    return q;
  };
  const current = () => (view === 'reading' ? currentReading() : currentQuestion());

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
    if (index === roundLength() && isGame(view)) {
      saved = addResult(saved, {
        finishedAt: now(), mode: view, group: group.value as Group, script: script.value as Script,
        score, hinted: hintedScore, errors, total: roundLength(),
      });
      persist();
      renderStatsPanel();
    }
    render();
  }

  function begin() {
    cancelAdvance();
    const g = group.value as Group;
    if (view === 'reading') readings = createReadingQuestions(ROUND_LENGTH, script.value as Script, random);
    else questions = createQuestions(roundLetters(g, saved.letterStats, now(), random), letterPool(g), script.value as Script, random);
    index = 0;
    score = 0;
    hintedScore = 0;
    errors = 0;
    answered = false;
    renderStatsPanel();
    render();
  }

  function roundStatsText() {
    return `Самостоятельно: ${score} · С подсказкой: ${hintedScore} · Ошибки: ${errors}`;
  }

  function updateScores() {
    required('#score').textContent = String(score);
    required('#hinted-score').textContent = String(hintedScore);
    required('#round-total').textContent = String(roundLength());
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
    const best = history.reduce<GameResult | undefined>((b, r) => (!b || r.score / r.total > b.score / b.total ? r : b), undefined);
    const last = history.at(-1);
    statsPanel.innerHTML = `<div class="eyebrow">ТВОЯ СТАТИСТИКА</div><h3>Чаще ошибаешься</h3><div id="weak-letters">${weakLettersHtml()}</div><h3>Давно не встречались</h3><div id="stale-letters">${staleLettersHtml()}</div><p id="games-played" class="stats-games">${history.length ? `Сыграно ${history.length} ${pluralRu(history.length, ['раунд', 'раунда', 'раундов'])} · лучший результат: ${best?.score} из ${best?.total}` : 'Сыгранных раундов пока нет.'}</p>${last ? `<p class="stats-games">Последний: «${modeNames[last.mode]}» — ${last.score} из ${last.total}</p>` : ''}<p class="setting-note">Такие буквы чаще попадают в новый раунд.</p>`;
  }

  function stageHtml() {
    const q = current();
    const font = view !== 'pairs' && q.type === 'print' ? ' ' + q.font : '';
    if ('word' in q) return `${hebrew(q.word, q.type, 'glyph' + font, ` data-reading="${q.reading}"`)}<span class="stage-label">${q.type === 'hand' ? 'письменное' : 'печатное'}</span>`;
    return `${glyph(q.letter, q.type, 'glyph' + font, ` data-letter-id="${q.letter.id}"`)}<span class="stage-label">${q.type === 'hand' ? 'письменная' : 'печатная'}</span>`;
  }

  function roundHead(pill: string) {
    return `<div class="round-head"><span>Вопрос ${index + 1} из ${roundLength()}</span><span class="pill">${pill}</span></div><div class="round-stats" id="round-stats">${roundStatsText()}</div><div class="progress" role="progressbar" aria-label="Пройдено вопросов" aria-valuemin="0" aria-valuemax="${roundLength()}" aria-valuenow="${index}"><div style="width:${(index * 100) / roundLength()}%"></div></div>`;
  }

  function hintHtml(q: { hintUsed: boolean }, text: string) {
    return `<button class="hint" id="hint">Нужна подсказка?</button><p class="hinttext" id="hinttext" ${q.hintUsed ? '' : 'hidden'}>${q.hintUsed ? text : ''}</p>`;
  }

  function wireRound(q: { hintUsed: boolean }, hint: string) {
    board.querySelectorAll<HTMLElement>('[data-answer]').forEach((b) => b.addEventListener('click', () => answer(Number(b.dataset.answer))));
    required<HTMLButtonElement>('#hint').onclick = () => {
      if (answered) return;
      q.hintUsed = true;
      const h = required<HTMLElement>('#hinttext');
      h.hidden = false;
      h.textContent = hint;
    };
  }

  function render() {
    updateScores();
    document.querySelectorAll<HTMLElement>('[data-view]').forEach((b) => {
      b.classList.toggle('active', b.dataset.view === view);
      b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false');
    });
    const reference = !isGame(view);
    const reading = view === 'reading';
    aside.hidden = reference;
    statsPanel.hidden = reference || reading || index < roundLength();
    board.parentElement?.classList.toggle('reference', reference);
    board.parentElement?.classList.toggle('reading', reading);
    group.hidden = reading;
    required<HTMLElement>('label[for="group"]').hidden = reading;
    if (view === 'alphabet') return renderAlphabet();
    if (view === 'nikud') return renderNikud();
    if (index >= roundLength()) return renderResult();
    if (reading) return renderReading();
    const q = currentQuestion();
    const pairing = view === 'pairs';
    const typing = view === 'typed';
    const answers = typing
      ? `<form id="name-form" class="name-form"><label for="letter-name">Название буквы по-русски</label><div class="name-controls"><input id="letter-name" type="text" maxlength="60" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="done" aria-describedby="name-help input-error"><button class="primary" type="submit">Проверить</button></div><p id="name-help" class="input-help">Для конечных форм добавь «софит».</p><p id="input-error" class="input-error" aria-live="polite"></p></form>`
      : `<div class="answers">${q.options.map((l, i) => `<button class="answer ${pairing ? 'hebrew' : ''}" data-answer="${l.id}" aria-label="Вариант ${i + 1}${pairing ? '' : ': ' + l.name}">${pairing ? glyph(l, q.type === 'print' ? 'hand' : 'print') : l.name}<span class="key">${i + 1}</span></button>`).join('')}</div>`;
    board.innerHTML = `${roundHead(pairing ? 'ДВА НАЧЕРТАНИЯ' : typing ? 'ВСПОМНИ НАЗВАНИЕ' : 'ЗНАКОМСТВО С БУКВАМИ')}<div class="prompt"><h2>${pairing ? 'Найди ту же букву' : 'Как называется эта буква?'}</h2><div class="sub">${pairing ? `Выбери ${q.type === 'print' ? 'письменную' : 'печатную'} пару` : typing ? 'Впиши название и нажми «Проверить»' : 'Нажми на правильное название'}</div></div><div class="letter-stage">${stageHtml()}</div>${answers}<div id="response" aria-live="polite"></div>${hintHtml(q, q.letter.gameHint)}`;
    wireRound(q, q.letter.gameHint);
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
    if (!handReady && (pairing || q.type === 'hand')) fontNotice();
  }

  function readingHint(q: ReadingQuestion) {
    return `Гласный — ${q.vowel.name.toLowerCase()} (${q.vowel.place}): читается «${q.vowel.vowel}».`;
  }

  function renderReading() {
    const q = currentReading();
    const answers = q.options.map((o, i) => `<button class="answer" data-answer="${i}" aria-label="Вариант ${i + 1}: ${o}">${o}<span class="key">${i + 1}</span></button>`).join('');
    board.innerHTML = `${roundHead('ЧТЕНИЕ С НЕКУДОТ')}<div class="prompt"><h2>Как читается это слово?</h2><div class="sub">Нажми на правильное чтение</div></div><div class="letter-stage">${stageHtml()}</div><div class="answers">${answers}</div><div id="response" aria-live="polite"></div>${hintHtml(q, readingHint(q))}`;
    wireRound(q, readingHint(q));
    if (!handReady && q.type === 'hand') fontNotice();
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
    if (!container || !answered || !isGame(view) || index >= roundLength()) return;
    const enabled = showAnswerForms.checked;
    container.classList.toggle('show-forms', enabled);
    if (!enabled) {
      container.innerHTML = stageHtml();
      return;
    }
    const q = current();
    const text = 'word' in q ? q.word : q.letter.char;
    container.innerHTML = `<div class="answer-forms-grid"><div>${hebrew(text, 'print', 'glyph print-sans')}<span>Без засечек</span></div><div>${hebrew(text, 'print', 'glyph print-serif')}<span>С засечками</span></div><div>${handReady ? hebrew(text, 'hand', 'glyph') : '<span class="font-pending">Шрифт загружается…</span>'}<span>Рукописная</span></div></div>`;
  }

  function nextLabel() {
    return index === roundLength() - 1 ? 'Результат' : 'Далее';
  }

  function configureAdvance() {
    cancelAdvance();
    if (!answered || index >= roundLength() || !isGame(view)) return;
    const next = document.querySelector<HTMLButtonElement>('#next');
    const pause = document.querySelector<HTMLButtonElement>('#pause');
    if (!next || !pause) return;
    const enabled = autoNext.checked;
    const ok = current().correct;
    next.textContent = nextLabel() + (enabled ? ` · ${ok ? '1,5' : '3'} с` : '');
    pause.hidden = !enabled;
    pause.disabled = false;
    pause.textContent = 'Пауза';
    if (enabled) advanceTimer = setTimeout(nextQuestion, ok ? 1500 : 3000);
  }

  function countAnswer(ok: boolean, hintUsed: boolean) {
    if (!ok) errors++;
    else if (hintUsed) hintedScore++;
    else score++;
  }

  function markAnswers(isCorrect: (n: number) => boolean, chosen: number | string) {
    board.querySelectorAll<HTMLButtonElement>('[data-answer]').forEach((b) => {
      b.disabled = true;
      const n = Number(b.dataset.answer);
      if (isCorrect(n)) b.classList.add('correct');
      else if (n === chosen) b.classList.add('wrong');
    });
  }

  function showFeedback(ok: boolean, hintUsed: boolean, title: string, text: string) {
    updateScores();
    required<HTMLElement>('#hint').hidden = true;
    required<HTMLElement>('#hinttext').hidden = true;
    required('#response').innerHTML = `<div class="feedback ${ok ? 'good' : 'bad'}"><strong>${ok ? (hintUsed ? 'Верно, с подсказкой!' : 'Верно, самостоятельно!') : 'Запомним на следующий раз:'} ${title}</strong>${text}<div class="feedback-actions"><button id="next" class="primary">${nextLabel()}</button><button id="pause" class="pause" aria-label="Остановить автоматический переход">Пауза</button></div></div>`;
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
  }

  function answerReading(choice: number) {
    const q = currentReading();
    const picked = q.options[choice];
    if (picked === undefined) throw new Error('Недопустимый вариант');
    if (!handReady && q.type === 'hand') return;
    answered = true;
    const ok = picked === q.reading;
    q.correct = ok;
    countAnswer(ok, q.hintUsed);
    markAnswers((n) => q.options[n] === q.reading, choice);
    const parts = q.parts.map(([text, sound], i) => `${i === 1 ? text.toLowerCase() : hebrew(text, 'print')} — ${sound ? `«${sound}»` : 'не читается'}`).join(', ');
    showFeedback(ok, q.hintUsed, `${hebrew(q.word, 'print')} — «${q.reading}»`, `<span class="meaning">Перевод: <b>${q.translation}</b></span>${parts}.`);
  }

  function answer(value: number | string) {
    if (answered || index >= roundLength() || !isGame(view)) return;
    if (view === 'reading') return answerReading(Number(value));
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
    countAnswer(ok, q.hintUsed);
    const outcome: Outcome = !ok ? 'wrong' : q.hintUsed ? 'hinted' : 'correct';
    saved = { ...saved, letterStats: recordAnswer(saved.letterStats, q.letter.id, outcome, now()) };
    persist();
    renderStatsPanel();
    markAnswers((n) => n === q.letter.id, value);
    if (typing) {
      const field = required<HTMLInputElement>('#letter-name');
      field.readOnly = true;
      field.classList.add(ok ? 'correct' : 'wrong');
      required<HTMLButtonElement>('#name-form button').disabled = true;
    }
    showFeedback(ok, q.hintUsed, `${q.letter.name} ${glyph(q.letter, 'print')}`, q.letter.sound);
    if (typing) required<HTMLButtonElement>('#next').focus({ preventScroll: true });
  }

  /** Review block of the result screen and what its button opens. */
  function reviewItems(): { html: string; open: () => void } | undefined {
    if (view === 'reading') {
      const words = readings.filter((q) => q.correct === false || q.hintUsed);
      if (!words.length) return undefined;
      return {
        html: `<strong>Слова для повторения</strong><p>${words.map((q) => `<span>${hebrew(q.word, 'print')} ${q.reading} — ${q.translation}</span>`).join('')}</p><button class="hint" id="review">Повторить некудот</button>`,
        open: () => {
          selectedMark = words[0]!.vowel.id;
          navigate('nikud');
        },
      };
    }
    const unique = [...new Map(questions.filter((q) => q.correct === false || q.hintUsed).map((q) => [q.letter.id, q.letter])).values()];
    if (!unique.length) return undefined;
    return {
      html: `<strong>Буквы для повторения</strong><p>${unique.map((l) => `<span>${glyph(l, 'print')} ${l.name}</span>`).join('')}</p><button class="hint" id="review">Рассмотреть в алфавите</button>`,
      open: () => {
        selected = unique[0]!.id;
        navigate('alphabet');
      },
    };
  }

  function renderResult() {
    const total = roundLength();
    const reading = view === 'reading';
    const review = reviewItems();
    const perfect = reading ? 'Все слова прочитаны!' : 'Все буквы узнаны!';
    const next = reading ? 'Попробуй письменное начертание или другую игру.' : 'Попробуй письменные буквы или следующий набор.';
    board.innerHTML = `<div class="result"><div class="result-icon" aria-hidden="true">${score >= 0.8 * total ? '✦' : 'א'}</div><h2>${score === total ? perfect : score >= 0.7 * total ? 'Отличный раунд!' : 'Ещё немного практики'}</h2><div class="big-score">${score}<span class="sub"> / ${total}</span></div><div class="result-stats"><span>Самостоятельно: <b>${score}</b></span><span>С подсказкой: <b>${hintedScore}</b></span><span>Ошибки: <b>${errors}</b></span></div><p>${score === total ? next : 'Каждая попытка помогает запомнить форму.<br>Можно повторить раунд без спешки.'}</p><button class="primary" id="again">Сыграть ещё раз</button>${review ? `<div class="review">${review.html}</div>` : ''}</div>`;
    required<HTMLButtonElement>('#again').onclick = begin;
    const r = document.querySelector<HTMLButtonElement>('#review');
    if (r && review)
      r.onclick = () => {
        detailOpen = true;
        review.open();
      };
  }

  function letterCards(list: Letter[]) {
    const isSelected = (x: Letter) => detailOpen && x.id === selected;
    return `<div class="alphabet-grid">${list.map((x) => `<button class="letter-card ${isSelected(x) ? 'selected' : ''}" data-letter="${x.id}" aria-label="${x.name}" aria-pressed="${isSelected(x)}"><span class="forms">${glyph(x, 'print')}${glyph(x, 'hand')}</span><small>${x.name}</small></button>`).join('')}</div>`;
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
    return `<div class="detail" aria-live="polite"><button type="button" id="detail-close" class="detail-close" aria-label="Закрыть описание">×</button><h3>${l.name} <span class="hebrew-name" lang="he" dir="rtl">${d.hebrewName}</span></h3><div class="both"><div>${glyph(l, 'print', 'glyph')}<small>печатная</small></div><div>${glyph(l, 'hand', 'glyph')}<small>письменная</small></div></div><p>${l.hint}</p><dl class="facts">${facts}</dl></div>`;
  }

  function renderAlphabet() {
    const l = letters[selected] ?? letters[0]!;
    board.innerHTML = `<div class="round-head"><span>Твой справочник</span><span class="pill">${BASE_LETTER_COUNT} БУКВЫ + ${letters.length - BASE_LETTER_COUNT} КОНЕЧНЫХ</span></div><h2>Печатная + письменная</h2><p class="sub">Нажми на букву: узнай её название, звук и пример слова.</p><div class="alphabet-body">${detailOpen ? detailHtml(l) : ''}${letterCards(letters.slice(0, BASE_LETTER_COUNT))}<h3 class="alphabet-section">Конечные формы</h3>${letterCards(letters.slice(BASE_LETTER_COUNT))}</div><p class="sub">Бет/вет, каф/хаф, пей/фей и шин/син — варианты звучания одной буквы. В игре мы используем её основное название. Почерк от руки может немного отличаться от образца.</p>`;
    wireReference('letter', selected, (id) => (selected = id), renderAlphabet);
  }

  /** Card taps open the description of `data-<attr>` items; the close button hides it. */
  function wireReference(attr: 'letter' | 'mark', current: number, choose: (id: number) => void, rerender: () => void) {
    board.querySelectorAll<HTMLElement>(`[data-${attr}]`).forEach(
      (b) =>
        (b.onclick = () => {
          choose(Number(b.getAttribute(`data-${attr}`)));
          detailOpen = true;
          rerender();
          board.querySelector('.detail')?.scrollIntoView?.({ block: 'nearest' });
        }),
    );
    const close = document.querySelector<HTMLButtonElement>('#detail-close');
    if (close)
      close.onclick = () => {
        detailOpen = false;
        rerender();
        board.querySelector<HTMLElement>(`[data-${attr}="${current}"]`)?.focus({ preventScroll: true });
      };
    if (!handReady) fontNotice();
  }

  function markCards(list: Mark[]) {
    const isSelected = (m: Mark) => detailOpen && m.id === selectedMark;
    return `<div class="alphabet-grid">${list.map((m) => `<button class="letter-card ${isSelected(m) ? 'selected' : ''}" data-mark="${m.id}" aria-label="${m.name}" aria-pressed="${isSelected(m)}"><span class="forms">${hebrew(m.sample, 'print')}${hebrew(m.sample, 'hand')}</span><small>${m.name}</small></button>`).join('')}</div>`;
  }

  function markChips(list: Mark[]) {
    return list.map((m) => `<button class="letter-chip" data-mark="${m.id}">${hebrew(m.sample, 'print')} ${m.name}</button>`).join(' ');
  }

  function markDetailHtml(m: Mark) {
    const d = markDetails(m);
    const facts = [
      `<dt>Как читается</dt><dd>${m.sound}</dd>`,
      `<dt>Где пишется</dt><dd>${m.place}</dd>`,
      `<dt>Пример</dt><dd><span class="example-word" lang="he" dir="rtl">${m.example.word}</span> ${m.example.transcription} — «${m.example.translation}»</dd>`,
      d.similar.length ? `<dt>Похожи на вид</dt><dd>${markChips(d.similar)}</dd>` : '',
      d.soundsLike.length ? `<dt>Звучат так же</dt><dd>${markChips(d.soundsLike)}</dd>` : '',
    ].join('');
    return `<div class="detail" aria-live="polite"><button type="button" id="detail-close" class="detail-close" aria-label="Закрыть описание">×</button><h3>${m.name} <span class="hebrew-name" lang="he" dir="rtl">${m.hebrewName}</span></h3><div class="both"><div>${hebrew(m.sample, 'print', 'glyph')}<small>печатная</small></div><div>${hebrew(m.sample, 'hand', 'glyph')}<small>письменная</small></div></div><p>${m.hint}</p><dl class="facts">${facts}</dl></div>`;
  }

  function renderNikud() {
    const m = marks[selectedMark] ?? marks[0]!;
    const vowels = marks.filter((x) => x.section !== 'other').length;
    const sections = (Object.keys(sectionNames) as MarkSection[])
      .map((s) => `<h3 class="alphabet-section">${sectionNames[s]}</h3>${markCards(marks.filter((x) => x.section === s))}`)
      .join('');
    board.innerHTML = `<div class="round-head"><span>Твой справочник</span><span class="pill">${vowels} ГЛАСНЫХ + ${marks.length - vowels} ЗНАКА</span></div><h2>Некудот — огласовки</h2><p class="sub">Нажми на знак: узнай, как он читается, и посмотри пример слова.</p><div class="alphabet-body">${detailOpen ? markDetailHtml(m) : ''}${sections}</div><p class="sub">Буква со знаком читается «согласный + гласный»: ${hebrew('מַ', 'print')} — «ма». В обычных текстах огласовки почти не ставят, но они есть в детских книгах, словарях и учебниках.</p>`;
    wireReference('mark', selectedMark, (id) => (selectedMark = id), renderNikud);
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
    if (['1', '2', '3', '4'].includes(e.key) && (view === 'quiz' || view === 'pairs' || view === 'reading') && index < roundLength() && !answered) {
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
          view, group: group.value, script: script.value, question: index < roundLength() ? index + 1 : null, total: roundLength(),
          score, hintedScore, errors, hintUsed: index < roundLength() ? current().hintUsed : false, answered,
        }),
      },
      {
        name: 'start_alphabet_round',
        description: 'Start a new round (10 questions, or 27 for the whole-alphabet set) and reset the current round score.',
        inputSchema: { type: 'object', properties: { mode: { type: 'string', enum: ['quiz', 'pairs', 'typed', 'reading'] } }, required: ['mode'], additionalProperties: false },
        execute: (input: { mode?: unknown } | undefined) => {
          if (!input || !['quiz', 'pairs', 'typed', 'reading'].includes(String(input.mode))) throw new Error('mode must be quiz, pairs, typed or reading');
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
