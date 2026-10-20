import AsyncStorage from '@react-native-async-storage/async-storage';
import { decryptFromStorage, encryptForStorage } from './crypto';
import type { ChatMessage, Entry, Person } from './types';

/**
 * Talks to the diary's AI server (see server/ in the repo), which holds the Claude
 * API key. The app only knows the server URL and the shared app key.
 */

const KEY = 'diary.ai.v1';
const TIMEOUT_MS = 60_000;

export type AiConfig = { url: string; appKey: string; diary: boolean; vent: boolean };
export const EMPTY_AI: AiConfig = { url: '', appKey: '', diary: true, vent: true };

export async function loadAiConfig(): Promise<AiConfig> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...EMPTY_AI, ...JSON.parse(await decryptFromStorage(raw)) } : EMPTY_AI;
  } catch {
    return EMPTY_AI;
  }
}

export async function saveAiConfig(c: AiConfig) {
  await AsyncStorage.setItem(KEY, await encryptForStorage(JSON.stringify(c)));
}

export const aiReady = (c: AiConfig, mode: 'diary' | 'vent') => !!c.url && !!c.appKey && c[mode];

export type AiProfile = { name?: string; people?: string[]; recent?: string[] };

export function buildProfile(userName: string, people: Person[], entries: Entry[]): AiProfile {
  return {
    name: userName || undefined,
    people: people.map((p) => (p.note ? `${p.name} (${p.note})` : p.name)),
    recent: entries.slice(0, 5).map((e) => `${e.createdAt.slice(0, 10)}: ${e.text}`),
  };
}

const toApi = (msgs: ChatMessage[]) => msgs.map((m) => ({ role: m.from === 'me' ? 'user' : 'assistant', content: m.text }));

async function post<T>(c: AiConfig, path: string, body: unknown): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(c.url.replace(/\/+$/, '') + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-app-key': c.appKey },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `שגיאה ${res.status}`);
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function aiChat(c: AiConfig, mode: 'diary' | 'vent', messages: ChatMessage[], profile?: AiProfile): Promise<string> {
  const { reply } = await post<{ reply: string }>(c, '/chat', { mode, messages: toApi(messages), profile });
  if (!reply) throw new Error('תשובה ריקה');
  return reply;
}

export type AiSummary = {
  entry: string;
  mood: number;
  people: { name: string; note: string }[];
  quotes: { name: string; text: string }[];
  tomorrow: string;
};

export async function aiSummarize(c: AiConfig, messages: ChatMessage[], profile?: AiProfile): Promise<AiSummary> {
  return post<AiSummary>(c, '/summarize', { messages: toApi(messages), profile });
}

/** Quick connection check used by the settings screen. */
export async function aiTest(c: AiConfig): Promise<string> {
  return aiChat({ ...c, diary: true }, 'diary', [{ from: 'me', text: 'בדיקת חיבור. ענה רק במילה: מחובר' }]);
}
