export const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const HEB_DAYS_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
export const HEB_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local-time YYYY-MM-DD key (not UTC) */
export function dayKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatTimeSeconds(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${formatTime(date)}:${pad(date.getSeconds())}`;
}

/** "יום שלישי, 19 באוקטובר 2026" */
export function formatLongDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `יום ${HEB_DAYS[date.getDay()]}, ${date.getDate()} ב${HEB_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** "19 באוק׳ 2026" */
export function formatShortDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${date.getDate()} ב${HEB_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function relativeDay(d: Date | string): string {
  const key = dayKey(d);
  const today = new Date();
  if (key === dayKey(today)) return 'היום';
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (key === dayKey(y)) return 'אתמול';
  return formatShortDate(d);
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'לילה טוב';
  if (h < 12) return 'בוקר טוב';
  if (h < 17) return 'צהריים טובים';
  if (h < 21) return 'ערב טוב';
  return 'לילה טוב';
}

/** Number of consecutive days (ending today or yesterday) that have at least one entry */
export function computeStreak(dayKeys: Set<string>): number {
  const d = new Date();
  if (!dayKeys.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (dayKeys.has(dayKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export { pad };
