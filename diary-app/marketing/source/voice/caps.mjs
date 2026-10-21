// Renders each subtitle chunk to a transparent PNG and writes caps.json with its time range.
// Usage: node caps.mjs timing.json marks.json outdir
import { chromium } from 'playwright';
import fs from 'node:fs';
const [, , timingFile, marksFile, out] = process.argv;
const timing = Object.fromEntries(JSON.parse(fs.readFileSync(timingFile, 'utf8')).map((x) => [x.id, x]));
const { segments } = JSON.parse(fs.readFileSync(marksFile, 'utf8'));
fs.mkdirSync(out, { recursive: true });
const fontCss = fs.readFileSync('/tmp/claude-0/-home-user-li-metachot-dashboard-/2e2639df-6304-5595-a915-0dca08c6fb1b/scratchpad/mkt/fonts/local.css', 'utf8')
  .replace(/url\(fonts\//g, 'url(file:///tmp/claude-0/-home-user-li-metachot-dashboard-/2e2639df-6304-5595-a915-0dca08c6fb1b/scratchpad/mkt/fonts/');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1000, height: 220 } });
const caps = []; let k = 0;
for (const s of segments) {
  const it = timing[s.id]; const total = it.cap.reduce((a, c) => a + c.length, 0); let t = s.start;
  for (const [i, c] of it.cap.entries()) {
    const d = (it.dur * c.length) / total; const last = i === it.cap.length - 1;
    await p.setContent(`<html dir="rtl"><head><meta charset="utf-8"><style>${fontCss} body{margin:0;background:transparent;display:flex;align-items:center;justify-content:center;height:220px}
      div{font-family:Rubik,sans-serif;font-weight:700;font-size:52px;line-height:1.3;color:#fff;text-align:center;max-width:940px;background:rgba(12,9,32,.82);border:2px solid rgba(196,181,253,.35);padding:16px 32px;border-radius:28px}</style></head><body><div>${c}</div></body></html>`);
    await p.evaluate(() => document.fonts.ready);
    const f = `${out}/c${k++}.png`;
    await p.screenshot({ path: f, omitBackground: true });
    caps.push({ file: f, a: +t.toFixed(2), b: +(t + d + (last ? 0.4 : 0)).toFixed(2) });
    t += d;
  }
}
fs.writeFileSync(`${out}/caps.json`, JSON.stringify(caps));
await b.close();
console.log(caps.length, 'captions');
