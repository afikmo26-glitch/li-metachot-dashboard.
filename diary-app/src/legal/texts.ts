/**
 * Privacy policy and terms of use, shown in the app (Settings → Privacy and terms, and at sign-up).
 * The same text is published for the stores in legal/privacy.html and legal/terms.html.
 * Update CONTACT and the date before publishing.
 */

export const LEGAL_UPDATED = '2026-10-22';
export const CONTACT = 'afikmo26@gmail.com';

type Doc = { title: string; sections: { h: string; p: string[] }[] };

export const PRIVACY: Record<'he' | 'en', Doc> = {
  he: {
    title: 'מדיניות פרטיות',
    sections: [
      { h: 'בקצרה', p: ['היומן שלך שייך לך. הוא נשמר מוצפן על הטלפון שלך. אם תבחר לגבות לענן, הוא ננעל על הטלפון בסיסמת היומן לפני שהוא עולה, כך שגם אנחנו לא יכולים לקרוא אותו. אנחנו לא מוכרים מידע ולא מציגים פרסומות.'] },
      {
        h: 'מה נשמר על הטלפון',
        p: ['רשומות היומן, הקלטות, תמונות, אנשים, אירועים, משמרות, חיסכון, לימודים והחבר שלך. הכל מוצפן (AES-256) עם מפתח שנשמר באזור המאובטח של הטלפון.'],
      },
      {
        h: 'מה עובר לשרת שלנו',
        p: [
          'התחברות: מזהה החשבון (אימייל, מספר טלפון, או מזהה מ-Google/Apple) כדי לזהות אותך.',
          'גיבוי בענן (אם הפעלת): עותק מוצפן של היומן. המפתח נגזר מסיסמת היומן ונשאר אצלך — לשרת אין דרך לפתוח אותו. הקלטות ותמונות לא עולות לענן כרגע.',
          'בינה מלאכותית (יומי, תמלול הקלטות): הטקסט או ההקלטה נשלחים דרך השרת שלנו לספק ה-AI (Google Gemini או Anthropic Claude) כדי לקבל תשובה, ולא נשמרים אצלנו.',
          'כרטיס החבר (אם שיתפת קוד): שם החבר, המראה והרמה שלו — כדי שחברים יוכלו לבקר. בלי שום תוכן מהיומן.',
          'דיווחי קריסה: הודעת השגיאה, סוג המכשיר וגרסת האפליקציה — בלי תוכן מהיומן. נמחקים אחרי 30 יום.',
        ],
      },
      { h: 'גיל', p: ['האפליקציה מיועדת לגיל 13 ומעלה. אם אתה מתחת לגיל 18, מומלץ לספר להורה שאתה משתמש בה.'] },
      { h: 'מחיקה', p: ['אפשר למחוק את החשבון ואת כל הגיבוי בענן מתוך ההגדרות בכל רגע. מחיקת האפליקציה מוחקת את כל מה שעל הטלפון.'] },
      { h: 'במצב חירום', p: ['האפליקציה אינה תחליף לעזרה מקצועית. אם קשה לך: ער"ן 1201 (24/7), סה"ר sahar.org.il, מד"א 101, משטרה 100.'] },
      { h: 'יצירת קשר', p: [`שאלות על פרטיות: ${CONTACT}`] },
    ],
  },
  en: {
    title: 'Privacy policy',
    sections: [
      { h: 'In short', p: ['Your diary belongs to you. It is stored encrypted on your phone. If you turn on cloud backup, it is locked on your phone with your diary password before upload, so even we cannot read it. We do not sell data or show ads.'] },
      { h: 'What stays on your phone', p: ['Entries, recordings, photos, people, events, shifts, savings, studies and your pet — all encrypted (AES-256) with a key kept in the phone’s secure storage.'] },
      {
        h: 'What reaches our server',
        p: [
          'Sign-in: your account identifier (email, phone number, or Google/Apple ID).',
          'Cloud backup (if on): an encrypted copy of the diary. The key is derived from your diary password and never leaves your phone. Recordings and photos are not uploaded for now.',
          'AI (Yomi, transcription): text or audio is passed through our server to the AI provider (Google Gemini or Anthropic Claude) to get a reply, and is not stored by us.',
          'Pet card (if you share a code): your pet’s name, look and level — no diary content.',
          'Crash reports: the error message, device type and app version — no diary content. Deleted after 30 days.',
        ],
      },
      { h: 'Age', p: ['The app is for ages 13 and up. If you are under 18, we recommend telling a parent that you use it.'] },
      { h: 'Deletion', p: ['You can delete your account and cloud backup from Settings at any time. Uninstalling the app deletes everything on the phone.'] },
      { h: 'In an emergency', p: ['The app is not a substitute for professional help. If things are hard: ERAN 1201 (24/7), sahar.org.il, ambulance 101, police 100.'] },
      { h: 'Contact', p: [`Privacy questions: ${CONTACT}`] },
    ],
  },
};

export const TERMS: Record<'he' | 'en', Doc> = {
  he: {
    title: 'תנאי שימוש',
    sections: [
      { h: 'השימוש באפליקציה', p: ['האפליקציה היא יומן אישי עם חבר וירטואלי ועוזר AI. מותר להשתמש בה לשימוש אישי בלבד, מגיל 13 ומעלה.'] },
      { h: 'יומי וה-AI', p: ['יומי הוא תוכנה, לא אדם ולא איש מקצוע. התשובות שלו עלולות לטעות, והן לא ייעוץ רפואי, פסיכולוגי או משפטי.'] },
      { h: 'האחריות על החשבון', p: ['שמור על סיסמת היומן. אם תשכח אותה, לא נוכל לפתוח את הגיבוי המוצפן בענן — זה המחיר של הצפנה שרק אתה מחזיק במפתח שלה.'] },
      { h: 'התנהגות', p: ['אסור להשתמש בשמות או בכרטיסי חבר כדי להטריד, לפגוע או להתחזות לאחרים.'] },
      { h: 'רכישות', p: ['חבילות בגדים לחבר הן רכישות דיגיטליות דרך חנות האפליקציות, לפי מדיניות ההחזרים שלה. הן לא משנות שום דבר מעבר למראה.'] },
      { h: 'שינויים', p: ['אנחנו עשויים לעדכן את האפליקציה ואת התנאים. שינוי מהותי יוצג באפליקציה.'] },
      { h: 'יצירת קשר', p: [CONTACT] },
    ],
  },
  en: {
    title: 'Terms of use',
    sections: [
      { h: 'Using the app', p: ['The app is a personal diary with a virtual pet and an AI helper, for personal use, ages 13 and up.'] },
      { h: 'Yomi and AI', p: ['Yomi is software, not a person or a professional. Replies can be wrong and are not medical, psychological or legal advice.'] },
      { h: 'Your account', p: ['Keep your diary password safe. If you forget it we cannot open your encrypted cloud backup — the price of encryption where only you hold the key.'] },
      { h: 'Conduct', p: ['Do not use names or pet cards to harass, hurt or impersonate others.'] },
      { h: 'Purchases', p: ['Pet outfit packs are digital purchases through the app store, under its refund policy. They change looks only.'] },
      { h: 'Changes', p: ['We may update the app and these terms. Material changes will be shown in the app.'] },
      { h: 'Contact', p: [CONTACT] },
    ],
  },
};
