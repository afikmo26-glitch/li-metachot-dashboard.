import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', (e) => errs.push(e.stack.slice(0, 300))); p.on('console', (m) => m.type() === 'error' && errs.push('C:' + m.text().slice(0, 200)));
const shot = (n) => p.screenshot({ path: `g6/${n}.png` });
await p.goto('http://localhost:8777/'); await p.waitForTimeout(4000);
if (await p.locator('input[type=password]').count()) { await p.locator('input[type=password]').fill(process.env.PW); await p.keyboard.press('Enter'); await p.waitForTimeout(2500); }
await p.getByLabel('הסים שלך').first().click(); await p.waitForTimeout(5000);
if (await p.getByLabel(process.env.CH || 'פנדי', { exact: true }).count()) { await p.getByLabel(process.env.CH || 'פנדי', { exact: true }).click(); await p.waitForTimeout(400); await p.getByRole('button', { name: /^בחר את .+!$/ }).click(); await p.waitForTimeout(3000); }
await p.waitForTimeout(9000); await shot('a0-hub');
if (process.env.ONLYHUB) { console.log('errors', errs.slice(0, 6)); await b.close(); process.exit(0); }
await p.getByText('🌋 זירת הכאוס').click(); await p.waitForTimeout(800);
await p.getByLabel('לזירה!').click(); for (let i = 0; i < 5; i++) { await p.waitForTimeout(i ? 1500 : 8000); await shot('a1-t' + i); }
const fire = await p.getByLabel('ירי').boundingBox(); const joy = await p.getByLabel('ג׳ויסטיק').boundingBox();
const jx = joy.x + joy.width / 2, jy = joy.y + joy.height / 2;
const walk = async (dx, dy, ms) => { await p.mouse.move(jx, jy); await p.mouse.down(); await p.mouse.move(jx + dx, jy + dy, { steps: 4 }); await p.waitForTimeout(ms); await p.mouse.up(); };
await walk(0, -50, 1500); await shot('a2-up');
for (let k = 0; k < 5; k++) {
  for (let q = 0; q < 6; q++) { await p.mouse.move(fire.x + 40, fire.y + 40); await p.mouse.down(); await p.waitForTimeout(250); await p.mouse.up(); await p.waitForTimeout(60); }
  try { await p.getByLabel('מכת על').click({ timeout: 300 }); } catch {}
  await shot('a3-fight' + k);
}
for (let r = 0; r < 8; r++) { await walk((r % 3 - 1) * 40, -40, 900); for (let q = 0; q < 8; q++) { await p.mouse.move(fire.x + 40, fire.y + 40); await p.mouse.down(); await p.waitForTimeout(250); await p.mouse.up(); await p.waitForTimeout(60); } try { await p.getByLabel('מכת על').click({ timeout: 300 }); } catch {} await shot('a4-r' + r); }
await walk(-50, 0, 2500); await shot('a5-left');
console.log('errors', errs.slice(0, 6)); await b.close();
