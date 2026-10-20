import { describe, expect, it } from 'vitest';
import { letters } from './letters';
import { matchesName, normalizeName } from './names';

const byChar = (char: string) => {
  const letter = letters.find((l) => l.char === char);
  if (!letter) throw new Error(`no letter ${char}`);
  return letter;
};

describe('normalizeName', () => {
  it('ignores case, ё, dashes and extra spaces', () => {
    expect(normalizeName('  Самёх  ')).toBe('самех');
    expect(normalizeName('КАФ—софит')).toBe('каф софит');
    expect(normalizeName('мем   софит')).toBe('мем софит');
  });
});

describe('matchesName', () => {
  it('accepts the main name and common variants', () => {
    expect(matchesName(byChar('א'), 'Алеф')).toBe(true);
    expect(matchesName(byChar('ב'), 'вет')).toBe(true);
    expect(matchesName(byChar('צ'), 'цадик')).toBe(true);
  });

  it('rejects a name of another letter', () => {
    expect(matchesName(byChar('ד'), 'реш')).toBe(false);
  });

  it('requires «софит» for final forms', () => {
    const finalMem = byChar('ם');
    expect(matchesName(finalMem, 'мем')).toBe(false);
    expect(matchesName(finalMem, 'мем софит')).toBe(true);
    expect(matchesName(finalMem, 'Софит мем')).toBe(true);
    expect(matchesName(finalMem, 'конечная мем')).toBe(true);
    expect(matchesName(byChar('ף'), 'фей-софит')).toBe(true);
  });
});
