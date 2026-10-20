import { describe, expect, it } from 'vitest';
import { BASE_LETTER_COUNT, letters } from './letters';
import { letterDetails } from './reference';

const byChar = (c: string) => letters.find((l) => l.char === c)!;

describe('letterDetails', () => {
  it('has a Hebrew name and an example word containing the letter for every letter', () => {
    for (const l of letters) {
      const d = letterDetails(l);
      expect(d.hebrewName, l.name).not.toBe('');
      expect(d.example.word, l.name).toContain(l.char);
      expect(d.example.transcription, l.name).not.toBe('');
      expect(d.example.translation, l.name).not.toBe('');
    }
  });

  it('puts final forms at the end of their example word', () => {
    for (const l of letters.slice(BASE_LETTER_COUNT)) expect(letterDetails(l).example.word.endsWith(l.char), l.name).toBe(true);
  });

  it('numbers base letters in alphabet order and gives their numeric value', () => {
    expect(letterDetails(byChar('א'))).toMatchObject({ order: 1, value: 1 });
    expect(letterDetails(byChar('י'))).toMatchObject({ order: 10, value: 10 });
    expect(letterDetails(byChar('כ'))).toMatchObject({ order: 11, value: 20 });
    expect(letterDetails(byChar('ק'))).toMatchObject({ order: 19, value: 100 });
    expect(letterDetails(byChar('ת'))).toMatchObject({ order: 22, value: 400 });
  });

  it('gives final forms the value of their base letter and no order number', () => {
    expect(letterDetails(byChar('ם'))).toMatchObject({ order: undefined, value: 40 });
  });

  it('links base letters and final forms to each other', () => {
    expect(letterDetails(byChar('מ')).pair?.char).toBe('ם');
    expect(letterDetails(byChar('ם')).pair?.char).toBe('מ');
    expect(letterDetails(byChar('א')).pair).toBeUndefined();
    const pairs = letters.filter((l) => letterDetails(l).pair);
    expect(pairs).toHaveLength(10);
  });

  it('lists look-alike and sound-alike letters symmetrically', () => {
    expect(letterDetails(byChar('ד')).similar.map((l) => l.char)).toContain('ר');
    expect(letterDetails(byChar('ט')).soundsLike.map((l) => l.char)).toEqual(['ת']);
    for (const l of letters) {
      const d = letterDetails(l);
      for (const s of d.similar) expect(letterDetails(s).similar, `${l.name} ~ ${s.name}`).toContain(l);
      for (const s of d.soundsLike) expect(letterDetails(s).soundsLike, `${l.name} ≈ ${s.name}`).toContain(l);
      expect(d.similar).not.toContain(l);
    }
  });
});
