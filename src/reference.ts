import { BASE_LETTER_COUNT, letters, type Letter } from './letters';

export interface ExampleWord {
  word: string;
  transcription: string;
  translation: string;
}

export interface LetterDetails {
  /** Name of the letter written in Hebrew. */
  hebrewName: string;
  /** Position in the alphabet; final forms have none. */
  order: number | undefined;
  /** Numeric value (гематрия); final forms share the value of their base letter. */
  value: number;
  example: ExampleWord;
  /** Base letter for a final form and vice versa. */
  pair: Letter | undefined;
  /** Letters that are easy to confuse in print. */
  similar: Letter[];
  /** Letters read with the same sound in modern Hebrew. */
  soundsLike: Letter[];
}

const extra: Record<string, [hebrewName: string, word: string, transcription: string, translation: string]> = {
  'א': ['אלף', 'אבא', 'аба', 'папа'],
  'ב': ['בית', 'בית', 'байит', 'дом'],
  'ג': ['גימל', 'גמל', 'гамаль', 'верблюд'],
  'ד': ['דלת', 'דג', 'даг', 'рыба'],
  'ה': ['הא', 'הר', 'хар', 'гора'],
  'ו': ['וו', 'ורד', 'веред', 'роза'],
  'ז': ['זין', 'זאב', 'зеэв', 'волк'],
  'ח': ['חית', 'חלב', 'халав', 'молоко'],
  'ט': ['טית', 'טלפון', 'телефон', 'телефон'],
  'י': ['יוד', 'יד', 'яд', 'рука'],
  'כ': ['כף', 'כלב', 'келев', 'собака'],
  'ל': ['למד', 'לחם', 'лехем', 'хлеб'],
  'מ': ['מם', 'מים', 'маим', 'вода'],
  'נ': ['נון', 'נר', 'нер', 'свеча'],
  'ס': ['סמך', 'ספר', 'сефер', 'книга'],
  'ע': ['עין', 'עין', 'аин', 'глаз'],
  'פ': ['פא', 'פה', 'пе', 'рот'],
  'צ': ['צדי', 'ציפור', 'ципор', 'птица'],
  'ק': ['קוף', 'קוף', 'коф', 'обезьяна'],
  'ר': ['ריש', 'ראש', 'рош', 'голова'],
  'ש': ['שין', 'שמש', 'шемеш', 'солнце'],
  'ת': ['תו', 'תפוח', 'тапуах', 'яблоко'],
  'ך': ['כף סופית', 'מלך', 'мелех', 'король'],
  'ם': ['מם סופית', 'שלום', 'шалом', 'мир, привет'],
  'ן': ['נון סופית', 'גן', 'ган', 'сад'],
  'ף': ['פא סופית', 'כף', 'каф', 'ложка'],
  'ץ': ['צדי סופית', 'עץ', 'эц', 'дерево'],
};

const finals: Record<string, string> = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const lookAlike = ['בכ', 'גנ', 'דר', 'דך', 'רך', 'הח', 'חת', 'הק', 'וז', 'וי', 'ון', 'סם', 'עצ'];
const soundAlike = ['אע', 'בו', 'חכ', 'חך', 'כק', 'טת', 'סש'];

const byChar = (c: string): Letter => {
  const l = letters.find((x) => x.char === c);
  if (!l) throw new Error(`Нет буквы ${c}`);
  return l;
};

function related(pairs: string[], char: string): Letter[] {
  return pairs.flatMap(([a, b]) => (a === char ? [b!] : b === char ? [a!] : [])).map(byChar);
}

function numericValue(order: number): number {
  if (order <= 10) return order;
  if (order <= 19) return (order - 9) * 10;
  return (order - 18) * 100;
}

export function letterDetails(letter: Letter): LetterDetails {
  const info = extra[letter.char];
  if (!info) throw new Error(`Нет справки для буквы ${letter.char}`);
  const [hebrewName, word, transcription, translation] = info;
  const isFinal = letter.id >= BASE_LETTER_COUNT;
  const base = isFinal ? byChar(finals[letter.char]!) : letter;
  const finalChar = Object.keys(finals).find((f) => finals[f] === letter.char);
  return {
    hebrewName,
    order: isFinal ? undefined : letter.id + 1,
    value: numericValue(base.id + 1),
    example: { word, transcription, translation },
    pair: isFinal ? base : finalChar ? byChar(finalChar) : undefined,
    similar: related(lookAlike, letter.char),
    soundsLike: related(soundAlike, letter.char),
  };
}
