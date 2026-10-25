import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(); p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:8791/'+(process.env.D||'')+'measure.html'); await p.waitForFunction(() => window.ok);
for (const m of process.argv.slice(2)) {
  const r = await p.evaluate((n) => measure(n), m);
  const bad = Object.entries(r).filter(([, x]) => x.floor || x.head).map(([k, x]) => `${k}(f${x.floor}/${x.worst} h${x.head} s${x.sink})`);
  console.log(m.padEnd(18), bad.join(' ') || 'clean');
}
await b.close();
