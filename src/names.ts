import { BASE_LETTER_COUNT, type Letter } from './letters';

/** Accepted Russian spellings for each of the 22 base letters, by letter id. */
const nameAliases: string[][] = [
  ['алеф'], ['бет', 'бэт', 'вет', 'вэт'], ['гимель', 'гимел'], ['далет', 'далед'],
  ['хей', 'хе', 'хэй', 'хэ', 'гей', 'ге'], ['вав'], ['заин', 'зайн'], ['хет', 'хэт'], ['тет', 'тэт'],
  ['йод', 'йуд', 'юд', 'иод'], ['каф', 'хаф'], ['ламед', 'ламэд'], ['мем', 'мэм'], ['нун'],
  ['самех', 'самэх'], ['аин', 'айн'], ['пей', 'пэй', 'пе', 'пэ', 'фей', 'фэй', 'фе', 'фэ'],
  ['цади', 'цадик'], ['куф', 'коф'], ['реш', 'рэш'], ['шин', 'син'], ['тав'],
];

/** Base letter ids for the final forms ך ם ן ף ץ. */
const finalBaseIds = [10, 12, 13, 16, 17];

export function normalizeName(value: string): string {
  return String(value).normalize('NFKC').toLowerCase().replace(/ё/g, 'е').replace(/[-‐‑–—]/g, ' ').trim().replace(/\s+/g, ' ');
}

export function matchesName(letter: Letter, value: string): boolean {
  const normalized = normalizeName(value);
  if (letter.id < BASE_LETTER_COUNT) return nameAliases[letter.id]?.includes(normalized) ?? false;
  const baseId = finalBaseIds[letter.id - BASE_LETTER_COUNT];
  if (baseId === undefined) return false;
  return (nameAliases[baseId] ?? []).some((name) =>
    [`${name} софит`, `софит ${name}`, `конечная ${name}`, `${name} конечная`].includes(normalized),
  );
}
