import { dayKey, formatShortDate } from './dates';
import { maskName, mentionsName, randomCommonNames } from './names';
import { circleOf } from './circles';
import type { Entry, Person, UserProfile } from './types';
import { t } from '../i18n';

export type Question = {
  id: string;
  emoji: string;
  prompt: string;
  context?: string;
  options: string[];
  answer: string;
};

export const ROUND_SIZE = 10;
export const QUESTION_SECONDS = 15;
export const XP_PER_LEVEL = 200;

const LEVEL_TITLES = ['מתחיל', 'זוכר שמות', 'חבר טוב', 'זיכרון של פיל', 'אלוף הזיכרון', 'אגדה'];
export function levelInfo(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  return {
    level,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    progress: (xp % XP_PER_LEVEL) / XP_PER_LEVEL,
    toNext: XP_PER_LEVEL - (xp % XP_PER_LEVEL),
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Correct answer + 3 distractors, preferring real people the user knows. */
function nameOptions(answer: string, people: Person[], exclude: string[] = []): string[] {
  const others = shuffle(people.map((p) => p.name).filter((n) => n !== answer && !exclude.includes(n))).slice(0, 3);
  const padded = [...others, ...randomCommonNames(3 - others.length, [answer, ...others, ...exclude])];
  return shuffle([answer, ...padded]);
}

function snippetAround(text: string, name: string, radius = 70): string {
  const masked = maskName(text, name);
  const idx = masked.indexOf('___');
  if (idx < 0) return masked.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(masked.length, idx + radius);
  return `${start > 0 ? '…' : ''}${masked.slice(start, end).trim()}${end < masked.length ? '…' : ''}`;
}

export function buildQuestions(entries: Entry[], people: Person[]): Question[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const pool: Question[] = [];
  let n = 0;
  const id = () => `q${n++}`;

  // 1. Who said this?
  for (const e of entries) {
    for (const q of e.quotes) {
      const p = byId.get(q.personId);
      if (!p) continue;
      pool.push({
        id: id(),
        emoji: '💬',
        prompt: t('מי אמר לך את זה?'),
        context: `"${q.text}"\n— ${formatShortDate(e.createdAt)}`,
        options: nameOptions(p.name, people),
        answer: p.name,
      });
    }
  }

  // 2. Fill in the missing name
  for (const e of entries) {
    for (const pid of e.people) {
      const p = byId.get(pid);
      if (!p || !e.text || !mentionsName(e.text, p.name)) continue;
      const others = e.people.map((x) => byId.get(x)?.name).filter((x): x is string => !!x && x !== p.name);
      pool.push({
        id: id(),
        emoji: '🧩',
        prompt: t('השלם את השם החסר'),
        context: `${snippetAround(e.text, p.name)}\n— ${formatShortDate(e.createdAt)}`,
        options: nameOptions(p.name, people, others),
        answer: p.name,
      });
    }
  }

  // 3. Who did you meet on that day?
  for (const e of entries) {
    if (!e.people.length) continue;
    const names = e.people.map((x) => byId.get(x)?.name).filter((x): x is string => !!x);
    if (!names.length) continue;
    const answer = pick(names);
    pool.push({
      id: id(),
      emoji: '📅',
      prompt: t('את מי פגשת או הזכרת ב-{date}?', { date: formatShortDate(e.createdAt) }),
      options: nameOptions(answer, people, names.filter((x) => x !== answer)),
      answer,
    });
  }

  // 4. When did you last mention someone?
  const allDays = [...new Set(entries.map((e) => dayKey(e.createdAt)))];
  if (allDays.length >= 4) {
    for (const p of people) {
      const last = entries.find((e) => e.people.includes(p.id));
      if (!last) continue;
      const answer = formatShortDate(last.createdAt);
      const lastKey = dayKey(last.createdAt);
      const distractors = shuffle(allDays.filter((d) => d !== lastKey))
        .slice(0, 3)
        .map((d) => formatShortDate(new Date(`${d}T12:00:00`)));
      pool.push({
        id: id(),
        emoji: '⏳',
        prompt: t('מתי הזכרת לאחרונה את {name}?', { name: p.name }),
        options: shuffle([answer, ...distractors]),
        answer,
      });
    }
  }

  // 5. From the intro and people notes: "who is X to you?" and "what's your mom's name?"
  const withNotes = people.filter((p) => p.note?.trim());
  const roles = [...new Set(withNotes.map((p) => p.note!.split(' · ')[0]))];
  if (roles.length >= 2) {
    for (const p of withNotes) {
      const role = p.note!.split(' · ')[0];
      const others = shuffle(roles.filter((r) => r !== role)).slice(0, 3);
      pool.push({
        id: id(),
        emoji: '🫂',
        prompt: t('מי זה {name} בשבילך?', { name: p.name }),
        options: shuffle([role, ...others]),
        answer: role,
      });
    }
  }
  for (const role of roles) {
    const holders = withNotes.filter((p) => p.note!.split(' · ')[0] === role);
    if (holders.length !== 1) continue; // only roles with a single person, like mom or dad
    pool.push({
      id: id(),
      emoji: '👨‍👩‍👧',
      prompt: t('איך קוראים ל{role} שלך?', { role }),
      options: nameOptions(holders[0].name, people),
      answer: holders[0].name,
    });
  }

  // 6. Complete the sentence someone said: one word is hidden
  const quoteWords = entries.flatMap((e) => e.quotes.flatMap((q) => q.text.split(/\s+/))).map(cleanWord).filter((w) => w.length >= 3);
  for (const e of entries) {
    for (const q of e.quotes) {
      const p = byId.get(q.personId);
      const words = q.text.split(/\s+/);
      if (!p || words.length < 3) continue;
      const candidates = words.map((w, i) => [cleanWord(w), i] as const).filter(([w]) => w.length >= 3);
      if (!candidates.length) continue;
      const [word, idx] = pick(candidates);
      const distractors = shuffle([...new Set(quoteWords.filter((w) => w !== word))]).slice(0, 3);
      if (distractors.length < 3) continue;
      pool.push({
        id: id(),
        emoji: '✍️',
        prompt: t('השלם את המשפט של {name}', { name: p.name }),
        context: `"${words.map((w, i) => (i === idx ? w.replace(word, '____') : w)).join(' ')}"`,
        options: shuffle([word, ...distractors]),
        answer: word,
      });
    }
  }

  // Keep a variety: shuffle then limit repeats of the same answer
  const out: Question[] = [];
  const answerCount = new Map<string, number>();
  for (const q of shuffle(pool)) {
    const c = answerCount.get(q.answer) ?? 0;
    if (c >= 3) continue;
    answerCount.set(q.answer, c + 1);
    out.push(q);
    if (out.length >= ROUND_SIZE) break;
  }
  return out;
}

const cleanWord = (w: string) => w.replace(/[.,!?;:"'״׳()\-–—…]/g, '');

const CITIES = ['תל אביב', 'ירושלים', 'חיפה', 'באר שבע', 'אילת', 'נתניה', 'ראשון לציון', 'נצרת', 'אשדוד', 'הרצליה'];
const JOBS = ['סטודנט/ית', 'שכיר/ה', 'עצמאי/ת', 'חייל/ת', 'מורה', 'מתכנת/ת', 'אחות', 'מעצב/ת'];
const HOBBIES = ['כדורגל', 'בישול', 'מוזיקה', 'קריאה', 'טיולים', 'ריקוד', 'גיימינג', 'צילום', 'ים', 'יוגה'];

/** "Who knows me better?": questions about the user, for a friend to answer on the user's phone. */
export function buildFriendQuiz(profile: UserProfile, people: Person[], entries: Entry[], userName: string): Question[] {
  const me = userName || t('החבר/ה שלך');
  const qs: Question[] = [];
  let n = 0;
  const id = () => `f${n++}`;
  const fromList = (answer: string, list: string[]) => shuffle([answer, ...shuffle(list.filter((x) => x !== answer)).slice(0, 3)]);
  const role = (p: Person) => p.note?.split(' · ')[0] ?? '';
  const mom = people.find((p) => /אמא|mom|أم/i.test(role(p)));
  const dad = people.find((p) => /אבא|dad|أب/i.test(role(p)));
  if (mom) qs.push({ id: id(), emoji: '👩', prompt: t('איך קוראים לאמא של {me}?', { me }), options: nameOptions(mom.name, people), answer: mom.name });
  if (dad) qs.push({ id: id(), emoji: '👨', prompt: t('איך קוראים לאבא של {me}?', { me }), options: nameOptions(dad.name, people), answer: dad.name });
  if (profile.city?.trim()) qs.push({ id: id(), emoji: '🏙️', prompt: t('איפה {me} גר/ה?', { me }), options: fromList(profile.city.trim(), CITIES), answer: profile.city.trim() });
  if (profile.job?.trim()) qs.push({ id: id(), emoji: '💼', prompt: t('במה {me} עוסק/ת?', { me }), options: fromList(profile.job.trim(), JOBS.map((j) => t(j))), answer: profile.job.trim() });
  const hobby = profile.hobbies?.split(/[,،]/)[0]?.trim();
  if (hobby) qs.push({ id: id(), emoji: '🎯', prompt: t('מה {me} אוהב/ת לעשות?', { me }), options: fromList(hobby, HOBBIES), answer: hobby });
  // Most mentioned friend
  const counts = new Map<string, number>();
  entries.forEach((e) => e.people.forEach((p) => counts.set(p, (counts.get(p) ?? 0) + 1)));
  const friends = people.filter((p) => circleOf(p) === 'friends').sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  if (friends[0]) qs.push({ id: id(), emoji: '🫶', prompt: t('על איזה חבר/ה {me} מדבר/ת הכי הרבה?', { me }), options: nameOptions(friends[0].name, people), answer: friends[0].name });
  if (entries.length >= 3) {
    const avgMood = Math.round(entries.reduce((a, e) => a + e.mood, 0) / entries.length);
    const moods = ['😞', '😕', '😐', '🙂', '🤩'];
    qs.push({ id: id(), emoji: '🌈', prompt: t('מה מצב הרוח הכי נפוץ של {me}?', { me }), options: fromList(moods[avgMood - 1], moods), answer: moods[avgMood - 1] });
  }
  return shuffle(qs);
}

/** A sample diary so the game can be tried before the user has real data. */
export function demoData(): { entries: Entry[]; people: Person[] } {
  const names = ['דנה', 'יוסי', 'מיכל', 'אבי', 'נועה', 'רון'];
  const people: Person[] = names.map((name, i) => ({ id: `d${i}`, name, firstSeen: new Date().toISOString() }));
  const P = (name: string) => people.find((p) => p.name === name)!.id;
  const day = (ago: number) => {
    const d = new Date();
    d.setDate(d.getDate() - ago);
    d.setHours(21, 15, 0, 0);
    return d.toISOString();
  };
  const entries: Entry[] = [
    {
      id: 'e1', createdAt: day(1), mood: 4, text: 'בעבודה דנה אמרה לי שהיא עוברת לתל אביב. אחר כך אכלתי צהריים עם יוסי.',
      people: [P('דנה'), P('יוסי')], quotes: [{ personId: P('דנה'), text: 'אני עוברת לתל אביב בחודש הבא' }],
    },
    {
      id: 'e2', createdAt: day(2), mood: 5, text: 'יום מדהים! מיכל סיפרה שהיא בהריון. אבי הביא עוגה לכל המשרד.',
      people: [P('מיכל'), P('אבי')], quotes: [{ personId: P('מיכל'), text: 'אני בהריון!' }],
    },
    {
      id: 'e3', createdAt: day(4), mood: 2, text: 'יום קשה. הפרויקט התעכב. נועה אמרה שהכל יסתדר ושאני לא צריך לדאוג.',
      people: [P('נועה')], quotes: [{ personId: P('נועה'), text: 'הכל יסתדר, אל תדאג' }],
    },
    {
      id: 'e4', createdAt: day(6), mood: 4, text: 'שיחקתי כדורגל עם רון ויוסי. רון אמר שהוא קיבל קידום.',
      people: [P('רון'), P('יוסי')], quotes: [{ personId: P('רון'), text: 'קיבלתי קידום לראש צוות' }],
    },
    {
      id: 'e5', createdAt: day(9), mood: 3, text: 'פגשתי את אבי בקפה. אבי סיפר שהוא מתכנן טיול ליפן.',
      people: [P('אבי')], quotes: [{ personId: P('אבי'), text: 'אני טס ליפן בפסח' }],
    },
  ];
  return { entries, people };
}
