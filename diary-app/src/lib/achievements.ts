import { computeStreak, dayKey } from './dates';
import type { Entry, GameStats, Person } from './types';

export type Achievement = { id: string; emoji: string; title: string; hint: string; done: boolean; progress: number };

/** Badges earned from using the diary and playing the game. */
export function achievements(entries: Entry[], people: Person[], game: GameStats): Achievement[] {
  const days = new Set(entries.map((e) => dayKey(e.createdAt)));
  const streak = computeStreak(days);
  const quotes = entries.reduce((a, e) => a + e.quotes.length, 0);
  const chats = entries.filter((e) => e.chat?.length).length;
  const list: [string, string, string, string, number, number][] = [
    ['first', '✍️', 'יום ראשון', 'שמור רשומה ראשונה', days.size, 1],
    ['week', '🔥', 'שבוע ברצף', '7 ימים ברצף ביומן', streak, 7],
    ['month', '🏅', 'חודש של זיכרונות', '30 ימים ביומן', days.size, 30],
    ['friends', '👥', 'חברותי', 'הזכר 10 אנשים', people.length, 10],
    ['quotes', '💬', 'אוזן קשבת', 'שמור 20 משפטים שאמרו לך', quotes, 20],
    ['chat', '💜', 'שיחה עם יומי', 'כתוב 5 ימים דרך השיחה', chats, 5],
    ['player', '🎮', 'שחקן', 'שחק 5 משחקים', game.gamesPlayed, 5],
    ['memory', '🧠', 'זיכרון של פיל', 'הגע ל-1500 נקודות במשחק אחד', game.bestScore, 1500],
  ];
  return list.map(([id, emoji, title, hint, value, goal]) => ({
    id,
    emoji,
    title,
    hint,
    done: value >= goal,
    progress: Math.min(1, value / goal),
  }));
}
