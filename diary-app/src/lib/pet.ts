import { t } from '../i18n';
import { dayKey } from './dates';
import { studyXp } from './study';
import type { Entry, GameStats, Person, SavingsTx, StudySession } from './types';

/**
 * The pet: a little creature that hatches, gets a name, grows with the user's levels and wears what they unlock.
 * Levels come from everything good the user does (writing, recording, streaks, the memory game, caring for the pet),
 * so the pet grows with the diary habit, not only with the game.
 */

export type Species = 'mochi' | 'cat' | 'bunny' | 'bear' | 'dragon' | 'unicorn';
export type Slot = 'color' | 'hair' | 'hat' | 'glasses' | 'neck' | 'face' | 'bg';
export type Stage = 'egg' | 'baby' | 'kid' | 'teen' | 'legend';

export type PetState = {
  hatched: boolean;
  /** Taps on the egg so far (it hatches at EGG_TAPS) */
  eggTaps: number;
  name: string;
  species: Species;
  wear: Partial<Record<Slot, string>>;
  /** 0..100, fills with petting, hugs, treats and writing; slowly fades but never hurts the pet */
  love: number;
  loveAt: string;
  treatsEaten: number;
  pets: number;
  hugs: number;
  /** XP from caring for the pet, capped per day */
  careXp: number;
  careDay: string;
  careToday: number;
  bornAt?: string;
  /** The highest level already celebrated */
  seenLevel: number;
  /** Outfit packs bought in the shop */
  packs?: string[];
  /** Friends' pets visited by code */
  friends?: { code: string; name: string }[];
};

export const DEFAULT_PET: PetState = {
  hatched: false,
  eggTaps: 0,
  name: '',
  species: 'mochi',
  wear: { color: 'grape', bg: 'room' },
  love: 60,
  loveAt: new Date(0).toISOString(),
  treatsEaten: 0,
  pets: 0,
  hugs: 0,
  careXp: 0,
  careDay: '',
  careToday: 0,
  seenLevel: 1,
};

export const EGG_TAPS = 7;
export const XP_PER_LEVEL = 200;
export const MAX_LEVEL = 10;
const CARE_XP_PER_DAY = 10;

// ---- Catalog ----

/** `pack`: an outfit pack bought in the shop (looks only, nothing else changes). */
export type Item = { id: string; slot: Slot; label: string; emoji: string; level: number; pack?: string };

export const SLOTS: { slot: Slot; label: string; emoji: string }[] = [
  { slot: 'color', label: 'צבע', emoji: '🎨' },
  { slot: 'hair', label: 'שיער', emoji: '💇' },
  { slot: 'hat', label: 'כובעים', emoji: '🎩' },
  { slot: 'glasses', label: 'משקפיים', emoji: '🕶️' },
  { slot: 'neck', label: 'צוואר', emoji: '🎀' },
  { slot: 'face', label: 'פנים', emoji: '✨' },
  { slot: 'bg', label: 'חדר', emoji: '🏠' },
];

export const ITEMS: Item[] = [
  // Colors
  { id: 'grape', slot: 'color', label: 'ענבים', emoji: '🟣', level: 1 },
  { id: 'bubblegum', slot: 'color', label: 'מסטיק', emoji: '🩷', level: 1 },
  { id: 'mint', slot: 'color', label: 'מנטה', emoji: '🟢', level: 1 },
  { id: 'sky', slot: 'color', label: 'שמיים', emoji: '🔵', level: 2 },
  { id: 'sun', slot: 'color', label: 'שמש', emoji: '🟡', level: 3 },
  { id: 'peach', slot: 'color', label: 'אפרסק', emoji: '🟠', level: 4 },
  { id: 'night', slot: 'color', label: 'לילה', emoji: '⚫', level: 5 },
  { id: 'galaxy', slot: 'color', label: 'גלקסיה', emoji: '🌌', level: 7 },
  { id: 'rainbow', slot: 'color', label: 'קשת', emoji: '🌈', level: 8 },
  { id: 'gold', slot: 'color', label: 'זהב', emoji: '🏆', level: 9 },
  { id: 'holo', slot: 'color', label: 'הולוגרמה', emoji: '💎', level: 10 },
  // Hair
  { id: 'tuft', slot: 'hair', label: 'קווצה', emoji: '🌱', level: 1 },
  { id: 'curls', slot: 'hair', label: 'תלתלים', emoji: '🌀', level: 2 },
  { id: 'ponytail', slot: 'hair', label: 'קוקו', emoji: '🎀', level: 3 },
  { id: 'mohawk', slot: 'hair', label: 'מוהוק', emoji: '🦔', level: 4 },
  { id: 'bangs', slot: 'hair', label: 'פוני', emoji: '💁', level: 5 },
  { id: 'long', slot: 'hair', label: 'ארוך ורוד', emoji: '👸', level: 6 },
  { id: 'afro', slot: 'hair', label: 'אפרו', emoji: '☁️', level: 7 },
  { id: 'rainbowhair', slot: 'hair', label: 'קשת בענן', emoji: '🌈', level: 9 },
  // Hats
  { id: 'party', slot: 'hat', label: 'כובע מסיבה', emoji: '🥳', level: 1 },
  { id: 'cap', slot: 'hat', label: 'כובע מצחייה', emoji: '🧢', level: 2 },
  { id: 'beanie', slot: 'hat', label: 'כובע צמר', emoji: '🧶', level: 3 },
  { id: 'headphones', slot: 'hat', label: 'אוזניות', emoji: '🎧', level: 4 },
  { id: 'flowers', slot: 'hat', label: 'זר פרחים', emoji: '🌸', level: 5 },
  { id: 'wizard', slot: 'hat', label: 'כובע קוסם', emoji: '🧙', level: 6 },
  { id: 'cowboy', slot: 'hat', label: 'כובע בוקרים', emoji: '🤠', level: 8 },
  { id: 'crown', slot: 'hat', label: 'כתר', emoji: '👑', level: 10 },
  // Glasses
  { id: 'round', slot: 'glasses', label: 'עגולים', emoji: '👓', level: 1 },
  { id: 'shades', slot: 'glasses', label: 'משקפי שמש', emoji: '🕶️', level: 2 },
  { id: 'hearts', slot: 'glasses', label: 'לבבות', emoji: '😍', level: 3 },
  { id: 'stars', slot: 'glasses', label: 'כוכבים', emoji: '🤩', level: 5 },
  { id: '3d', slot: 'glasses', label: 'תלת־ממד', emoji: '🎬', level: 6 },
  { id: 'pixel', slot: 'glasses', label: 'פיקסלים', emoji: '😎', level: 8 },
  // Neck
  { id: 'bowtie', slot: 'neck', label: 'פפיון', emoji: '🎀', level: 1 },
  { id: 'scarf', slot: 'neck', label: 'צעיף', emoji: '🧣', level: 3 },
  { id: 'tie', slot: 'neck', label: 'עניבה', emoji: '👔', level: 4 },
  { id: 'bandana', slot: 'neck', label: 'בנדנה', emoji: '🔺', level: 6 },
  { id: 'chain', slot: 'neck', label: 'שרשרת זהב', emoji: '📿', level: 7 },
  // Face
  { id: 'freckles', slot: 'face', label: 'נמשים', emoji: '🟤', level: 1 },
  { id: 'blushhearts', slot: 'face', label: 'סומק לבבות', emoji: '💗', level: 2 },
  { id: 'bandaid', slot: 'face', label: 'פלסטר', emoji: '🩹', level: 3 },
  { id: 'mustache', slot: 'face', label: 'שפם', emoji: '🥸', level: 4 },
  { id: 'starsticker', slot: 'face', label: 'מדבקת כוכב', emoji: '⭐', level: 5 },
  // Rooms
  { id: 'room', slot: 'bg', label: 'החדר שלי', emoji: '🛏️', level: 1 },
  { id: 'clouds', slot: 'bg', label: 'עננים', emoji: '☁️', level: 2 },
  { id: 'beach', slot: 'bg', label: 'חוף', emoji: '🏖️', level: 3 },
  { id: 'forest', slot: 'bg', label: 'יער', emoji: '🌲', level: 4 },
  { id: 'space', slot: 'bg', label: 'חלל', emoji: '🚀', level: 6 },
  { id: 'disco', slot: 'bg', label: 'דיסקו', emoji: '🪩', level: 9 },
  // Shop packs
  { id: 'strawhat', slot: 'hat', label: 'כובע קש', emoji: '👒', level: 1, pack: 'pack_summer' },
  { id: 'aviator', slot: 'glasses', label: 'משקפי טייס', emoji: '🕶️', level: 1, pack: 'pack_summer' },
  { id: 'lei', slot: 'neck', label: 'שרשרת פרחים', emoji: '🌺', level: 1, pack: 'pack_summer' },
  { id: 'halo', slot: 'hat', label: 'הילה', emoji: '😇', level: 1, pack: 'pack_magic' },
  { id: 'cape', slot: 'neck', label: 'גלימה', emoji: '🦸', level: 1, pack: 'pack_magic' },
  { id: 'sparkle', slot: 'face', label: 'נצנוצים', emoji: '✨', level: 1, pack: 'pack_magic' },
];

export const SPECIES: { id: Species; label: string; emoji: string; level: number }[] = [
  { id: 'mochi', label: 'מוצ׳י', emoji: '🍡', level: 1 },
  { id: 'cat', label: 'חתלתול', emoji: '🐱', level: 1 },
  { id: 'bunny', label: 'ארנבון', emoji: '🐰', level: 1 },
  { id: 'bear', label: 'דובון', emoji: '🐻', level: 1 },
  { id: 'dragon', label: 'דרקון', emoji: '🐲', level: 5 },
  { id: 'unicorn', label: 'חד־קרן', emoji: '🦄', level: 8 },
];

export const itemsFor = (slot: Slot) => ITEMS.filter((i) => i.slot === slot);
export const itemById = (id?: string) => ITEMS.find((i) => i.id === id);
export const unlockedAt = (level: number) => [...ITEMS.filter((i) => !i.pack), ...SPECIES.map((s) => ({ ...s, slot: 'species' as const }))].filter((i) => i.level === level);

// ---- Levels ----

const LEVEL_TITLES = ['מתחיל', 'זוכר שמות', 'חבר טוב', 'זיכרון של פיל', 'כוכב עולה', 'אלוף הזיכרון', 'נשמה טובה', 'גיבור היומן', 'מאסטר', 'אגדה'];

export function levelOf(xp: number) {
  const level = Math.min(MAX_LEVEL, Math.floor(xp / XP_PER_LEVEL) + 1);
  const max = level >= MAX_LEVEL;
  return {
    level,
    title: t(LEVEL_TITLES[level - 1]),
    progress: max ? 1 : (xp % XP_PER_LEVEL) / XP_PER_LEVEL,
    toNext: max ? 0 : XP_PER_LEVEL - (xp % XP_PER_LEVEL),
    max,
  };
}

export const levelTitle = (level: number) => t(LEVEL_TITLES[Math.min(level, MAX_LEVEL) - 1]);

export function stageOf(pet: PetState, level: number): Stage {
  if (!pet.hatched) return 'egg';
  if (level >= MAX_LEVEL) return 'legend';
  if (level >= 6) return 'teen';
  if (level >= 3) return 'kid';
  return 'baby';
}

export const STAGE_LABELS: Record<Stage, string> = { egg: '🥚 ביצה', baby: '🐣 תינוק', kid: '🧒 ילד', teen: '😎 נער', legend: '👑 אגדה' };
export const STAGE_SCALE: Record<Stage, number> = { egg: 1, baby: 0.78, kid: 0.9, teen: 1, legend: 1.04 };

/**
 * XP from habits, worked out from the data itself (so it can't be farmed by tapping):
 * a day written 20, a day with a recording +10, every full week in a row +50, each person 5 (up to 40 people),
 * a day with a savings deposit 5.
 */
export function habitXp(entries: Entry[], people: Person[], savingsTx: SavingsTx[]): number {
  const days = new Set(entries.map((e) => dayKey(e.createdAt)));
  const recDays = new Set(entries.filter((e) => e.audioUri).map((e) => dayKey(e.createdAt)));
  let weeks = 0;
  let run = 0;
  for (const d of [...days].sort()) {
    const prev = new Date(`${d}T12:00:00`);
    prev.setDate(prev.getDate() - 1);
    run = days.has(dayKey(prev)) ? run + 1 : 1;
    if (run % 7 === 0) weeks++;
  }
  const saveDays = new Set(savingsTx.filter((x) => x.amount > 0).map((x) => dayKey(x.at)));
  return days.size * 20 + recDays.size * 10 + weeks * 50 + Math.min(people.length, 40) * 5 + saveDays.size * 5;
}

export const totalXp = (game: GameStats, pet: PetState, entries: Entry[], people: Person[], savingsTx: SavingsTx[], study: StudySession[] = []) =>
  game.xp + pet.careXp + habitXp(entries, people, savingsTx) + studyXp(study);

/** Love fades by 1 point an hour, down to 20 (the pet misses you, it never gets sick). */
export function currentLove(pet: PetState, now = Date.now()): number {
  const hours = Math.max(0, (now - new Date(pet.loveAt).getTime()) / 3600000);
  return Math.max(Math.min(pet.love, 20), Math.round(pet.love - hours));
}

/** Petting, a hug or a treat: more love, and a little XP (at most CARE_XP_PER_DAY a day). */
export function care(pet: PetState, love: number, xp: number, kind?: 'pets' | 'hugs' | 'treatsEaten'): PetState {
  const today = dayKey(new Date());
  const careToday = pet.careDay === today ? pet.careToday : 0;
  const gain = Math.max(0, Math.min(xp, CARE_XP_PER_DAY - careToday));
  return {
    ...pet,
    love: Math.min(100, currentLove(pet) + love),
    loveAt: new Date().toISOString(),
    careXp: pet.careXp + gain,
    careDay: today,
    careToday: careToday + gain,
    ...(kind ? { [kind]: pet[kind] + 1 } : {}),
  };
}

/** One treat for every day written; eating one is a care action. */
export const treatsLeft = (pet: PetState, entries: Entry[]) => Math.max(0, new Set(entries.map((e) => dayKey(e.createdAt))).size - pet.treatsEaten);

export const isNight = (d = new Date()) => d.getHours() >= 23 || d.getHours() < 6;

/** What the pet says: depends on the time, love, whether the user wrote today and the streak. */
export function petLine(pet: PetState, userName: string, wroteToday: boolean, love: number, d = new Date(), todayMood?: number): string {
  const name = userName || '';
  const h = d.getHours();
  if (isNight(d)) return t('זזז… 😴 (לילה טוב{name})', { name: name ? `, ${name}` : '' });
  if (todayMood !== undefined && todayMood <= 2) return t('ראיתי שהיה לך יום קשה… אני פה. בא לך חיבוק? 🫂');
  if (todayMood === 5 && d.getMinutes() % 2 === 0) return t('איזה יום מעולה היה לך! אני כל כך שמח 🎉');
  if (love < 35) return t('התגעגעתי אליך 🥺 בוא נשב קצת ביחד?');
  if (!wroteToday && h >= 18) return t('ספרת לי כבר איך היה היום? אני סקרן! 👀');
  const pool = [
    h < 12 ? t('בוקר טוב{name}! ☀️ איזה כיף שבאת', { name: name ? ` ${name}` : '' }) : h < 18 ? t('היי{name}! 👋 התגעגעתי', { name: name ? ` ${name}` : '' }) : t('ערב טוב{name} 🌙', { name: name ? ` ${name}` : '' }),
    t('תלטף אותי? 🥰'),
    t('בא לי חיבוק! 🤗'),
    t('אני מרגיש שאני גדל… 🌱'),
    wroteToday ? t('תודה שסיפרת לי על היום 💜') : t('מה קרה היום? ספר לי הכל!'),
    pet.wear.hat ? t('ראית את הכובע החדש שלי? 😎') : t('בא לי להתלבש! נבחר משהו מהארון? 👕'),
  ];
  return pool[Math.floor(d.getTime() / 20000) % pool.length];
}
