import { t } from '../i18n';
import { findKnownPeople, suggestNewNames } from './names';
import type { Person } from './types';

/**
 * A scripted interviewer that asks follow-up questions about the day, based on
 * what the user already answered (people, work, feelings). Runs fully offline.
 * Texts are Hebrew source strings passed through t(); keyword checks cover
 * Hebrew plus common English and Arabic words.
 */

export type QuestionKind =
  | 'opening'
  | 'who' // who is a new person
  | 'said' // what did someone say
  | 'topic'
  | 'wellbeing'
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

/** The question asked when the user mentions new friends without names. */
export const namesQuestion = (): BotQuestion => ({ kind: 'topic', topic: 'names', text: t('איזה כיף להכיר אנשים חדשים! 😊 איך קוראים להם?') });

/** "נועם וגלעד" / "Dana and Yossi" -> ['נועם', 'גלעד'] (answer to "what are their names?") */
export function namesFromList(text: string): string[] {
  return text
    .split(/[,،\s]+/)
    .map((w) => w.replace(/[^֐-׿؀-ۿA-Za-z'׳]/g, ''))
    .map((w) => (w.length >= 3 && (w.startsWith('ו') || w.startsWith('و')) ? w.slice(1) : w))
    .filter((w) => w.length >= 2 && w.length <= 12 && !/^(ו|גם|עם|את|של|הם|הן|קוראים|להם|לה|לו|and|their|names|are|is|و|اسمهم)$/i.test(w));
}

const TOPICS: { key: string; words: RegExp; question: string }[] = [
  { key: 'work', words: /עבודה|משרד|בוס|מנהל|פגישה|לקוח|פרויקט|משמרת|work|office|boss|meeting|project|عمل|مكتب|مدير/i, question: 'ואיך היה בעבודה? קרה שם משהו שכדאי לזכור?' },
  { key: 'hard', words: /עייף|עייפה|לחוץ|לחוצה|קשה|עצוב|עצובה|כועס|כועסת|מתוסכל|דאגה|מבאס|tired|stress|sad|angry|hard|متعب|حزين|صعب/i, question: 'נשמע שהיה לא פשוט. מה הכי הכביד עליך היום?' },
  { key: 'happy', words: /שמח|שמחה|מעולה|כיף|מדהים|מושלם|הצלחתי|התרגשתי|happy|great|amazing|awesome|fun|سعيد|رائع/i, question: 'איזה כיף לשמוע! מה הכי שימח אותך?' },
  { key: 'family', words: /אמא|אבא|אחי|אחותי|סבתא|סבא|משפחה|ילדים|הבן|הבת|mom|dad|family|kids|brother|sister|أمي|أبي|عائلة/i, question: 'מה שלום המשפחה? דיברתם על משהו מיוחד?' },
  { key: 'food', words: /אכלתי|ארוחה|מסעדה|בישלתי|קפה|ate|dinner|lunch|restaurant|cooked|أكلت|مطعم/i, question: 'מה אכלת? היה טעים?' },
  { key: 'sport', words: /ספורט|אימון|ריצה|חדר כושר|כדורגל|הליכה|שחייה|gym|workout|run|football|walk|رياضة|نادي/i, question: 'איך היה האימון? הרגשת טוב אחריו?' },
];

const MOVED = /התאמנתי|אימון|ריצה|רצתי|חדר כושר|הליכה|הלכתי|שחייה|יוגה|כדורגל|gym|workout|ran|run|walked|yoga|رياضة|تمرين/i;

const WELLBEING = [
  { key: 'move', question: 'הספקת להזיז קצת את הגוף היום? אפילו הליכה קצרה נחשבת 🚶', chips: ['כן!', 'לא הספקתי'] },
  { key: 'breath', question: 'עצרת היום לרגע אחד רק לנשום? 🌬️', chips: ['כן', 'לא ממש'] },
  { key: 'water', question: 'שתית מספיק מים היום? 💧', chips: ['כן', 'פחות מדי'] },
  { key: 'grateful', question: 'על מה אתה מרגיש תודה היום, אפילו משהו קטן? 🙏' },
];

const MOOD_CHIPS = ['😞 קשה', '😕 לא משהו', '😐 רגיל', '🙂 טוב', '🤩 מדהים'];
const MOOD_EMOJI = ['😞', '😕', '😐', '🙂', '🤩'];

const OPENINGS = ['היי! 👋 ספר לי, איך היה היום שלך?', 'ערב טוב 🌙 מה קרה היום?', 'אני כאן להקשיב 💜 איך עבר עליך היום?'];

export function openingQuestion(name?: string): BotQuestion {
  const i = Math.floor(Math.random() * OPENINGS.length);
  if (i === 0 && name) return { kind: 'opening', text: t('היי {name}! 👋 ספר לי, איך היה היום שלך?', { name }) };
  return { kind: 'opening', text: t(OPENINGS[i]) };
}

/** Mood from a chip answer ("🙂 טוב", in any language) or 3 when unclear. */
export function moodFromAnswer(text: string): number {
  const byEmoji = MOOD_EMOJI.findIndex((e) => text.includes(e));
  if (byEmoji >= 0) return byEmoji + 1;
  const byWord = MOOD_CHIPS.findIndex((c) => {
    const word = c.split(' ').slice(1).join(' ');
    return text.includes(word) || text.includes(t(c).split(' ').slice(1).join(' '));
  });
  return byWord >= 0 ? byWord + 1 : 3;
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
    const listed = answers.filter((a) => a.question.topic === 'names').flatMap((a) => namesFromList(a.text));
    const known = new Set(people.map((p) => p.name));
    const candidates = [...new Set([...suggestNewNames(allText, people), ...listed])].filter((n) => !known.has(n));
    const newName = candidates.find((n) => !askedWho.has(n));
    if (newName) {
      return {
        kind: 'who',
        name: newName,
        text: t('מי זה {name}? אשמור את זה כדי לזכור 🙂', { name: newName }),
        chips: ['חבר/ה', 'מהעבודה', 'משפחה', 'לא חשוב'].map((c) => t(c)),
      };
    }

    // 2. Known people who were mentioned → "what did X say?"
    const askedSaid = new Set(asked.filter((q) => q.kind === 'said').map((q) => q.name));
    const mentioned = findKnownPeople(allText, people)
      .map((id) => people.find((p) => p.id === id)!.name)
      .filter((n) => !askedSaid.has(n));
    const saidBefore = (n: string) => new RegExp(`${n}\\s+(אמר|אמרה|סיפר|סיפרה|said|told|قال|قالت)`).test(allText);
    const quiet = mentioned.find((n) => !saidBefore(n));
    if (quiet && asked.filter((q) => q.kind === 'said').length < 2) {
      return { kind: 'said', name: quiet, text: t('מה {name} אמר/ה לך היום? משהו שתרצה לזכור?', { name: quiet }), chips: [t('שום דבר מיוחד')] };
    }

    // 3. Topics in what was said
    const askedTopics = new Set(asked.filter((q) => q.kind === 'topic').map((q) => q.topic));
    const topic = TOPICS.find((tp) => !askedTopics.has(tp.key) && tp.words.test(allText));
    if (topic) return { kind: 'topic', topic: topic.key, text: t(topic.question) };
  }

  if (!asked.some((q) => q.kind === 'wellbeing')) {
    const options = WELLBEING.filter((w) => !(MOVED.test(allText) && w.key === 'move'));
    const w = options[answers.length % options.length];
    return { kind: 'wellbeing', topic: w.key, text: t(w.question), chips: w.chips?.map((c) => t(c)) };
  }
  if (!asked.some((q) => q.kind === 'mood')) {
    return { kind: 'mood', text: t('ואיך אתה מרגיש בסך הכל עם היום הזה?'), chips: MOOD_CHIPS.map((c) => t(c)) };
  }
  if (!asked.some((q) => q.kind === 'best')) {
    return { kind: 'best', text: t('מה הדבר הכי טוב שקרה היום? ✨'), chips: [t('לא היה משהו מיוחד')] };
  }
  if (!asked.some((q) => q.kind === 'tomorrow')) {
    return { kind: 'tomorrow', text: t('יש משהו שתרצה שאזכיר לך מחר בבוקר? 📝'), chips: [t('לא, תודה')] };
  }
  return null;
}

const SKIP_WORDS = ['לא', 'לא תודה', 'לא, תודה', 'שום דבר מיוחד', 'לא היה משהו מיוחד', 'לא חשוב', '-'];
/** True for "no" / "nothing special" answers, in the current language or Hebrew. */
export const isSkip = (text: string) => {
  const s = text.trim().toLowerCase();
  return SKIP_WORDS.some((w) => s === w || s === t(w).toLowerCase()) || /^(no|nope|nothing|لا)$/.test(s);
};

/** Turns the conversation into diary text. */
export function composeEntryText(answers: Answer[]): string {
  const parts: string[] = [];
  for (const { question, text } of answers) {
    const a = text.trim();
    if (!a || isSkip(a)) continue;
    switch (question.kind) {
      case 'opening':
      case 'topic':
        parts.push(question.topic === 'names' ? t('הכרתי את {names}', { names: a }) : a);
        break;
      case 'said':
        parts.push(`💬 ${question.name}: "${a}"`);
        break;
      case 'best':
        parts.push(t('✨ הכי טוב היום: {text}', { text: a }));
        break;
      case 'tomorrow':
        parts.push(t('📝 למחר: {text}', { text: a }));
        break;
      case 'wellbeing':
        if (question.topic === 'grateful') parts.push(t('🙏 תודה על: {text}', { text: a }));
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

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const join = (names: string[]) => names.join(t(' ו'));

/**
 * A short, human reaction to what the user just wrote, said before the next question
 * (offline mode). Returns undefined when nothing specific fits.
 */
export function reactTo(text: string, question: BotQuestion, newNames: string[]): string | undefined {
  const a = text.trim();
  if (question.kind === 'who' && question.name) {
    return isSkip(a) ? t('בסדר גמור 🙂') : t('רשמתי: {name} — {note} 👍', { name: question.name, note: a });
  }
  if (question.kind === 'wellbeing') {
    const no = /^(לא|פחות|לא ממש|לא הספקתי|no|not|nope|لا)/i.test(a) || a === t('לא הספקתי') || a === t('לא ממש') || a === t('פחות מדי');
    switch (question.topic) {
      case 'move':
        return no ? t('זה בסדר, מחר הזדמנות חדשה. אפילו 10 דקות הליכה עושות הבדל 💪') : t('כל הכבוד! הגוף שלך מודה לך 💪');
      case 'breath':
        return no ? t('בוא ננסה עכשיו, רק פעם אחת: שאיפה 4 שניות, עצירה 4, נשיפה 6. 🌬️ איך זה מרגיש?') : t('מעולה. רגע אחד של נשימה יכול לשנות יום שלם 🌿');
      case 'water':
        return no ? t('אז כוס מים לפני השינה? 💧 הגוף יגיד תודה מחר') : t('יופי! ממשיכים ככה 💧');
      default:
        return isSkip(a) ? undefined : t('איזה דבר יפה להודות עליו 🙏');
    }
  }
  if (question.kind === 'mood' || question.kind === 'tomorrow') return undefined;
  if (question.kind === 'best') {
    return isSkip(a) ? t('גם ימים רגילים הם חלק מהסיפור 🙂') : t(pick(['איזה כיף! 🎉', 'זה באמת שווה לזכור ✨', 'אני שמח שזה קרה לך 😊']));
  }
  if (question.kind === 'said') return isSkip(a) ? undefined : t(pick(['שמרתי את זה 💬', 'טוב שרשמנו, ככה לא תשכח 💬']));

  if (question.topic === 'names') {
    const names = namesFromList(a);
    return names.length ? t('נעים להכיר את {names}! 😊', { names: join(names) }) : undefined;
  }
  const parts: string[] = [];
  if (/עצוב|עצובה|בכיתי|קשה לי|מבואס|מבואסת|בודד|בודדה|מאוכזב|sad|cried|lonely|disappointed|حزين|وحيد/i.test(a)) {
    parts.push(t('אני מצטער שזה היה ככה 💜 טוב שאתה משתף.'));
  } else if (/עייף|עייפה|מותש|לחוץ|לחוצה|לחץ|סטרס|עמוס|tired|exhausted|stress|busy|متعب|ضغط/i.test(a)) {
    parts.push(t('נשמע יום עמוס. מגיע לך לנוח הערב 🛋️'));
  } else if (/שמח|שמחה|מעולה|מדהים|כיף|מושלם|הצלחתי|התרגשתי|happy|great|amazing|awesome|سعيد|رائع/i.test(a)) {
    parts.push(t(pick(['איזה כיף לשמוע! 🎉', 'וואו, נשמע יום טוב! 😄'])));
  }
  if (MOVED.test(a)) parts.push(t('וגם התאמנת, כל הכבוד 💪'));
  if (newNames.length) parts.push(t('{names}, אני רושם 📝', { names: join(newNames) }));
  if (!parts.length && a.length > 25) parts.push(t(pick(['תודה ששיתפת 🙏', 'הבנתי 🙂', 'מעניין!'])));
  return parts.length ? parts.join(' ') : undefined;
}

/** True when the user mentioned new friends without naming them, so the bot should ask for names. */
export function shouldAskNames(text: string, newNames: string[], asked: BotQuestion[]) {
  return (
    /הכרתי|חברים חדשים|חבר חדש|חברה חדשה|אנשים חדשים|new friends?|met new|made friends|أصدقاء جدد|تعرفت/i.test(text) &&
    !newNames.length &&
    !asked.some((q) => q.topic === 'names')
  );
}
