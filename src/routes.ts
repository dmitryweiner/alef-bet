import type { Mode } from './storage';

export type View = Mode | 'alphabet';

const slugs: Record<View, string> = { quiz: 'guess', typed: 'type', pairs: 'pairs', alphabet: 'alphabet' };

export function hashForView(view: View): string {
  return `#${slugs[view]}`;
}

/** Unknown or empty hashes open the first game. */
export function viewFromHash(hash: string): View {
  const slug = hash.replace(/^#\/?/, '').toLowerCase();
  const found = (Object.keys(slugs) as View[]).find((v) => slugs[v] === slug);
  return found ?? 'quiz';
}
