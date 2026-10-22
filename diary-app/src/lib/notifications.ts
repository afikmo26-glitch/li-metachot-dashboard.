import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { parseDayKey } from './dates';
import type { CalendarEvent, Entry, Person, Settings } from './types';
import { t } from '../i18n';

const CHANNEL = 'diary';
const IDS_KEY = 'diary.notifIds.v1';

type ScheduledIds = { bedtime?: string; recap?: string; todo?: string; photo?: string; savings?: string };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function getIds(): Promise<ScheduledIds> {
  try {
    return JSON.parse((await AsyncStorage.getItem(IDS_KEY)) ?? '{}');
  } catch {
    return {};
  }
}

async function setIds(ids: ScheduledIds) {
  await AsyncStorage.setItem(IDS_KEY, JSON.stringify(ids));
}

async function cancel(id?: string) {
  if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

export async function ensurePermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: t('יומן'),
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

const BEDTIME_LINES = [
  'איך עבר עליך היום? ספר לי הכל 🌙',
  'לפני שנרדמים — מה היה היום? מי פגשת? 💜',
  'היום שלך ראוי להיזכר. בוא נקליט אותו 🎙️',
  'מה הדבר הכי טוב שקרה היום? ✨',
];

/** Daily "how was your day" reminder at the user's bedtime. */
export async function scheduleBedtime(settings: Settings) {
  if (Platform.OS === 'web') return;
  const ids = await getIds();
  await cancel(ids.bedtime);
  ids.bedtime = undefined;
  if (settings.bedtimeEnabled && (await ensurePermissions())) {
    const name = settings.userName ? `${settings.userName}, ` : '';
    ids.bedtime = await Notifications.scheduleNotificationAsync({
      content: {
        title: settings.userName ? t('{name}, איך היה היום? 🌙', { name: settings.userName }) : t('איך היה היום? 🌙'),
        body: t(BEDTIME_LINES[Math.floor(Math.random() * BEDTIME_LINES.length)]),
        data: { screen: 'record' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: settings.bedtimeHour,
        minute: settings.bedtimeMinute,
        channelId: CHANNEL,
      },
    });
  }
  await setIds(ids);
}

/** "Still at work?" if a shift has been running for 9 hours; cancelled on clock-out. */
export async function scheduleShiftReminder(place: string): Promise<string | undefined> {
  if (Platform.OS === 'web' || !(await ensurePermissions())) return undefined;
  return Notifications.scheduleNotificationAsync({
    content: { title: t('⏱️ עדיין במשמרת?'), body: t('המשמרת ב{place} רצה כבר 9 שעות. שכחת לסיים?', { place }), data: { screen: 'work' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 9 * 3600, channelId: CHANNEL },
  });
}

export async function cancelShiftReminder(id?: string) {
  if (Platform.OS === 'web' || !id) return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

/** Weekly "time to save" nudge on Sunday evening, when the user turns it on. */
export async function scheduleSavingsReminder(settings: Settings) {
  if (Platform.OS === 'web') return;
  const ids = await getIds();
  await cancel(ids.savings);
  ids.savings = undefined;
  if (settings.savingsReminder && (await ensurePermissions())) {
    ids.savings = await Notifications.scheduleNotificationAsync({
      content: { title: t('🐷 בוא נחסוך!'), body: t('שבוע חדש — כמה תוסיף לחיסכון השבוע?'), data: { screen: 'work' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 18, minute: 0, channelId: CHANNEL },
    });
  }
  await setIds(ids);
}

/** Optional daily nudge to add a photo of the day (off unless the user turns it on). */
export async function schedulePhotoReminder(settings: Settings) {
  if (Platform.OS === 'web') return;
  const ids = await getIds();
  await cancel(ids.photo);
  ids.photo = undefined;
  if (settings.photoReminder && (await ensurePermissions())) {
    ids.photo = await Notifications.scheduleNotificationAsync({
      content: { title: t('📸 תמונה של היום?'), body: t('תמונה אחת ביום, ובעוד חודש תראה כמה דברים השתנו'), data: { screen: 'record' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 19, minute: 0, channelId: CHANNEL },
    });
  }
  await setIds(ids);
}

/**
 * Next-morning recap of the latest entry so the user remembers what happened
 * and what people told them. Rescheduled after every save.
 */
export async function scheduleMorningRecap(settings: Settings, entry: Entry | undefined, people: Person[]) {
  if (Platform.OS === 'web') return;
  const ids = await getIds();
  await cancel(ids.recap);
  ids.recap = undefined;
  if (settings.morningRecapEnabled && entry && (await ensurePermissions())) {
    const when = new Date(entry.createdAt);
    when.setDate(when.getDate() + 1);
    when.setHours(settings.morningHour, 0, 0, 0);
    if (when.getTime() > Date.now()) {
      const names = entry.people.map((id) => people.find((p) => p.id === id)?.name).filter(Boolean);
      const quote = entry.quotes[0];
      const quoteLine = quote
        ? t('{name} אמר/ה: "{text}"', { name: people.find((p) => p.id === quote.personId)?.name ?? '', text: quote.text })
        : '';
      const snippet = entry.text.length > 90 ? `${entry.text.slice(0, 90)}…` : entry.text;
      const body = [names.length ? t('פגשת את {names}.', { names: names.join(', ') }) : '', quoteLine || snippet]
        .filter(Boolean)
        .join('\n');
      ids.recap = await Notifications.scheduleNotificationAsync({
        content: {
          title: t('☀️ בוקר טוב! ככה היה אתמול'),
          body: body || t('הקלטת יומן אתמול — בוא להיזכר'),
          data: { screen: 'archive', entryId: entry.id },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
      });
    }
  }
  await setIds(ids);
}

/** "Remind me tomorrow" from the chat — fires next morning at the recap hour. */
export async function scheduleTomorrowReminder(settings: Settings, note: string) {
  if (Platform.OS === 'web') return;
  const ids = await getIds();
  await cancel(ids.todo);
  ids.todo = undefined;
  if (await ensurePermissions()) {
    const when = new Date();
    when.setDate(when.getDate() + 1);
    when.setHours(settings.morningHour, 5, 0, 0);
    ids.todo = await Notifications.scheduleNotificationAsync({
      content: { title: t('📝 ביקשת שאזכיר לך'), body: note, data: { screen: 'today' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
    });
  }
  await setIds(ids);
}

const KIND_EMOJI = { birthday: '🎂', anniversary: '💍', event: '📌' } as const;

/** Schedules a reminder on the event's day (9:00, or the event time). Returns the notification id. */
export async function scheduleEvent(ev: CalendarEvent): Promise<string | undefined> {
  if (Platform.OS === 'web') return;
  await cancel(ev.notificationId);
  if (!(await ensurePermissions())) return;
  const [hour, minute] = ev.time ? ev.time.split(':').map(Number) : [9, 0];
  const date = parseDayKey(ev.date);
  const content = {
    title: `${KIND_EMOJI[ev.kind]} ${ev.title}`,
    body: ev.kind === 'birthday' ? t('היום יום הולדת! אל תשכח לאחל 🎉') : t('תזכורת לאירוע של היום'),
    data: { screen: 'calendar' },
  };
  if (ev.yearly) {
    return Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.YEARLY,
        month: date.getMonth(),
        day: date.getDate(),
        hour,
        minute,
        channelId: CHANNEL,
      },
    });
  }
  date.setHours(hour, minute, 0, 0);
  if (date.getTime() <= Date.now()) return;
  return Notifications.scheduleNotificationAsync({
    content,
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL },
  });
}

export async function cancelEvent(ev: CalendarEvent) {
  await cancel(ev.notificationId);
}

export async function sendTestNotification() {
  if (!(await ensurePermissions())) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title: t('איך היה היום? 🌙'), body: t('ככה תיראה התזכורת היומית שלך') },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: CHANNEL },
  });
  return true;
}

/** Exam reminders: the evening before (19:00) and that morning (7:30). Returns the ids to cancel later. */
export async function scheduleExamReminders(subject: string, date: string): Promise<string[]> {
  if (Platform.OS === 'web' || !(await ensurePermissions())) return [];
  const day = parseDayKey(date);
  const eve = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1, 19, 0);
  const morning = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 7, 30);
  const ids: string[] = [];
  for (const [when, title, body] of [
    [eve, t('📚 מחר מבחן ב{subject}', { subject }), t('עוד חזרה קטנה ושינה טובה — אתה מוכן! 💪')],
    [morning, t('🍀 בהצלחה במבחן ב{subject}!', { subject }), t('נשום עמוק. אתה יודע יותר ממה שאתה חושב.')],
  ] as const) {
    if (when.getTime() <= Date.now()) continue;
    ids.push(
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data: { screen: 'work' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
      }),
    );
  }
  return ids;
}

/** "Time's up" when a study timer ends while the app is closed. */
export async function scheduleStudyEnd(seconds: number, petName: string): Promise<string | undefined> {
  if (Platform.OS === 'web' || !(await ensurePermissions())) return;
  return Notifications.scheduleNotificationAsync({
    content: { title: t('⏰ סיימת לימוד!'), body: t('{name} גאה בך 🤓 זמן להפסקה קטנה', { name: petName || t('יומי') }), data: { screen: 'work' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.round(seconds)), channelId: CHANNEL },
  });
}

export async function cancelNotifications(ids?: (string | undefined)[]) {
  for (const id of ids ?? []) await cancel(id);
}
