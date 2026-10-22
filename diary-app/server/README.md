# 🖥️ השרת של היומן

השרת הקטן הזה (Cloudflare Worker, חינם לרוב השימושים) נותן לאפליקציה:

- **כניסה פעם אחת** עם Google, Apple, אימייל או טלפון, והמשתמש נשאר מחובר.
- **גיבוי מוצפן** של היומן. ההצפנה קורית בטלפון, והשרת רואה רק ג'יבריש מוצפן שאי אפשר לקרוא.
- **AI** (צ'אט, סיכום יום, תמלול הקלטות), עם מגבלה יומית לכל משתמש. המפתחות נשמרים בשרת בלבד.
- **דיווחי קריסה**, **ביקור בחיית המחמד של חברים** לפי קוד, ו**מחיקת חשבון** (דרישה של Google Play).

צריך מחשב (Windows / Mac) לחצי שעה, פעם אחת.

## 1. הכנות
1. מתקינים Node.js (גרסת LTS) מ-https://nodejs.org.
2. פותחים חשבון חינמי ב-https://dash.cloudflare.com.
3. פותחים טרמינל בתיקייה `diary-app/server` ומריצים:
   ```bash
   npm install
   npx wrangler login
   ```
   ייפתח דפדפן: מאשרים את הגישה לחשבון Cloudflare.

## 2. מקום לשמור נתונים (KV)
```bash
npx wrangler kv namespace create DATA
```
הפקודה מדפיסה `id` ארוך. פותחים את `wrangler.toml`, מוחקים את ה-`#` משלוש השורות של `[[kv_namespaces]]` עם `binding = "DATA"`, ומדביקים את ה-id במקום `<your KV namespace id>`.

## 3. סודות (Secrets)
כל סוד מגדירים בפקודה הבאה. הטרמינל ישאל את הערך, מדביקים ולוחצים Enter:
```bash
npx wrangler secret put APP_KEY
```

| שם | מה לשים | חובה? |
|---|---|---|
| `APP_KEY` | סיסמה ארוכה שאתה ממציא (20+ תווים מעורבבים) | כן |
| `SESSION_SECRET` | עוד מחרוזת ארוכה ואקראית, שונה מהקודמת. אם משנים אותה, כל המשתמשים מתנתקים | כן |
| `GOOGLE_CLIENT_IDS` | מזהי ה-Client של Google, מופרדים בפסיקים (שלב 4) | לכניסה עם Google |
| `GEMINI_API_KEY` | מפתח מ-https://aistudio.google.com ← Get API key | לתמלול הקלטות ול-AI |
| `ANTHROPIC_API_KEY` | מפתח Claude מ-https://console.anthropic.com (אם קיים, הצ'אט משתמש בו) | לא |
| `APPLE_BUNDLE_ID` | `com.mylifediary.app` | לכניסה עם Apple (אייפון) |
| `RESEND_API_KEY`, `MAIL_FROM` | קודים באימייל (שלב 5) | לכניסה עם אימייל |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | קודים ב-SMS (שלב 5) | לכניסה עם טלפון |

רעיון לסיסמה אקראית: `node -e "console.log(crypto.randomUUID()+crypto.randomUUID())"`.

## 4. כניסה עם Google
1. נכנסים ל-https://console.cloud.google.com ויוצרים פרויקט (או בוחרים קיים).
2. **APIs & Services** ← **OAuth consent screen**: ממלאים שם אפליקציה ואימייל, ושומרים.
3. **APIs & Services** ← **Credentials** ← **Create credentials** ← **OAuth client ID**, ויוצרים:
   - **Web application** (בלי כתובות). את ה-Client ID שלו (נגמר ב-`.apps.googleusercontent.com`) האפליקציה שולחת בתור `webClientId`, והוא החשוב ביותר.
   - **Android**: Package name = `com.mylifediary.app`, ו-**SHA-1** של חתימת האפליקציה. את ה-SHA-1 לוקחים מ-Google Play Console ← האפליקציה ← **Test and release** ← **App integrity** ← **App signing key certificate**. לגרסאות בדיקה שנבנו ב-EAS: `npx eas-cli@latest credentials` ← Android ← מעתיקים את ה-SHA1. אפשר ליצור כמה Android clients, אחד לכל SHA-1.
   - **iOS** (אם יש אייפון): Bundle ID = `com.mylifediary.app`.
4. שמים ב-`GOOGLE_CLIENT_IDS` את כל ה-Client IDs מופרדים בפסיקים, **ובראשם ה-Web client**:
   ```
   123-web.apps.googleusercontent.com,123-android.apps.googleusercontent.com
   ```

## 5. קודים באימייל או ב-SMS (אופציונלי)
- **אימייל** (חינם עד 3,000 מיילים בחודש): חשבון ב-https://resend.com, מאמתים דומיין ויוצרים API key. `MAIL_FROM` נראה כך: `My Diary <no-reply@הדומיין-שלך>`.
- **SMS** (בערך 5–8 סנט להודעה לישראל): חשבון ב-https://twilio.com וקונים מספר שולח. `TWILIO_FROM` הוא המספר שקנית, בפורמט `+1…`.

אותם קודים משמשים גם לשחזור סיסמה (`/recover`), כמו קודם.

**אבטחה:** קוד תקף ל-10 דקות, נמחק אחרי 5 ניסיונות שגויים, ואפשר לבקש לכל היותר 5 קודים בשעה. הקודים נשמרים רק כ-hash.

**לבדיקות בלבד:** הסוד `DEV_CODES` עם הערך `1` מחזיר את הקוד בתשובה, בלי אימייל או SMS. חובה למחוק אותו לפני שמשתמשים אמיתיים נכנסים (`npx wrangler secret delete DEV_CODES`), אחרת כל אחד יכול להיכנס לחשבון של כל אחד.

## 6. העלאה לאוויר
```bash
npx wrangler deploy
```
בסוף מופיעה כתובת השרת, למשל `https://diary-ai.<השם-שלך>.workers.dev`. כל שינוי בקוד או ב-`wrangler.toml` דורש להריץ את הפקודה שוב. סודות לא צריך להגדיר מחדש.

## 7. חיבור האפליקציה
ממלאים בקובץ `src/config.ts` של האפליקציה:
```ts
export const SERVER = {
  url: 'https://diary-ai.<השם-שלך>.workers.dev',
  appKey: '<הערך של APP_KEY>',
};
```
ואת ה-Web client ID משלב 4 בתור `webClientId` של כניסת Google.

## מגבלות יומיות
- צ'אט וסיכומים: 300 ביום.
- תמלול: 40 הקלטות ביום, עד 15MB כל אחת.
- דיווחי קריסה: 50 ביום.

מי שמחובר נספר לפי החשבון, ומי שלא מחובר לפי כתובת ה-IP. מעבר למגבלה מחזיר שגיאה 429.

גיבוי מוצפן יכול להגיע עד 20MB.

## לראות דיווחי קריסה
```bash
npx wrangler kv key list --binding DATA --prefix crash: --remote
npx wrangler kv key get --binding DATA --remote "<שם המפתח>"
```
דיווחים נמחקים לבד אחרי 30 יום.

## בדיקות (למפתחים)
```bash
npm test               # מריץ את השרת מול KV מדומה
npx tsc --noEmit       # בדיקת טיפוסים
```

## פרטיות
- **היומן:** מוצפן בטלפון לפני ההעלאה, והשרת לא יכול לקרוא אותו.
- **AI:** כשה-AI פעיל, הודעות הצ'אט וההקלטות עוברות דרך השרת אל Claude או Gemini, ולא נשמרות בשרת.
- **מחיקת חשבון:** "מחיקת חשבון" באפליקציה מוחקת מהשרת את הגיבוי, את כרטיס חיית המחמד ואת הלבבות.
