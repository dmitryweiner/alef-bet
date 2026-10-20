import { describe, expect, it } from 'vitest';
import { formatAgo, pluralRu } from './format';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 20, 12);

describe('pluralRu', () => {
  it('picks the Russian plural form', () => {
    const forms = ['день', 'дня', 'дней'] as const;
    expect([1, 2, 5, 11, 12, 21, 22, 25, 111].map((n) => pluralRu(n, forms))).toEqual([
      'день', 'дня', 'дней', 'дней', 'дней', 'день', 'дня', 'дней', 'дней',
    ]);
  });
});

describe('formatAgo', () => {
  it('describes how long ago a letter was seen', () => {
    expect(formatAgo(null, NOW)).toBe('ещё не встречалась');
    expect(formatAgo(NOW - 2 * 60 * 60 * 1000, NOW)).toBe('сегодня');
    expect(formatAgo(NOW - DAY, NOW)).toBe('1 день назад');
    expect(formatAgo(NOW - 3 * DAY - 1000, NOW)).toBe('3 дня назад');
    expect(formatAgo(NOW - 40 * DAY, NOW)).toBe('40 дней назад');
  });
});
