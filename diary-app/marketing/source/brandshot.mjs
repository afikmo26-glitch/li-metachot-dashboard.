import { chromium } from 'playwright';
const [, , page, out] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const sizes = { wordmark: [1600, 600], 'wordmark-light': [1600, 600], feature: [1024, 500], square: [1080, 1080], demobg: [1080, 1920] };
for (const [v, [w, h]] of Object.entries(sizes)) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto('file://' + page); await p.evaluate((v) => (document.body.dataset.v = v), v);
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/${v}.png` }); await p.close();
}
await b.close();
