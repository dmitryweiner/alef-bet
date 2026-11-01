import { describe, expect, it } from 'vitest';
import { markByKey } from './nikud';
import { createReadingQuestions, readingWords, syllable } from './reading';
import { seededRandom } from './selection';

const nfc = (s: string) => s.normalize('NFC');
const letters = (word: string) => [...word].filter((c) => c >= 'א' && c <= 'ת');
const rounds = (script: 'print' | 'hand' | 'mixed' = 'print') =>
  Array.from({ length: 30 }, (_, seed) => createReadingQuestions(10, script, seededRandom(seed)));
const word = (w: string) => {
  const found = readingWords.find((x) => x.word === nfc(w));
  if (!found) throw new Error(`Нет слова ${w}`);
  return found;
};

describe('syllable', () => {
  it('writes the vowel with the first letter and reads letter by letter', () => {
    expect(syllable('גּ', markByKey('patah'), 'ג')).toMatchObject({ word: nfc('גַּג'), reading: 'гаг' });
    expect(syllable('בּ', markByKey('tsere'), 'ר')).toMatchObject({ word: nfc('בֵּר'), reading: 'бер' });
    expect(syllable('שׂ', markByKey('hiriq'), 'ם')).toMatchObject({ word: nfc('שִׂם'), reading: 'сим' });
    expect(syllable('ס', markByKey('shuruk'), 'ס')).toMatchObject({ word: nfc('סוּס'), reading: 'сус' });
    expect(syllable('שׁ', markByKey('hiriqMale'), 'ר')).toMatchObject({ word: nfc('שִׁיר'), reading: 'шир' });
  });

  it('reads final kaf as «х» and keeps its shva', () => {
    expect(syllable('מ', markByKey('kamatz'), 'ךְ')).toMatchObject({ word: nfc('מָךְ'), reading: 'мах' });
  });

  it('follows Russian spelling: «я», «йо», «э» at the start, «ль» at the end', () => {
    expect(syllable('י', markByKey('kamatz'), 'ד').reading).toBe('яд');
    expect(syllable('י', markByKey('holamMale'), 'ם').reading).toBe('йом');
    expect(syllable('א', markByKey('tsere'), 'ם').reading).toBe('эм');
    expect(syllable('גּ', markByKey('patah'), 'ל').reading).toBe('галь');
  });

  it('does not read silent letters', () => {
    expect(syllable('מ', markByKey('kamatz'), 'ה').reading).toBe('ма');
    expect(syllable('ע', markByKey('hiriqMale'), 'ר').reading).toBe('ир');
  });

  it('explains every part of the reading', () => {
    expect(syllable('דּ', markByKey('kubuts'), 'ב').parts).toEqual([
      ['דּ', 'д'],
      [markByKey('kubuts').name, 'у'],
      ['ב', 'в'],
    ]);
    expect(syllable('ע', markByKey('patah'), 'ם').parts[0]).toEqual(['ע', '']);
  });
});

describe('readingWords', () => {
  it('are real words with a translation', () => {
    expect(word('גַּג')).toMatchObject({ reading: 'гаг', translation: 'крыша' });
    expect(word('זָז')).toMatchObject({ reading: 'заз' });
    expect(word('טוֹב')).toMatchObject({ reading: 'тов', translation: 'хороший' });
    expect(word('יָד')).toMatchObject({ reading: 'яд', translation: 'рука' });
    expect(new Set(readingWords.map((w) => w.word)).size).toBe(readingWords.length);
    for (const w of readingWords) expect(w.translation).toBeTruthy();
  });

  it('have two letters, plus ו or י for a full vowel', () => {
    for (const w of readingWords) {
      const helpers = [...w.vowel.sign].filter((c) => c === 'ו' || c === 'י').length;
      expect(letters(w.word)).toHaveLength(2 + helpers);
      for (const c of w.vowel.sign) expect(w.word).toContain(c);
    }
  });

  it('use final forms at the end and dagesh in ב, כ, פ at the start', () => {
    for (const w of readingWords) {
      const all = letters(w.word);
      expect('כמנפצ').not.toContain(all.at(-1));
      if ('בכפ'.includes(all[0]!)) expect(w.word).toContain('ּ');
    }
  });

  it('never put holam on shin or sin, where the dots merge', () => {
    for (const w of readingWords) if (w.vowel === markByKey('holam')) expect(letters(w.word)[0]).not.toBe('ש');
  });

  it('cover all five vowel sounds', () => {
    expect(new Set(readingWords.map((w) => w.vowel.vowel))).toEqual(new Set(['а', 'э', 'и', 'о', 'у']));
  });
});

describe('createReadingQuestions', () => {
  it('asks only words from the list', () => {
    for (const q of rounds().flat()) expect(word(q.word)).toMatchObject({ reading: q.reading, translation: q.translation });
  });

  it('does not repeat a word within a round and covers every vowel', () => {
    const vowels = new Set(readingWords.map((w) => w.vowel));
    for (const round of rounds()) {
      expect(new Set(round.map((q) => q.word)).size).toBe(10);
      expect(new Set(round.map((q) => q.vowel))).toEqual(vowels);
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
      const [first, , last] = q.parts.map(([, sound]) => sound);
      // «я»/«ю» and words that start or end with a silent letter have no fixed consonant to compare.
      if (!first || first === 'й' || !last) continue;
      const sameConsonants = q.options.filter((o) => o !== q.reading && o.startsWith(first) && o.endsWith(last));
      expect(sameConsonants.length).toBeGreaterThanOrEqual(2);
    }
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
