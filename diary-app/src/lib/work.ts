import { t } from '../i18n';
import { formatShortDate, formatTime, monthName, pad } from './dates';
import type { Shift, Workplace } from './types';

/** Shift clock maths: worked minutes, monthly totals per workplace, pay and a report for the employer. */

export const WORK_EMOJIS = ['💼', '🏥', '🍔', '☕', '🛒', '🏫', '🧸', '🎬', '🏋️', '💻', '🚚', '🧹'];

/** Minutes worked in a shift, after the break. */
export function shiftMinutes(s: Pick<Shift, 'start' | 'end' | 'breakMin'>): number {
  const m = (new Date(s.end).getTime() - new Date(s.start).getTime()) / 60000 - (s.breakMin ?? 0);
  return Math.max(0, Math.round(m));
}

/** "7:45" — hours and minutes, for totals. */
export const fmtHM = (minutes: number) => `${Math.floor(minutes / 60)}:${pad(Math.round(minutes % 60))}`;

/** "01:23:45" — for the running clock. */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** "16:00–17:00", kept left-to-right inside Hebrew/Arabic text. */
export const timeRange = (start: string, end: string) => `\u2066${formatTime(start)}–${formatTime(end)}\u2069`;

export const money = (n: number) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

/** Start and end of a month (local time). */
export function monthRange(year: number, month: number) {
  return { from: new Date(year, month, 1).getTime(), to: new Date(year, month + 1, 1).getTime() };
}

export function shiftsInMonth(shifts: Shift[], year: number, month: number): Shift[] {
  const { from, to } = monthRange(year, month);
  return shifts
    .filter((s) => {
      const t0 = new Date(s.start).getTime();
      return t0 >= from && t0 < to;
    })
    .sort((a, b) => b.start.localeCompare(a.start));
}

export type PlaceTotal = { place: Workplace | undefined; workplaceId: string; minutes: number; shifts: number; rates: RateMinutes; pay?: number };

export function monthTotals(
  shifts: Shift[],
  workplaces: Workplace[],
): { minutes: number; pay: number; hasPay: boolean; rates: RateMinutes; byPlace: PlaceTotal[] } {
  const map = new Map<string, PlaceTotal>();
  for (const s of shifts) {
    const place = workplaces.find((w) => w.id === s.workplaceId);
    const cur = map.get(s.workplaceId) ?? { place, workplaceId: s.workplaceId, minutes: 0, shifts: 0, rates: {} };
    cur.minutes += shiftMinutes(s);
    cur.shifts += 1;
    cur.rates = addRates(cur.rates, shiftRates(s, place));
    map.set(s.workplaceId, cur);
  }
  const byPlace = [...map.values()].map((p) => ({ ...p, pay: p.place?.wage ? ratesPay(p.rates, p.place.wage) : undefined })).sort((a, b) => b.minutes - a.minutes);
  return {
    minutes: byPlace.reduce((a, p) => a + p.minutes, 0),
    pay: byPlace.reduce((a, p) => a + (p.pay ?? 0), 0),
    hasPay: byPlace.some((p) => p.pay !== undefined),
    rates: byPlace.reduce((a, p) => addRates(a, p.rates), {} as RateMinutes),
    byPlace,
  };
}

/** Builds an ISO start/end from a day and "HH:MM" times; an end before the start means the shift ended after midnight. */
export function makeTimes(day: Date, sh: number, sm: number, eh: number, em: number) {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), sh, sm);
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), eh, em);
  if (end <= start) end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** A plain-text monthly hours report, ready to send to an employer. */
export function monthReportText(name: string, year: number, month: number, shifts: Shift[], workplaces: Workplace[], onlyPlace?: string): string {
  const list = onlyPlace ? shifts.filter((s) => s.workplaceId === onlyPlace) : shifts;
  const totals = monthTotals(list, workplaces);
  const lines = [t('📋 דוח שעות — {month} {year}', { month: monthName(month), year }), name ? t('שם: {name}', { name }) : ''];
  for (const p of totals.byPlace) {
    lines.push('');
    lines.push(`${p.place?.emoji ?? '💼'} ${p.place?.name ?? t('מקום עבודה')}${p.place?.role ? ` · ${p.place.role}` : ''}`);
    const placeShifts = list.filter((s) => s.workplaceId === p.workplaceId).sort((a, b) => a.start.localeCompare(b.start));
    for (const s of placeShifts) {
      const br = s.breakMin ? ` (${t('הפסקה {n} דק׳', { n: s.breakMin })})` : '';
      const r = shiftRates(s, p.place);
      const tags = [overtimeMinutes(r) ? t('נוספות {h}', { h: fmtHM(overtimeMinutes(r)) }) : '', shabbatMinutes(r) ? (s.holiday ? t('חג') : t('שבת')) : ''].filter(Boolean).join(', ');
      lines.push(`• ${formatShortDate(s.start)}  ${timeRange(s.start, s.end)}  = ${fmtHM(shiftMinutes(s))}${br}${tags ? ` [${tags}]` : ''}${s.note ? ` — ${s.note}` : ''}`);
    }
    lines.push(t('סה״כ: {h} שעות ב-{n} משמרות', { h: fmtHM(p.minutes), n: p.shifts }));
    for (const [k, m] of sortedRates(p.rates)) lines.push(`   ${rateLabel(k)}: ${fmtHM(m)}`);
    if (p.pay !== undefined) lines.push(t('שכר משוער: {pay}', { pay: money(p.pay) }));
  }
  if (totals.byPlace.length > 1) {
    lines.push('');
    lines.push(t('סה״כ בכל המקומות: {h} שעות', { h: fmtHM(totals.minutes) }) + (totals.hasPay ? ` · ${money(totals.pay)}` : ''));
  }
  lines.push('');
  lines.push(t('— נוצר באפליקציית "היומן שלי"'));
  return lines.filter((l, i) => l !== '' || lines[i - 1] !== '').join('\n');
}

// ---- Overtime and Shabbat premium ----

export const DEFAULT_OVERTIME = { enabled: true, after: 8 };
export const DEFAULT_SHABBAT = { enabled: true, rate: 150, friFrom: 17, satUntil: 19 };

/** Worked minutes by kind and rate, e.g. { "reg:100": 480, "ot:125": 60, "sh:150": 120, "shot:175": 30 }. */
export type RateMinutes = Record<string, number>;

const rateOf = (key: string) => +key.split(':')[1];

function isShabbat(d: Date, sh: typeof DEFAULT_SHABBAT): boolean {
  const day = d.getDay();
  const h = d.getHours() + d.getMinutes() / 60;
  return (day === 5 && h >= sh.friFrom) || (day === 6 && h < sh.satUntil);
}

/**
 * Splits a shift's worked minutes by pay rate. The break is taken out of the middle of the shift.
 * Rate = (Shabbat/holiday ? Shabbat rate : 100) + (first 2 overtime hours ? 25 : later overtime ? 50 : 0),
 * which gives the usual 125/150 on weekdays and 175/200 on Shabbat.
 */
export function shiftRates(s: Shift, place?: Workplace): RateMinutes {
  const ot = place?.overtime ?? DEFAULT_OVERTIME;
  const sh = place?.shabbat ?? DEFAULT_SHABBAT;
  const start = new Date(s.start).getTime();
  const span = Math.max(0, Math.round((new Date(s.end).getTime() - start) / 60000));
  const brk = Math.min(s.breakMin ?? 0, span);
  const breakFrom = Math.floor((span - brk) / 2);
  const out: RateMinutes = {};
  let worked = 0;
  for (let i = 0; i < span; i++) {
    if (i >= breakFrom && i < breakFrom + brk) continue;
    worked++;
    const special = !!s.holiday || (sh.enabled && isShabbat(new Date(start + i * 60000), sh));
    const over = ot.enabled ? worked - ot.after * 60 : -1;
    const extra = over <= 0 ? 0 : over <= 120 ? 25 : 50;
    const key = `${special ? (extra ? 'shot' : 'sh') : extra ? 'ot' : 'reg'}:${(special ? sh.rate : 100) + extra}`;
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

export function addRates(a: RateMinutes, b: RateMinutes): RateMinutes {
  const out = { ...a };
  for (const [k, m] of Object.entries(b)) out[k] = (out[k] ?? 0) + m;
  return out;
}

/** Pay for minutes at rates, given an hourly wage. */
export const ratesPay = (r: RateMinutes, wage: number) => Object.entries(r).reduce((a, [k, m]) => a + (m / 60) * wage * (rateOf(k) / 100), 0);

export const overtimeMinutes = (r: RateMinutes) => Object.entries(r).reduce((a, [k, m]) => a + (k.startsWith('ot') || k.startsWith('shot') ? m : 0), 0);
export const shabbatMinutes = (r: RateMinutes) => Object.entries(r).reduce((a, [k, m]) => a + (k.startsWith('sh') ? m : 0), 0);

const ORDER = ['reg', 'ot', 'sh', 'shot'];
/** Buckets in a stable order: regular, overtime, Shabbat, Shabbat overtime. */
export const sortedRates = (r: RateMinutes) =>
  Object.entries(r)
    .filter(([, m]) => m > 0)
    .sort(([a], [b]) => ORDER.indexOf(a.split(':')[0]) - ORDER.indexOf(b.split(':')[0]) || rateOf(a) - rateOf(b));

export function rateLabel(key: string): string {
  const [kind, r] = key.split(':');
  if (kind === 'reg') return t('רגילות {r}%', { r });
  if (kind === 'ot') return t('נוספות {r}%', { r });
  if (kind === 'sh') return t('שבת/חג {r}%', { r });
  return t('שבת + נוספות {r}%', { r });
}
