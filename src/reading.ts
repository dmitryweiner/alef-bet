import { markByKey, marks, type Mark, type Vowel } from './nikud';
import type { PrintFont, Script } from './round';
import { shuffle, type Random } from './selection';

export interface Segment {
  /** Letter with its dagesh or shin/sin dot (and the shva of final kaf), NFC-normalized. */
  letter: string;
  /** Vowel or shva of the letter, with ו or י for a full vowel. */
  mark: Mark | undefined;
}

/** A letter or a mark with its sound, for the explanation; '' is silent. */
export interface Part {
  kind: 'letter' | 'mark';
  text: string;
  sound: string;
  /** Patah under a final ח or ע is read before the letter. */
  beforeLetter: boolean;
}

export interface WordReading {
  /** NFC-normalized. */
  word: string;
  /** Reading in Russian letters, e.g. «гаг». */
  reading: string;
  segments: Segment[];
  /** Vowel marks in written order, each once; shva is not a vowel. */
  vowels: Mark[];
  parts: Part[];
}

export interface ReadingWord extends WordReading {
  translation: string;
}

export interface ReadingQuestion extends ReadingWord {
  options: string[];
  type: 'print' | 'hand';
  font: PrintFont;
  hintUsed: boolean;
  correct?: boolean;
}

const DAGESH = 'ּ';
const SHIN_DOT = 'ׁ';
const SIN_DOT = 'ׂ';

/** Sounds without a dagesh; א and ע are silent. */
const sounds: Record<string, string> = {
  א: '', ב: 'в', ג: 'г', ד: 'д', ה: 'х', ו: 'в', ז: 'з', ח: 'х', ט: 'т', י: 'й', כ: 'х', ך: 'х', ל: 'л', מ: 'м', ם: 'м',
  נ: 'н', ן: 'н', ס: 'с', ע: '', פ: 'ф', ף: 'ф', צ: 'ц', ץ: 'ц', ק: 'к', ר: 'р', ת: 'т',
};

/** Dagesh changes the sound only in ב, כ, פ. */
const dageshSounds: Record<string, string> = { ב: 'б', כ: 'к', ך: 'к', פ: 'п', ף: 'п' };

/** The sound a careless reader may give to a look-alike letter. */
const lookAlike: Record<string, string> = { ג: 'н', ד: 'р', ז: 'в', ח: 'т', נ: 'г', ר: 'д', ת: 'х' };

/** Vowel points written on their own, and shva. */
const points = new Map(marks.filter((m) => m.sign.length === 1 && (m.vowel || m.key === 'shva')).map((m) => [m.sign, m]));

const isLetter = (c: string) => c >= 'א' && c <= 'ת';
const isDot = (c: string) => c === DAGESH || c === SHIN_DOT || c === SIN_DOT;

/** Letters with their marks; ו and י of a full vowel join the letter before them. */
function segmentsOf(word: string): Segment[] {
  const clusters: { base: string; signs: string[] }[] = [];
  for (const c of word) {
    if (isLetter(c)) clusters.push({ base: c, signs: [] });
    else if (clusters.length) clusters.at(-1)!.signs.push(c);
    else throw new Error(`Слово ${word} начинается не с буквы`);
  }
  const segments: Segment[] = [];
  for (const { base, signs } of clusters) {
    const prev = segments.at(-1);
    const only = signs.length === 1 ? signs[0] : undefined;
    if (prev && !prev.mark && base === 'ו' && (only === 'ֹ' || only === DAGESH)) {
      prev.mark = markByKey(only === DAGESH ? 'shuruk' : 'holamMale');
      continue;
    }
    if (prev && base === 'י' && !signs.length && (prev.mark?.key === 'hiriq' || prev.mark?.key === 'tsere')) {
      prev.mark = markByKey(`${prev.mark.key}Male`);
      continue;
    }
    const dots = signs.filter(isDot);
    const vowels = signs.filter((s) => !isDot(s));
    if (vowels.length > 1 || vowels.some((s) => !points.has(s))) throw new Error(`Непонятные знаки в слове ${word}`);
    const mark = vowels[0] === undefined ? undefined : points.get(vowels[0]);
    if (base === 'ך' && mark?.key === 'shva') segments.push({ letter: (base + mark.sign).normalize('NFC'), mark: undefined });
    else segments.push({ letter: (base + dots.join('')).normalize('NFC'), mark });
  }
  return segments;
}

function consonant(s: Segment, last: boolean): string {
  const base = s.letter[0]!;
  if (base === 'ש') {
    if (s.letter.includes(SHIN_DOT)) return 'ш';
    if (s.letter.includes(SIN_DOT)) return 'с';
    throw new Error('Буква ש без точки');
  }
  if (s.letter.includes(DAGESH) && dageshSounds[base]) return dageshSounds[base];
  if (base === 'ה' && last && !s.mark) return '';
  if (base === 'ל' && !s.mark?.vowel) return 'ль';
  const sound = sounds[base];
  if (sound === undefined) throw new Error(`Нет буквы ${base}`);
  return sound;
}

/** Patah under a final ח or ע (patah ganuv). */
function furtive(s: Segment, i: number, count: number): boolean {
  return i > 0 && i === count - 1 && s.mark?.key === 'patah' && (s.letter === 'ח' || s.letter === 'ע');
}

/** Another sound for the letter: without or with its dagesh, the other dot of ש, or a look-alike letter. */
function confusion(s: Segment): string | undefined {
  const base = s.letter[0]!;
  if (base === 'ש') return s.letter.includes(SHIN_DOT) ? 'с' : 'ш';
  const withDagesh = dageshSounds[base];
  if (withDagesh) return s.letter.includes(DAGESH) ? sounds[base] : withDagesh;
  return lookAlike[base];
}

const yot: Record<Vowel, string> = { а: 'я', э: 'е', и: 'йи', о: 'йо', у: 'ю' };

/** Consonant and vowel in Russian spelling: «я» for «йа», «е» for «э» after a consonant. */
function onset(consonant: string, vowel: Vowel): string {
  if (consonant === 'й') return yot[vowel];
  if (!consonant) return vowel;
  return consonant + (vowel === 'э' ? 'е' : vowel);
}

/** A change to one letter, for wrong readings. */
interface Change {
  at: number;
  vowel?: Vowel;
  consonant?: string;
}

function spell(segments: Segment[], change?: Change): string {
  return segments
    .map((s, i) => {
      const changed = change?.at === i ? change : undefined;
      const c = changed?.consonant ?? consonant(s, i === segments.length - 1);
      if (furtive(s, i, segments.length)) return 'а' + c;
      const vowel = changed?.vowel ?? s.mark?.vowel;
      return vowel ? onset(c, vowel) : c;
    })
    .join('');
}

export function readWord(word: string): WordReading {
  const nfc = word.normalize('NFC');
  const segments = segmentsOf(nfc);
  const vowels = [...new Set(segments.flatMap((s) => (s.mark?.vowel ? [s.mark] : [])))];
  if (!vowels.length) throw new Error(`В слове ${word} нет гласных`);
  const parts = segments.flatMap((s, i): Part[] => {
    const letter: Part = { kind: 'letter', text: s.letter, sound: consonant(s, i === segments.length - 1), beforeLetter: false };
    if (!s.mark) return [letter];
    return [letter, { kind: 'mark', text: s.mark.name, sound: s.mark.vowel ?? '', beforeLetter: furtive(s, i, segments.length) }];
  });
  return { word: nfc, reading: spell(segments), segments, vowels, parts };
}

export function vowelHint(w: WordReading): string {
  const about = (m: Mark) => `${m.name.toLowerCase()} (${m.place})`;
  const [first] = w.vowels;
  if (w.vowels.length === 1 && first) return `Гласный — ${about(first)}: читается «${first.vowel}».`;
  return `Гласные: ${w.vowels.map((m) => `${about(m)} — читается «${m.vowel}»`).join('; ')}.`;
}

/**
 * Short real words: word with nikud, reading, translation. The reading is checked against the rules in tests.
 * ב, כ, פ take a dagesh at the start of a word; final ח takes a vowel only as patah ganuv.
 */
export const dictionary: readonly [word: string, reading: string, translation: string][] = [
  // One syllable.
  ['דָּג', 'даг', 'рыба'], ['זָז', 'заз', 'двигается'], ['יָד', 'яд', 'рука'], ['יָם', 'ям', 'море'],
  ['דָּם', 'дам', 'кровь'], ['קָם', 'кам', 'встал'], ['שָׁם', 'шам', 'там'], ['רָץ', 'рац', 'бежит'],
  ['טָס', 'тас', 'летит (на самолёте)'], ['גָּר', 'гар', 'живёт'], ['שָׁר', 'шар', 'поёт'], ['מָה', 'ма', 'что'],
  ['לָךְ', 'лах', 'тебе (ж. р.)'], ['חָג', 'хаг', 'праздник'], ['כָּךְ', 'ках', 'так'], ['עָף', 'аф', 'летит (о птице)'],
  ['בָּא', 'ба', 'пришёл'], ['זָר', 'зар', 'чужой'], ['רָם', 'рам', 'высокий'], ['שָׁב', 'шав', 'вернулся'],
  ['גַּג', 'гаг', 'крыша'], ['גַּן', 'ган', 'сад'], ['חַם', 'хам', 'горячий'], ['רַךְ', 'рах', 'мягкий'],
  ['רַק', 'рак', 'только'], ['דַּק', 'дак', 'тонкий'], ['כַּד', 'кад', 'кувшин'], ['בַּד', 'бад', 'ткань'],
  ['סַל', 'саль', 'корзина'], ['פַּס', 'пас', 'полоса'], ['עַם', 'ам', 'народ'], ['אַף', 'аф', 'нос'],
  ['צַד', 'цад', 'сторона'], ['תַּן', 'тан', 'шакал'], ['מַס', 'мас', 'налог'], ['גַּל', 'галь', 'волна'],
  ['טַל', 'таль', 'роса'], ['זַךְ', 'зах', 'чистый'], ['חַד', 'хад', 'острый'], ['קַל', 'каль', 'лёгкий'],
  ['מַר', 'мар', 'горький'], ['רַע', 'ра', 'плохой'], ['קַר', 'кар', 'холодный'], ['דַּף', 'даф', 'страница'],
  ['כַּף', 'каф', 'ладонь; ложка'], ['בַּת', 'бат', 'дочь'], ['גַּם', 'гам', 'тоже'], ['עַל', 'аль', 'на'],
  ['הַר', 'хар', 'гора'],
  ['עֵץ', 'эц', 'дерево'], ['אֵם', 'эм', 'мать'], ['נֵר', 'нер', 'свеча'], ['שֵׁם', 'шем', 'имя'],
  ['בֵּן', 'бен', 'сын'], ['לֵב', 'лев', 'сердце'], ['מֵת', 'мет', 'мёртвый'], ['שֵׁן', 'шен', 'зуб'],
  ['חֵן', 'хен', 'обаяние'], ['קֵץ', 'кец', 'конец'], ['צֵל', 'цель', 'тень'], ['תֵּן', 'тен', 'дай'],
  ['זֵר', 'зер', 'венок'], ['חֵץ', 'хец', 'стрела'], ['לֵךְ', 'лех', 'иди'], ['צֵא', 'це', 'выйди'],
  ['הֵם', 'хем', 'они'], ['עֵט', 'эт', 'ручка (для письма)'],
  ['זֶה', 'зе', 'это'], ['פֶּה', 'пе', 'рот'], ['שֶׂה', 'се', 'ягнёнок'], ['אֶל', 'эль', 'к (куда)'],
  ['אִם', 'им', 'если'], ['עִם', 'им', 'с (вместе)'], ['מִן', 'мин', 'из'],
  ['לֹא', 'ло', 'нет'], ['כֹּה', 'ко', 'так'], ['פֹּה', 'по', 'здесь'], ['רֹב', 'ров', 'большинство'],
  ['חֹם', 'хом', 'жара'], ['קֹר', 'кор', 'холод'], ['עֹז', 'оз', 'сила'], ['דֹּב', 'дов', 'медведь'],
  ['חֹק', 'хок', 'закон'], ['כֹּל', 'коль', 'весь, всё'], ['תֹּף', 'тоф', 'бубен'], ['רֹךְ', 'рох', 'мягкость'],
  ['טוֹב', 'тов', 'хороший'], ['דּוֹד', 'дод', 'дядя'], ['קוֹל', 'коль', 'голос'], ['יוֹם', 'йом', 'день'],
  ['סוֹף', 'соф', 'конец'], ['חוֹף', 'хоф', 'пляж'], ['שׁוֹר', 'шор', 'бык'], ['עוֹף', 'оф', 'курица'],
  ['אוֹר', 'ор', 'свет'], ['חוֹל', 'холь', 'песок'], ['קוֹף', 'коф', 'обезьяна'],
  ['סוּס', 'сус', 'лошадь'], ['חוּם', 'хум', 'коричневый'], ['קוּם', 'кум', 'встань'], ['שׁוּק', 'шук', 'рынок'],
  ['צוּר', 'цур', 'скала'], ['דּוּד', 'дуд', 'бойлер'], ['גּוּף', 'гуф', 'тело'], ['רוּץ', 'руц', 'беги'],
  ['זוּז', 'зуз', 'подвинься'], ['חוּט', 'хут', 'нитка'], ['תּוּת', 'тут', 'клубника'], ['בּוּל', 'буль', 'почтовая марка'],
  ['שׁוּם', 'шум', 'чеснок'], ['גּוּר', 'гур', 'щенок'],
  ['שִׁיר', 'шир', 'песня'], ['עִיר', 'ир', 'город'], ['גִּיל', 'гиль', 'возраст'], ['תִּיק', 'тик', 'сумка'],
  ['כִּיס', 'кис', 'карман'], ['סִיר', 'сир', 'кастрюля'], ['מִיץ', 'миц', 'сок'], ['פִּיל', 'пиль', 'слон'],
  ['טִיל', 'тиль', 'ракета'], ['דִּין', 'дин', 'суд, закон'],
  // Two syllables, «э» or «а» in the second.
  ['יֶלֶד', 'елед', 'мальчик'], ['סֵפֶר', 'сефер', 'книга'], ['כֶּלֶב', 'келев', 'собака'], ['לֶחֶם', 'лехем', 'хлеб'],
  ['דֶּרֶךְ', 'дерех', 'дорога'], ['אֶרֶץ', 'эрец', 'страна, земля'], ['עֶרֶב', 'эрев', 'вечер'], ['בֹּקֶר', 'бокер', 'утро'],
  ['חֶדֶר', 'хедер', 'комната'], ['גֶּשֶׁם', 'гешем', 'дождь'], ['שֶׁמֶשׁ', 'шемеш', 'солнце'], ['מֶלֶךְ', 'мелех', 'король'],
  ['בֶּגֶד', 'бегед', 'одежда'], ['כֶּסֶף', 'кесеф', 'деньги'], ['רֶגֶל', 'регель', 'нога'], ['אֹזֶן', 'озен', 'ухо'],
  ['אֹכֶל', 'охель', 'еда'], ['שֶׁלֶג', 'шелег', 'снег'], ['דֶּלֶת', 'делет', 'дверь'], ['בֶּטֶן', 'бетен', 'живот'],
  ['אֶלֶף', 'элеф', 'тысяча'], ['נַעַר', 'наар', 'юноша'], ['שַׁעַר', 'шаар', 'ворота'], ['פֶּרַח', 'перах', 'цветок'],
  ['מֶלַח', 'мелах', 'соль'], ['בַּיִת', 'байит', 'дом'], ['מַיִם', 'майим', 'вода'], ['עַיִן', 'айин', 'глаз'],
  // Kamatz, then kamatz, patah or tsere.
  ['דָּבָר', 'давар', 'вещь, слово'], ['חָלָב', 'халав', 'молоко'], ['זָהָב', 'захав', 'золото'], ['נָהָר', 'нахар', 'река'],
  ['בָּשָׂר', 'басар', 'мясо'], ['עָנָן', 'анан', 'облако'], ['חָדָשׁ', 'хадаш', 'новый'], ['קָטָן', 'катан', 'маленький'],
  ['לָבָן', 'лаван', 'белый'], ['יָשָׁן', 'яшан', 'старый'], ['רָעֵב', 'раэв', 'голодный'], ['כָּבֵד', 'кавед', 'тяжёлый'],
  ['זָקֵן', 'закен', 'старик'], ['חָבֵר', 'хавер', 'друг'], ['חָזָק', 'хазак', 'сильный'], ['חָכָם', 'хахам', 'умный'],
  ['מָחָר', 'махар', 'завтра'], ['אֶחָד', 'эхад', 'один'],
  // «о» or «у» in the second syllable.
  ['מָקוֹם', 'маком', 'место'], ['שָׁלוֹם', 'шалом', 'мир, привет'], ['גָּדוֹל', 'гадоль', 'большой'], ['חָלוֹם', 'халом', 'сон'],
  ['אָרוֹן', 'арон', 'шкаф'], ['חַלּוֹן', 'халон', 'окно'], ['שָׁעוֹן', 'шаон', 'часы'], ['קָרוֹב', 'каров', 'близкий'],
  ['רָחוֹק', 'рахок', 'далёкий'], ['יָכוֹל', 'яхоль', 'может'], ['כָּחֹל', 'кахоль', 'синий'], ['צָהֹב', 'цахов', 'жёлтый'],
  ['יָרֹק', 'ярок', 'зелёный'], ['אָדֹם', 'адом', 'красный'], ['שָׁחֹר', 'шахор', 'чёрный'], ['נָכוֹן', 'нахон', 'правильно'],
  ['בָּחוּר', 'бахур', 'парень'], ['חָתוּל', 'хатуль', 'кот'], ['כַּדּוּר', 'кадур', 'мяч'], ['סָגוּר', 'сагур', 'закрыто'],
  ['אָסוּר', 'асур', 'запрещено'], ['פָּתוּחַ', 'патуах', 'открыто'], ['תַּפּוּחַ', 'тапуах', 'яблоко'],
  // A silent letter at the end.
  ['יָפֶה', 'яфе', 'красивый'], ['קָשֶׁה', 'каше', 'трудный'], ['תּוֹדָה', 'тода', 'спасибо'], ['שָׁנָה', 'шана', 'год'],
  ['שָׂפָה', 'сафа', 'язык'], ['אַתָּה', 'ата', 'ты (м. р.)'], ['לָמָּה', 'лама', 'почему'], ['כַּמָּה', 'кама', 'сколько'],
  ['מִטָּה', 'мита', 'кровать'], ['סַבָּא', 'саба', 'дедушка'], ['אִמָּא', 'има', 'мама'], ['אַבָּא', 'аба', 'папа'],
  ['כִּסֵּא', 'кисе', 'стул'], ['רוֹצֶה', 'роце', 'хочет'], ['מוֹרֶה', 'море', 'учитель'], ['רוֹפֵא', 'рофе', 'врач'],
  // Verbs.
  ['הוֹלֵךְ', 'холех', 'идёт'], ['יוֹדֵעַ', 'йодеа', 'знает'], ['אוֹהֵב', 'охев', 'любит'], ['מֵבִין', 'мевин', 'понимает'],
  ['כָּתַב', 'катав', 'написал'], ['אָמַר', 'амар', 'сказал'], ['יָשַׁב', 'яшав', 'сидел'], ['אָכַל', 'ахаль', 'ел'],
  // Others.
  ['צָרִיךְ', 'царих', 'нужно'], ['כְּבָר', 'квар', 'уже'], ['זְמַן', 'зман', 'время'], ['מָתַי', 'матай', 'когда'],
  ['אוּלַי', 'улай', 'может быть'], ['תָּמִיד', 'тамид', 'всегда'], ['עוֹלָם', 'олам', 'мир, вселенная'],
];

export const readingWords: ReadingWord[] = dictionary.map(([word, , translation]) => ({ ...readWord(word), translation }));

const vowelSounds: Vowel[] = ['а', 'э', 'и', 'о', 'у'];

/** Correct reading, two with another vowel in one syllable, and one more of either kind or with a look-alike letter. */
function options(w: ReadingWord, rng: Random): string[] {
  const { segments } = w;
  const voiced = segments.flatMap((s, i) => (s.mark?.vowel && !furtive(s, i, segments.length) ? [i] : []));
  const [at] = shuffle(voiced, rng);
  if (at === undefined) throw new Error(`В слове ${w.word} нет гласных`);
  const own = segments[at]!.mark?.vowel;
  const vowelSwaps = shuffle(vowelSounds.filter((v) => v !== own), rng).map((vowel) => spell(segments, { at, vowel }));
  const consonantSwaps = segments.flatMap((s, i) => {
    const consonant = confusion(s);
    return consonant === undefined || furtive(s, i, segments.length) ? [] : [spell(segments, { at: i, consonant })];
  });
  const extra = shuffle([...vowelSwaps.slice(2), ...shuffle(consonantSwaps, rng).slice(0, 1)], rng);
  const wrong = [...new Set([...vowelSwaps.slice(0, 2), ...extra])].filter((r) => r !== w.reading).slice(0, 3);
  return shuffle([w.reading, ...wrong], rng);
}

/** A round of different words; the vowels go in shuffled passes so that each one appears in a round as long as their number. */
export function createReadingQuestions(count: number, script: Script, rng: Random): ReadingQuestion[] {
  const vowels = [...new Set(readingWords.flatMap((w) => w.vowels))];
  const left = new Set(readingWords);
  const questions: ReadingQuestion[] = [];
  let pass: Mark[] = [];
  while (questions.length < count && left.size) {
    if (!pass.length) pass = shuffle(vowels, rng);
    const vowel = pass.pop()!;
    const [w] = shuffle([...left].filter((x) => x.vowels.includes(vowel)), rng);
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
