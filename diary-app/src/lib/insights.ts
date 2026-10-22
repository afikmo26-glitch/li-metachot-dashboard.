import { t } from '../i18n';
import { circleOf } from './circles';
import { dayKey } from './dates';
import type { Entry, GameStats, Person } from './types';

/** Small, computed-on-the-fly observations for the Today screen and the recap. */

const DAY = 86400000;

/** An entry from this day in a past year, or else from a month / a week ago. */
export function onThisDay(entries: Entry[], now = new Date()): { label: string; entry: Entry } | null {
  const md = `${now.getMonth()}-${now.getDate()}`;
  const yearAgo = entries.find((e) => {
    const d = new Date(e.createdAt);
    return `${d.getMonth()}-${d.getDate()}` === md && d.getFullYear() < now.getFullYear();
  });
  if (yearAgo) {
    const years = now.getFullYear() - new Date(yearAgo.createdAt).getFullYear();
    return { label: years === 1 ? t('היום לפני שנה') : t('היום לפני {n} שנים', { n: years }), entry: yearAgo };
  }
  for (const [days, label] of [
    [30, t('היום לפני חודש')],
    [7, t('היום לפני שבוע')],
  ] as const) {
    const k = dayKey(new Date(now.getTime() - days * DAY));
    const e = entries.find((x) => dayKey(x.createdAt) === k);
    if (e) return { label, entry: e };
  }
  return null;
}

/** Family and friends you haven't mentioned for a while: a nudge to call them. */
export function reachOut(people: Person[], entries: Entry[], minDays = 14, now = Date.now()): { person: Person; days: number }[] {
  return people
    .filter((p) => {
      const c = circleOf(p);
      return c === 'family' || c === 'friends';
    })
    .map((person) => {
      const last = entries.find((e) => e.people.includes(person.id));
      const since = new Date(last ? last.createdAt : person.firstSeen).getTime();
      return { person, days: Math.floor((now - since) / DAY) };
    })
    .filter((x) => x.days >= minDays)
    .sort((a, b) => b.days - a.days)
    .slice(0, 3);
}

/** Days until a "MM-DD" birthday (0 = today). */
export function daysUntilBirthday(mmdd: string, now = new Date()): number {
  const [m, d] = mmdd.split('-').map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), m - 1, d);
  if (next < today) next = new Date(now.getFullYear() + 1, m - 1, d);
  return Math.round((next.getTime() - today.getTime()) / DAY);
}

export function upcomingBirthdays(people: Person[], within = 14): { person: Person; days: number }[] {
  return people
    .filter((p) => p.birthday)
    .map((person) => ({ person, days: daysUntilBirthday(person.birthday!) }))
    .filter((x) => x.days <= within)
    .sort((a, b) => a.days - b.days);
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** How sleep and exercise line up with mood, once there is enough data to say anything. */
export function wellbeingInsights(entries: Entry[]): string[] {
  const out: string[] = [];
  const withW = entries.filter((e) => e.workout !== undefined);
  const yes = withW.filter((e) => e.workout).map((e) => e.mood);
  const no = withW.filter((e) => !e.workout).map((e) => e.mood);
  if (yes.length >= 2 && no.length >= 2) {
    const diff = Math.round(((avg(yes) - avg(no)) / avg(no)) * 100);
    if (diff >= 5) out.push(t('🏃 בימים שהתאמנת, מצב הרוח שלך טוב ב-{n}%', { n: diff }));
    else if (diff <= -5) out.push(t('🏃 בימים שהתאמנת היית קצת יותר עייף/ה — אולי כדאי להתאמן מוקדם יותר'));
  }
  const withS = entries.filter((e) => e.sleep !== undefined);
  const good = withS.filter((e) => e.sleep! >= 7).map((e) => e.mood);
  const bad = withS.filter((e) => e.sleep! < 7).map((e) => e.mood);
  if (good.length >= 2 && bad.length >= 2) {
    const diff = Math.round(((avg(good) - avg(bad)) / avg(bad)) * 100);
    if (diff >= 5) out.push(t('😴 אחרי לילה של 7 שעות ומעלה, מצב הרוח שלך טוב ב-{n}%', { n: diff }));
  }
  const grateful = entries.filter((e) => e.gratitude?.length).map((e) => e.mood);
  const notGrateful = entries.filter((e) => !e.gratitude?.length).map((e) => e.mood);
  if (grateful.length >= 2 && notGrateful.length >= 2 && avg(grateful) > avg(notGrateful) + 0.2) {
    out.push(t('🙏 בימים שכתבת דברים טובים, הרגשת טוב יותר'));
  }
  return out;
}

/** Sunday-based week key, e.g. "2026-10-18". */
export function weekKey(d = new Date()): string {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  return dayKey(s);
}

export type Challenge = { id: string; emoji: string; title: string; goal: number; progress: number; xp: number };

/** This week's challenges and how far the user got. */
export function weeklyChallenges(entries: Entry[], people: Person[], now = new Date()): Challenge[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
  const week = entries.filter((e) => new Date(e.createdAt).getTime() >= start);
  const days = new Set(week.map((e) => dayKey(e.createdAt))).size;
  const newPeople = people.filter((p) => new Date(p.firstSeen).getTime() >= start).length;
  const gratitude = week.reduce((a, e) => a + (e.gratitude?.length ?? 0), 0);
  const workouts = week.filter((e) => e.workout).length;
  return [
    { id: 'days5', emoji: '📖', title: t('לכתוב 5 ימים השבוע'), goal: 5, progress: Math.min(days, 5), xp: 60 },
    { id: 'people3', emoji: '💞', title: t('לספר על 3 אנשים חדשים'), goal: 3, progress: Math.min(newPeople, 3), xp: 40 },
    { id: 'thanks7', emoji: '🙏', title: t('לכתוב 7 דברים טובים'), goal: 7, progress: Math.min(gratitude, 7), xp: 40 },
    { id: 'move3', emoji: '🏃', title: t('להתאמן 3 פעמים'), goal: 3, progress: Math.min(workouts, 3), xp: 40 },
  ];
}

/** Challenges completed this week that were not rewarded yet. */
export function newlyCompleted(challenges: Challenge[], game: GameStats, now = new Date()): Challenge[] {
  const wk = weekKey(now);
  return challenges.filter((c) => c.progress >= c.goal && !(game.challengesDone ?? []).includes(`${wk}:${c.id}`));
}

// ---- Mood over time ----

export type DayMood = { key: string; mood: number };

/** Average mood per day (days with entries only), oldest first. */
export function moodByDay(entries: Entry[]): DayMood[] {
  const map = new Map<string, number[]>();
  for (const e of entries) map.set(dayKey(e.createdAt), [...(map.get(dayKey(e.createdAt)) ?? []), e.mood]);
  return [...map.entries()].map(([key, m]) => ({ key, mood: m.reduce((a, b) => a + b, 0) / m.length })).sort((a, b) => a.key.localeCompare(b.key));
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * What goes with better days, in plain words: working out, sleep, studying, topics and people.
 * Only says something when both sides have at least 3 days and the gap is real (≥ 0.4 on the 1–5 scale).
 */
export function moodLinks(entries: Entry[], people: Person[], studyDays: Set<string>, topicOf: (e: Entry) => string[], topicLabel: (k: string) => string): string[] {
  const days = moodByDay(entries);
  if (days.length < 6) return [];
  const all = mean(days.map((d) => d.mood));
  const byKey = new Map(days.map((d) => [d.key, d.mood]));
  const dayEntries = new Map<string, Entry[]>();
  for (const e of entries) dayEntries.set(dayKey(e.createdAt), [...(dayEntries.get(dayKey(e.createdAt)) ?? []), e]);
  const out: { gap: number; text: string }[] = [];
  const split = (test: (key: string, es: Entry[]) => boolean | undefined, text: (gap: number) => string) => {
    const yes: number[] = [];
    const no: number[] = [];
    for (const [key, es] of dayEntries) {
      const r = test(key, es);
      if (r === true) yes.push(byKey.get(key)!);
      else if (r === false) no.push(byKey.get(key)!);
    }
    if (yes.length >= 3 && no.length >= 3) {
      const gap = mean(yes) - mean(no);
      if (Math.abs(gap) >= 0.4) out.push({ gap: Math.abs(gap), text: text(gap) });
    }
  };
  split((_, es) => (es.some((e) => e.workout === true) ? true : es.some((e) => e.workout === false) ? false : undefined), (g) =>
    g > 0 ? t('🏃 בימים שהתאמנת, מצב הרוח היה טוב יותר') : t('🏃 דווקא בימי מנוחה מצב הרוח היה טוב יותר'),
  );
  split((_, es) => {
    const s = es.find((e) => e.sleep !== undefined)?.sleep;
    return s === undefined ? undefined : s >= 7;
  }, (g) => (g > 0 ? t('😴 אחרי לילה של 7+ שעות שינה, הימים שלך טובים יותר') : t('😴 מעניין: שינה ארוכה לא שיפרה את מצב הרוח')));
  split((key) => studyDays.has(key), (g) => (g > 0 ? t('📚 בימים שלמדת עם הטיימר הרגשת טוב יותר') : t('📚 ימי לימוד היו קצת יותר קשים — זה בסדר, אל תשכח הפסקות')));
  const topics = new Set(entries.flatMap(topicOf));
  for (const k of topics) split((_, es) => es.some((e) => topicOf(e).includes(k)), (g) => (g > 0 ? t('{topic}: הימים האלה הם מהטובים שלך', { topic: topicLabel(k) }) : t('{topic}: הימים האלה קשים יותר', { topic: topicLabel(k) })));
  for (const p of people) {
    const withP = [...dayEntries.entries()].filter(([, es]) => es.some((e) => e.people.includes(p.id))).map(([k]) => byKey.get(k)!);
    if (withP.length >= 3 && mean(withP) - all >= 0.5) out.push({ gap: mean(withP) - all, text: t('💛 ימים עם {name} הם מהשמחים שלך', { name: p.name }) });
  }
  // Best day of the week
  const byWeekday = new Map<number, number[]>();
  for (const d of days) {
    const w = new Date(`${d.key}T12:00:00`).getDay();
    byWeekday.set(w, [...(byWeekday.get(w) ?? []), d.mood]);
  }
  const best = [...byWeekday.entries()].filter(([, m]) => m.length >= 2).sort((a, b) => mean(b[1]) - mean(a[1]))[0];
  if (best && mean(best[1]) - all >= 0.3) {
    const names = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    out.push({ gap: 0.3, text: t('📅 היום הכי טוב שלך בשבוע: יום {day}', { day: t(names[best[0]]) }) });
  }
  return out.sort((a, b) => b.gap - a.gap).slice(0, 5).map((x) => x.text);
}
