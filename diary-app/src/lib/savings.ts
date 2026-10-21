import { t } from '../i18n';
import { dayKey, formatShortDate } from './dates';
import type { SavingsGoal, SavingsTx, Shift, Workplace } from './types';
import { ratesPay, shiftRates } from './work';

/** "Let's save": progress, pace, how much is still needed and how the shifts help get there. */

export const SAVE_EMOJIS = ['📱', '💻', '🎮', '✈️', '🚗', '👟', '🎧', '🎁', '🏍️', '🎓', '🏠', '🐷'];
export const QUICK_AMOUNTS = [10, 20, 50, 100, 200];
export const MILESTONES = [25, 50, 75, 100];

const DAY = 86400000;

export function goalTx(all: SavingsTx[], goalId: string): SavingsTx[] {
  return all.filter((x) => x.goalId === goalId).sort((a, b) => b.at.localeCompare(a.at));
}

export const sumTx = (txs: SavingsTx[]) => txs.reduce((a, x) => a + x.amount, 0);

export function byMethod(txs: SavingsTx[]): { bank: number; cash: number; other: number } {
  const out = { bank: 0, cash: 0, other: 0 };
  for (const x of txs) out[x.method] += x.amount;
  return out;
}

/** Percent reached, 0..100. */
export const percent = (saved: number, target: number) => (target > 0 ? Math.max(0, Math.min(100, (saved / target) * 100)) : 0);

/** The milestone (25/50/75/100) that this deposit crossed, if any. */
export function crossedMilestone(before: number, after: number, target: number): number | null {
  const a = percent(before, target);
  const b = percent(after, target);
  const hit = MILESTONES.filter((m) => a < m && b >= m);
  return hit.length ? hit[hit.length - 1] : null;
}

/** Saving pace and what is needed to make the deadline. */
export function pace(goal: SavingsGoal, txs: SavingsTx[], now = Date.now()) {
  const saved = sumTx(txs);
  const left = Math.max(0, goal.target - saved);
  const since = Math.min(new Date(goal.createdAt).getTime(), ...txs.map((x) => new Date(x.at).getTime()));
  const days = Math.max(1, (now - since) / DAY);
  const perDay = saved > 0 ? saved / days : 0;
  // A projection from one day of saving means little: wait for a week of history
  const etaDays = perDay > 0 && left > 0 && days >= 7 ? Math.ceil(left / perDay) : null;
  const deadline = goal.deadline ? new Date(`${goal.deadline}T23:59:59`).getTime() : null;
  const daysToDeadline = deadline ? Math.max(0, Math.ceil((deadline - now) / DAY)) : null;
  const perWeekNeeded = daysToDeadline !== null && left > 0 ? left / Math.max(1, daysToDeadline / 7) : null;
  const perDayNeeded = daysToDeadline !== null && left > 0 ? left / Math.max(1, daysToDeadline) : null;
  const onTrack = daysToDeadline === null || left === 0 ? null : etaDays !== null && etaDays <= daysToDeadline;
  return { saved, left, perDay, etaDate: etaDays !== null ? new Date(now + etaDays * DAY) : null, daysToDeadline, perWeekNeeded, perDayNeeded, onTrack };
}

/** Weeks in a row (ending this week or last week) with at least one deposit. */
export function weekStreak(txs: SavingsTx[], now = new Date()): number {
  const weekStart = (d: Date) => dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()));
  const weeks = new Set(txs.filter((x) => x.amount > 0).map((x) => weekStart(new Date(x.at))));
  let streak = 0;
  const cur = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  if (!weeks.has(dayKey(cur))) cur.setDate(cur.getDate() - 7); // this week may still come
  while (weeks.has(dayKey(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 7);
  }
  return streak;
}

/** Average pay of a shift over the last 60 days (needs a wage on the workplace), to say "about N more shifts". */
export function avgShiftPay(shifts: Shift[], workplaces: Workplace[], now = Date.now()): number | null {
  const recent = shifts.filter((s) => now - new Date(s.start).getTime() < 60 * DAY);
  const paid = recent
    .map((s) => {
      const w = workplaces.find((x) => x.id === s.workplaceId);
      return w?.wage ? ratesPay(shiftRates(s, w), w.wage) : null;
    })
    .filter((x): x is number => x !== null);
  return paid.length ? paid.reduce((a, b) => a + b, 0) / paid.length : null;
}

/** This month's estimated earnings from the shift clock. */
export function monthEarnings(shifts: Shift[], workplaces: Workplace[], now = new Date()): number {
  return shifts
    .filter((s) => {
      const d = new Date(s.start);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((a, s) => {
      const w = workplaces.find((x) => x.id === s.workplaceId);
      return a + (w?.wage ? ratesPay(shiftRates(s, w), w.wage) : 0);
    }, 0);
}

export const TIPS = [
  '💡 כלל 10%: מכל משכורת, 10% הולכים ישר לחיסכון — עוד לפני שמוציאים',
  '💡 לפני קנייה לא מתוכננת, חכה 24 שעות. הרבה פעמים הרצון עובר',
  '💡 מזומן בקופסה? צלם אותה פעם בחודש וספור — ככה לא "נעלם" כסף',
  '💡 קפה בחוץ כל יום = בערך ₪400 בחודש. נסה פעמיים בשבוע במקום',
  '💡 קיבלת מתנה בכסף? חצי לחיסכון, חצי לכיף',
  '💡 חיסכון קבוע קטן עדיף על סכום גדול פעם בכמה זמן',
];

export const tipOfTheDay = () => t(TIPS[new Date().getDate() % TIPS.length]);

export const methodLabel = (m: SavingsTx['method']) => (m === 'bank' ? t('🏦 בנק') : m === 'cash' ? t('💵 מזומן') : t('💳 אחר'));

export const shortDate = (iso: string) => formatShortDate(iso);
