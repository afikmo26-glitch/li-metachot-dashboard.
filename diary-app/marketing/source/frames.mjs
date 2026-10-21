// Renders an HTML animation to numbered JPEG frames by seeking every animation. Usage: node frames.mjs page.html outDir seconds fps width height
import { chromium } from 'playwright';
import fs from 'node:fs';
const [, , page, out, secs, fps, w, h] = process.argv;
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
await p.goto('file://' + page); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
const n = Math.round(secs * fps);
for (let i = 0; i < n; i++) {
  await p.evaluate((ms) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ms; }), (i * 1000) / fps);
  await p.screenshot({ path: `${out}/f${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
}
await b.close();
