import { getLang, t } from '../i18n';

const NAMES = {
  he: {
    days: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],
    short: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'],
    months: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'],
  },
  en: {
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    short: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  },
  ar: {
    days: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
    short: ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'],
    months: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  },
};

const names = () => NAMES[getLang()];
export const dayNamesShort = () => names().short;
export const monthName = (m: number) => names().months[m];

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

/** "יום שלישי, 19 באוקטובר 2026" / "Tuesday, October 19, 2026" / "الثلاثاء، 19 أكتوبر 2026" */
export function formatLongDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const n = names();
  const [day, month, num, year] = [n.days[date.getDay()], n.months[date.getMonth()], date.getDate(), date.getFullYear()];
  switch (getLang()) {
    case 'en':
      return `${day}, ${month} ${num}, ${year}`;
    case 'ar':
      return `${day}، ${num} ${month} ${year}`;
    default:
      return `יום ${day}, ${num} ב${month} ${year}`;
  }
}

/** "19 באוקטובר 2026" / "October 19, 2026" / "19 أكتوبر 2026" */
export function formatShortDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const [month, num, year] = [names().months[date.getMonth()], date.getDate(), date.getFullYear()];
  switch (getLang()) {
    case 'en':
      return `${month} ${num}, ${year}`;
    case 'ar':
      return `${num} ${month} ${year}`;
    default:
      return `${num} ב${month} ${year}`;
  }
}

export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function relativeDay(d: Date | string): string {
  const key = dayKey(d);
  const today = new Date();
  if (key === dayKey(today)) return t('היום');
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (key === dayKey(y)) return t('אתמול');
  return formatShortDate(d);
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return t('לילה טוב');
  if (h < 12) return t('בוקר טוב');
  if (h < 17) return t('צהריים טובים');
  if (h < 21) return t('ערב טוב');
  return t('לילה טוב');
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
