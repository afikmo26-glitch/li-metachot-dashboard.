# סקר ספריות קוד פתוח להוספה לאפליקציה

נבדק ב-21.10.2026 מול GitHub ו-npm. מספרי הכוכבים מעוגלים.

**הבהרה חשובה:** תאימות ספציפית ל-Expo SDK 58 / RN 0.88 לא נבדקה בפועל לאף ספרייה, רק דרישות המינימום מה-README שלהן. אחרי כל התקנה צריך להריץ `npx expo install --check` ולבנות APK לבדיקה.

כמעט כל ספרייה רצינית צריכה **Dev build** (build מותאם דרך EAS) ולא תרוץ ב-Expo Go. האפליקציה שלנו כבר נבנית כ-APK מלא, אז זה לא חוסם.

## עשר ההמלצות הראשונות, לפי סדר

| # | מה | ספרייה | למה |
|---|---|---|---|
| 1 | דיווח קריסות | [`@sentry/react-native`](https://github.com/getsentry/sentry-react-native) (⭐1.8k, MIT) | בלי זה לא נדע מה קורס אצל משתמשים אחרי ההשקה. צריך לסנן ממנו תוכן יומן (`beforeSend`). |
| 2 | מסד נתונים מוצפן | `expo-sqlite` עם SQLCipher | DB מוצפן במלואו וחיפוש מהיר בארכיון (FTS5). **אזהרה:** אם ה-build נעשה בלי SQLCipher, הנתונים נשמרים לא מוצפנים בשקט. חייבים בדיקה שמוודאת את זה. |
| 3 | טביעת אצבע / Face ID | `expo-local-authentication` | יום עבודה בערך. פתיחה מהירה לאפליקציה ולמרחב הפריקה. |
| 4 | הקלטה לטקסט | [`expo-speech-recognition`](https://github.com/jamsch/expo-speech-recognition) (⭐700, MIT) | תמלול דרך מנוע הטלפון, כולל on-device וגם תמלול קובץ קיים. צריך לבדוק שעברית וערבית נתמכות במכשיר. בהמשך אפשר להוסיף [`whisper.rn`](https://github.com/mybigday/whisper.rn) כמצב "פרטי לגמרי" שבו שום אודיו לא עוזב את הטלפון. |
| 5 | אנימציות וקונפטי | [`lottie-react-native`](https://github.com/lottie-react-native/lottie-react-native) (⭐17k) ו-[`react-native-fast-confetti`](https://github.com/AlirezaHadjar/react-native-fast-confetti) | אנימציות מקצועיות מוכנות מ-LottieFiles. fast-confetti דורשת Skia ו-Reanimated 4. כרגע יש לנו קונפטי משלנו בלי ספריות. |
| 6 | גרפים של מצב רוח | [`react-native-gifted-charts`](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts) (⭐1.4k, MIT) | הכי מהיר להתחיל. אם נצטרך גרפים אינטראקטיביים יותר: [`victory-native`](https://github.com/FormidableLabs/victory-native-xl). |
| 7 | חשבונות וגיבוי בענן | [`@react-native-firebase`](https://github.com/invertase/react-native-firebase) (⭐12k), `expo-apple-authentication`, [`google-signin`](https://github.com/react-native-google-signin/google-signin) | Sign in with Apple **חובה** ב-App Store אם יש כניסה עם Google. הגיבוי צריך להיות מוצפן בטלפון לפני ההעלאה. Firebase Functions יכולות לשמש גם כשרת ביניים ל-Claude. חלופה: [`supabase-js`](https://github.com/supabase/supabase-js). |
| 8 | מנויים | [`react-native-purchases`](https://github.com/RevenueCat/react-native-purchases) (RevenueCat) | מנויים בשתי החנויות בלי שרת, עם Paywall שאפשר לשנות מרחוק. עדיף על פרסומות באפליקציה רגשית. |
| 9 | ווידג'ט למסך הבית | `expo-widgets` (רשמי, iOS) ו-[`react-native-android-widget`](https://github.com/sAleksovski/react-native-android-widget) | ווידג'ט "רשמת היום?" ו-streak: אחד הכלים החזקים להחזיר משתמשים לאפליקציה. |
| 10 | "השנה שלך" לשיתוף | [`react-native-view-shot`](https://github.com/gre/react-native-view-shot) (⭐3k) ו-`expo-sharing` | כרטיסי סיכום חודשי או שנתי בסגנון Spotify Wrapped לשיתוף באינסטגרם. אפשר להוסיף [`react-native-stories-view`](https://github.com/yuvraj24/react-native-stories-view) לפורמט stories. |

## עוד ספריות ששווה להכיר

- **[`react-native-calendars`](https://github.com/wix/react-native-calendars)** (Wix, ⭐10k): לוח שנה מקצועי עם Agenda ונקודות לאירועים.
- **[`react-native-gifted-chat`](https://github.com/FaridSafi/react-native-gifted-chat)** (⭐14k): ממשק צ'אט מוכן לבוט. צריך לבדוק איך הוא מתנהג מימין לשמאל.
- **[`@shopify/flash-list`](https://github.com/Shopify/flash-list)**: ארכיון ורשימת אנשים מהירים גם עם אלפי רשומות.
- **`expo-image-picker`**: תמונה יומית לכל רשומה, ותמונות לאנשים ברשימה.
- **[`posthog-react-native`](https://github.com/PostHog/posthog-js)**: מדידת שימוש, רק בהסכמת המשתמש (opt-in). לא להפעיל Session Replay באפליקציית יומן.
- **[`react-native-mmkv`](https://github.com/margelo/react-native-mmkv)** ו-**[`react-native-quick-crypto`](https://github.com/margelo/react-native-quick-crypto)**: אחסון והצפנה מהירים יותר, ב-C++.
- **[`react-native-google-mobile-ads`](https://github.com/invertase/react-native-google-mobile-ads)**: אם בכלל רוצים פרסומות, רק rewarded במשחק. לעולם לא ביומן או במרחב הפריקה.

## אפליקציות יומן בקוד פתוח ללמוד מהן

- **[memex](https://github.com/memex-lab/memex)**: הכי קרובה לחזון שלנו. יומן AI עם קול ותמונות, שמארגן את הכל לציר זמן ותובנות.
- **[Standard Notes](https://github.com/standardnotes/app)** ו-**[Joplin](https://github.com/laurent22/joplin)**: הצפנה מקצה לקצה וסנכרון. הרישיון שלהן AGPL, אז לומדים מהארכיטקטורה ולא מעתיקים קוד.
- **[storypad](https://github.com/theachoem/storypad)** (יותר מ-100 אלף הורדות) ו-**[moodiary](https://github.com/ZhuJHua/moodiary)**: UX פשוט של יומן ומצב רוח.
- **[diaryapp](https://github.com/saheeranas/diaryapp)**: יומן ב-React Native עם גיבוי ל-Google Drive. קטנה, אבל באותה טכנולוגיה כמו שלנו.

## ממה להימנע

- `@react-native-voice/voice`: הפרויקט הועבר לארכיון.
- `react-native-confetti-cannon`: לא מתוחזקת מאז 2023.
- `moti`: אין עדכונים מאז מרץ 2025.
- לא להתקין `@shopify/react-native-skia` לצד `react-native-skia`.
- **לא לשים מפתח API של Claude בתוך האפליקציה שמפורסמת בחנות.** הקריאות צריכות לעבור דרך שרת ביניים (התיקייה `server/`) שמגביל קצב ומטפל בזיהוי מצבי חירום.
