import type { Topic } from './aiCore';
export type Quote = {
  personId: string;
  text: string;
};

export type Entry = {
  id: string;
  /** ISO timestamp — exact date and time the entry was recorded */
  createdAt: string;
  text: string;
  audioUri?: string;
  durationMs?: number;
  mood: number; // 1..5
  people: string[]; // person ids
  quotes: Quote[];
  /** The conversation with the diary bot, when the entry was made by chatting */
  chat?: ChatMessage[];
  /** Optional photo of the day (a copy inside the app's folder) */
  photoUri?: string;
  /** "Three good things" from today */
  gratitude?: string[];
  /** Hours slept last night */
  sleep?: number;
  /** Worked out today */
  workout?: boolean;
  /** What the day was about (friends, family, work, studies…) */
  topics?: Topic[];
};

/** Something a person said that is worth asking about later ("Dana has a job interview"). */
export type FollowUp = {
  id: string;
  personId: string;
  /** What they said, as saved in the entry */
  text: string;
  /** Short topic key used to phrase the question, e.g. 'interview' */
  topic: string;
  createdAt: string;
  /** When to ask about it */
  due: string;
  done?: boolean;
};

/** A place the user works at (for the shift clock). */
export type Workplace = {
  id: string;
  name: string;
  emoji: string;
  /** Hourly wage, for the pay estimate */
  wage?: number;
  role?: string;
  /** Overtime: after how many hours a day, on by default (8h, then 125% for 2h and 150% after) */
  overtime?: { enabled: boolean; after: number };
  /** Shabbat premium: rate in % and the Friday-to-Saturday window (hours), on by default */
  shabbat?: { enabled: boolean; rate: number; friFrom: number; satUntil: number };
};

/** One worked shift. A shift that ends after midnight has end on the next day. */
export type Shift = {
  id: string;
  workplaceId: string;
  start: string; // ISO
  end: string; // ISO
  breakMin?: number;
  note?: string;
  /** Worked on a holiday: paid like Shabbat */
  holiday?: boolean;
};

/** The shift that is running right now (clocked in, not out yet). */
export type ActiveShift = { workplaceId: string; start: string; notificationId?: string };

/** "Let's save": something the user is saving money for. */
export type SavingsGoal = {
  id: string;
  name: string;
  emoji: string;
  target: number;
  /** "YYYY-MM-DD", optional */
  deadline?: string;
  createdAt: string;
  done?: boolean;
};

/** Money added to (or taken out of, when negative) a savings goal. */
export type SavingsTx = {
  id: string;
  goalId: string;
  amount: number;
  at: string; // ISO
  method: 'bank' | 'cash' | 'other';
  note?: string;
};

/** A personal goal with weekly check-ins. */
export type Goal = {
  id: string;
  title: string;
  createdAt: string;
  checkins: { at: string; progress: number }[];
  done?: boolean;
};

export type ChatMessage = { from: 'bot' | 'me'; text: string };

/** Which part of the user's life someone belongs to. */
export type Circle = 'family' | 'friends' | 'work' | 'other';

export type Person = {
  id: string;
  name: string;
  firstSeen: string; // ISO
  note?: string;
  circle?: Circle;
  /** "MM-DD" */
  birthday?: string;
  /** What they like: hobbies, food, brands… (gift ideas come from here) */
  likes?: string;
  gifts?: string[];
};

/** What the user shared in the first-run "getting to know you" questions. */
export type UserProfile = {
  done: boolean;
  age?: string;
  city?: string;
  job?: string;
  workplace?: string;
  familyName?: string;
  hobbies?: string;
  goals: string[];
};

export const EMPTY_PROFILE: UserProfile = { done: false, goals: [] };

export type EventKind = 'birthday' | 'anniversary' | 'event';

export type CalendarEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  kind: EventKind;
  yearly: boolean;
  notificationId?: string;
};

export type Settings = {
  userName: string;
  bedtimeEnabled: boolean;
  bedtimeHour: number;
  bedtimeMinute: number;
  morningRecapEnabled: boolean;
  morningHour: number;
  /** Daily reminder to add a photo of the day; off unless the user turns it on */
  photoReminder: boolean;
  /** Weekly "time to save" reminder */
  savingsReminder?: boolean;
};

export type GameStats = {
  xp: number;
  bestScore: number;
  bestCombo: number;
  gamesPlayed: number;
  totalCorrect: number;
  totalAnswered: number;
  /** Weekly challenges already rewarded, as "weekKey:challengeId" */
  challengesDone?: string[];
};

export const DEFAULT_SETTINGS: Settings = {
  userName: '',
  bedtimeEnabled: true,
  bedtimeHour: 22,
  bedtimeMinute: 30,
  morningRecapEnabled: true,
  morningHour: 8,
  photoReminder: false,
};

export const DEFAULT_GAME_STATS: GameStats = {
  xp: 0,
  bestScore: 0,
  bestCombo: 0,
  gamesPlayed: 0,
  totalCorrect: 0,
  totalAnswered: 0,
};
