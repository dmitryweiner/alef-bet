import { describe, expect, it } from 'vitest';
import { hashForView, viewFromHash } from './routes';

describe('routes', () => {
  it('maps every view to its own hash and back', () => {
    for (const view of ['quiz', 'typed', 'pairs', 'alphabet'] as const) {
      expect(viewFromHash(hashForView(view))).toBe(view);
    }
    expect(new Set(['quiz', 'typed', 'pairs', 'alphabet'].map((v) => hashForView(v as 'quiz'))).size).toBe(4);
  });

  it('uses readable game names', () => {
    expect(hashForView('quiz')).toBe('#guess');
    expect(hashForView('typed')).toBe('#type');
    expect(hashForView('pairs')).toBe('#pairs');
    expect(hashForView('alphabet')).toBe('#alphabet');
  });

  it('accepts a hash with a leading slash and ignores case', () => {
    expect(viewFromHash('#/pairs')).toBe('pairs');
    expect(viewFromHash('#Alphabet')).toBe('alphabet');
  });

  it('falls back to the first game for an empty or unknown hash', () => {
    expect(viewFromHash('')).toBe('quiz');
    expect(viewFromHash('#')).toBe('quiz');
    expect(viewFromHash('#nope')).toBe('quiz');
  });
});
