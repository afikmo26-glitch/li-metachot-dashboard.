import type Anthropic from '@anthropic-ai/sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiMessage, chatWithClaude, Profile, Summary, summarizeWithClaude } from './aiCore';
import { decryptFromStorage, encryptForStorage } from './crypto';
import type { ChatMessage, Entry, Person } from './types';

/**
 * Two ways to reach Claude:
 * - Personal key: the user's own Claude API key, kept encrypted on this phone; the app calls Claude directly.
 * - Server: the diary's AI server (server/ in the repo) holds the key; the app sends the shared app key.
 * The personal key wins when both are set.
 */

const KEY = 'diary.ai.v1';
const TIMEOUT_MS = 60_000;

export type AiConfig = { claudeKey: string; url: string; appKey: string; diary: boolean; vent: boolean };
export const EMPTY_AI: AiConfig = { claudeKey: '', url: '', appKey: '', diary: true, vent: true };
export type AiProfile = Profile;
export type AiSummary = Summary;

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

const hasServer = (c: AiConfig) => !!c.url && !!c.appKey;
export const aiReady = (c: AiConfig, mode: 'diary' | 'vent') => (!!c.claudeKey || hasServer(c)) && c[mode];

export function buildProfile(userName: string, people: Person[], entries: Entry[]): AiProfile {
  return {
    name: userName || undefined,
    people: people.map((p) => (p.note ? `${p.name} (${p.note})` : p.name)),
    recent: entries.slice(0, 5).map((e) => `${e.createdAt.slice(0, 10)}: ${e.text}`),
  };
}

const toApi = (msgs: ChatMessage[]): ApiMessage[] => msgs.map((m) => ({ role: m.from === 'me' ? 'user' : 'assistant', content: m.text }));

type Sdk = typeof Anthropic;
let sdk: Sdk | undefined;

/** Loaded on first use, so the app starts even if the library can't load on some device. */
async function loadSdk(): Promise<Sdk> {
  if (!sdk) sdk = (await import('@anthropic-ai/sdk')).default;
  return sdk;
}

async function claude(c: AiConfig) {
  const Claude = await loadSdk();
  // The key belongs to this user and is typed in on their own phone, never shipped in the app.
  return new Claude({ apiKey: c.claudeKey, dangerouslyAllowBrowser: true, timeout: TIMEOUT_MS, maxRetries: 1 });
}

function friendlyError(e: unknown): Error {
  const Anthropic = sdk;
  if (!Anthropic) return e instanceof Error ? e : new Error('שגיאה');
  if (e instanceof Anthropic.AuthenticationError) return new Error('מפתח Claude לא תקין');
  if (e instanceof Anthropic.PermissionDeniedError) return new Error('למפתח אין הרשאה. בדוק את החשבון ב-console.anthropic.com');
  if (e instanceof Anthropic.RateLimitError) return new Error('יותר מדי בקשות או שנגמר הקרדיט');
  if (e instanceof Anthropic.APIConnectionError) return new Error('אין חיבור לאינטרנט');
  if (e instanceof Anthropic.APIError) return new Error(`שגיאת Claude ${e.status ?? ''}`);
  return e instanceof Error ? e : new Error('שגיאה');
}

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
  if (c.claudeKey) {
    try {
      return await chatWithClaude(await claude(c), mode, toApi(messages), profile);
    } catch (e) {
      throw friendlyError(e);
    }
  }
  const { reply } = await post<{ reply: string }>(c, '/chat', { mode, messages: toApi(messages), profile });
  if (!reply) throw new Error('תשובה ריקה');
  return reply;
}

export async function aiSummarize(c: AiConfig, messages: ChatMessage[], profile?: AiProfile): Promise<AiSummary> {
  if (c.claudeKey) {
    try {
      return await summarizeWithClaude(await claude(c), toApi(messages), profile);
    } catch (e) {
      throw friendlyError(e);
    }
  }
  return post<AiSummary>(c, '/summarize', { messages: toApi(messages), profile });
}

/** Quick connection check used by the settings screen. */
export async function aiTest(c: AiConfig): Promise<string> {
  return aiChat({ ...c, diary: true }, 'diary', [{ from: 'me', text: 'בדיקת חיבור. ענה רק במילה: מחובר' }]);
}
