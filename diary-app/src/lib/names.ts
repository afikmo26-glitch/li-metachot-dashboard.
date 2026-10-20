import type { Person, Quote } from './types';

const WORD = '[\\u0590-\\u05FFA-Za-z\'׳]';
const NOT_WORD = `(?:^|[^\\u0590-\\u05FFA-Za-z'׳])`;
/** Hebrew one-letter prefixes that can be glued to a name: ו, ה, ב, ל, מ, ש, כ (up to two, e.g. "ולדנה") */
const PREFIX = '(?:[ושהבלמכ]{0,2})';

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function nameRegex(name: string, flags = 'g') {
  return new RegExp(`${NOT_WORD}${PREFIX}(${escapeRegex(name)})(?!${WORD})`, flags);
}

/** Common Israeli first names, used to suggest people the user hasn't tagged yet. */
const COMMON_NAMES = new Set(
  (
    'אבי אביב אילן אלעד גלעד יגאל ליאם מאור נוה עדן רועי שון אביגיל אביטל אבישג אברהם אדם אהרון אודי אודליה אופיר אופק אור אורי אוריה אורית אורן אורנה אושר איילת איתי איתן אלון אלי אליאור אליה אלינור אליעזר אלירן אלכס אלמוג אלנה אמיר אנה אסף אפרת אריאל אריה בן בני בתיה בר ברק גאיה גבי גדי גיא גיל גילה גלי גלית גל דב דבורה דוד דודי דור דורית דין דנה דני דניאל דניאלה דפנה הגר הדס הדר הילה הלל זיו חגית חיים חן חנה טל טליה טל יאיר יהודה יהונתן יובל יואב יוסי יוסף יונתן יעל יעקב יצחק ירדן ישי כרמל כרמית לאה ליאור ליאת לירון לי ליה לינוי לימור מאיה מור מורן מיכאל מיכל מירב מירי משה מתן נגה נדב נוי נועה נועם נטע ניר נעמה נתנאל סהר סיוון סתיו עדי עדן עומר עוז עידו עידן עמית ענבל ענבר עמרי ערן פזית צביקה קרן רבקה רועי רון רונה רוני רז רחל רינת רם רן רעות שגיא שגית שחר שי שירה שירן שלמה שמואל שמעון שני שקד שרה שרון תאיר תום תמר תהל אמא אבא סבתא סבא'
  ).split(' '),
);

/** Words that look like a name slot but are not names. */
const STOPWORDS = new Set(
  'אני אתה את הוא היא אנחנו אתם הם הן זה זאת כולם מישהו מישהי כל החברים חבר חברה הבוס המנהל המנהלת הצוות העבודה המשפחה ההורים לי לו לה להם שלי שלו שלה גם רק עוד כבר לא כן מה איך למה מתי איפה עם על אל יש אין היה היתה הייתה'.split(
    ' ',
  ),
);

/** Ids of known people mentioned anywhere in the text. */
export function findKnownPeople(text: string, people: Person[]): string[] {
  return people.filter((p) => p.name.trim() && nameRegex(p.name.trim(), '').test(text)).map((p) => p.id);
}

function stripPrefix(word: string): string[] {
  const out = [word];
  for (let i = 1; i <= 2 && i < word.length - 1; i++) {
    if (/^[ושהבלמכ]+$/.test(word.slice(0, i))) out.push(word.slice(i));
  }
  return out;
}

/**
 * Suggests names in the text that aren't yet known people.
 * Uses a common-names list plus patterns like "X אמר", "פגשתי את X", "דיברתי עם X".
 */
export function suggestNewNames(text: string, people: Person[]): string[] {
  const known = new Set(people.map((p) => p.name.trim()));
  const found = new Set<string>();
  // Place names that contain a first name ("תל אביב") are not people
  text = text.replace(/תל[\s-]אביב/g, ' ');
  const tokens = text.split(/[^֐-׿A-Za-z'׳]+/).filter(Boolean);

  for (const t of tokens) {
    for (const candidate of stripPrefix(t)) {
      if (COMMON_NAMES.has(candidate)) {
        found.add(candidate);
        break;
      }
    }
  }

  const patterns = [
    new RegExp(`(${WORD}{2,})\\s+(?:אמרה|אמר|סיפרה|סיפר|ביקשה|ביקש|שאלה|שאל|התקשרה|התקשר|צחקה|צחק)(?!${WORD})`, 'g'),
    new RegExp(`(?:פגשתי את|דיברתי עם|נפגשתי עם|ישבתי עם|יצאתי עם|התקשרתי ל|ראיתי את)\\s+(${WORD}{2,})`, 'g'),
  ];
  // "אכלתי עם גלעד" — but not "עם החברים" (a leading ה is the definite article, not a name)
  for (const m of text.matchAll(new RegExp(`(?:^|\\s)[וש]?עם\\s+(${WORD}{2,})`, 'g'))) {
    const w = m[1].length >= 4 && m[1].startsWith('ו') ? m[1].slice(1) : m[1];
    if (!w.startsWith('ה') && !STOPWORDS.has(w) && w.length <= 12) found.add(w);
  }
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      // "וגלעד סיפר" -> "גלעד" (a leading ו is almost always "and")
      const w = m[1].length >= 4 && m[1].startsWith('ו') ? m[1].slice(1) : m[1];
      if (!STOPWORDS.has(w) && w.length <= 12) found.add(w);
    }
  }

  return [...found].filter((n) => !known.has(n) && !STOPWORDS.has(n));
}

/**
 * Pulls out what people said: "דנה אמרה לי שהיא עוברת דירה" -> {dana, "היא עוברת דירה"}.
 * Also catches a quote in quotation marks right after the name.
 */
export function extractQuotes(text: string, people: Person[], personIds: string[]): Quote[] {
  const quotes: Quote[] = [];
  const seen = new Set<string>();
  const sentences = text.split(/(?<=[.!?\n])\s*/);
  for (const id of personIds) {
    const p = people.find((x) => x.id === id);
    if (!p) continue;
    const name = escapeRegex(p.name.trim());
    const re = new RegExp(
      `${NOT_WORD}[ו]?${name}\\s+(?:אמרה|אמר|סיפרה|סיפר|ביקשה|ביקש|שאלה|שאל|הציעה|הציע|טענה|טען|הסבירה|הסביר)(?![\\u0590-\\u05FF])(?:\\s+(?:לי|לנו|לכולם))?\\s*(?:[:,]\\s*)?(?:ש|כי\\s+)?["״“]?([^"״”.!?\\n]{4,160})`,
    );
    for (const s of sentences) {
      const m = s.match(re);
      if (m) {
        const q = m[1].trim();
        const key = id + q;
        if (!seen.has(key)) {
          seen.add(key);
          quotes.push({ personId: id, text: q });
        }
      }
    }
  }
  return quotes;
}

/** Replaces a person's name (with any glued prefix) in the text with a blank, for the game. */
export function maskName(text: string, name: string): string {
  return text.replace(nameRegex(name.trim()), (full, n: string) => full.replace(n, '_'.repeat(Math.max(3, n.length))));
}

export function mentionsName(text: string, name: string): boolean {
  return nameRegex(name.trim(), '').test(text);
}

export function randomCommonNames(count: number, exclude: string[]): string[] {
  const pool = [...COMMON_NAMES].filter((n) => !exclude.includes(n) && !['אמא', 'אבא', 'סבא', 'סבתא'].includes(n));
  const out: string[] = [];
  while (out.length < count && pool.length) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}
