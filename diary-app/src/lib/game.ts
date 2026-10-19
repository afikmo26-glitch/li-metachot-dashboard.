import { dayKey, formatShortDate } from './dates';
import { maskName, mentionsName, randomCommonNames } from './names';
import type { Entry, Person } from './types';

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
        prompt: 'מי אמר לך את זה?',
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
        prompt: 'השלם את השם החסר',
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
      prompt: `את מי פגשת או הזכרת ב-${formatShortDate(e.createdAt)}?`,
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
        prompt: `מתי הזכרת לאחרונה את ${p.name}?`,
        options: shuffle([answer, ...distractors]),
        answer,
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
