import { chromium } from 'playwright'; import fs from 'fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(); p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:8791/' + (process.env.D || '') + (process.env.P || 'sheet.html')); await p.waitForFunction(() => window.ok);
const [name, out, clips, rot] = process.argv.slice(2);
const times = (process.env.T || '0.15,0.4,0.65,0.9').split(',').map(Number);
const url = await p.evaluate(([n, c, r, t]) => sheet(n, c.split(','), t, +r), [name, clips, rot || '0', times]);
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); await b.close();
