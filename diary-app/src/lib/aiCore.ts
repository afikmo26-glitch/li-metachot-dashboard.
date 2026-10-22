import type Anthropic from '@anthropic-ai/sdk';

/**
 * Claude prompts and calls, shared by the app (personal-key mode) and server/ (Cloudflare Worker).
 * Keep this file free of React Native imports so the server can bundle it.
 */

export const MODEL = 'claude-opus-5-5';
const MAX_MESSAGES = 40;
const MAX_CHARS = 4000;

export type ApiMessage = { role: 'user' | 'assistant'; content: string };

/** What a day can be about; the app shows labels for these (lib/topics.ts). */
export const TOPICS = ['friends', 'family', 'work', 'studies', 'love', 'health', 'hobbies'] as const;
export type Topic = (typeof TOPICS)[number];
type Circle = 'family' | 'friends' | 'work' | 'other';
export type Profile = { name?: string; lang?: string; gender?: 'm' | 'f'; people?: string[]; recent?: string[]; about?: string };

export type Summary = {
  entry: string;
  mood: number;
  people: { name: string; note: string; circle: Circle }[];
  quotes: { name: string; text: string }[];
  tomorrow: string;
  topics: Topic[];
};

export type Transcript = { text: string; topics: Topic[] };

const CRISIS = `Safety comes first. If the user mentions suicide, wanting to die, self-harm or being in danger, even briefly or as a joke:
- Never agree with, normalize or validate the wish to die ("that's a valid feeling" is wrong here). Validate the pain, not the plan.
- Respond with warmth and take it seriously. Ask directly and gently whether they are safe right now.
- Encourage them to reach a real person now and give these Israeli lines: ער"ן 1201 (24/7, also chat at eran.org.il), סה"ר at sahar.org.il, emergency מד"א 101 / police 100. Suggest a trusted person they could be with.
- Stay with them in the conversation and keep these resources in view in later replies. Do not diagnose or give methods of any kind.`;

const DIARY_SYSTEM = `You are Yomi (יומי), a warm, curious companion inside a personal diary app. Each evening the user tells you about their day, and you chat with them like a close friend texting back.

How to reply:
- First respond to what they actually said: react with real interest or feeling and pick up a specific detail. Never ignore their message to ask a scripted question.
- Then ask at most one natural follow-up question. If they met new people, ask their names. If someone said something to them, ask what. Ask about work, small wins and what mattered.
- Now and then, weave in a meaningful check-in that fits the moment: did they move their body today, drink enough water, take a minute to breathe, eat something good, what they're grateful for. At most one every few messages, never preachy.
- Keep it short, 1 to 3 sentences, like a chat message. Use emojis sparingly.
- Write in natural, casual Hebrew (switch if the user writes in another language). Use the user's name sometimes.
- Use the profile to remember people they mentioned before and connect to earlier days when it helps.
- You are a friend, not a therapist.

${CRISIS}`;

const VENT_SYSTEM = `You are a caring listener in the private "unload" space of a diary app. The user comes here to let things out. Nothing they say here is judged.

How to reply:
- Listen first. Reflect back what you hear and name the feeling ("נשמע שאתה ממש מותש ומאוכזב").
- Validate the feelings. Never minimize, lecture or rush to fix.
- Ask one gentle, open question that helps them go deeper, or simply give space.
- When they seem ready, offer real encouragement: remind them of their strengths, give a realistic perspective and at most one small, doable next step. Motivation should feel genuine, not like a poster.
- 2 to 5 sentences, warm and human, in natural Hebrew (or the user's language).

${CRISIS}`;

const SUMMARY_SYSTEM = `You turn a chat between a user and their diary companion into a diary entry.
Write the entry in the language the profile asks for (Hebrew if none), first person, as the user would write it in their diary: what happened, who they met, what people said, how they felt. Keep their words and details; do not invent anything. 2 to 8 sentences.
Also extract: mood (1 = very bad, 5 = amazing), the people mentioned (first names as written, with a short note like "חבר מהעבודה" when the chat says who they are, else empty, and which part of the user's life they belong to: family, friends, work or other — classmates count as friends), notable things people said to the user (quotes), anything the user asked to be reminded of tomorrow (else empty), and the topics of the day from this list only: ${TOPICS.join(', ')} (studies = school, exams, university; love = a partner or dating).`;

const SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['entry', 'mood', 'people', 'quotes', 'tomorrow', 'topics'],
  properties: {
    entry: { type: 'string' },
    mood: { type: 'integer' },
    people: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'note', 'circle'],
        properties: { name: { type: 'string' }, note: { type: 'string' }, circle: { type: 'string', enum: ['family', 'friends', 'work', 'other'] } },
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
    topics: { type: 'array', items: { type: 'string', enum: TOPICS } },
  },
};

/** Shown if Claude declines to answer, so the person is never left without a reply. */
const REFUSAL_REPLIES: Record<string, string> = {
  Hebrew: 'אני כאן איתך 💜 אם קשה לך עכשיו, ער"ן זמינים 24/7 ב-1201. ספר לי עוד, במילים שלך.',
  English: "I'm here with you 💜 If things feel hard right now, ERAN is available 24/7 at 1201, or your local emergency number. Tell me more, in your own words.",
  Arabic: 'أنا هنا معك 💜 إذا كان الأمر صعبًا الآن، يمكنك الاتصال بـ ERAN على 1201 على مدار الساعة. أخبرني المزيد بكلماتك.',
};
export const refusalReply = (lang?: string) => REFUSAL_REPLIES[lang ?? 'Hebrew'] ?? REFUSAL_REPLIES.Hebrew;

/** Chat bubbles show raw text, so ask for no markdown. */
const PLAIN = '\n\nWrite plain text for a chat bubble: no markdown, no asterisks, no [link](url) syntax.';

function profileText(p: Profile | undefined) {
  if (!p) return '';
  const lines: string[] = [];
  if (p.lang) lines.push(`Always reply in ${p.lang}.`);
  if (p.gender) lines.push(`The user is ${p.gender === 'm' ? 'male' : 'female'}: use ${p.gender === 'm' ? 'masculine' : 'feminine'} forms when addressing them (Hebrew/Arabic).`);
  if (p.name) lines.push(`User's name: ${p.name}`);
  if (p.about) lines.push(`About the user (from their intro): ${p.about.slice(0, 1200)}`);
  if (p.people?.length) lines.push(`People they've mentioned before: ${p.people.slice(0, 60).join(', ')}`);
  if (p.recent?.length) lines.push(`Recent diary entries:\n${p.recent.slice(0, 5).map((r) => `- ${r.slice(0, 400)}`).join('\n')}`);
  return lines.length ? `\n\n<profile>\n${lines.join('\n')}\n</profile>` : '';
}

/** The full instructions for a chat, for providers that take them as plain text. */
export const chatInstructions = (mode: 'diary' | 'vent', profile?: Profile) => (mode === 'vent' ? VENT_SYSTEM : DIARY_SYSTEM) + PLAIN + profileText(profile);

/** The diary-entry instructions plus the transcript, as one prompt asking for the summary JSON. */
export function summaryPrompt(messages: ApiMessage[], profile?: Profile): string {
  const transcript = cleanMessages(messages)
    .map((m) => `${m.role === 'user' ? 'User' : 'Yomi'}: ${m.content}`)
    .join('\n');
  return `${SUMMARY_SYSTEM}${profileText(profile)}\n\nReply with only a JSON object of this shape: {"entry": string, "mood": 1-5, "people": [{"name": string, "note": string, "circle": "family"|"friends"|"work"|"other"}], "quotes": [{"name": string, "text": string}], "tomorrow": string, "topics": string[]}\n\n<conversation>\n${transcript}\n</conversation>`;
}

/** Keeps the conversation valid for the API: trimmed, starting with the user. */
export function cleanMessages(raw: unknown): ApiMessage[] {
  if (!Array.isArray(raw)) return [];
  const msgs = raw
    .filter((m): m is ApiMessage => !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && !!m.content.trim())
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

export async function chatWithClaude(client: Anthropic, mode: 'diary' | 'vent', messages: ApiMessage[], profile?: Profile): Promise<string> {
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: (mode === 'vent' ? VENT_SYSTEM : DIARY_SYSTEM) + PLAIN + profileText(profile),
    messages: cleanMessages(messages),
  });
  if (res.stop_reason === 'refusal') return refusalReply(profile?.lang);
  return textOf(res.content) || refusalReply(profile?.lang);
}

export async function summarizeWithClaude(client: Anthropic, messages: ApiMessage[], profile?: Profile): Promise<Summary> {
  const transcript = cleanMessages(messages)
    .map((m) => `${m.role === 'user' ? 'User' : 'Yomi'}: ${m.content}`)
    .join('\n');
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SUMMARY_SCHEMA } },
    system: SUMMARY_SYSTEM + profileText(profile),
    messages: [{ role: 'user', content: `<conversation>\n${transcript}\n</conversation>` }],
  });
  if (res.stop_reason === 'refusal') throw new Error('refused');
  return JSON.parse(textOf(res.content)) as Summary;
}

// ---- Gemini (Google AI Studio), same prompts, plain REST so it runs in the app and in the Worker ----

export const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

async function callGemini(key: string, body: unknown, signal?: AbortSignal): Promise<{ text: string; blocked: boolean }> {
  const res = await fetch(`${GEMINI_URL}/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
    signal,
  });
  const data = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (!res.ok) throw new GeminiError(data.error?.message ?? `gemini ${res.status}`, res.status);
  const c = data.candidates?.[0];
  const text = (c?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
    .trim();
  // Google's own safety filter can stop a reply (often on exactly the hard conversations): never leave the person hanging
  const blocked = !!data.promptFeedback?.blockReason || c?.finishReason === 'SAFETY' || c?.finishReason === 'PROHIBITED_CONTENT';
  return { text, blocked };
}

const toGemini = (msgs: ApiMessage[]) => cleanMessages(msgs).map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

export async function chatWithGemini(key: string, mode: 'diary' | 'vent', messages: ApiMessage[], profile?: Profile, signal?: AbortSignal): Promise<string> {
  const { text, blocked } = await callGemini(
    key,
    {
      systemInstruction: { parts: [{ text: (mode === 'vent' ? VENT_SYSTEM : DIARY_SYSTEM) + PLAIN + profileText(profile) }] },
      contents: toGemini(messages),
      generationConfig: { maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: 'low' } },
    },
    signal,
  );
  return blocked || !text ? refusalReply(profile?.lang) : text;
}

export async function summarizeWithGemini(key: string, messages: ApiMessage[], profile?: Profile, signal?: AbortSignal): Promise<Summary> {
  const transcript = cleanMessages(messages)
    .map((m) => `${m.role === 'user' ? 'User' : 'Yomi'}: ${m.content}`)
    .join('\n');
  const { text, blocked } = await callGemini(
    key,
    {
      systemInstruction: { parts: [{ text: SUMMARY_SYSTEM + profileText(profile) }] },
      contents: [{ role: 'user', parts: [{ text: `<conversation>\n${transcript}\n</conversation>` }] }],
      generationConfig: { maxOutputTokens: 4096, thinkingConfig: { thinkingLevel: 'low' }, responseMimeType: 'application/json', responseJsonSchema: SUMMARY_SCHEMA },
    },
    signal,
  );
  if (blocked || !text) throw new Error('refused');
  return JSON.parse(text) as Summary;
}

const TRANSCRIBE_SYSTEM = `You get a voice recording from a personal diary app: the user talking about their day.
Write down exactly what they said, word for word, in the language they spoke (usually Hebrew), with punctuation. Fix nothing and add nothing; leave out only filler sounds. If nothing is said, return an empty text.
Also list the topics of what they talked about, from this list only: ${TOPICS.join(', ')} (studies = school, exams, university; love = a partner or dating).`;

const TRANSCRIPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'topics'],
  properties: { text: { type: 'string' }, topics: { type: 'array', items: { type: 'string', enum: TOPICS } } },
};

/** Turns a recording (base64) into the user's words and the topics of the day. */
export async function transcribeWithGemini(key: string, audioBase64: string, mimeType: string, profile?: Profile, signal?: AbortSignal): Promise<Transcript> {
  const { text, blocked } = await callGemini(
    key,
    {
      systemInstruction: { parts: [{ text: TRANSCRIBE_SYSTEM + profileText(profile && { name: profile.name, people: profile.people }) }] },
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: audioBase64 } }, { text: 'Transcribe this recording.' }] }],
      generationConfig: { maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: 'low' }, responseMimeType: 'application/json', responseJsonSchema: TRANSCRIPT_SCHEMA },
    },
    signal,
  );
  if (blocked || !text) throw new Error('refused');
  const out = JSON.parse(text) as Transcript;
  return { text: (out.text ?? '').trim(), topics: (out.topics ?? []).filter((k) => (TOPICS as readonly string[]).includes(k)) };
}
