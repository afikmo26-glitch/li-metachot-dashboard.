import { t } from '../i18n';
import { dayKey, parseDayKey } from './dates';
import type { Exam, Homework, StudySession } from './types';

/** "Study with me": subjects, how soon each exam is, and how much was studied. */

export const SUBJECTS = ['מתמטיקה', 'אנגלית', 'לשון', 'היסטוריה', 'תנ״ך', 'ספרות', 'אזרחות', 'ביולוגיה', 'פיזיקה', 'כימיה', 'מדעי המחשב', 'ערבית'];
export const DURATIONS = [15, 25, 45, 60];
const DAY = 86400000;

export function daysUntil(date: string, now = new Date()): number {
  const today = parseDayKey(dayKey(now)).getTime();
  return Math.round((parseDayKey(date).getTime() - today) / DAY);
}

export function whenLabel(date: string): string {
  const d = daysUntil(date);
  if (d === 0) return t('היום!');
  if (d === 1) return t('מחר');
  if (d < 0) return t('עבר');
  return t('בעוד {n} ימים', { n: d });
}

export const upcomingExams = (exams: Exam[]) => exams.filter((e) => daysUntil(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
export const pastExams = (exams: Exam[]) => exams.filter((e) => daysUntil(e.date) < 0).sort((a, b) => b.date.localeCompare(a.date));
export const openHomework = (hw: Homework[]) => hw.filter((h) => !h.done).sort((a, b) => a.due.localeCompare(b.due));

/** Minutes studied in the 7 days ending today, and per subject. */
export function weekStudy(sessions: StudySession[], now = new Date()) {
  const from = now.getTime() - 7 * DAY;
  const recent = sessions.filter((s) => new Date(s.start).getTime() >= from);
  const bySubject = new Map<string, number>();
  for (const s of recent) bySubject.set(s.subject || t('כללי'), (bySubject.get(s.subject || t('כללי')) ?? 0) + s.minutes);
  return {
    minutes: recent.reduce((a, s) => a + s.minutes, 0),
    sessions: recent.length,
    bySubject: [...bySubject.entries()].sort((a, b) => b[1] - a[1]),
  };
}

/** XP from studying: 10 for each session of 10+ minutes, up to 40 a day. */
export function studyXp(sessions: StudySession[]): number {
  const perDay = new Map<string, number>();
  for (const s of sessions) if (s.minutes >= 10) perDay.set(dayKey(s.start), Math.min(40, (perDay.get(dayKey(s.start)) ?? 0) + 10));
  return [...perDay.values()].reduce((a, b) => a + b, 0);
}

/** Days for the date chips: today and the next `n` days. */
export function nextDays(n = 60): { key: string; label: string }[] {
  const names = [t('א׳'), t('ב׳'), t('ג׳'), t('ד׳'), t('ה׳'), t('ו׳'), t('ש׳')];
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return { key: dayKey(d), label: i === 0 ? t('היום') : i === 1 ? t('מחר') : `${names[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}` };
  });
}
