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

export type PlaceTotal = { place: Workplace | undefined; workplaceId: string; minutes: number; shifts: number; pay?: number };

export function monthTotals(shifts: Shift[], workplaces: Workplace[]): { minutes: number; pay: number; hasPay: boolean; byPlace: PlaceTotal[] } {
  const map = new Map<string, PlaceTotal>();
  for (const s of shifts) {
    const cur = map.get(s.workplaceId) ?? { place: workplaces.find((w) => w.id === s.workplaceId), workplaceId: s.workplaceId, minutes: 0, shifts: 0 };
    cur.minutes += shiftMinutes(s);
    cur.shifts += 1;
    map.set(s.workplaceId, cur);
  }
  const byPlace = [...map.values()].map((p) => ({ ...p, pay: p.place?.wage ? (p.minutes / 60) * p.place.wage : undefined })).sort((a, b) => b.minutes - a.minutes);
  return {
    minutes: byPlace.reduce((a, p) => a + p.minutes, 0),
    pay: byPlace.reduce((a, p) => a + (p.pay ?? 0), 0),
    hasPay: byPlace.some((p) => p.pay !== undefined),
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
      lines.push(`• ${formatShortDate(s.start)}  ${timeRange(s.start, s.end)}  = ${fmtHM(shiftMinutes(s))}${br}${s.note ? ` — ${s.note}` : ''}`);
    }
    lines.push(t('סה״כ: {h} שעות ב-{n} משמרות', { h: fmtHM(p.minutes), n: p.shifts }) + (p.pay !== undefined ? ` · ${t('שכר משוער: {pay}', { pay: money(p.pay) })}` : ''));
  }
  if (totals.byPlace.length > 1) {
    lines.push('');
    lines.push(t('סה״כ בכל המקומות: {h} שעות', { h: fmtHM(totals.minutes) }) + (totals.hasPay ? ` · ${money(totals.pay)}` : ''));
  }
  lines.push('');
  lines.push(t('— נוצר באפליקציית "היומן שלי"'));
  return lines.filter((l, i) => l !== '' || lines[i - 1] !== '').join('\n');
}
