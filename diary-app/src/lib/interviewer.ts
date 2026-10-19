import { findKnownPeople, suggestNewNames } from './names';
import type { Person } from './types';

/**
 * A scripted interviewer that asks follow-up questions about the day, based on
 * what the user already answered (people, work, feelings). Runs fully offline.
 */

export type QuestionKind =
  | 'opening'
  | 'who' // who is a new person
  | 'said' // what did someone say
  | 'topic'
  | 'mood'
  | 'best'
  | 'tomorrow';

export type BotQuestion = {
  kind: QuestionKind;
  text: string;
  /** Quick replies shown as chips */
  chips?: string[];
  /** For 'who' / 'said' questions: the person's name */
  name?: string;
  topic?: string;
};

export type Answer = { question: BotQuestion; text: string };

const MAX_FOLLOWUPS = 4;

const TOPICS: { key: string; words: RegExp; question: string }[] = [
  { key: 'work', words: /עבודה|משרד|בוס|מנהל|פגישה|לקוח|פרויקט|משמרת/, question: 'ואיך היה בעבודה? קרה שם משהו שכדאי לזכור?' },
  { key: 'hard', words: /עייף|עייפה|לחוץ|לחוצה|קשה|עצוב|עצובה|כועס|כועסת|מתוסכל|דאגה|מבאס/, question: 'נשמע שהיה לא פשוט. מה הכי הכביד עליך היום?' },
  { key: 'happy', words: /שמח|שמחה|מעולה|כיף|מדהים|מושלם|הצלחתי|התרגשתי/, question: 'איזה כיף לשמוע! מה הכי שימח אותך?' },
  { key: 'family', words: /אמא|אבא|אחי|אחותי|סבתא|סבא|משפחה|ילדים|הבן|הבת/, question: 'מה שלום המשפחה? דיברתם על משהו מיוחד?' },
  { key: 'food', words: /אכלתי|ארוחה|מסעדה|בישלתי|קפה/, question: 'מה אכלת? היה טעים?' },
  { key: 'sport', words: /ספורט|אימון|ריצה|חדר כושר|כדורגל|הליכה|שחייה/, question: 'איך היה האימון? הרגשת טוב אחריו?' },
];

const MOOD_CHIPS = ['😞 קשה', '😕 לא משהו', '😐 רגיל', '🙂 טוב', '🤩 מדהים'];

export const OPENINGS = [
  'היי! 👋 ספר לי, איך היה היום שלך?',
  'ערב טוב 🌙 מה קרה היום?',
  'אני כאן להקשיב 💜 איך עבר עליך היום?',
];

export function openingQuestion(name?: string): BotQuestion {
  const base = OPENINGS[Math.floor(Math.random() * OPENINGS.length)];
  return { kind: 'opening', text: name ? base.replace('היי!', `היי ${name}!`) : base };
}

/** Mood from a chip answer ("🙂 טוב") or 3 when unclear. */
export function moodFromAnswer(text: string): number {
  const i = MOOD_CHIPS.findIndex((c) => text.includes(c.split(' ')[0]) || text.includes(c.split(' ')[1]));
  return i >= 0 ? i + 1 : 3;
}

/**
 * Decides the next question from everything said so far.
 * Returns null when the conversation is complete.
 */
export function nextQuestion(answers: Answer[], people: Person[]): BotQuestion | null {
  const asked = answers.map((a) => a.question);
  const allText = answers
    .filter((a) => a.question.kind !== 'mood')
    .map((a) => a.text)
    .join('\n');
  const followups = asked.filter((q) => q.kind === 'who' || q.kind === 'said' || q.kind === 'topic').length;

  // Follow-ups only before the closing questions (mood / best / tomorrow)
  if (followups < MAX_FOLLOWUPS && !asked.some((q) => q.kind === 'mood')) {
    // 1. New names → "who is X?"
    const askedWho = new Set(asked.filter((q) => q.kind === 'who').map((q) => q.name));
    const newName = suggestNewNames(allText, people).find((n) => !askedWho.has(n));
    if (newName) {
      return {
        kind: 'who',
        name: newName,
        text: `מי זה ${newName}? אשמור את זה כדי לזכור 🙂`,
        chips: ['חבר/ה', 'מהעבודה', 'משפחה', 'לא חשוב'],
      };
    }

    // 2. Known people who were mentioned → "what did X say?"
    const askedSaid = new Set(asked.filter((q) => q.kind === 'said').map((q) => q.name));
    const mentioned = findKnownPeople(allText, people)
      .map((id) => people.find((p) => p.id === id)!.name)
      .filter((n) => !askedSaid.has(n));
    const saidBefore = (n: string) => new RegExp(`${n}\\s+(אמר|אמרה|סיפר|סיפרה)`).test(allText);
    const quiet = mentioned.find((n) => !saidBefore(n));
    if (quiet && asked.filter((q) => q.kind === 'said').length < 2) {
      return { kind: 'said', name: quiet, text: `מה ${quiet} אמר/ה לך היום? משהו שתרצה לזכור?`, chips: ['שום דבר מיוחד'] };
    }

    // 3. Topics in what was said
    const askedTopics = new Set(asked.filter((q) => q.kind === 'topic').map((q) => q.topic));
    const topic = TOPICS.find((t) => !askedTopics.has(t.key) && t.words.test(allText));
    if (topic) return { kind: 'topic', topic: topic.key, text: topic.question };
  }

  if (!asked.some((q) => q.kind === 'mood')) {
    return { kind: 'mood', text: 'ואיך אתה מרגיש בסך הכל עם היום הזה?', chips: MOOD_CHIPS };
  }
  if (!asked.some((q) => q.kind === 'best')) {
    return { kind: 'best', text: 'מה הדבר הכי טוב שקרה היום? ✨', chips: ['לא היה משהו מיוחד'] };
  }
  if (!asked.some((q) => q.kind === 'tomorrow')) {
    return {
      kind: 'tomorrow',
      text: 'יש משהו שתרצה שאזכיר לך מחר בבוקר? 📝',
      chips: ['לא, תודה'],
    };
  }
  return null;
}

const SKIP = /^(לא|לא תודה|לא, תודה|שום דבר מיוחד|לא היה משהו מיוחד|לא חשוב|-)$/;
export const isSkip = (text: string) => SKIP.test(text.trim());

/** Turns the conversation into diary text. */
export function composeEntryText(answers: Answer[]): string {
  const parts: string[] = [];
  for (const { question, text } of answers) {
    const t = text.trim();
    if (!t || isSkip(t)) continue;
    switch (question.kind) {
      case 'opening':
      case 'topic':
        parts.push(t);
        break;
      case 'said':
        parts.push(`💬 ${question.name}: "${t}"`);
        break;
      case 'best':
        parts.push(`✨ הכי טוב היום: ${t}`);
        break;
      case 'tomorrow':
        parts.push(`📝 למחר: ${t}`);
        break;
      default:
        break;
    }
  }
  return parts.join('\n');
}

export function tomorrowNote(answers: Answer[]): string | undefined {
  const a = answers.find((x) => x.question.kind === 'tomorrow');
  return a && !isSkip(a.text) ? a.text.trim() : undefined;
}

/** "מי זה X?" answers become a note on the person. */
export function personNotes(answers: Answer[]): { name: string; note?: string }[] {
  return answers
    .filter((a) => a.question.kind === 'who' && a.question.name)
    .map((a) => ({ name: a.question.name!, note: isSkip(a.text) ? undefined : a.text.trim() }));
}

/** "מה X אמר לך?" answers become saved quotes. */
export function saidQuotes(answers: Answer[]): { name: string; text: string }[] {
  return answers
    .filter((a) => a.question.kind === 'said' && a.question.name && !isSkip(a.text))
    .map((a) => ({ name: a.question.name!, text: a.text.trim() }));
}
