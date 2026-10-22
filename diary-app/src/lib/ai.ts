import type Anthropic from '@anthropic-ai/sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiMessage, chatWithClaude, chatWithGemini, GeminiError, Profile, Summary, summarizeWithClaude, summarizeWithGemini } from './aiCore';
import { decryptFromStorage, encryptForStorage } from './crypto';
import type { ChatMessage, Entry, Person, UserProfile } from './types';
import { langName, getGender, t } from '../i18n';

/**
 * Ways to reach the AI, first match wins:
 * - Personal Claude key: the user's own key, kept encrypted on this phone; the app calls Claude directly.
 * - Gemini key (Google AI Studio): typed in Settings, or built into this build via EXPO_PUBLIC_GEMINI_API_KEY.
 * - Server: the diary's AI server (server/ in the repo) holds the key; the app sends the shared app key.
 */

const KEY = 'diary.ai.v1';
const TIMEOUT_MS = 60_000;

export type AiConfig = { claudeKey: string; geminiKey?: string; url: string; appKey: string; diary: boolean; vent: boolean };
export const EMPTY_AI: AiConfig = { claudeKey: '', geminiKey: '', url: '', appKey: '', diary: true, vent: true };

/** A Gemini key baked into this build (from .env, never committed); a key typed in Settings takes precedence. */
const BUILT_IN_GEMINI = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const geminiKeyOf = (c: AiConfig) => c.geminiKey?.trim() || BUILT_IN_GEMINI;
export const hasBuiltInAi = () => !!BUILT_IN_GEMINI;
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
export const aiReady = (c: AiConfig, mode: 'diary' | 'vent') => (!!c.claudeKey || !!geminiKeyOf(c) || hasServer(c)) && c[mode];

/** A one-line description of the user for Yomi, built from the intro answers. */
export function profileSummary(p: UserProfile): string {
  return [
    p.age && `age ${p.age}`,
    p.city && `lives in ${p.city}`,
    p.job && `works as / is: ${p.job}${p.workplace ? ` at ${p.workplace}` : ''}`,
    p.familyName && `family name ${p.familyName}`,
    p.hobbies && `enjoys ${p.hobbies}`,
    p.goals.length > 0 && `wants the diary to help with: ${p.goals.join(', ')}`,
  ]
    .filter(Boolean)
    .join('; ');
}

export function buildProfile(userName: string, people: Person[], entries: Entry[], profile?: UserProfile): AiProfile {
  return {
    about: profile ? profileSummary(profile) || undefined : undefined,
    name: userName || undefined,
    lang: langName(),
    gender: getGender(),
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

function geminiError(e: unknown): Error {
  if (e instanceof GeminiError) {
    if (e.status === 400 || e.status === 401 || e.status === 403) return new Error(t('מפתח Gemini לא תקין'));
    if (e.status === 429) return new Error(t('יותר מדי בקשות לשירות. נסה שוב בעוד דקה'));
    return new Error(t('שגיאת Gemini {code}', { code: e.status }));
  }
  if (e instanceof Error && e.name === 'AbortError') return new Error(t('אין חיבור לאינטרנט'));
  return e instanceof TypeError ? new Error(t('אין חיבור לאינטרנט')) : e instanceof Error ? e : new Error(t('שגיאה'));
}

/** Runs a Gemini call with the same timeout as the other providers. */
async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fn(ctrl.signal);
  } catch (e) {
    throw geminiError(e);
  } finally {
    clearTimeout(timer);
  }
}

function friendlyError(e: unknown): Error {
  const Anthropic = sdk;
  if (!Anthropic) return e instanceof Error ? e : new Error(t('שגיאה'));
  if (e instanceof Anthropic.AuthenticationError) return new Error(t('מפתח Claude לא תקין'));
  if (e instanceof Anthropic.PermissionDeniedError) return new Error(t('למפתח אין הרשאה. בדוק את החשבון ב-console.anthropic.com'));
  if (e instanceof Anthropic.RateLimitError) return new Error(t('יותר מדי בקשות או שנגמר הקרדיט'));
  if (e instanceof Anthropic.APIConnectionError) return new Error(t('אין חיבור לאינטרנט'));
  if (e instanceof Anthropic.APIError) return new Error(t('שגיאת Claude {code}', { code: e.status ?? '' }));
  return e instanceof Error ? e : new Error(t('שגיאה'));
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
    if (!res.ok) throw new Error(data?.error || t('שגיאה {code}', { code: res.status }));
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
  const gk = geminiKeyOf(c);
  if (gk) return withTimeout((signal) => chatWithGemini(gk, mode, toApi(messages), profile, signal));
  const { reply } = await post<{ reply: string }>(c, '/chat', { mode, messages: toApi(messages), profile });
  if (!reply) throw new Error(t('תשובה ריקה'));
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
  const gk = geminiKeyOf(c);
  if (gk) return withTimeout((signal) => summarizeWithGemini(gk, toApi(messages), profile, signal));
  return post<AiSummary>(c, '/summarize', { messages: toApi(messages), profile });
}

/** Quick connection check used by the settings screen. */
export async function aiTest(c: AiConfig): Promise<string> {
  return aiChat({ ...c, diary: true }, 'diary', [{ from: 'me', text: 'בדיקת חיבור. ענה רק במילה: מחובר' }]);
}
