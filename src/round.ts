import type { Letter } from './letters';
import { shuffle, type Random } from './selection';

export type Script = 'print' | 'hand' | 'mixed';
export type PrintFont = 'print-sans' | 'print-serif';

export interface Question {
  letter: Letter;
  options: Letter[];
  type: 'print' | 'hand';
  font: PrintFont;
  hintUsed: boolean;
  correct?: boolean;
  draft?: string;
}

export const OPTION_COUNT = 4;

export function createQuestions(chosen: readonly Letter[], pool: readonly Letter[], script: Script, rng: Random): Question[] {
  return chosen.map((letter) => ({
    letter,
    hintUsed: false,
    font: rng() < 0.5 ? 'print-serif' : 'print-sans',
    type: script === 'mixed' ? (rng() < 0.5 ? 'print' : 'hand') : script,
    options: shuffle([letter, ...shuffle(pool.filter((x) => x.id !== letter.id), rng).slice(0, OPTION_COUNT - 1)], rng),
  }));
}
