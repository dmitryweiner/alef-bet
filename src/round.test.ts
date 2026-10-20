import { describe, expect, it } from 'vitest';
import { letters } from './letters';
import { createQuestions } from './round';
import { seededRandom } from './selection';

describe('createQuestions', () => {
  const pool = letters.slice(0, 22);
  const chosen = pool.slice(0, 10);

  it('makes one question per chosen letter with four distinct options including the answer', () => {
    const questions = createQuestions(chosen, pool, 'print', seededRandom(1));
    expect(questions.map((q) => q.letter.id)).toEqual(chosen.map((l) => l.id));
    for (const q of questions) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options.map((o) => o.id)).size).toBe(4);
      expect(q.options.map((o) => o.id)).toContain(q.letter.id);
      for (const o of q.options) expect(pool).toContain(o);
      expect(q.hintUsed).toBe(false);
    }
  });

  it('uses the selected script or mixes them', () => {
    expect(createQuestions(chosen, pool, 'hand', seededRandom(1)).every((q) => q.type === 'hand')).toBe(true);
    const mixed = createQuestions(chosen, pool, 'mixed', seededRandom(2)).map((q) => q.type);
    expect(mixed).toContain('hand');
    expect(mixed).toContain('print');
  });
});
