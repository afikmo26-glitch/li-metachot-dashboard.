import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Chip, GhostButton, GradientButton, Input, Row, ScreenTitle, SectionTitle, T, tap } from '../components/ui';
import { dayKey, formatLongDate, HEB_DAYS_SHORT, HEB_MONTHS, parseDayKey } from '../lib/dates';
import { cancelEvent, scheduleEvent } from '../lib/notifications';
import { newId, useStore } from '../lib/store';
import { colors, gradients, MOODS } from '../lib/theme';
import type { CalendarEvent, EventKind } from '../lib/types';
import { MiniEntry } from './TodayScreen';

const KINDS: { kind: EventKind; label: string; emoji: string; color: string }[] = [
  { kind: 'event', label: 'אירוע', emoji: '📌', color: colors.blue },
  { kind: 'birthday', label: 'יום הולדת', emoji: '🎂', color: colors.pink },
  { kind: 'anniversary', label: 'יום נישואין', emoji: '💍', color: colors.orange },
];
const kindInfo = (k: EventKind) => KINDS.find((x) => x.kind === k)!;

function eventOnDay(ev: CalendarEvent, d: Date) {
  const e = parseDayKey(ev.date);
  if (ev.yearly) return e.getMonth() === d.getMonth() && e.getDate() === d.getDate() && d >= new Date(e.getFullYear(), 0, 1);
  return ev.date === dayKey(d);
}

export default function CalendarScreen({ onOpenEntry }: { onOpenEntry: (id: string) => void }) {
  const { entries, events, saveEvent, deleteEvent } = useStore();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(dayKey(new Date()));
  const [editor, setEditor] = useState<CalendarEvent | null>(null);

  const entriesByDay = useMemo(() => {
    const m = new Map<string, typeof entries>();
    entries.forEach((e) => {
      const k = dayKey(e.createdAt);
      m.set(k, [...(m.get(k) ?? []), e]);
    });
    return m;
  }, [entries]);

  const cells = useMemo(() => {
    const first = cursor.getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = Array(first).fill(null);
    for (let i = 1; i <= daysInMonth; i++) out.push(new Date(cursor.getFullYear(), cursor.getMonth(), i));
    while (out.length % 7) out.push(null);
    return out;
  }, [cursor]);

  const selectedDate = parseDayKey(selected);
  const dayEvents = events.filter((ev) => eventOnDay(ev, selectedDate));
  const dayEntries = entriesByDay.get(selected) ?? [];
  const todayKey = dayKey(new Date());

  const upcoming = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return events
      .map((ev) => {
        const d = parseDayKey(ev.date);
        if (ev.yearly) {
          d.setFullYear(now.getFullYear());
          if (d < now) d.setFullYear(now.getFullYear() + 1);
        }
        return { ev, next: d };
      })
      .filter((x) => x.next >= now)
      .sort((a, b) => a.next.getTime() - b.next.getTime())
      .slice(0, 6);
  }, [events]);

  const shift = (delta: number) => {
    tap();
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  };

  const persistEvent = async (ev: CalendarEvent) => {
    const notificationId = await scheduleEvent(ev).catch(() => undefined);
    saveEvent({ ...ev, notificationId });
    setEditor(null);
  };

  const removeEvent = (ev: CalendarEvent) =>
    Alert.alert('למחוק את האירוע?', ev.title, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: () => {
          cancelEvent(ev).catch(() => {});
          deleteEvent(ev.id);
          setEditor(null);
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }}>
      <ScreenTitle title="🗓️ לוח שנה" subtitle="ימים שתיעדת ואירועים מיוחדים" />

      <Card>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Pressable onPress={() => shift(-1)} hitSlop={12}>
            <T bold size={22}>
              ›
            </T>
          </Pressable>
          <T bold size={18}>
            {HEB_MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </T>
          <Pressable onPress={() => shift(1)} hitSlop={12}>
            <T bold size={22}>
              ‹
            </T>
          </Pressable>
        </Row>
        <Row>
          {HEB_DAYS_SHORT.map((d) => (
            <T key={d} dim size={13} style={{ flex: 1, textAlign: 'center' }}>
              {d}
            </T>
          ))}
        </Row>
        {Array.from({ length: cells.length / 7 }).map((_, w) => (
          <Row key={w} style={{ marginTop: 6 }}>
            {cells.slice(w * 7, w * 7 + 7).map((d, i) => {
              if (!d) return <View key={i} style={{ flex: 1 }} />;
              const k = dayKey(d);
              const dayE = entriesByDay.get(k);
              const hasEvent = events.some((ev) => eventOnDay(ev, d));
              const isSel = k === selected;
              const isToday = k === todayKey;
              return (
                <Pressable
                  key={i}
                  onPress={() => {
                    tap();
                    setSelected(k);
                  }}
                  style={{
                    flex: 1,
                    aspectRatio: 1,
                    margin: 2,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSel ? colors.primary : dayE ? colors.cardHi : 'transparent',
                    borderWidth: isToday && !isSel ? 1.5 : 0,
                    borderColor: colors.primaryHi,
                  }}
                >
                  {dayE ? (
                    <Text style={{ fontSize: 14 }}>{MOODS[dayE[0].mood - 1]}</Text>
                  ) : (
                    <T bold={isToday} size={15} style={{ textAlign: 'center' }}>
                      {d.getDate()}
                    </T>
                  )}
                  {dayE ? (
                    <T size={10} style={{ textAlign: 'center' }}>
                      {d.getDate()}
                    </T>
                  ) : null}
                  {hasEvent && (
                    <View style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.orange }} />
                  )}
                </Pressable>
              );
            })}
          </Row>
        ))}
        <Row style={{ marginTop: 12, gap: 14 }}>
          <T dim size={12}>😊 = יום מתועד</T>
          <T dim size={12}>
            <Text style={{ color: colors.orange }}>●</Text> = אירוע
          </T>
        </Row>
      </Card>

      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionTitle>{formatLongDate(selectedDate)}</SectionTitle>
      </Row>
      <GradientButton
        small
        icon="➕"
        title="הוסף אירוע ליום הזה"
        colors={gradients.calm}
        onPress={() => setEditor({ id: newId(), title: '', date: selected, kind: 'event', yearly: false })}
      />
      <View style={{ marginTop: 10 }}>
        {dayEvents.map((ev) => (
          <EventRow key={ev.id} ev={ev} onPress={() => setEditor(ev)} />
        ))}
        {dayEntries.map((e) => (
          <MiniEntry key={e.id} entry={e} onPress={() => onOpenEntry(e.id)} />
        ))}
        {!dayEvents.length && !dayEntries.length && (
          <T dim style={{ textAlign: 'center', marginVertical: 12 }}>
            אין כלום ביום הזה עדיין
          </T>
        )}
      </View>

      {upcoming.length > 0 && (
        <>
          <SectionTitle>⏳ בקרוב</SectionTitle>
          {upcoming.map(({ ev, next }) => {
            const days = Math.round((next.getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
            return <EventRow key={ev.id} ev={ev} subtitle={days === 0 ? 'היום!' : days === 1 ? 'מחר' : `בעוד ${days} ימים`} onPress={() => setEditor(ev)} />;
          })}
        </>
      )}

      {editor && (
        <EventEditor
          initial={editor}
          isNew={!events.some((e) => e.id === editor.id)}
          onCancel={() => setEditor(null)}
          onSave={persistEvent}
          onDelete={() => removeEvent(editor)}
        />
      )}
    </ScrollView>
  );
}

function EventRow({ ev, onPress, subtitle }: { ev: CalendarEvent; onPress: () => void; subtitle?: string }) {
  const info = kindInfo(ev.kind);
  return (
    <Pressable onPress={onPress} style={{ marginBottom: 10 }}>
      <Card style={{ borderColor: info.color, padding: 12 }}>
        <Row style={{ alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 26 }}>{info.emoji}</Text>
          <View style={{ flex: 1 }}>
            <T bold>{ev.title}</T>
            <T dim size={13}>
              {subtitle ? `${subtitle} · ` : ''}
              {info.label}
              {ev.time ? ` · ${ev.time}` : ''}
              {ev.yearly ? ' · כל שנה 🔁' : ''}
            </T>
          </View>
        </Row>
      </Card>
    </Pressable>
  );
}

function EventEditor({
  initial,
  isNew,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: CalendarEvent;
  isNew: boolean;
  onSave: (e: CalendarEvent) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [ev, setEv] = useState(initial);
  const [time, setTime] = useState(initial.time ?? '');

  const save = () => {
    if (!ev.title.trim()) {
      Alert.alert('חסרה כותרת', 'תן שם לאירוע');
      return;
    }
    const t = time.trim();
    if (t && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(t)) {
      Alert.alert('שעה לא תקינה', 'כתוב שעה בפורמט 18:30');
      return;
    }
    onSave({ ...ev, title: ev.title.trim(), time: t ? t.padStart(5, '0') : undefined });
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' }}>
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
          <View style={{ padding: 20 }}>
            <T bold size={20}>
              {isNew ? '➕ אירוע חדש' : '✏️ עריכת אירוע'}
            </T>
            <T dim style={{ marginTop: 2, marginBottom: 14 }}>
              {formatLongDate(parseDayKey(ev.date))}
            </T>
            <Row style={{ flexWrap: 'wrap' }}>
              {KINDS.map((k) => (
                <Chip
                  key={k.kind}
                  label={`${k.emoji} ${k.label}`}
                  color={k.color}
                  active={ev.kind === k.kind}
                  onPress={() => setEv({ ...ev, kind: k.kind, yearly: k.kind === 'event' ? ev.yearly : true })}
                />
              ))}
            </Row>
            <Input
              value={ev.title}
              onChangeText={(title) => setEv({ ...ev, title })}
              placeholder={ev.kind === 'birthday' ? 'יום הולדת ל…' : 'שם האירוע'}
              style={{ marginTop: 6 }}
              autoFocus={isNew}
            />
            <Input value={time} onChangeText={setTime} placeholder="שעה (לא חובה) למשל 18:30" keyboardType="numbers-and-punctuation" style={{ marginTop: 10 }} />
            <Row style={{ alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
              <T>🔁 חוזר כל שנה</T>
              <Switch value={ev.yearly} onValueChange={(yearly) => setEv({ ...ev, yearly })} trackColor={{ true: colors.primary, false: colors.border }} />
            </Row>
            <T dim size={12} style={{ marginTop: 6 }}>
              🔔 תקבל התראה ביום האירוע{time ? ` ב-${time}` : ' ב-9:00'}
            </T>
            <GradientButton title="שמור" colors={gradients.primary} onPress={save} style={{ marginTop: 18 }} />
            <Row style={{ gap: 10, marginTop: 10 }}>
              <GhostButton title="ביטול" onPress={onCancel} style={{ flex: 1 }} />
              {!isNew && <GhostButton title="🗑️ מחק" color={colors.red} onPress={onDelete} style={{ flex: 1, borderColor: colors.red }} />}
            </Row>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
