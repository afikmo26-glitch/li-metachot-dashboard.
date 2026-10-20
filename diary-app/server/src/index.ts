import Anthropic from '@anthropic-ai/sdk';
import { chatWithClaude, cleanMessages, Profile, summarizeWithClaude } from '../../src/lib/aiCore';

/**
 * AI server for the diary app. The Claude API key stays here (a Cloudflare secret)
 * and never ships inside the app. Prompts and calls live in src/lib/aiCore.ts,
 * shared with the app's personal-key mode.
 *
 *   POST /chat       { mode: 'diary' | 'vent', messages, profile } -> { reply }
 *   POST /summarize  { messages, profile }                         -> { entry, mood, people, quotes, tomorrow }
 *
 * Every request must carry the header `x-app-key: <APP_KEY>`.
 */

export interface Env {
  ANTHROPIC_API_KEY: string;
  APP_KEY: string;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-app-key',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS } });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'not found' }, 404);
    if (!env.APP_KEY || req.headers.get('x-app-key') !== env.APP_KEY) return json({ error: 'unauthorized' }, 401);

    let body: { mode?: string; messages?: unknown; profile?: Profile };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'bad json' }, 400);
    }
    const messages = cleanMessages(body.messages);
    if (!messages.length) return json({ error: 'no messages' }, 400);

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const path = new URL(req.url).pathname;

    try {
      if (path === '/chat') {
        return json({ reply: await chatWithClaude(client, body.mode === 'vent' ? 'vent' : 'diary', messages, body.profile) });
      }
      if (path === '/summarize') {
        return json(await summarizeWithClaude(client, messages, body.profile));
      }
      return json({ error: 'not found' }, 404);
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) return json({ error: 'busy, try again soon' }, 429);
      if (err instanceof Anthropic.AuthenticationError) return json({ error: 'server API key is invalid' }, 500);
      if (err instanceof Anthropic.APIError) return json({ error: `ai error ${err.status ?? ''}` }, 502);
      return json({ error: 'server error' }, 500);
    }
  },
};
