import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { parseDayKey } from './dates';
import type { CalendarEvent, Entry, Person, Settings } from './types';

const CHANNEL = 'diary';
const IDS_KEY = 'diary.notifIds.v1';

type ScheduledIds = { bedtime?: string; recap?: string };

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
      name: 'יומן',
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
        title: `${name}איך היה היום? 🌙`,
        body: BEDTIME_LINES[Math.floor(Math.random() * BEDTIME_LINES.length)],
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
        ? `${people.find((p) => p.id === quote.personId)?.name ?? ''} אמר/ה: "${quote.text}"`
        : '';
      const snippet = entry.text.length > 90 ? `${entry.text.slice(0, 90)}…` : entry.text;
      const body = [names.length ? `פגשת את ${names.join(', ')}.` : '', quoteLine || snippet]
        .filter(Boolean)
        .join('\n');
      ids.recap = await Notifications.scheduleNotificationAsync({
        content: {
          title: '☀️ בוקר טוב! ככה היה אתמול',
          body: body || 'הקלטת יומן אתמול — בוא להיזכר',
          data: { screen: 'archive', entryId: entry.id },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
      });
    }
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
    body: ev.kind === 'birthday' ? 'היום יום הולדת! אל תשכח לאחל 🎉' : 'תזכורת לאירוע של היום',
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
    content: { title: 'איך היה היום? 🌙', body: 'ככה תיראה התזכורת היומית שלך' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: CHANNEL },
  });
  return true;
}
