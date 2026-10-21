// Narrated walkthrough: records the real app and logs when each narration line should start.
import { chromium } from 'playwright';
import fs from 'node:fs';
const [, , O, timingFile] = process.argv;
const dur = Object.fromEntries(JSON.parse(fs.readFileSync(timingFile, 'utf8')).map((x) => [x.id, x.dur]));
fs.mkdirSync(O, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 450, height: 975 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.addInitScript(() => {
  if (localStorage.getItem('seeded')) return; localStorage.setItem('seeded', '1');
  const day = (ago, h) => { const d = new Date(); d.setDate(d.getDate() - ago); d.setHours(h, 14, 0, 0); return d.toISOString(); };
  const c = [['friends', 'חברה מהצבא'], ['friends', 'חבר קרוב'], ['work', 'מהעבודה'], ['work', 'מהעבודה'], ['family', 'אחות']];
  const people = ['דנה', 'יוסי', 'מיכל', 'אבי', 'נועה'].map((n, i) => ({ id: 'p' + i, name: n, firstSeen: day(30, 20), circle: c[i][0], note: c[i][1] }));
  const entries = [
    { id: 'x1', createdAt: day(1, 22), mood: 4, text: 'בעבודה דנה סיפרה שהיא עוברת לתל אביב. אחר כך אכלתי צהריים עם יוסי.', people: ['p0', 'p1'], quotes: [{ personId: 'p0', text: 'אני עוברת לתל אביב' }] },
    { id: 'x2', createdAt: day(2, 21), mood: 5, text: 'יום מדהים! מיכל סיפרה שהיא בהריון. אבי הביא עוגה לכל המשרד.', people: ['p2', 'p3'], quotes: [{ personId: 'p2', text: 'אני בהריון!' }] },
    { id: 'x3', createdAt: day(4, 23), mood: 2, text: 'יום קשה, הפרויקט התעכב. נועה אמרה שהכל יסתדר.', people: ['p4'], quotes: [{ personId: 'p4', text: 'הכל יסתדר' }] },
    { id: 'x4', createdAt: day(6, 22), mood: 3, text: 'קפה עם אבי ודנה.', people: ['p3', 'p0'], quotes: [] },
    { id: 'x5', createdAt: day(9, 21), mood: 4, text: 'שיחקתי כדורגל עם יוסי. הוא קיבל קידום!', people: ['p1', 'p0'], quotes: [{ personId: 'p1', text: 'קיבלתי קידום' }] },
  ];
  localStorage.setItem('diary.people.v1', JSON.stringify(people)); localStorage.setItem('diary.entries.v1', JSON.stringify(entries));
  localStorage.setItem('diary.prefs.v1', JSON.stringify({ lang: 'he', theme: 'night', sounds: false }));
});
const cdp = await ctx.newCDPSession(p);
const frames = [];
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const f = `${O}/s${String(frames.length).padStart(5, '0')}.jpg`;
  fs.writeFileSync(f, Buffer.from(data, 'base64')); frames.push([f, metadata.timestamp]);
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
const w = (ms) => p.waitForTimeout(ms);
const type = async (loc, text) => { await loc.click(); await loc.pressSequentially(text, { delay: 40 }); };
const marks = [];
let stepStart = 0, stepId = null;
const step = async (id) => { if (stepId) await until(stepStart + dur[stepId] + 0.45); stepId = id; stepStart = Date.now() / 1000; marks.push({ id, at: stepStart }); };
const until = async (t) => { const ms = (t - Date.now() / 1000) * 1000; if (ms > 0) await w(ms); };

await p.goto('http://localhost:8766/'); await w(1500);
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 900, maxHeight: 1950 }); await w(600);
await step('d1'); await w(2600);
await p.getByText('כבר מכיר/ה — ישר להרשמה').click();
await step('d2'); await w(500);
await type(p.getByPlaceholder('השם שלך (איך לקרוא לך)'), 'נועם');
await p.getByPlaceholder('שם משתמש (באנגלית)').fill('noam');
await p.getByPlaceholder('סיסמה (לפחות 6 תווים)').fill('123456'); await p.getByPlaceholder('אימות סיסמה').fill('123456');
await type(p.getByPlaceholder('אימייל או מספר טלפון (לשחזור סיסמה)'), 'noam@gmail.com');
await until(stepStart + dur.d2 - 0.3);
await p.getByText('צור חשבון', { exact: true }).last().click(); await w(700);
await p.getByText('הבא', { exact: true }).click(); await w(300); await p.getByText('הבא', { exact: true }).click(); await w(500);
await step('d3');
const ins = p.getByPlaceholder('שם', { exact: true });
await type(ins.nth(0), 'רחל'); await type(ins.nth(1), 'משה'); await w(200);
await p.getByText('הבא', { exact: true }).click(); await w(500);
await type(p.getByPlaceholder('חבר/ה 1'), 'עומר'); await type(p.getByPlaceholder('מאיפה?').first(), 'מהתיכון');
await until(stepStart + dur.d3); await p.getByText('הבא', { exact: true }).click(); await w(400);
await p.getByText('סיימנו! 🎉').click(); await w(400);
await step('d4'); await w(1500);
await until(stepStart + dur.d4 + 0.8);
await p.getByText('יאללה, ממשיכים 🚀').click(); await w(600);
await p.getByText('אשר התראות וסיים').click(); await w(900);
await p.getByText(/דבר עם יומי/).click(); await w(900);
await step('d5');
await type(p.getByPlaceholder(/כתוב או הכתב/), 'היה יום מעולה! נפגשתי עם עומר'); await p.getByLabel('שלח').click(); await w(1800);
await until(stepStart + dur.d5 + 0.3);
await p.getByText('סגור', { exact: false }).first().click().catch(() => {}); await w(500);
await p.getByText('אנשים', { exact: true }).last().click(); await w(300);
await step('d6'); await w(1500); await p.mouse.wheel(0, 500);
await p.getByText('ארכיון', { exact: true }).last().click(); await w(300);
await step('d7'); await w(1800); await p.mouse.wheel(0, 300);
await until(stepStart + dur.d7 + 0.3);
await p.getByText('היום', { exact: true }).last().click(); await w(700);
await p.getByText('החודש שלך מוכן!').click(); await w(300);
await step('d8'); await w(2200); await p.mouse.click(110, 520); await w(1700); await p.mouse.click(110, 520);
await step('d9'); await w(600); await p.mouse.click(110, 520);
await until(stepStart + dur.d9 + 1.6);
await cdp.send('Page.stopScreencast');
const t0 = frames[0][1];
let list = '';
for (let i = 0; i < frames.length; i++) {
  const d = i + 1 < frames.length ? frames[i + 1][1] - frames[i][1] : 0.5;
  list += `file '${frames[i][0]}'\nduration ${Math.max(d, 0.001).toFixed(4)}\n`;
}
list += `file '${frames[frames.length - 1][0]}'\n`;
fs.writeFileSync(`${O}/list.txt`, list);
const segs = marks.map((m) => ({ id: m.id, start: +(m.at - t0 + 0.15).toFixed(3) }));
fs.writeFileSync(`${O}/marks.json`, JSON.stringify({ segments: segs, end: +(frames.at(-1)[1] - t0).toFixed(2) }));
console.log('frames', frames.length, 'secs', (frames.at(-1)[1] - t0).toFixed(1), JSON.stringify(segs));
await ctx.close(); await b.close();
