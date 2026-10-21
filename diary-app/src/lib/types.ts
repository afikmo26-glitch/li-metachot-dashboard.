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
