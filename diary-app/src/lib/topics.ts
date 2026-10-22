import { t } from '../i18n';
import { TOPICS, type Topic } from './aiCore';
import type { Entry } from './types';

/** What a day was about: friends, family, work, studies… The AI tags recorded/chatted days; a keyword guess covers the rest. */

export { TOPICS, type Topic };

export const TOPIC_LABELS: Record<Topic, string> = {
  friends: '👫 חברים',
  family: '👨‍👩‍👧 משפחה',
  work: '💼 עבודה',
  studies: '📚 לימודים',
  love: '💘 זוגיות',
  health: '💪 בריאות וספורט',
  hobbies: '🎨 תחביבים',
};

const KEYWORDS: Record<Topic, RegExp> = {
  friends: /חבר|חברה|חברים|חברות|החבר׳ה|חבר'ה|בילינו|מסיבה|friend|صديق|اصحاب/i,
  family: /אמא|אבא|הורים|אח שלי|אחי|אחות|אחותי|סבא|סבתא|דוד|דודה|משפחה|בן דוד|בת דודה|mom|dad|family|أمي|أبي|عائلة/i,
  work: /עבודה|משמרת|בוס|מנהל|מנהלת|לקוח|משכורת|קולגה|במשרד|work|shift|boss|عمل|شغل/i,
  studies: /בית ספר|ביה"ס|כיתה|מבחן|בגרות|שיעורי בית|מורה|לימודים|אוניברסיטה|מכללה|הרצאה|קורס|school|exam|class|مدرسة|امتحان|جامعة/i,
  love: /חבר שלי|חברה שלי|דייט|זוגיות|אהבה|מתנשקים|נשיקה|date|boyfriend|girlfriend|حبيب/i,
  health: /רופא|חולה|כאב|אימון|חדר כושר|ריצה|ספורט|שינה|רופאה|gym|doctor|sick|رياضة|طبيب/i,
  hobbies: /גיטרה|ציור|ציירתי|שיחקתי|גיימינג|כדורגל|ריקוד|לשיר|שירים|מוזיקה|סרט|סדרה|קראתי ספר|guitar|music|movie|رسم|موسيقى/i,
};

export function guessTopics(text: string): Topic[] {
  return TOPICS.filter((k) => KEYWORDS[k].test(text));
}

export const entryTopics = (e: Entry): Topic[] => (e.topics?.length ? e.topics : guessTopics(e.text));

/** The topics the user talks about most, over their recent days, most frequent first. */
export function topTopics(entries: Entry[], last = 60): { topic: Topic; count: number }[] {
  const counts = new Map<Topic, number>();
  for (const e of entries.slice(0, last)) for (const k of entryTopics(e)) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts.entries()].map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count);
}

export const topicLabel = (k: Topic) => t(TOPIC_LABELS[k]);
