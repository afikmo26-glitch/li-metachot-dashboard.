import AsyncStorage from '@react-native-async-storage/async-storage';
import { b64, decryptFromStorage, deriveKey, encryptForStorage, open, PBKDF2_ITERATIONS, randomBytes, seal } from './crypto';
import type { ChatMessage } from './types';

/**
 * The private "unload" space. Its conversations are encrypted with a key derived
 * from the space's own password (PBKDF2 → AES-256-GCM), on top of the device-level
 * encryption, so they can't be read even when the diary itself is open.
 */

const META_KEY = 'diary.vent.meta.v1';
const DATA_KEY = 'diary.vent.data.v1';
const CHECK = 'vent-ok';
export const MIN_VENT_PASSWORD = 4;

type Meta = { salt: string; iterations: number; check: string };

export type VentSession = { id: string; startedAt: string; messages: ChatMessage[] };
export type VentData = { sessions: VentSession[] };

async function loadMeta(): Promise<Meta | null> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    return raw ? (JSON.parse(await decryptFromStorage(raw)) as Meta) : null;
  } catch {
    return null;
  }
}

export async function hasVentPassword(): Promise<boolean> {
  return !!(await loadMeta());
}

export async function setupVent(password: string): Promise<Uint8Array> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const meta: Meta = { salt: b64.encode(salt), iterations: PBKDF2_ITERATIONS, check: seal(key, CHECK) };
  await AsyncStorage.setItem(META_KEY, await encryptForStorage(JSON.stringify(meta)));
  await saveVent(key, { sessions: [] });
  return key;
}

/** The space's key, or null when the password is wrong. */
export async function unlockVent(password: string): Promise<Uint8Array | null> {
  const meta = await loadMeta();
  if (!meta) return null;
  const key = await deriveKey(password, b64.decode(meta.salt), meta.iterations);
  try {
    return open(key, meta.check) === CHECK ? key : null;
  } catch {
    return null;
  }
}

export async function loadVent(key: Uint8Array): Promise<VentData> {
  try {
    const raw = await AsyncStorage.getItem(DATA_KEY);
    return raw ? (JSON.parse(open(key, raw)) as VentData) : { sessions: [] };
  } catch {
    return { sessions: [] };
  }
}

export async function saveVent(key: Uint8Array, data: VentData) {
  await AsyncStorage.setItem(DATA_KEY, seal(key, JSON.stringify(data)));
}

export async function wipeVent() {
  await AsyncStorage.multiRemove([META_KEY, DATA_KEY]);
}

// ---------- Offline listener ----------

const CRISIS_RE =
  /להתאבד|התאבדות|לשים קץ|לא רוצה לחיות|לא רוצה להיות פה|אין טעם לחיות|לפגוע בעצמי|לחתוך את עצמי|למות|רוצה למות|בא לי למות|kill myself|suicide|end my life/i;

/** True when the message suggests the person may be in danger. */
export const detectCrisis = (text: string) => CRISIS_RE.test(text);

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const FEELINGS: { re: RegExp; reflect: string[] }[] = [
  {
    re: /כועס|כועסת|עצבני|עצבנית|זועם|מתעצבן|נמאס|שונא/,
    reflect: ['אני שומע כמה כעס יש בך עכשיו, וזה מובן לגמרי.', 'נשמע שמשהו ממש עבר את הגבול בשבילך. מותר לכעוס.'],
  },
  {
    re: /עצוב|עצובה|בוכה|בכיתי|כואב לי|שבור|שבורה|מדוכא|דיכאון/,
    reflect: ['זה נשמע כואב מאוד, ואני כאן איתך בזה.', 'אני מרגיש כמה זה כבד לך. אתה לא צריך להחזיק את זה לבד.'],
  },
  {
    re: /לחוץ|לחוצה|חרדה|חרד|פוחד|פוחדת|מפחד|דואג|דואגת|מתוח/,
    reflect: ['נשמע שיש בך הרבה לחץ ודאגה עכשיו.', 'הפחד הזה נשמע ממש מתיש. בוא ננשום רגע ביחד: שאיפה ארוכה... ונשיפה איטית.'],
  },
  {
    re: /בודד|בודדה|לבד|אף אחד|אין לי עם מי/,
    reflect: ['להרגיש לבד זו אחת התחושות הקשות שיש. טוב שאתה כותב את זה כאן.', 'אני שומע כמה חסר לך מישהו לידך עכשיו.'],
  },
  {
    re: /עייף|עייפה|מותש|מותשת|שחוק|שחוקה|אין לי כוח/,
    reflect: ['נשמע שאתה פשוט גמור, גוף ונפש.', 'אין לך כוח, וזה הגיוני אחרי כל מה שאתה סוחב.'],
  },
  {
    re: /נכשלתי|כישלון|לא מספיק טוב|לא שווה|אפס|דפקתי/,
    reflect: ['אני שומע כמה אתה קשה עם עצמך עכשיו.', 'זה שמשהו לא הצליח לא אומר שאתה לא מספיק טוב.'],
  },
];

const TOPICS: { re: RegExp; ask: string[] }[] = [
  { re: /עבודה|בוס|מנהל|משרד|לקוח/, ask: ['מה הכי מעיק עליך בעבודה עכשיו?', 'מה היית רוצה שיקרה אחרת שם?'] },
  { re: /חבר|חברה|בן זוג|בת זוג|זוגיות|נפרדנו|פרידה/, ask: ['מה הכי פגע בך במה שקרה ביניכם?', 'מה היית רוצה להגיד לו או לה אם היית יכול?'] },
  { re: /אמא|אבא|הורים|משפחה|אחי|אחותי/, ask: ['מה קרה עם המשפחה שהביא את זה?', 'מה היית צריך מהם עכשיו?'] },
  { re: /כסף|חובות|משכורת|מינוס/, ask: ['לחץ כלכלי שוחק מאוד. מה הכי מדאיג אותך בזה?'] },
  { re: /לימודים|מבחן|בחינה|ציון/, ask: ['מה הכי מלחיץ אותך במבחן הזה?'] },
];

const VALIDATE = ['תודה שאתה משתף אותי.', 'מה שאתה מרגיש הגיוני.', 'אני מקשיב.', 'זה באמת לא פשוט.'];
const OPEN_QS = ['ספר לי עוד, מה עוד יושב עליך?', 'מה הכי קשה בזה בשבילך?', 'מה היית צריך עכשיו, ברגע הזה?', 'ואיך אתה מרגיש עם זה עכשיו, אחרי שכתבת?'];
const MOTIVATE = [
  'זכור: כבר עברת ימים קשים לפני, והנה אתה פה. יש בך יותר כוח ממה שאתה מרגיש עכשיו 💪',
  'לא צריך לפתור הכל הלילה. צעד קטן אחד מחר מספיק.',
  'מגיע לך את אותה סבלנות שהיית נותן לחבר טוב במצב שלך.',
  'רגשות הם כמו גלים. הגל הזה ישכך, גם אם עכשיו הוא נראה ענק 🌊',
  'זה שאתה עוצר לכתוב ולהבין מה אתה מרגיש זה כבר צעד אמיץ.',
];

/** A warm, varied reply without AI: reflect the feeling, validate, then ask or encourage. */
export function offlineVentReply(text: string, turn: number): string {
  const parts: string[] = [];
  const feeling = FEELINGS.find((f) => f.re.test(text));
  parts.push(feeling ? pick(feeling.reflect) : pick(VALIDATE));
  if (turn > 0 && turn % 3 === 0) {
    parts.push(pick(MOTIVATE));
  } else {
    const topic = TOPICS.find((t) => t.re.test(text));
    parts.push(topic ? pick(topic.ask) : pick(OPEN_QS));
  }
  return parts.join(' ');
}

export const VENT_GREETINGS = [
  'זה המקום שלך. מה שנכתב כאן נשאר כאן 🔒 מה יושב לך על הלב?',
  'אני כאן, בלי שיפוט. ספר לי מה קורה 💜',
  'אפשר לשחרר הכל כאן. מה מעיק עליך היום?',
];
