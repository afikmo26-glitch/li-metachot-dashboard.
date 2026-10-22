import Anthropic from '@anthropic-ai/sdk';
import { chatWithClaude, chatWithGemini, cleanMessages, GeminiError, Profile, summarizeWithClaude, summarizeWithGemini, transcribeWithGemini } from '../../src/lib/aiCore';
import { Env } from './env';

/**
 * AI proxy. Prompts and calls live in src/lib/aiCore.ts, shared with the app's personal-key mode.
 *
 *   POST /chat        { mode: 'diary' | 'vent', messages, profile } -> { reply }
 *   POST /summarize   { messages, profile }                         -> { entry, mood, people, quotes, tomorrow }
 *   POST /transcribe  { audio (base64), mimeType, profile? }        -> { text, topics }   (Gemini only)
 *
 * Rate limits are applied by the router before these run.
 */

export const MAX_AUDIO = 15 * 1024 * 1024;

type Body = { mode?: string; messages?: unknown; profile?: Profile } & Record<string, unknown>;

/** Gemini's per-minute limit trips on short bursts: wait and try again (1.5 s, then 4 s) before giving up. */
async function retryBusy<T>(fn: () => Promise<T>): Promise<T> {
  for (const wait of [1500, 4000]) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof GeminiError && err.status === 429)) throw err;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  return fn();
}

function geminiFailure(err: unknown): [number, unknown] {
  console.error('gemini failure', err instanceof GeminiError ? `${err.status} ${err.message}` : String(err));
  if (err instanceof GeminiError && err.status === 429) return [429, { error: 'busy, try again soon' }];
  if (err instanceof GeminiError && (err.status === 400 || err.status === 403)) return [500, { error: 'server API key is invalid' }];
  return [502, { error: 'ai error' }];
}

export async function handleTranscribe(body: Body, env: Env): Promise<[number, unknown]> {
  if (!env.GEMINI_API_KEY) return [501, { error: 'transcription not configured (GEMINI_API_KEY)' }];
  const { audio, mimeType } = body;
  if (typeof audio !== 'string' || !audio) return [400, { error: 'no audio' }];
  // base64 is 4 chars per 3 bytes
  if (Math.floor((audio.length * 3) / 4) > MAX_AUDIO) return [413, { error: 'recording too large' }];
  if (typeof mimeType !== 'string' || !/^audio\/[\w.+-]+$/.test(mimeType)) return [400, { error: 'bad mimeType' }];
  try {
    return [200, await retryBusy(() => transcribeWithGemini(env.GEMINI_API_KEY!, audio, mimeType, body.profile))];
  } catch (err) {
    return geminiFailure(err);
  }
}

export async function handleChat(path: string, body: Body, env: Env): Promise<[number, unknown]> {
  const messages = cleanMessages(body.messages);
  if (!messages.length) return [400, { error: 'no messages' }];
  const mode = body.mode === 'vent' ? 'vent' : 'diary';

  if (!env.ANTHROPIC_API_KEY && env.GEMINI_API_KEY) {
    try {
      if (path === '/chat') return [200, { reply: await retryBusy(() => chatWithGemini(env.GEMINI_API_KEY!, mode, messages, body.profile)) }];
      return [200, await retryBusy(() => summarizeWithGemini(env.GEMINI_API_KEY!, messages, body.profile))];
    } catch (err) {
      return geminiFailure(err);
    }
  }
  if (!env.ANTHROPIC_API_KEY) return [500, { error: 'no AI key on the server' }];

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    if (path === '/chat') return [200, { reply: await chatWithClaude(client, mode, messages, body.profile) }];
    return [200, await summarizeWithClaude(client, messages, body.profile)];
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return [429, { error: 'busy, try again soon' }];
    if (err instanceof Anthropic.AuthenticationError) return [500, { error: 'server API key is invalid' }];
    if (err instanceof Anthropic.APIError) return [502, { error: `ai error ${err.status ?? ''}` }];
    return [500, { error: 'server error' }];
  }
}
