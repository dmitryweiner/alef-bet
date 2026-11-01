import { describe, expect, it } from 'vitest';
import { hashForView, isGame, viewFromHash, type View } from './routes';

const views: View[] = ['alphabet', 'nikud', 'quiz', 'typed', 'pairs', 'reading'];

describe('routes', () => {
  it('maps every view to its own hash and back', () => {
    for (const view of views) {
      expect(viewFromHash(hashForView(view))).toBe(view);
    }
    expect(new Set(views.map(hashForView)).size).toBe(views.length);
  });

  it('uses readable game names', () => {
    expect(hashForView('quiz')).toBe('#guess');
    expect(hashForView('typed')).toBe('#type');
    expect(hashForView('pairs')).toBe('#pairs');
    expect(hashForView('alphabet')).toBe('#alphabet');
    expect(hashForView('nikud')).toBe('#nikud');
    expect(hashForView('reading')).toBe('#read');
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

  it('tells games from reference pages', () => {
    expect(views.filter(isGame)).toEqual(['quiz', 'typed', 'pairs', 'reading']);
  });
});
