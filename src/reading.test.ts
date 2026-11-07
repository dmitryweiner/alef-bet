import { describe, expect, it } from 'vitest';
import { markByKey } from './nikud';
import { createReadingQuestions, dictionary, readingWords, readWord, vowelHint } from './reading';
import { seededRandom } from './selection';

const nfc = (s: string) => s.normalize('NFC');
const reads = (w: string) => readWord(w).reading;
const rounds = (script: 'print' | 'hand' | 'mixed' = 'print') =>
  Array.from({ length: 30 }, (_, seed) => createReadingQuestions(10, script, seededRandom(seed)));
const word = (w: string) => {
  const found = readingWords.find((x) => x.word === nfc(w));
  if (!found) throw new Error(`Нет слова ${w}`);
  return found;
};
/** Consonants of a Russian reading: what stays when only vowels change. */
const consonants = (reading: string) => reading.replace(/[аэиоуяеюй]/g, '');

describe('readWord', () => {
  it('reads a short word letter by letter', () => {
    expect(readWord('גַּג')).toMatchObject({ word: nfc('גַּג'), reading: 'гаг' });
    expect(reads('בֵּר')).toBe('бер');
    expect(reads('שִׂם')).toBe('сим');
    expect(reads('סוּס')).toBe('сус');
    expect(reads('שִׁיר')).toBe('шир');
  });

  it('reads words of three letters with two vowels', () => {
    expect(reads('דָּבָר')).toBe('давар');
    expect(reads('שָׁלוֹם')).toBe('шалом');
    expect(reads('בֹּקֶר')).toBe('бокер');
  });

  it('reads final kaf as «х» and keeps its shva', () => {
    expect(readWord('מָךְ')).toMatchObject({ word: nfc('מָךְ'), reading: 'мах' });
    expect(reads('דֶּרֶךְ')).toBe('дерех');
  });

  it('follows Russian spelling: «я», «е», «йо», «э» at the start and after a silent letter', () => {
    expect(reads('יָד')).toBe('яд');
    expect(reads('יוֹם')).toBe('йом');
    expect(reads('יֶלֶד')).toBe('елед');
    expect(reads('אֵם')).toBe('эм');
    expect(reads('כֶּלֶב')).toBe('келев');
    expect(reads('רָעֵב')).toBe('раэв');
  });

  it('reads ל without a vowel as «ль»', () => {
    expect(reads('גַּל')).toBe('галь');
    expect(reads('רֶגֶל')).toBe('регель');
    expect(reads('אָכַל')).toBe('ахаль');
  });

  it('does not read א and ע, nor ה at the end', () => {
    expect(reads('מָה')).toBe('ма');
    expect(reads('עִיר')).toBe('ир');
    expect(reads('יָפֶה')).toBe('яфе');
    expect(reads('אִמָּא')).toBe('има');
    expect(reads('נַעַר')).toBe('наар');
  });

  it('reads ה at the start and in the middle', () => {
    expect(reads('זָהָב')).toBe('захав');
    expect(reads('הוֹלֵךְ')).toBe('холех');
  });

  it('reads ב, כ, פ by their dagesh in any place', () => {
    expect(reads('חָלָב')).toBe('халав');
    expect(reads('סֵפֶר')).toBe('сефер');
    expect(reads('כּוֹכָב')).toBe('кохав');
    expect(reads('סַבָּא')).toBe('саба');
  });

  it('ignores dagesh in other letters', () => {
    expect(reads('חַלּוֹן')).toBe('халон');
    expect(reads('אַתָּה')).toBe('ата');
    expect(reads('כַּדּוּר')).toBe('кадур');
  });

  it('does not read shva at the start of a word', () => {
    expect(reads('זְמַן')).toBe('зман');
    expect(reads('כְּבָר')).toBe('квар');
  });

  it('reads patah under final ח and ע before the letter', () => {
    expect(reads('פָּתוּחַ')).toBe('патуах');
    expect(reads('תַּפּוּחַ')).toBe('тапуах');
    expect(reads('יוֹדֵעַ')).toBe('йодеа');
    expect(reads('פֶּרַח')).toBe('перах');
  });

  it('reads י as «й» after a vowel and as a consonant with its own vowel', () => {
    expect(reads('מָתַי')).toBe('матай');
    expect(reads('אוּלַי')).toBe('улай');
    expect(reads('בַּיִת')).toBe('байит');
    expect(reads('מֵבִין')).toBe('мевин');
  });

  it('explains every letter and mark in written order', () => {
    expect(readWord('יֶלֶד').parts).toEqual([
      { kind: 'letter', text: 'י', sound: 'й', beforeLetter: false },
      { kind: 'mark', text: 'Сеголь', sound: 'э', beforeLetter: false },
      { kind: 'letter', text: 'ל', sound: 'л', beforeLetter: false },
      { kind: 'mark', text: 'Сеголь', sound: 'э', beforeLetter: false },
      { kind: 'letter', text: 'ד', sound: 'д', beforeLetter: false },
    ]);
    expect(readWord('עַם').parts[0]).toMatchObject({ kind: 'letter', text: 'ע', sound: '' });
    expect(readWord('טוֹב').parts[1]).toMatchObject({ kind: 'mark', text: 'Холам малэ', sound: 'о' });
    expect(readWord('זְמַן').parts[1]).toMatchObject({ kind: 'mark', text: 'Шва', sound: '' });
    expect(readWord('מָךְ').parts.at(-1)).toMatchObject({ kind: 'letter', text: nfc('ךְ'), sound: 'х' });
    expect(readWord('פָּתוּחַ').parts.at(-1)).toMatchObject({ kind: 'mark', text: 'Патах', sound: 'а', beforeLetter: true });
  });

  it('lists the vowels of a word once, without shva', () => {
    expect(readWord('דָּבָר').vowels).toEqual([markByKey('kamatz')]);
    expect(readWord('שָׁלוֹם').vowels).toEqual([markByKey('kamatz'), markByKey('holamMale')]);
    expect(readWord('זְמַן').vowels).toEqual([markByKey('patah')]);
  });

  it('refuses a ש without its dot', () => {
    expect(() => readWord('שָם')).toThrow();
  });
});

describe('vowelHint', () => {
  it('names the vowel, where it is written and how it is read', () => {
    expect(vowelHint(readWord('דָּג'))).toBe('Гласный — камац (под буквой): читается «а».');
    expect(vowelHint(readWord('דָּבָר'))).toBe('Гласный — камац (под буквой): читается «а».');
  });

  it('names every vowel of a longer word', () => {
    expect(vowelHint(readWord('בֹּקֶר'))).toBe('Гласные: холам (над буквой, слева) — читается «о»; сеголь (под буквой) — читается «э».');
  });
});

describe('dictionary', () => {
  it('lists readings that follow the rules', () => {
    for (const [w, reading] of dictionary) expect(readWord(w).reading, w).toBe(reading);
  });

  it('are real words with a translation', () => {
    expect(word('גַּג')).toMatchObject({ reading: 'гаг', translation: 'крыша' });
    expect(word('זָז')).toMatchObject({ reading: 'заз' });
    expect(word('טוֹב')).toMatchObject({ reading: 'тов', translation: 'хороший' });
    expect(word('יֶלֶד')).toMatchObject({ reading: 'елед', translation: 'мальчик' });
    expect(new Set(readingWords.map((w) => w.word)).size).toBe(readingWords.length);
    for (const w of readingWords) expect(w.translation).toBeTruthy();
  });

  it('read «гур» for a puppy, with shuruk', () => {
    expect(word('גּוּר')).toMatchObject({ reading: 'гур', translation: 'щенок' });
    expect(readingWords.find((w) => w.word === nfc('גּוֹר'))).toBeUndefined();
  });

  it('have two or three letters, plus ו or י for a full vowel', () => {
    for (const w of readingWords) expect([2, 3], w.word).toContain(w.segments.length);
    expect(readingWords.filter((w) => w.segments.length === 3).length).toBeGreaterThanOrEqual(100);
  });

  it('use final forms only at the end and dagesh in ב, כ, פ at the start', () => {
    for (const w of readingWords) {
      const bases = w.segments.map((s) => s.letter[0]!);
      expect('כמנפצ', w.word).not.toContain(bases.at(-1));
      for (const b of bases.slice(0, -1)) expect('ךםןףץ', w.word).not.toContain(b);
      if ('בכפ'.includes(bases[0]!)) expect(w.segments[0]!.letter, w.word).toContain('ּ');
    }
  });

  it('never put holam on shin or sin, where the dots merge', () => {
    for (const w of readingWords) for (const s of w.segments) if (s.letter[0] === 'ש') expect(s.mark, w.word).not.toBe(markByKey('holam'));
  });

  it('cover all five vowel sounds', () => {
    expect(new Set(readingWords.flatMap((w) => w.vowels.map((v) => v.vowel)))).toEqual(new Set(['а', 'э', 'и', 'о', 'у']));
  });
});

describe('createReadingQuestions', () => {
  it('asks only words from the list', () => {
    for (const q of rounds().flat()) expect(word(q.word)).toMatchObject({ reading: q.reading, translation: q.translation });
  });

  it('does not repeat a word within a round and covers every vowel', () => {
    const vowels = new Set(readingWords.flatMap((w) => w.vowels));
    for (const round of rounds()) {
      expect(new Set(round.map((q) => q.word)).size).toBe(10);
      expect(new Set(round.flatMap((q) => q.vowels))).toEqual(vowels);
    }
  });

  it('offers four different readings, the correct one included', () => {
    for (const q of rounds().flat()) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.reading);
    }
  });

  it('offers at least two readings with the same consonants and another vowel', () => {
    for (const q of rounds().flat()) {
      const sameConsonants = q.options.filter((o) => o !== q.reading && consonants(o) === consonants(q.reading));
      expect(sameConsonants.length, q.word).toBeGreaterThanOrEqual(2);
    }
  });

  it('sometimes offers a reading with a look-alike letter', () => {
    const all = rounds().flat();
    expect(all.some((q) => q.options.some((o) => consonants(o) !== consonants(q.reading)))).toBe(true);
  });

  it('uses the chosen script', () => {
    expect(rounds('hand').flat().every((q) => q.type === 'hand')).toBe(true);
    expect(rounds('print').flat().every((q) => q.type === 'print')).toBe(true);
    expect(new Set(rounds('mixed').flat().map((q) => q.type)).size).toBe(2);
  });

  it('is deterministic for a seed', () => {
    expect(createReadingQuestions(10, 'print', seededRandom(3))).toEqual(createReadingQuestions(10, 'print', seededRandom(3)));
  });
});
