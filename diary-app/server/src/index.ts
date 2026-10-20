import Anthropic from '@anthropic-ai/sdk';

/**
 * AI server for the diary app. The Claude API key stays here (a Cloudflare secret)
 * and never ships inside the app.
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

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type Profile = { name?: string; people?: string[]; recent?: string[] };

const MODEL = 'claude-opus-5-5';
const MAX_MESSAGES = 40;
const MAX_CHARS = 4000;

const CRISIS = `If the user mentions wanting to die, hurting themselves or being in danger: respond with warmth, take it seriously, encourage them to reach a person now, and give these Israeli lines: ער"ן 1201 (24/7, also chat at eran.org.il), סה"ר at sahar.org.il, and emergency 101 (מד"א) / 100 (police). Do not diagnose.`;

const DIARY_SYSTEM = `You are Yomi (יומי), a warm, curious companion inside a personal diary app. Each evening the user tells you about their day, and you chat with them like a close friend texting back.

How to reply:
- First respond to what they actually said: react with real interest or feeling and pick up a specific detail. Never ignore their message to ask a scripted question.
- Then ask at most one natural follow-up question. If they met new people, ask their names. If someone said something to them, ask what. Ask about work, small wins and what mattered.
- Now and then, weave in a meaningful check-in that fits the moment: did they move their body today, drink enough water, take a minute to breathe, eat something good, what they're grateful for. At most one every few messages, never preachy.
- Keep it short, 1 to 3 sentences, like a chat message. Use emojis sparingly.
- Write in natural, casual Hebrew (switch if the user writes in another language). Use the user's name sometimes.
- Use the profile to remember people they mentioned before and connect to earlier days when it helps.
- You are a friend, not a therapist. ${CRISIS}`;

const VENT_SYSTEM = `You are a caring listener in the private "unload" space of a diary app. The user comes here to let things out. Nothing they say here is judged.

How to reply:
- Listen first. Reflect back what you hear and name the feeling ("נשמע שאתה ממש מותש ומאוכזב").
- Validate. Never minimize, lecture or rush to fix.
- Ask one gentle, open question that helps them go deeper, or simply give space.
- When they seem ready, offer real encouragement: remind them of their strengths, give a realistic perspective and at most one small, doable next step. Motivation should feel genuine, not like a poster.
- 2 to 5 sentences, warm and human, in natural Hebrew (or the user's language).
- ${CRISIS}`;

const SUMMARY_SYSTEM = `You turn a chat between a user and their diary companion into a diary entry.
Write the entry in Hebrew, first person, as the user would write it in their diary: what happened, who they met, what people said, how they felt. Keep their words and details; do not invent anything. 2 to 8 sentences.
Also extract: mood (1 = very bad, 5 = amazing), the people mentioned (first names as written, with a short note like "חבר מהעבודה" when the chat says who they are, else empty), notable things people said to the user (quotes), and anything the user asked to be reminded of tomorrow (else empty).`;

const SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['entry', 'mood', 'people', 'quotes', 'tomorrow'],
  properties: {
    entry: { type: 'string' },
    mood: { type: 'integer' },
    people: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'note'],
        properties: { name: { type: 'string' }, note: { type: 'string' } },
      },
    },
    quotes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'text'],
        properties: { name: { type: 'string' }, text: { type: 'string' } },
      },
    },
    tomorrow: { type: 'string' },
  },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-app-key',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS } });
}

function profileText(p: Profile | undefined) {
  if (!p) return '';
  const lines = [];
  if (p.name) lines.push(`User's name: ${p.name}`);
  if (p.people?.length) lines.push(`People they've mentioned before: ${p.people.slice(0, 60).join(', ')}`);
  if (p.recent?.length) lines.push(`Recent diary entries:\n${p.recent.slice(0, 5).map((r) => `- ${r.slice(0, 400)}`).join('\n')}`);
  return lines.length ? `\n\n<profile>\n${lines.join('\n')}\n</profile>` : '';
}

/** Keeps the conversation valid for the API: trimmed, alternating, starting with the user. */
function cleanMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const msgs = raw
    .filter((m): m is ChatMessage => !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && !!m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))
    .slice(-MAX_MESSAGES);
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  return msgs;
}

function textOf(content: Anthropic.Beta.BetaContentBlock[]) {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
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
        const system = (body.mode === 'vent' ? VENT_SYSTEM : DIARY_SYSTEM) + profileText(body.profile);
        const res = await client.beta.messages.create({
          model: MODEL,
          max_tokens: 8000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'low' },
          system,
          messages,
        });
        if (res.stop_reason === 'refusal') {
          return json({ reply: 'אני כאן איתך. ספר לי עוד, במילים שלך 💜' });
        }
        return json({ reply: textOf(res.content) });
      }

      if (path === '/summarize') {
        const transcript = messages.map((m) => `${m.role === 'user' ? 'User' : 'Yomi'}: ${m.content}`).join('\n');
        const res = await client.beta.messages.create({
          model: MODEL,
          max_tokens: 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'medium', format: { type: 'json_schema', schema: SUMMARY_SCHEMA } },
          system: SUMMARY_SYSTEM + profileText(body.profile),
          messages: [{ role: 'user', content: `<conversation>\n${transcript}\n</conversation>` }],
        });
        if (res.stop_reason === 'refusal') return json({ error: 'refused' }, 422);
        return json(JSON.parse(textOf(res.content)));
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
