import { markByKey, type Mark, type Vowel } from './nikud';
import type { PrintFont, Script } from './round';
import { shuffle, type Random } from './selection';

export interface Syllable {
  /** First letter, vowel (with ו or י for a full vowel) and last letter, NFC-normalized. */
  word: string;
  /** Reading in Russian letters, e.g. «гаг». */
  reading: string;
  vowel: Mark;
  first: string;
  last: string;
  /** First letter, vowel and last letter with their sounds, for the explanation; '' is a silent letter. */
  parts: [text: string, sound: string][];
}

export interface ReadingWord extends Syllable {
  translation: string;
}

export interface ReadingQuestion extends ReadingWord {
  options: string[];
  type: 'print' | 'hand';
  font: PrintFont;
  hintUsed: boolean;
  correct?: boolean;
}

/**
 * Letters that start a word, with the sound a careless reader may give instead:
 * the letter without its dot or a look-alike letter. ב, כ, פ (and ג, ד, ת) take a dagesh
 * at the start of a word; א and ע are silent.
 */
const firsts: [char: string, sound: string, confusedWith: string | undefined][] = [
  ['א', '', undefined], ['בּ', 'б', 'в'], ['גּ', 'г', 'н'], ['דּ', 'д', 'р'], ['ה', 'х', undefined], ['ז', 'з', 'в'],
  ['ח', 'х', 'т'], ['ט', 'т', undefined], ['י', 'й', undefined], ['כּ', 'к', 'х'], ['ל', 'л', undefined], ['מ', 'м', undefined],
  ['נ', 'н', 'г'], ['ס', 'с', undefined], ['ע', '', undefined], ['פּ', 'п', 'ф'], ['צ', 'ц', undefined], ['ק', 'к', undefined],
  ['ר', 'р', 'д'], ['שׁ', 'ш', 'с'], ['שׂ', 'с', 'ш'], ['תּ', 'т', 'х'],
];

/**
 * Letters that end a word, in final form. Final kaf keeps its shva; ה, א and ע after a vowel are silent.
 * Final ח is left out: after most vowels it needs a furtive patah.
 */
const lasts: [char: string, sound: string][] = [
  ['א', ''], ['ב', 'в'], ['ג', 'г'], ['ד', 'д'], ['ה', ''], ['ז', 'з'], ['ט', 'т'], ['ךְ', 'х'], ['ל', 'ль'], ['ם', 'м'],
  ['ן', 'н'], ['ס', 'с'], ['ע', ''], ['ף', 'ф'], ['ץ', 'ц'], ['ק', 'к'], ['ר', 'р'], ['שׁ', 'ш'], ['ת', 'т'],
];

/** Short real words: first letter, vowel, last letter, translation. */
const words: [first: string, vowel: string, last: string, translation: string][] = [
  ['דּ', 'kamatz', 'ג', 'рыба'], ['ז', 'kamatz', 'ז', 'двигается'], ['י', 'kamatz', 'ד', 'рука'],
  ['י', 'kamatz', 'ם', 'море'], ['דּ', 'kamatz', 'ם', 'кровь'], ['ק', 'kamatz', 'ם', 'встал'], ['שׁ', 'kamatz', 'ם', 'там'],
  ['ר', 'kamatz', 'ץ', 'бежит'], ['ט', 'kamatz', 'ס', 'летит (на самолёте)'], ['גּ', 'kamatz', 'ר', 'живёт'], ['שׁ', 'kamatz', 'ר', 'поёт'],
  ['מ', 'kamatz', 'ה', 'что'], ['ל', 'kamatz', 'ךְ', 'тебе (ж. р.)'], ['ח', 'kamatz', 'ג', 'праздник'],
  ['כּ', 'kamatz', 'ךְ', 'так'], ['ע', 'kamatz', 'ף', 'летит (о птице)'], ['בּ', 'kamatz', 'א', 'пришёл'], ['ז', 'kamatz', 'ר', 'чужой'],
  ['ר', 'kamatz', 'ם', 'высокий'], ['שׁ', 'kamatz', 'ב', 'вернулся'],
  ['גּ', 'patah', 'ג', 'крыша'], ['גּ', 'patah', 'ן', 'сад'], ['ח', 'patah', 'ם', 'горячий'], ['ר', 'patah', 'ךְ', 'мягкий'], ['ר', 'patah', 'ק', 'только'],
  ['דּ', 'patah', 'ק', 'тонкий'], ['כּ', 'patah', 'ד', 'кувшин'], ['בּ', 'patah', 'ד', 'ткань'], ['ס', 'patah', 'ל', 'корзина'],
  ['פּ', 'patah', 'ס', 'полоса'], ['ע', 'patah', 'ם', 'народ'], ['א', 'patah', 'ף', 'нос'], ['צ', 'patah', 'ד', 'сторона'],
  ['תּ', 'patah', 'ן', 'шакал'], ['מ', 'patah', 'ס', 'налог'], ['גּ', 'patah', 'ל', 'волна'], ['ט', 'patah', 'ל', 'роса'],
  ['ז', 'patah', 'ךְ', 'чистый'], ['ח', 'patah', 'ד', 'острый'], ['ק', 'patah', 'ל', 'лёгкий'], ['מ', 'patah', 'ר', 'горький'],
  ['ר', 'patah', 'ע', 'плохой'], ['ק', 'patah', 'ר', 'холодный'], ['דּ', 'patah', 'ף', 'страница'], ['כּ', 'patah', 'ף', 'ладонь; ложка'],
  ['בּ', 'patah', 'ת', 'дочь'], ['גּ', 'patah', 'ם', 'тоже'], ['ע', 'patah', 'ל', 'на'], ['ה', 'patah', 'ר', 'гора'],
  ['ע', 'tsere', 'ץ', 'дерево'], ['א', 'tsere', 'ם', 'мать'], ['נ', 'tsere', 'ר', 'свеча'], ['שׁ', 'tsere', 'ם', 'имя'],
  ['בּ', 'tsere', 'ן', 'сын'], ['ל', 'tsere', 'ב', 'сердце'], ['מ', 'tsere', 'ת', 'мёртвый'], ['שׁ', 'tsere', 'ן', 'зуб'],
  ['ח', 'tsere', 'ן', 'обаяние'], ['ק', 'tsere', 'ץ', 'конец'], ['צ', 'tsere', 'ל', 'тень'], ['תּ', 'tsere', 'ן', 'дай'],
  ['ז', 'tsere', 'ר', 'венок'], ['ח', 'tsere', 'ץ', 'стрела'], ['ל', 'tsere', 'ךְ', 'иди'], ['צ', 'tsere', 'א', 'выйди'],
  ['ה', 'tsere', 'ם', 'они'], ['ע', 'tsere', 'ט', 'ручка (для письма)'],
  ['ז', 'segol', 'ה', 'это'], ['פּ', 'segol', 'ה', 'рот'], ['שׂ', 'segol', 'ה', 'ягнёнок'], ['א', 'segol', 'ל', 'к (куда)'],
  ['א', 'hiriq', 'ם', 'если'], ['ע', 'hiriq', 'ם', 'с (вместе)'], ['מ', 'hiriq', 'ן', 'из'],
  ['ל', 'holam', 'א', 'нет'], ['כּ', 'holam', 'ה', 'так'], ['פּ', 'holam', 'ה', 'здесь'], ['ר', 'holam', 'ב', 'большинство'],
  ['ח', 'holam', 'ם', 'жара'], ['ק', 'holam', 'ר', 'холод'], ['ע', 'holam', 'ז', 'сила'], ['דּ', 'holam', 'ב', 'медведь'],
  ['ח', 'holam', 'ק', 'закон'], ['כּ', 'holam', 'ל', 'весь, всё'], ['תּ', 'holam', 'ף', 'бубен'], ['ר', 'holam', 'ךְ', 'мягкость'],
  ['ט', 'holamMale', 'ב', 'хороший'], ['דּ', 'holamMale', 'ד', 'дядя'], ['ק', 'holamMale', 'ל', 'голос'], ['י', 'holamMale', 'ם', 'день'],
  ['ס', 'holamMale', 'ף', 'конец'], ['ח', 'holamMale', 'ף', 'пляж'], ['שׁ', 'holamMale', 'ר', 'бык'], ['ע', 'holamMale', 'ף', 'курица'],
  ['א', 'holamMale', 'ר', 'свет'], ['ח', 'holamMale', 'ל', 'песок'], ['גּ', 'holamMale', 'ר', 'щенок'], ['ק', 'holamMale', 'ף', 'обезьяна'],
  ['ס', 'shuruk', 'ס', 'лошадь'], ['ח', 'shuruk', 'ם', 'коричневый'], ['ק', 'shuruk', 'ם', 'встань'], ['שׁ', 'shuruk', 'ק', 'рынок'],
  ['צ', 'shuruk', 'ר', 'скала'], ['דּ', 'shuruk', 'ד', 'бойлер'], ['גּ', 'shuruk', 'ף', 'тело'], ['ר', 'shuruk', 'ץ', 'беги'],
  ['ז', 'shuruk', 'ז', 'подвинься'], ['ח', 'shuruk', 'ט', 'нитка'], ['תּ', 'shuruk', 'ת', 'клубника'], ['בּ', 'shuruk', 'ל', 'почтовая марка'],
  ['שׁ', 'shuruk', 'ם', 'чеснок'],
  ['שׁ', 'hiriqMale', 'ר', 'песня'], ['ע', 'hiriqMale', 'ר', 'город'], ['גּ', 'hiriqMale', 'ל', 'возраст'], ['תּ', 'hiriqMale', 'ק', 'сумка'],
  ['כּ', 'hiriqMale', 'ס', 'карман'], ['ס', 'hiriqMale', 'ר', 'кастрюля'], ['מ', 'hiriqMale', 'ץ', 'сок'], ['פּ', 'hiriqMale', 'ל', 'слон'],
  ['ט', 'hiriqMale', 'ל', 'ракета'], ['דּ', 'hiriqMale', 'ן', 'суд, закон'],
];

const yot: Record<Vowel, string> = { а: 'я', э: 'е', и: 'йи', о: 'йо', у: 'ю' };

/** Consonant and vowel in Russian spelling: «я» for «йа», «е» for «э» after a consonant. */
function onset(consonant: string, vowel: Vowel): string {
  if (consonant === 'й') return yot[vowel];
  if (!consonant) return vowel;
  return consonant + (vowel === 'э' ? 'е' : vowel);
}

function find<T extends [string, ...unknown[]]>(rows: readonly T[], char: string): T {
  const row = rows.find(([c]) => c === char);
  if (!row) throw new Error(`Нет буквы ${char}`);
  return row;
}

function vowelOf(mark: Mark): Vowel {
  if (!mark.vowel) throw new Error(`Знак ${mark.name} не гласный`);
  return mark.vowel;
}

export function syllable(first: string, vowel: Mark, last: string): Syllable {
  const [, firstSound] = find(firsts, first);
  const [, lastSound] = find(lasts, last);
  return {
    word: (first + vowel.sign + last).normalize('NFC'),
    reading: onset(firstSound, vowelOf(vowel)) + lastSound,
    vowel,
    first,
    last,
    parts: [[first, firstSound], [vowel.name, vowelOf(vowel)], [last, lastSound]],
  };
}

export const readingWords: ReadingWord[] = words.map(([first, vowel, last, translation]) => ({ ...syllable(first, markByKey(vowel), last), translation }));

const vowelSounds: Vowel[] = ['а', 'э', 'и', 'о', 'у'];

/** Correct reading, two with the same consonants and another vowel, and one more of either kind. */
function options(w: ReadingWord, rng: Random): string[] {
  const [, firstSound, confusedWith] = find(firsts, w.first);
  const [, lastSound] = find(lasts, w.last);
  const own = vowelOf(w.vowel);
  const vowelSwaps = shuffle(vowelSounds.filter((v) => v !== own), rng).map((v) => onset(firstSound, v) + lastSound);
  const consonantSwaps = confusedWith ? [onset(confusedWith, own) + lastSound] : [];
  const wrong = [...vowelSwaps.slice(0, 2), ...shuffle([...vowelSwaps.slice(2), ...consonantSwaps], rng).slice(0, 1)];
  return shuffle([w.reading, ...wrong], rng);
}

/** A round of different words; the vowels go in shuffled passes so that each one appears in a round as long as their number. */
export function createReadingQuestions(count: number, script: Script, rng: Random): ReadingQuestion[] {
  const vowels = [...new Set(readingWords.map((w) => w.vowel))];
  const left = new Set(readingWords);
  const questions: ReadingQuestion[] = [];
  let pass: Mark[] = [];
  while (questions.length < count && left.size) {
    if (!pass.length) pass = shuffle(vowels, rng);
    const vowel = pass.pop()!;
    const [w] = shuffle([...left].filter((x) => x.vowel === vowel), rng);
    if (!w) continue;
    left.delete(w);
    questions.push({
      ...w,
      options: options(w, rng),
      hintUsed: false,
      font: rng() < 0.5 ? 'print-serif' : 'print-sans',
      type: script === 'mixed' ? (rng() < 0.5 ? 'print' : 'hand') : script,
    });
  }
  return questions;
}
