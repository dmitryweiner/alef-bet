const DAY = 24 * 60 * 60 * 1000;

export function pluralRu(n: number, [one, few, many]: readonly [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function formatAgo(lastSeen: number | null, now: number): string {
  if (lastSeen === null) return 'ещё не встречалась';
  const days = Math.floor((now - lastSeen) / DAY);
  if (days < 1) return 'сегодня';
  return `${days} ${pluralRu(days, ['день', 'дня', 'дней'])} назад`;
}
