import type { Mode } from './storage';

export type View = Mode | 'alphabet' | 'nikud';

const slugs: Record<View, string> = { alphabet: 'alphabet', nikud: 'nikud', quiz: 'guess', typed: 'type', pairs: 'pairs', reading: 'read' };

export function hashForView(view: View): string {
  return `#${slugs[view]}`;
}

/** Unknown or empty hashes open the first game. */
export function viewFromHash(hash: string): View {
  const slug = hash.replace(/^#\/?/, '').toLowerCase();
  const found = (Object.keys(slugs) as View[]).find((v) => slugs[v] === slug);
  return found ?? 'quiz';
}

/** Games have rounds and scores; the other views are reference pages. */
export function isGame(view: View): view is Mode {
  return view !== 'alphabet' && view !== 'nikud';
}
