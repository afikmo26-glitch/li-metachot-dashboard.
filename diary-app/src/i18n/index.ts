import { ar } from './ar';
import { arF } from './ar-f';
import { en } from './en';
import { heF } from './he-f';
import { heM } from './he-m';

/**
 * Translations keyed by the Hebrew source text: t('איך היה היום?') returns the
 * Hebrew as-is, or its English / Arabic translation. Placeholders look like {name}.
 * The app remounts after a language change, so t() can be called during render.
 */

export type Lang = 'he' | 'en' | 'ar';

export const LANGS: { code: Lang; label: string; rtl: boolean }[] = [
  { code: 'he', label: 'עברית', rtl: true },
  { code: 'en', label: 'English', rtl: false },
  { code: 'ar', label: 'العربية', rtl: true },
];

const DICTS: Record<Lang, Record<string, string> | null> = { he: null, en, ar };

let current: Lang = 'he';

/** How the user wants to be addressed. Unset keeps the neutral "את/ה" forms. */
export type Gender = 'm' | 'f';
let gender: Gender | undefined;
export function setGender(g: Gender | undefined) {
  gender = g;
}
export const getGender = () => gender;

export function setLang(l: Lang) {
  current = l;
}

export const getLang = () => current;
export const isRTL = () => LANGS.find((l) => l.code === current)!.rtl;

export function t(he: string, params?: Record<string, string | number>): string {
  // Gendered wording first (Hebrew male/female, Arabic female), then the plain translation
  let s =
    (current === 'he' && gender === 'm' ? heM[he] : current === 'he' && gender === 'f' ? heF[he] : current === 'ar' && gender === 'f' ? arF[he] : undefined) ??
    DICTS[current]?.[he] ??
    he;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Language name for AI prompts. */
export const langName = () => ({ he: 'Hebrew', en: 'English', ar: 'Arabic' })[current];
