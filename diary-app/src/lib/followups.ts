import { t } from '../i18n';
import type { Entry, FollowUp, Person } from './types';

/**
 * Things people tell you that are worth asking about later: "Dana has a job interview on Sunday"
 * becomes a reminder, a few days on, to ask how it went. Detection is keyword based (Hebrew, English, Arabic).
 */

type Topic = { key: string; re: RegExp; days: number; ask: string };

const TOPICS: Topic[] = [
  { key: 'interview', re: /ראיון|interview|مقابلة/i, days: 4, ask: 'איך היה ל{name} בראיון?' },
  { key: 'exam', re: /מבחן|בחינה|מבחנים|\bexams?\b|\btest\b|امتحان/i, days: 4, ask: 'איך הלך ל{name} במבחן?' },
  { key: 'health', re: /ניתוח|רופא|בדיקות|בית חולים|חולה|לא מרגיש|לא מרגישה|surgery|doctor|hospital|\bsick\b|عملية|طبيب|مستشفى|مريض/i, days: 3, ask: 'מה שלום {name}? מרגיש/ה יותר טוב?' },
  { key: 'trip', re: /טס|טסה|טיסה|חופשה|לחו"ל|נוסע|נוסעת|\btrip\b|flight|vacation|holiday|سفر|رحلة|إجازة/i, days: 10, ask: 'איך היה ל{name} בטיול?' },
  { key: 'move', re: /עובר דירה|עוברת דירה|עובר ל|עוברת ל|דירה חדשה|moving|new apartment|انتقل|شقة جديدة/i, days: 14, ask: 'איך {name} מסתדר/ת במקום החדש?' },
  { key: 'wedding', re: /מתחתן|מתחתנת|חתונה|התארס|התארסה|wedding|engaged|getting married|زفاف|عرس|خطوبة/i, days: 14, ask: 'מה חדש עם החתונה של {name}?' },
  { key: 'baby', re: /בהריון|תינוק|תינוקת|לידה|pregnant|baby|حامل|مولود/i, days: 30, ask: 'מה שלום {name} וההריון/התינוק?' },
  { key: 'job', re: /עבודה חדשה|קידום|התפטר|התפטרה|פוטר|פוטרה|new job|promot|quit|fired|وظيفة جديدة|ترقية|استقال/i, days: 10, ask: 'איך ל{name} בעבודה החדשה?' },
  { key: 'breakup', re: /נפרד|נפרדה|פרידה|broke up|breakup|انفصل|انفصلت/i, days: 5, ask: 'מה שלום {name} אחרי הפרידה?' },
  { key: 'event', re: /יום הולדת|מסיבה|הופעה|תחרות|birthday|party|concert|competition|عيد ميلاد|حفلة/i, days: 3, ask: 'איך היה ל{name} באירוע?' },
];

const DAY = 86400000;

/** Follow-ups found in a newly saved entry (one per person and topic). */
export function detectFollowUps(entry: Entry, people: Person[], existing: FollowUp[], newId: () => string): FollowUp[] {
  const found: FollowUp[] = [];
  const seen = new Set(existing.filter((f) => !f.done).map((f) => `${f.personId}:${f.topic}`));
  const consider = (personId: string, text: string) => {
    for (const topic of TOPICS) {
      if (!topic.re.test(text)) continue;
      const key = `${personId}:${topic.key}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({
        id: newId(),
        personId,
        text: text.trim().slice(0, 140),
        topic: topic.key,
        createdAt: entry.createdAt,
        due: new Date(new Date(entry.createdAt).getTime() + topic.days * DAY).toISOString(),
      });
    }
  };
  // What they said directly
  for (const q of entry.quotes) consider(q.personId, q.text);
  // Sentences in the entry that mention them
  const sentences = entry.text.split(/(?<=[.!?\n])\s+/);
  for (const pid of entry.people) {
    const name = people.find((p) => p.id === pid)?.name;
    if (!name) continue;
    for (const s of sentences) if (s.includes(name)) consider(pid, s);
  }
  return found;
}

/** Follow-ups whose day has come, oldest first. */
export const dueFollowUps = (all: FollowUp[], now = Date.now()) =>
  all.filter((f) => !f.done && new Date(f.due).getTime() <= now).sort((a, b) => a.due.localeCompare(b.due));

export function followUpQuestion(f: FollowUp, name: string): string {
  const topic = TOPICS.find((x) => x.key === f.topic);
  return t(topic?.ask ?? 'מה חדש עם {name}?', { name });
}
