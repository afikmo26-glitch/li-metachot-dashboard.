import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { getLang, isRTL, t } from '../i18n';
import { circleInfo, circleOf } from './circles';
import { formatLongDate, formatTime } from './dates';
import { photoDataUri } from './photos';
import { personName } from './store';
import { MOODS } from './theme';
import type { Entry, Person } from './types';

/** The year as a printable book (PDF): a cover, the year in numbers, the people, then every day. */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const MAX_PHOTOS = 80;

export async function buildYearBookHtml(year: number, entries: Entry[], people: Person[], userName: string): Promise<string> {
  const es = entries.filter((e) => new Date(e.createdAt).getFullYear() === year).reverse();
  const counts = new Map<string, number>();
  es.forEach((e) => e.people.forEach((p) => counts.set(p, (counts.get(p) ?? 0) + 1)));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const avg = es.length ? es.reduce((a, e) => a + e.mood, 0) / es.length : 3;
  let photos = 0;
  const days: string[] = [];
  for (const e of es) {
    let img = '';
    if (e.photoUri && photos < MAX_PHOTOS) {
      const src = await photoDataUri(e.photoUri);
      if (src) {
        img = `<img src="${src}" class="photo">`;
        photos++;
      }
    }
    const names = e.people.map((p) => esc(personName(people, p))).join(' · ');
    const quotes = e.quotes.map((q) => `<div class="quote">"${esc(q.text)}" — ${esc(personName(people, q.personId))}</div>`).join('');
    const thanks = e.gratitude?.length ? `<div class="thanks">🙏 ${e.gratitude.map(esc).join(' · ')}</div>` : '';
    days.push(`<section class="day"><div class="date">${esc(formatLongDate(e.createdAt))} · ${formatTime(e.createdAt)} <span class="mood">${MOODS[e.mood - 1]}</span></div>
      ${img}<p>${esc(e.text || t('🎙️ הקלטה קולית'))}</p>${quotes}${thanks}${names ? `<div class="people">💞 ${names}</div>` : ''}</section>`);
  }
  const peopleHtml = top
    .map(([id, n]) => {
      const p = people.find((x) => x.id === id);
      const c = p && circleOf(p);
      return `<li>${c ? circleInfo(c).emoji : '👤'} <b>${esc(personName(people, id))}</b> — ${t('הוזכר/ה {n} פעמים', { n })}</li>`;
    })
    .join('');
  const dir = isRTL() ? 'rtl' : 'ltr';
  return `<!doctype html><html lang="${getLang()}" dir="${dir}"><head><meta charset="utf-8"><style>
    @page { margin: 18mm 16mm; }
    body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #2e1065; }
    .cover { height: 92vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-after: always;
             background: linear-gradient(135deg, #6D28D9, #A855F7 55%, #EC4899); color: #fff; border-radius: 24px; }
    .cover h1 { font-size: 54px; margin: 0; } .cover h2 { font-size: 30px; margin: 10px 0 0; font-weight: 400; }
    .stats { display: flex; gap: 14px; justify-content: center; margin: 24px 0; } .stat { background: #f3e8ff; border-radius: 16px; padding: 14px 20px; text-align: center; }
    .stat b { display: block; font-size: 30px; color: #7c3aed; }
    h3 { color: #7c3aed; border-bottom: 2px solid #ede9fe; padding-bottom: 6px; }
    .day { page-break-inside: avoid; border-bottom: 1px solid #ede9fe; padding: 14px 0; }
    .date { font-weight: 700; color: #7c3aed; } .mood { font-size: 20px; }
    p { font-size: 15px; line-height: 1.6; white-space: pre-wrap; }
    .quote { color: #be185d; font-style: italic; margin: 4px 0; } .thanks { color: #047857; margin-top: 4px; } .people { color: #6d28d9; font-size: 13px; margin-top: 4px; }
    .photo { max-width: 60%; max-height: 300px; border-radius: 14px; margin: 8px 0; display: block; }
  </style></head><body>
    <div class="cover"><div style="font-size:80px">📔</div><h1>${esc(t('השנה שלי'))} ${year}</h1><h2>${esc(userName || '')}</h2></div>
    <div class="stats"><div class="stat"><b>${es.length}</b>${t('ימים ביומן')}</div><div class="stat"><b>${counts.size}</b>${t('אנשים')}</div><div class="stat"><b>${MOODS[Math.round(avg) - 1]}</b>${t('מצב רוח ממוצע')}</div></div>
    ${peopleHtml ? `<h3>${t('האנשים של השנה')}</h3><ul>${peopleHtml}</ul>` : ''}
    <h3>${t('כל הימים')}</h3>${days.join('')}
  </body></html>`;
}

export async function shareYearBook(year: number, entries: Entry[], people: Person[], userName: string) {
  const html = await buildYearBookHtml(year, entries, people, userName);
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: t('ספר השנה שלי') });
}
