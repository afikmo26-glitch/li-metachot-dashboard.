import type Anthropic from '@anthropic-ai/sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiMessage, chatInstructions, chatWithClaude, chatWithGemini, cleanMessages, GeminiError, Profile, refusalReply, Summary, summarizeWithClaude, summarizeWithGemini, summaryPrompt, transcribeWithGemini, Transcript } from './aiCore';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { decryptFromStorage, encryptForStorage } from './crypto';
import type { ChatMessage, Entry, Person, UserProfile } from './types';
import { langName, getGender, t } from '../i18n';
import { topTopics } from './topics';

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
export const hasBuiltInAi = () => !!BUILT_IN_GEMINI || inClaudeViewer();

// ---- Inside a claude.ai page (the web preview) ----
// The page's network is blocked there, so Gemini/Claude can't be reached; the viewer's own Claude answers instead.

type Sample = ((input: { role: 'user' | 'assistant'; content: string }[] | string, opts?: object) => Promise<{ text: string }>) & {
  json: <T>(input: string, opts?: object) => Promise<T>;
};
type ClaudeHost = { use: (name: string) => Promise<unknown> };

function inClaudeViewer(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as { claude?: ClaudeHost }).claude?.use;
}

let samplePromise: Promise<Sample | null> | undefined;
function viewerSample(): Promise<Sample | null> {
  if (!inClaudeViewer()) return Promise.resolve(null);
  samplePromise ??= (window as unknown as { claude: ClaudeHost }).claude.use('sample').then((s) => (s as Sample) ?? null).catch(() => null);
  return samplePromise;
}

function sampleError(e: unknown): Error {
  const code = (e as { code?: string })?.code;
  if (code === 'not_granted' || code === 'sampling_disabled') return new Error(t('צריך לאשר את השימוש ב-AI בחלון שנפתח'));
  if (code === 'rate_limited') return new Error(t('יותר מדי בקשות לשירות. נסה שוב בעוד דקה'));
  return new Error(t('שגיאה'));
}
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
export const aiReady = (c: AiConfig, mode: 'diary' | 'vent') => (inClaudeViewer() || !!c.claudeKey || !!geminiKeyOf(c) || hasServer(c)) && c[mode];

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
  // What their days are mostly about, so Yomi knows what matters to them and asks about it
  const top = topTopics(entries).slice(0, 4);
  const talks = top.length ? `lately talks most about: ${top.map((x) => `${x.topic} (${x.count} days)`).join(', ')}` : '';
  const intro = profile ? profileSummary(profile) : '';
  return {
    about: [intro, talks].filter(Boolean).join('; ') || undefined,
    name: userName || undefined,
    lang: langName(),
    gender: getGender(),
    people: people.map((p) => {
      const info = [p.circle && p.circle !== 'other' ? p.circle : '', p.note ?? ''].filter(Boolean).join(', ');
      return info ? `${p.name} (${info})` : p.name;
    }),
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
  const sample = await viewerSample();
  if (sample) {
    try {
      const { text } = await sample([{ role: 'user', content: chatInstructions(mode, profile) }, ...cleanMessages(toApi(messages))], { modelTier: 'quick', cache: false });
      return text.trim() || refusalReply(profile?.lang);
    } catch (e) {
      if ((e as { code?: string })?.code === 'refused') return refusalReply(profile?.lang);
      throw sampleError(e);
    }
  }
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
  const sample = await viewerSample();
  if (sample) {
    try {
      return await sample.json<AiSummary>(summaryPrompt(toApi(messages), profile), { modelTier: 'quick', cache: false });
    } catch (e) {
      throw sampleError(e);
    }
  }
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

/** True when a recording can be turned into text here (needs Gemini: Claude doesn't take audio). */
export const canTranscribe = (c: AiConfig) => !inClaudeViewer() && !!geminiKeyOf(c);

const AUDIO_TYPES: Record<string, string> = { m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', webm: 'audio/webm', ogg: 'audio/ogg', wav: 'audio/wav', mp3: 'audio/mp3', caf: 'audio/x-caf' };

async function audioBase64(uri: string): Promise<{ data: string; mimeType: string }> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    const url = await new Promise<string>((ok, fail) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => fail(r.error);
      r.readAsDataURL(blob);
    });
    return { data: url.slice(url.indexOf(',') + 1), mimeType: (blob.type || 'audio/webm').split(';')[0] };
  }
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? 'm4a';
  return { data: await new File(uri).base64(), mimeType: AUDIO_TYPES[ext] ?? 'audio/mp4' };
}

/** The user's spoken words from a recording, plus what the day was about. */
export async function aiTranscribe(c: AiConfig, uri: string, profile?: AiProfile): Promise<Transcript> {
  const gk = geminiKeyOf(c);
  if (!gk || inClaudeViewer()) throw new Error(t('אין חיבור ל-AI'));
  const { data, mimeType } = await audioBase64(uri);
  return withTimeout((signal) => transcribeWithGemini(gk, data, mimeType, profile, signal));
}

/** Quick connection check used by the settings screen. */
export async function aiTest(c: AiConfig): Promise<string> {
  return aiChat({ ...c, diary: true }, 'diary', [{ from: 'me', text: 'בדיקת חיבור. ענה רק במילה: מחובר' }]);
}
