// Builds legal/*.html from src/legal/texts.ts (the same text the app shows). Run: npx tsx legal/build.ts
import { writeFileSync } from 'node:fs';
import { CONTACT, LEGAL_UPDATED, PRIVACY, TERMS } from '../src/legal/texts';

type Doc = (typeof PRIVACY)['he'];
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const section = (d: Doc, dir: 'rtl' | 'ltr', lang: string) =>
  `<section dir="${dir}" lang="${lang}"><h1>${esc(d.title)}</h1><p class="d">${LEGAL_UPDATED}</p>${d.sections
    .map((s) => `<h2>${esc(s.h)}</h2>${s.p.map((p) => `<p>${esc(p)}</p>`).join('')}`)
    .join('')}</section>`;
const page = (title: string, body: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>body{font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;max-width:720px;margin:0 auto;padding:24px 16px;line-height:1.6;color:#1f1b2e;background:#faf8ff}
h1{color:#6d28d9}h2{margin-top:1.4em;font-size:1.1em}.d{color:#777;font-size:.9em}section+section{border-top:1px solid #ddd;margin-top:40px;padding-top:20px}</style></head><body>${body}</body></html>`;

writeFileSync('legal/privacy.html', page('היומן שלי — מדיניות פרטיות / Privacy policy', section(PRIVACY.he, 'rtl', 'he') + section(PRIVACY.en, 'ltr', 'en')));
writeFileSync('legal/terms.html', page('היומן שלי — תנאי שימוש / Terms', section(TERMS.he, 'rtl', 'he') + section(TERMS.en, 'ltr', 'en')));
writeFileSync(
  'legal/delete-account.html',
  page(
    'היומן שלי — מחיקת חשבון / Delete account',
    `<section dir="rtl" lang="he"><h1>מחיקת חשבון ונתונים</h1><p>באפליקציה: הגדרות ← גיבוי בענן ← "מחק את החשבון והגיבוי מהענן". החשבון והגיבוי המוצפן נמחקים מיד ולצמיתות. כל מה שעל הטלפון נמחק כשמסירים את האפליקציה.</p><p>אין גישה לאפליקציה? כתבו אל ${CONTACT} מהאימייל או עם מספר הטלפון שאיתם נרשמתם, ונמחק תוך 30 יום.</p></section>
<section dir="ltr" lang="en"><h1>Delete your account and data</h1><p>In the app: Settings → Cloud backup → "Delete account and cloud backup". The account and encrypted backup are deleted immediately and permanently. Everything on the phone is removed when you uninstall the app.</p><p>No access to the app? Email ${CONTACT} from the email or phone you signed up with and we will delete it within 30 days.</p></section>`,
  ),
);
console.log('legal pages written');
