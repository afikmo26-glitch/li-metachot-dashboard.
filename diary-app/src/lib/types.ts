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
};

export type Person = {
  id: string;
  name: string;
  firstSeen: string; // ISO
  note?: string;
};

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
};

export type GameStats = {
  xp: number;
  bestScore: number;
  bestCombo: number;
  gamesPlayed: number;
  totalCorrect: number;
  totalAnswered: number;
};

export const DEFAULT_SETTINGS: Settings = {
  userName: '',
  bedtimeEnabled: true,
  bedtimeHour: 22,
  bedtimeMinute: 30,
  morningRecapEnabled: true,
  morningHour: 8,
};

export const DEFAULT_GAME_STATS: GameStats = {
  xp: 0,
  bestScore: 0,
  bestCombo: 0,
  gamesPlayed: 0,
  totalCorrect: 0,
  totalAnswered: 0,
};
