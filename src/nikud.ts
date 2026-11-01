import type { ExampleWord } from './reference';

/** Vowel sound in Russian letters, as heard on its own. */
export type Vowel = 'а' | 'э' | 'и' | 'о' | 'у';

/** `full` vowels are written with ו or י; `reduced` are shva and the hataf vowels. */
export type MarkSection = 'vowel' | 'full' | 'reduced' | 'other';

export interface Mark {
  /** Index in `marks`. */
  id: number;
  key: string;
  /** The point itself, with ו or י for full vowels. */
  sign: string;
  name: string;
  hebrewName: string;
  /** The sign on a sample letter, shown on cards. */
  sample: string;
  vowel: Vowel | undefined;
  sound: string;
  /** Where the sign is written relative to the letter. */
  place: string;
  hint: string;
  example: ExampleWord;
  section: MarkSection;
}

export interface MarkDetails {
  /** Marks that are easy to confuse in print. */
  similar: Mark[];
  /** Marks read with the same vowel. */
  soundsLike: Mark[];
}

type Row = [key: string, sign: string, name: string, hebrewName: string, sample: string, vowel: Vowel | undefined, sound: string, place: string, hint: string, example: [word: string, transcription: string, translation: string]];

const sections: Record<MarkSection, Row[]> = {
  vowel: [
    ['kamatz', 'ָ', 'Камац', 'קמץ', 'מָ', 'а', 'Звук «а». В некоторых словах — «о» (камац катан): כָּל — «коль».', 'под буквой', 'Похож на маленькую «т». Сравни с патахом — у него только черта.', ['דָּג', 'даг', 'рыба']],
    ['patah', 'ַ', 'Патах', 'פתח', 'מַ', 'а', 'Звук «а».', 'под буквой', 'Горизонтальная черта под буквой.', ['גַּן', 'ган', 'сад']],
    ['tsere', 'ֵ', 'Цере', 'צירי', 'מֵ', 'э', 'Звук «э».', 'под буквой', 'Две точки рядом, по горизонтали.', ['עֵץ', 'эц', 'дерево']],
    ['segol', 'ֶ', 'Сеголь', 'סגול', 'מֶ', 'э', 'Звук «э».', 'под буквой', 'Три точки треугольником, вершиной вниз.', ['מֶלֶךְ', 'мелех', 'король']],
    ['hiriq', 'ִ', 'Хирик', 'חיריק', 'מִ', 'и', 'Звук «и».', 'под буквой', 'Одна точка под буквой.', ['אִמָּא', 'има', 'мама']],
    ['holam', 'ֹ', 'Холам', 'חולם', 'מֹ', 'о', 'Звук «о».', 'над буквой, слева', 'Одна точка над буквой, у её левого края.', ['לֹא', 'ло', 'нет']],
    ['kubuts', 'ֻ', 'Кубуц', 'קובוץ', 'מֻ', 'у', 'Звук «у».', 'под буквой', 'Три точки наискосок.', ['שֻׁלְחָן', 'шульхан', 'стол']],
  ],
  full: [
    ['holamMale', 'וֹ', 'Холам малэ', 'חולם מלא', 'מוֹ', 'о', 'Звук «о». Буква ו здесь не читается как «в».', 'точка над буквой ו после согласного', 'Буква ו с точкой сверху.', ['שָׁלוֹם', 'шалом', 'мир, привет']],
    ['shuruk', 'וּ', 'Шурук', 'שורוק', 'מוּ', 'у', 'Звук «у». Буква ו здесь не читается как «в».', 'точка внутри буквы ו после согласного', 'Буква ו с точкой сбоку, посередине.', ['סוּס', 'сус', 'лошадь']],
    ['hiriqMale', 'ִי', 'Хирик малэ', 'חיריק מלא', 'מִי', 'и', 'Звук «и». Буква י здесь только показывает гласный.', 'под буквой, а за ней — י', 'Точка под буквой и י после неё.', ['עִיר', 'ир', 'город']],
    ['tsereMale', 'ֵי', 'Цере малэ', 'צירי מלא', 'מֵי', 'э', 'Звук «э», часто «эй».', 'под буквой, а за ней — י', 'Две точки под буквой и י после неё.', ['אֵיךְ', 'эйх', 'как']],
  ],
  reduced: [
    ['shva', 'ְ', 'Шва', 'שווא', 'מְ', undefined, 'Чаще всего гласного нет: буква читается без гласного. Иногда — короткий «э».', 'под буквой', 'Две точки одна над другой.', ['זְמַן', 'зман', 'время']],
    ['hatafPatah', 'ֲ', 'Хатаф-патах', 'חטף פתח', 'אֲ', 'а', 'Звук «а». Ставится под гортанными буквами א, ה, ח, ע.', 'под буквой', 'Шва и патах рядом.', ['חֲמוֹר', 'хамор', 'осёл']],
    ['hatafSegol', 'ֱ', 'Хатаф-сеголь', 'חטף סגול', 'אֱ', 'э', 'Звук «э». Ставится под гортанными буквами, чаще всего под א.', 'под буквой', 'Шва и сеголь рядом.', ['אֱמֶת', 'эмет', 'правда']],
    ['hatafKamatz', 'ֳ', 'Хатаф-камац', 'חטף קמץ', 'אֳ', 'о', 'Звук «о». Встречается редко.', 'под буквой', 'Шва и камац рядом.', ['אֳנִיָּה', 'онийа', 'корабль']],
  ],
  other: [
    ['dagesh', 'ּ', 'Дагеш', 'דגש', 'בּ', undefined, 'В буквах ב, כ, פ меняет звук: בּ — «б», כּ — «к», פּ — «п», а без точки — «в», «х», «ф». В других буквах на чтение почти не влияет. Такая же точка в конечной ה (мапик) показывает, что ה произносится.', 'внутри буквы', 'Точка внутри буквы. В букве ו такая точка — уже шурук.', ['בַּיִת', 'байит', 'дом']],
    ['shinDot', 'ׁ', 'Точка шин', 'שין ימנית', 'שׁ', undefined, 'Буква ש читается «ш».', 'над правым краем ש', 'Точка над правым зубцом ש.', ['שֶׁמֶשׁ', 'шемеш', 'солнце']],
    ['sinDot', 'ׂ', 'Точка син', 'שין שמאלית', 'שׂ', undefined, 'Буква ש читается «с».', 'над левым краем ש', 'Точка над левым зубцом ש.', ['שִׂמְחָה', 'симха', 'радость']],
  ],
};

export const marks: Mark[] = (Object.keys(sections) as MarkSection[])
  .flatMap((section) => sections[section].map((row) => ({ section, row })))
  .map(({ section, row: [key, sign, name, hebrewName, sample, vowel, sound, place, hint, [word, transcription, translation]] }, id) => ({
    id, key, sign, name, hebrewName, sample, vowel, sound, place, hint, example: { word, transcription, translation }, section,
  }));

export function markByKey(key: string): Mark {
  const m = marks.find((x) => x.key === key);
  if (!m) throw new Error(`Нет знака ${key}`);
  return m;
}

const lookAlike = [
  ['kamatz', 'patah'], ['kamatz', 'hatafKamatz'], ['patah', 'hatafPatah'], ['segol', 'hatafSegol'], ['tsere', 'segol'],
  ['tsere', 'shva'], ['segol', 'kubuts'], ['hiriq', 'hiriqMale'], ['tsere', 'tsereMale'], ['holam', 'holamMale'],
  ['holam', 'shinDot'], ['holamMale', 'shuruk'], ['shuruk', 'dagesh'], ['shinDot', 'sinDot'],
];

export function markDetails(mark: Mark): MarkDetails {
  return {
    similar: lookAlike.flatMap(([a, b]) => (a === mark.key ? [b!] : b === mark.key ? [a!] : [])).map(markByKey),
    soundsLike: mark.vowel ? marks.filter((m) => m !== mark && m.vowel === mark.vowel) : [],
  };
}
