import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { b64urlEncode, clearJwksCache, verifySession } from '../src/jwt';
import { call, fetchCalls, makeEnv, mockFetch, restoreFetch, signIn } from './helpers';

// ── a local RSA key standing in for Google's / Apple's ──
let priv: CryptoKey;
let jwk: JsonWebKey;
const KID = 'test-kid-1';

async function idToken(claims: Record<string, unknown>, kid = KID) {
  const head = b64urlEncode(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const body = b64urlEncode(JSON.stringify(claims));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', priv, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64urlEncode(new Uint8Array(sig))}`;
}

const now = () => Math.floor(Date.now() / 1000);
const googleClaims = (extra: Record<string, unknown> = {}) => ({
  iss: 'https://accounts.google.com',
  aud: 'web-client.apps.googleusercontent.com',
  sub: '1234567890',
  email: 'dana@gmail.com',
  name: 'Dana',
  iat: now(),
  exp: now() + 3600,
  ...extra,
});

const jwksHandler = (url: string) =>
  url === 'https://www.googleapis.com/oauth2/v3/certs' || url === 'https://appleid.apple.com/auth/keys'
    ? new Response(JSON.stringify({ keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }] }), { headers: { 'cache-control': 'public, max-age=3600' } })
    : undefined;

const geminiHandler = (url: string) =>
  url.startsWith('https://generativelanguage.googleapis.com/')
    ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ text: 'היום היה יום טוב', topics: ['friends', 'nope'] }) }] }, finishReason: 'STOP' }] }))
    : undefined;

before(async () => {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  priv = pair.privateKey;
  jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
});
beforeEach(() => {
  clearJwksCache();
  mockFetch(jwksHandler, geminiHandler);
});
after(restoreFetch);

describe('basics', () => {
  test('app key is required', async () => {
    const env = makeEnv();
    assert.equal((await call(env, 'GET', '/sync/meta', undefined, { appKey: null })).status, 401);
    assert.equal((await call(env, 'GET', '/sync/meta', undefined, { appKey: 'wrong' })).status, 401);
  });
  test('unknown route is a JSON 404', async () => {
    const res = await call(makeEnv(), 'GET', '/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'not found');
  });
  test('CORS preflight', async () => {
    const env = makeEnv();
    const { default: worker } = await import('../src/index');
    const res = await worker.fetch(new Request('https://diary.test/sync', { method: 'OPTIONS' }), env);
    assert.match(res.headers.get('access-control-allow-headers') ?? '', /authorization/);
    assert.match(res.headers.get('access-control-allow-methods') ?? '', /DELETE/);
  });
});

describe('sign in by code', () => {
  test('start + verify returns a session token', async () => {
    const env = makeEnv();
    const start = await call(env, 'POST', '/auth/code/start', { contact: 'Dana@Example.com' });
    assert.equal(start.status, 200);
    assert.equal(start.body.ok, true);
    assert.match(start.body.devCode, /^\d{6}$/);
    assert.equal(fetchCalls.length, 0, 'no email provider configured → nothing sent');

    const res = await call(env, 'POST', '/auth/code/verify', { contact: 'dana@example.com', code: start.body.devCode });
    assert.equal(res.status, 200);
    assert.equal(res.body.uid, 'e:dana@example.com');
    assert.equal(res.body.isNew, true);
    assert.equal(await verifySession('test-session-secret', res.body.token), 'e:dana@example.com');

    // a code works once
    const again = await call(env, 'POST', '/auth/code/verify', { contact: 'dana@example.com', code: start.body.devCode });
    assert.equal(again.status, 400);
  });

  test('phone numbers give p: uids and send SMS through Twilio when configured', async () => {
    const env = makeEnv({ TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't', TWILIO_FROM: '+15550000000' });
    mockFetch((url) => (url.includes('api.twilio.com') ? new Response('{}', { status: 201 }) : undefined));
    const start = await call(env, 'POST', '/auth/code/start', { contact: '+972501234567' });
    assert.equal(start.status, 200);
    assert.ok(fetchCalls.some((u) => u.includes('api.twilio.com')));
    const res = await call(env, 'POST', '/auth/code/verify', { contact: '+972501234567', code: start.body.devCode });
    assert.equal(res.body.uid, 'p:+972501234567');
  });

  test('without DEV_CODES the code is not returned, and no provider means 501', async () => {
    const env = makeEnv({ DEV_CODES: undefined });
    assert.equal((await call(env, 'POST', '/auth/code/start', { contact: 'a@b.co' })).status, 501);
    const env2 = makeEnv({ DEV_CODES: undefined, RESEND_API_KEY: 'r', MAIL_FROM: 'x@y.z' });
    mockFetch((url) => (url === 'https://api.resend.com/emails' ? new Response('{}') : undefined));
    const res = await call(env2, 'POST', '/auth/code/start', { contact: 'a@b.co' });
    assert.deepEqual(res.body, { ok: true });
  });

  test('bad contact is rejected', async () => {
    assert.equal((await call(makeEnv(), 'POST', '/auth/code/start', { contact: 'not-a-contact' })).status, 400);
  });

  test('5 wrong codes burn the code', async () => {
    const env = makeEnv();
    const contact = 'lock@example.com';
    const { body } = await call(env, 'POST', '/auth/code/start', { contact });
    const wrong = body.devCode === '000000' ? '111111' : '000000';
    for (let i = 1; i <= 4; i++) {
      const r = await call(env, 'POST', '/auth/code/verify', { contact, code: wrong });
      assert.equal(r.status, 400);
      assert.equal(r.body.triesLeft, 5 - i);
    }
    const fifth = await call(env, 'POST', '/auth/code/verify', { contact, code: wrong });
    assert.equal(fifth.body.error, 'too many tries');
    const right = await call(env, 'POST', '/auth/code/verify', { contact, code: body.devCode });
    assert.equal(right.status, 400, 'even the right code fails now');
    assert.equal(right.body.error, 'code expired');
  });

  test('max 5 sends per hour', async () => {
    const env = makeEnv();
    for (let i = 0; i < 5; i++) assert.equal((await call(env, 'POST', '/auth/code/start', { contact: 'spam@example.com' })).status, 200);
    assert.equal((await call(env, 'POST', '/auth/code/start', { contact: 'spam@example.com' })).status, 429);
  });

  test('works with only CODES missing (codes go to DATA) and the old /recover route still works', async () => {
    const env = makeEnv({ RESEND_API_KEY: 'r', MAIL_FROM: 'x@y.z' });
    mockFetch((url) => (url === 'https://api.resend.com/emails' ? new Response('{}') : undefined));
    const res = await call(env, 'POST', '/recover/start', { contact: 'old@example.com', lang: 'he' });
    assert.deepEqual(res.body, { ok: true });
    assert.equal(env.DATA.keys('rc:').length, 1);
  });

  test('refresh issues a new token and needs a valid one', async () => {
    const env = makeEnv();
    const { token } = await signIn(env);
    const res = await call(env, 'POST', '/auth/refresh', {}, { token });
    assert.equal(res.status, 200);
    assert.equal(await verifySession('test-session-secret', res.body.token), 'e:dana@example.com');
    assert.equal((await call(env, 'POST', '/auth/refresh', {}, { token: token + 'x' })).status, 401);
  });
});

describe('Google / Apple', () => {
  test('valid Google token', async () => {
    const env = makeEnv();
    const res = await call(env, 'POST', '/auth/google', { idToken: await idToken(googleClaims()) });
    assert.equal(res.status, 200);
    assert.equal(res.body.uid, 'g:1234567890');
    assert.equal(res.body.email, 'dana@gmail.com');
    assert.equal(res.body.name, 'Dana');
    assert.equal(res.body.isNew, true);
    // keys are cached
    await call(env, 'POST', '/auth/google', { idToken: await idToken(googleClaims({ aud: 'android-client.apps.googleusercontent.com' })) });
    assert.equal(fetchCalls.filter((u) => u.includes('googleapis.com/oauth2')).length, 1);
  });

  test('wrong audience', async () => {
    const res = await call(makeEnv(), 'POST', '/auth/google', { idToken: await idToken(googleClaims({ aud: 'someone-else' })) });
    assert.equal(res.status, 401);
    assert.equal(res.body.reason, 'bad audience');
  });

  test('expired', async () => {
    const res = await call(makeEnv(), 'POST', '/auth/google', { idToken: await idToken(googleClaims({ exp: now() - 3600 })) });
    assert.equal(res.status, 401);
    assert.equal(res.body.reason, 'token expired');
  });

  test('wrong issuer and tampered signature', async () => {
    const env = makeEnv();
    assert.equal((await call(env, 'POST', '/auth/google', { idToken: await idToken(googleClaims({ iss: 'https://evil.example' })) })).body.reason, 'bad issuer');
    const t = await idToken(googleClaims());
    const [h, , s] = t.split('.');
    const forged = `${h}.${b64urlEncode(JSON.stringify(googleClaims({ sub: 'other' })))}.${s}`;
    assert.equal((await call(env, 'POST', '/auth/google', { idToken: forged })).body.reason, 'bad signature');
  });

  test('valid Apple token', async () => {
    const res = await call(makeEnv(), 'POST', '/auth/apple', {
      identityToken: await idToken({ iss: 'https://appleid.apple.com', aud: 'com.example.diary', sub: '001.abc', iat: now(), exp: now() + 600 }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.uid, 'a:001.abc');
  });
});

describe('encrypted sync', () => {
  test('user routes need a session token', async () => {
    const env = makeEnv();
    for (const [m, p] of [['GET', '/sync/meta'], ['GET', '/sync'], ['PUT', '/sync'], ['DELETE', '/account'], ['PUT', '/pet'], ['GET', '/pet'], ['POST', '/pet/ABCDEF/heart']]) {
      const r = await call(env, m, p, m === 'GET' || m === 'DELETE' ? undefined : {});
      assert.equal(r.status, 401, `${m} ${p}`);
    }
    assert.equal((await call(env, 'GET', '/sync/meta', undefined, { token: 'garbage' })).status, 401);
  });

  test('put / get / meta / conflict', async () => {
    const env = makeEnv();
    const { token } = await signIn(env);
    assert.deepEqual((await call(env, 'GET', '/sync/meta', undefined, { token })).body, { exists: false });
    assert.equal((await call(env, 'GET', '/sync', undefined, { token })).status, 404);

    const put1 = await call(env, 'PUT', '/sync', { blob: 'QUJDRA==', salt: 's1', updatedAt: '2026-10-22T10:00:00.000Z' }, { token });
    assert.deepEqual(put1.body, { ok: true, version: 1 });
    const meta = await call(env, 'GET', '/sync/meta', undefined, { token });
    assert.deepEqual(meta.body, { exists: true, updatedAt: '2026-10-22T10:00:00.000Z', size: 8, salt: 's1', version: 1 });
    const get = await call(env, 'GET', '/sync', undefined, { token });
    assert.deepEqual(get.body, { blob: 'QUJDRA==', salt: 's1', updatedAt: '2026-10-22T10:00:00.000Z', version: 1 });

    const put2 = await call(env, 'PUT', '/sync', { blob: 'RUZHSA==', salt: 's1', updatedAt: '2026-10-22T11:00:00.000Z', baseVersion: 1 }, { token });
    assert.equal(put2.body.version, 2);
    const stale = await call(env, 'PUT', '/sync', { blob: 'SUpLTA==', salt: 's1', updatedAt: '2026-10-22T12:00:00.000Z', baseVersion: 1 }, { token });
    assert.equal(stale.status, 409);
    assert.deepEqual(stale.body, { version: 2, updatedAt: '2026-10-22T11:00:00.000Z' });

    // sign-in now reports an existing backup
    assert.equal((await signIn(env)).isNew, false);
    // other users don't see it
    const other = await signIn(env, 'other@example.com');
    assert.deepEqual((await call(env, 'GET', '/sync/meta', undefined, { token: other.token })).body, { exists: false });
  });

  test('too large blob → 413, bad fields → 400', async () => {
    const env = makeEnv();
    const { token } = await signIn(env);
    const big = await call(env, 'PUT', '/sync', { blob: 'A'.repeat(20 * 1024 * 1024 + 4), salt: 's', updatedAt: new Date().toISOString() }, { token });
    assert.equal(big.status, 413);
    assert.equal((await call(env, 'PUT', '/sync', { blob: 'not base64!', salt: 's', updatedAt: new Date().toISOString() }, { token })).status, 400);
    assert.equal((await call(env, 'PUT', '/sync', { blob: 'QQ==', salt: 's', updatedAt: 'yesterday' }, { token })).status, 400);
  });
});

describe('pets', () => {
  const card = { name: 'מוצ׳י', species: 'mochi', wear: { color: 'grape', hat: 'crown' }, level: 3, stage: 'kid' };

  test('put / get / visit / hearts', async () => {
    const env = makeEnv();
    const a = await signIn(env, 'a@example.com');
    const b = await signIn(env, 'b@example.com');

    assert.deepEqual((await call(env, 'GET', '/pet', undefined, { token: a.token })).body, { hearts: 0 });
    const put = await call(env, 'PUT', '/pet', { card }, { token: a.token });
    assert.equal(put.status, 200);
    assert.match(put.body.code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    const code = put.body.code;
    // stable code
    assert.equal((await call(env, 'PUT', '/pet', { card: { ...card, level: 4 } }, { token: a.token })).body.code, code);

    const visit = await call(env, 'GET', `/pet/${code}`);
    assert.equal(visit.status, 200);
    assert.deepEqual(visit.body, { card: { ...card, level: 4 }, hearts: 0 });
    assert.equal((await call(env, 'GET', `/pet/${code.toLowerCase()}`)).status, 200);
    assert.equal((await call(env, 'GET', '/pet/ZZZZZZ')).status, 404);

    const h1 = await call(env, 'POST', `/pet/${code}/heart`, {}, { token: b.token });
    assert.deepEqual(h1.body, { ok: true, hearts: 1 });
    const h2 = await call(env, 'POST', `/pet/${code}/heart`, {}, { token: b.token });
    assert.deepEqual(h2.body, { ok: true, hearts: 1, already: true });
    const self = await call(env, 'POST', `/pet/${code}/heart`, {}, { token: a.token });
    assert.equal(self.status, 400);

    const mine = await call(env, 'GET', '/pet', undefined, { token: a.token });
    assert.equal(mine.body.code, code);
    assert.equal(mine.body.hearts, 1);
    assert.ok(mine.body.lastHeartAt);
  });

  test('card validation', async () => {
    const env = makeEnv();
    const { token } = await signIn(env);
    for (const bad of [
      { ...card, name: 'x'.repeat(17) },
      { ...card, name: '' },
      { ...card, level: 'high' },
      { ...card, wear: { hat: 5 } },
      { ...card, wear: ['crown'] },
      { ...card, species: 42 },
      null,
    ]) {
      assert.equal((await call(env, 'PUT', '/pet', { card: bad }, { token })).status, 400, JSON.stringify(bad));
    }
  });
});

describe('account deletion', () => {
  test('wipes backup, pet and code', async () => {
    const env = makeEnv();
    const { token } = await signIn(env);
    await call(env, 'PUT', '/sync', { blob: 'QUJDRA==', salt: 's', updatedAt: new Date().toISOString() }, { token });
    const { body } = await call(env, 'PUT', '/pet', { card: { name: 'Bo', species: 'cat', wear: {}, level: 1, stage: 'egg' } }, { token });
    assert.ok(env.DATA.keys('sync:').length === 2 && env.DATA.keys('pet:').length === 2);

    assert.deepEqual((await call(env, 'DELETE', '/account', undefined, { token })).body, { ok: true });
    assert.deepEqual(env.DATA.keys('sync:'), []);
    assert.deepEqual(env.DATA.keys('pet:'), []);
    assert.equal((await call(env, 'GET', `/pet/${body.code}`)).status, 404);
    assert.deepEqual((await call(env, 'GET', '/sync/meta', undefined, { token })).body, { exists: false });
  });
});

describe('AI', () => {
  test('transcribe through Gemini', async () => {
    const env = makeEnv();
    const res = await call(env, 'POST', '/transcribe', { audio: 'AAAA', mimeType: 'audio/m4a' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { text: 'היום היה יום טוב', topics: ['friends'] });
    assert.equal((await call(makeEnv({ GEMINI_API_KEY: undefined }), 'POST', '/transcribe', { audio: 'AAAA', mimeType: 'audio/m4a' })).status, 501);
    const big = await call(env, 'POST', '/transcribe', { audio: 'A'.repeat(21 * 1024 * 1024), mimeType: 'audio/m4a' });
    assert.equal(big.status, 413);
  });

  test('daily limits return 429 (per IP without a token, per account with one)', async () => {
    const env = makeEnv();
    // transcribe: 40 a day
    for (let i = 0; i < 40; i++) assert.equal((await call(env, 'POST', '/transcribe', { audio: 'AAAA', mimeType: 'audio/m4a' })).status, 200);
    const over = await call(env, 'POST', '/transcribe', { audio: 'AAAA', mimeType: 'audio/m4a' });
    assert.equal(over.status, 429);
    assert.deepEqual(over.body, { error: 'rate_limited' });
    // another IP is fine
    assert.equal((await call(env, 'POST', '/transcribe', { audio: 'AAAA', mimeType: 'audio/m4a' }, { ip: '198.51.100.7' })).status, 200);
    // signed in: counted per account, even from the exhausted IP
    const { token } = await signIn(env);
    assert.equal((await call(env, 'POST', '/transcribe', { audio: 'AAAA', mimeType: 'audio/m4a' }, { token })).status, 200);

    // chat + summarize: 300 a day (pre-fill the counter)
    const key = env.DATA.keys('rl:transcribe:ip:203.0.113.1:')[0].replace('transcribe', 'ai');
    await env.DATA.put(key, '300');
    assert.equal((await call(env, 'POST', '/chat', { mode: 'diary', messages: [{ role: 'user', content: 'hi' }] })).status, 429);
    await env.DATA.put(key, '299');
    mockFetch((url) => (url.startsWith('https://generativelanguage') ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'שלום!' }] } }] })) : undefined));
    const ok = await call(env, 'POST', '/chat', { mode: 'diary', messages: [{ role: 'user', content: 'hi' }] });
    assert.deepEqual(ok.body, { reply: 'שלום!' });
    assert.equal((await call(env, 'POST', '/summarize', { messages: [{ role: 'user', content: 'hi' }] })).status, 429);
  });
});

describe('crash reports', () => {
  test('stored truncated with a TTL, rate limited per IP', async () => {
    const env = makeEnv();
    const res = await call(env, 'POST', '/crash', { message: 'x'.repeat(900), stack: 'y'.repeat(9000), platform: 'android', version: '1.2.3', at: '2026-10-22T10:00:00Z' });
    assert.deepEqual(res.body, { ok: true });
    const keys = env.DATA.keys('crash:');
    assert.equal(keys.length, 1);
    assert.match(keys[0], /^crash:\d{4}-\d\d-\d\dT[\d:.]+Z:[0-9a-f]+$/);
    const saved = JSON.parse(env.DATA.store.get(keys[0])!.value);
    assert.equal(saved.message.length, 500);
    assert.equal(saved.stack.length, 4000);
    assert.equal(saved.platform, 'android');
    assert.ok(env.DATA.store.get(keys[0])!.exp! > Date.now() + 29 * 86400_000);

    for (let i = 1; i < 50; i++) await call(env, 'POST', '/crash', { message: 'boom' });
    assert.equal((await call(env, 'POST', '/crash', { message: 'boom' })).status, 429);
    assert.equal((await call(env, 'POST', '/crash', {})).status, 400);
  });
});

describe('pet arena', () => {
  const card = (extra: Record<string, unknown> = {}) => ({ name: 'ספרקי', species: 'YellowDragon', level: 12, trophies: 150, wins: 4, equip: { weapon: { id: 'Sword', level: 3 } }, ...extra });
  const secretA = 'a'.repeat(32);
  const secretB = 'b'.repeat(32);

  test('profile, leaderboard and opponents', async () => {
    const env = makeEnv();
    const a = await call(env, 'PUT', '/arena/profile', { secret: secretA, card: card() });
    assert.equal(a.status, 200);
    assert.match(a.body.id, /^[a-f0-9]{16}$/);
    assert.equal(a.body.rank, 1);
    const b = await call(env, 'PUT', '/arena/profile', { secret: secretB, card: card({ name: 'בו', species: 'Ghost', trophies: 120 }) });
    assert.equal(b.body.rank, 2);

    // same secret, same id
    assert.equal((await call(env, 'PUT', '/arena/profile', { secret: secretA, card: card({ trophies: 180 }) })).body.id, a.body.id);

    const top = await call(env, 'GET', `/arena/top?id=${a.body.id}`);
    assert.equal(top.body.rows.length, 2);
    assert.equal(top.body.rows[0].name, 'ספרקי');
    assert.equal(top.body.rows[0].me, true);
    assert.deepEqual(top.body.me, { rank: 1, trophies: 180 });

    // A gets B as an opponent, never itself
    const opp = await call(env, 'GET', `/arena/opponent?t=180&id=${a.body.id}`);
    assert.equal(opp.body.card.name, 'בו');
    const none = await call(env, 'GET', `/arena/opponent?t=5000&id=${a.body.id}`);
    assert.equal(none.body.card, null);
  });

  test('trophy jumps are capped and bad cards refused', async () => {
    const env = makeEnv();
    const first = await call(env, 'PUT', '/arena/profile', { secret: secretA, card: card({ trophies: 9000 }) });
    assert.equal(first.body.trophies, 200); // a new player starts at most at 200
    const next = await call(env, 'PUT', '/arena/profile', { secret: secretA, card: card({ trophies: 9000 }) });
    assert.equal(next.body.trophies, 280); // +80 at most per save
    for (const bad of [card({ name: '' }), card({ name: '<script>' }), card({ level: 501 }), card({ equip: { boots: { id: 'X', level: 1 } } }), card({ species: 'a b' })]) {
      assert.equal((await call(env, 'PUT', '/arena/profile', { secret: secretB, card: bad })).status, 400, JSON.stringify(bad));
    }
    assert.equal((await call(env, 'PUT', '/arena/profile', { secret: 'short', card: card() })).status, 400);
  });
});
