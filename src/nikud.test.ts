import { describe, expect, it } from 'vitest';
import { markByKey, markDetails, marks } from './nikud';

const isPoint = (c: string) => c.charCodeAt(0) >= 0x5b0 && c.charCodeAt(0) <= 0x5c7;

describe('nikud marks', () => {
  it('lists every mark once with its index as id', () => {
    expect(marks.length).toBe(18);
    marks.forEach((m, i) => expect(m.id).toBe(i));
    expect(new Set(marks.map((m) => m.key)).size).toBe(marks.length);
  });

  it('writes signs with Hebrew points, plus ו or י for full vowels', () => {
    for (const m of marks) {
      expect([...m.sign].some(isPoint)).toBe(true);
      for (const c of m.sign) expect(isPoint(c) || c === 'ו' || c === 'י').toBe(true);
    }
  });

  it('shows the sign on its sample and in its example word', () => {
    for (const m of marks) {
      expect(m.sample).toContain(m.sign);
      expect(m.example.word).toContain(m.sign);
      expect(m.hebrewName && m.sound && m.place && m.hint && m.example.transcription && m.example.translation).toBeTruthy();
    }
  });

  it('splits the reference into sections', () => {
    const count = (s: string) => marks.filter((m) => m.section === s).length;
    expect([count('vowel'), count('full'), count('reduced'), count('other')]).toEqual([7, 4, 4, 3]);
  });

  it('links look-alike marks both ways', () => {
    for (const m of marks) {
      for (const other of markDetails(m).similar) {
        expect(other).not.toBe(m);
        expect(markDetails(other).similar).toContain(m);
      }
    }
    expect(markDetails(markByKey('kamatz')).similar).toContain(markByKey('patah'));
    expect(markDetails(markByKey('shinDot')).similar).toContain(markByKey('sinDot'));
  });

  it('groups marks read with the same vowel', () => {
    const kamatz = markDetails(markByKey('kamatz')).soundsLike;
    expect(kamatz).toEqual([markByKey('patah'), markByKey('hatafPatah')]);
    expect(markDetails(markByKey('dagesh')).soundsLike).toEqual([]);
    for (const m of marks) for (const other of markDetails(m).soundsLike) expect(other.vowel).toBe(m.vowel);
  });
});
