import { t } from '../i18n';
import { colors } from './theme';
import type { Circle, Person } from './types';

/** Family, friends, work, everyone else: how the People list and the archive group someone. */
export const CIRCLES: { key: Circle; emoji: string; label: string; one: string; with: string }[] = [
  { key: 'family', emoji: '👨‍👩‍👧', label: 'משפחה', one: 'משפחה', with: 'ימים עם המשפחה' },
  { key: 'friends', emoji: '🫶', label: 'חברים', one: 'חבר/ה', with: 'ימים עם חברים' },
  { key: 'work', emoji: '💼', label: 'עבודה ולימודים', one: 'מהעבודה', with: 'ימים בעבודה' },
  { key: 'other', emoji: '🙂', label: 'עוד אנשים בחיים שלי', one: 'מכר/ה', with: 'ימים עם אחרים' },
];

export const circleInfo = (c: Circle) => CIRCLES.find((x) => x.key === c)!;

export const circleColor = (c: Circle | undefined) =>
  c === 'family' ? colors.pink : c === 'friends' ? colors.primaryHi : c === 'work' ? colors.blue : colors.textDim;

const FAMILY_WORDS = /אמא|אבא|אח|אחות|אחים|בן\/בת זוג|בעל|אשת|אישה|זוג|ילד|בן |בת |סבא|סבתא|דוד|דודה|בן דוד|בת דודה|גיס|mom|mother|dad|father|brother|sister|sibling|partner|wife|husband|son|daughter|kid|child|grand|aunt|uncle|cousin|أم|أب|أخ|أخت|زوج|ابن|ابنة|طفل|جد|جدة|عم|خال|عمة|خالة/i;
const FRIEND_WORDS = /חבר|friend|صديق/i;
const WORK_WORDS = /עבודה|עובד|קולגה|מנהל|בוס|לקוח|מורה|מרצה|לימודים|כיתה|work|colleague|boss|manager|client|teacher|class|عمل|زميل|مدير|معلم|دراسة/i;

/** The person's circle: what the user picked, else a guess from their note (for people saved before circles existed). */
export function circleOf(p: Person): Circle | undefined {
  if (p.circle) return p.circle;
  const role = p.note?.split(' · ')[0] ?? '';
  if (!role) return undefined;
  if (FRIEND_WORDS.test(role)) return 'friends';
  if (FAMILY_WORDS.test(role)) return 'family';
  if (WORK_WORDS.test(role)) return 'work';
  return undefined;
}

export const circleEmoji = (p: Person | undefined) => {
  const c = p && circleOf(p);
  return c ? circleInfo(c).emoji : '👤';
};

/** "Dana · close friend", or the circle's name when there is no note. */
export function relationText(p: Person): string {
  if (p.note) return p.note.split(' · ')[0];
  const c = circleOf(p);
  return c ? t(circleInfo(c).one) : '';
}
