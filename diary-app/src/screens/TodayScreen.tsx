import React, { useMemo, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, Text, View } from 'react-native';
import Recorder from '../components/Recorder';
import { Card, Chip, GradientButton, Input, notify, Row, SectionTitle, T, tap } from '../components/ui';
import { persistRecording } from '../lib/audio';
import { computeStreak, dayKey, formatLongDate, formatShortDate, formatTimeSeconds, greeting, parseDayKey } from '../lib/dates';
import { extractQuotes, findKnownPeople, suggestNewNames } from '../lib/names';
import { scheduleMorningRecap } from '../lib/notifications';
import { newId, personName, useStore } from '../lib/store';
import { colors, gradients, MOOD_LABELS, MOODS } from '../lib/theme';
import type { Entry } from '../lib/types';

type Props = { onOpenSettings: () => void; onOpenEntry: (id: string) => void };

export default function TodayScreen({ onOpenSettings, onOpenEntry }: Props) {
  const { entries, people, events, settings, saveEntry, addPerson } = useStore();
  const [text, setText] = useState('');
  const [mood, setMood] = useState(3);
  const [recording, setRecording] = useState<{ uri: string; durationMs: number; startedAt: Date } | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState<string[]>([]);
  const [newName, setNewName] = useState('');

  const detected = useMemo(() => findKnownPeople(text, people), [text, people]);
  const tagged = useMemo(
    () => [...new Set([...detected, ...manual])].filter((id) => !excluded.has(id)),
    [detected, manual, excluded],
  );
  const suggestions = useMemo(() => suggestNewNames(text, people), [text, people]);
  const quotes = useMemo(() => extractQuotes(text, people, tagged), [text, people, tagged]);

  const days = useMemo(() => new Set(entries.map((e) => dayKey(e.createdAt))), [entries]);
  const streak = computeStreak(days);
  const todayKey = dayKey(new Date());
  const todayEntries = entries.filter((e) => dayKey(e.createdAt) === todayKey);

  const todayEvents = useMemo(() => {
    const now = new Date();
    return events.filter((ev) => {
      const d = parseDayKey(ev.date);
      return ev.yearly ? d.getMonth() === now.getMonth() && d.getDate() === now.getDate() : ev.date === todayKey;
    });
  }, [events, todayKey]);

  /** A past entry from this calendar day (a month / year ago), or a random older one. */
  const memory = useMemo(() => {
    const now = new Date();
    const past = entries.filter((e) => dayKey(e.createdAt) !== todayKey);
    if (!past.length) return null;
    const sameDay = past.find((e) => new Date(e.createdAt).getDate() === now.getDate());
    if (sameDay) return sameDay;
    return past[now.getDate() % past.length];
  }, [entries, todayKey]);

  const addManual = (name: string) => {
    if (!name.trim()) return;
    const p = addPerson(name);
    setManual((m) => [...m, p.id]);
    setExcluded((s) => {
      const n = new Set(s);
      n.delete(p.id);
      return n;
    });
    setNewName('');
  };

  const toggle = (id: string) => {
    setExcluded((s) => {
      const n = new Set(s);
      if (tagged.includes(id)) n.add(id);
      else n.delete(id);
      return n;
    });
    if (!detected.includes(id) && !manual.includes(id)) setManual((m) => [...m, id]);
  };

  const save = async () => {
    if (!text.trim() && !recording) {
      Alert.alert('עוד רגע…', 'הקלט או כתוב משהו על היום שלך לפני השמירה 🙂');
      return;
    }
    Keyboard.dismiss();
    const id = newId();
    const audioUri = recording ? await persistRecording(recording.uri, id) : undefined;
    const entry: Entry = {
      id,
      createdAt: (recording?.startedAt ?? new Date()).toISOString(),
      text: text.trim(),
      audioUri,
      durationMs: recording?.durationMs,
      mood,
      people: tagged,
      quotes,
    };
    saveEntry(entry);
    scheduleMorningRecap(settings, entry, people).catch(() => {});
    notify('success');
    setText('');
    setMood(3);
    setRecording(null);
    setExcluded(new Set());
    setManual([]);
    Alert.alert(
      'נשמר בארכיון ✨',
      `${formatLongDate(entry.createdAt)}\nבשעה ${formatTimeSeconds(entry.createdAt)}${
        tagged.length ? `\n\nאנשים: ${tagged.map((t) => personName(people, t)).join(', ')}` : ''
      }`,
    );
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T dim size={14}>
            {formatLongDate(new Date())}
          </T>
          <T bold size={28}>
            {greeting()}
            {settings.userName ? `, ${settings.userName}` : ''} 👋
          </T>
        </View>
        <Pressable onPress={onOpenSettings} hitSlop={12} style={{ padding: 6 }}>
          <Text style={{ fontSize: 26 }}>⚙️</Text>
        </Pressable>
      </Row>

      <Row style={{ marginTop: 14, gap: 10 }}>
        <Stat emoji="🔥" value={streak} label="ימים ברצף" />
        <Stat emoji="📖" value={days.size} label="ימים בארכיון" />
        <Stat emoji="👥" value={people.length} label="אנשים" />
      </Row>

      {todayEvents.length > 0 && (
        <Card style={{ marginTop: 14, borderColor: colors.orange }}>
          {todayEvents.map((ev) => (
            <T key={ev.id} bold>
              {ev.kind === 'birthday' ? '🎂' : ev.kind === 'anniversary' ? '💍' : '📌'} היום: {ev.title}
            </T>
          ))}
        </Card>
      )}

      <Card style={{ marginTop: 16, paddingVertical: 20 }}>
        <T bold size={20} style={{ textAlign: 'center' }}>
          איך היה היום שלך?
        </T>
        <Recorder hasRecording={!!recording} onRecorded={(uri, durationMs, startedAt) => setRecording({ uri, durationMs, startedAt })} />

        <Input
          multiline
          value={text}
          onChangeText={setText}
          placeholder="ספר מה קרה היום, מי פגשת ומה אמרו לך… (טיפ: לחץ על 🎤 במקלדת כדי להכתיב בקול)"
          style={{ minHeight: 120, textAlignVertical: 'top', marginTop: 10, lineHeight: 22 }}
        />

        <T bold style={{ marginTop: 16, marginBottom: 8 }}>
          מצב רוח: {MOOD_LABELS[mood - 1]}
        </T>
        <Row style={{ justifyContent: 'space-between' }}>
          {MOODS.map((m, i) => (
            <Pressable
              key={m}
              onPress={() => {
                tap();
                setMood(i + 1);
              }}
              style={{
                padding: 8,
                borderRadius: 16,
                backgroundColor: mood === i + 1 ? colors.cardHi : 'transparent',
                borderWidth: mood === i + 1 ? 1.5 : 0,
                borderColor: colors.primaryHi,
              }}
            >
              <Text style={{ fontSize: mood === i + 1 ? 36 : 28 }}>{m}</Text>
            </Pressable>
          ))}
        </Row>

        <T bold style={{ marginTop: 16, marginBottom: 8 }}>
          👥 אנשים מהיום
        </T>
        {people.length === 0 && suggestions.length === 0 ? (
          <T dim size={14} style={{ marginBottom: 8 }}>
            כשתזכיר שמות בטקסט אזהה אותם אוטומטית. אפשר גם להוסיף ידנית:
          </T>
        ) : null}
        <Row style={{ flexWrap: 'wrap' }}>
          {[...new Set([...detected, ...manual])].map((id) => (
            <Chip key={id} label={personName(people, id)} active={tagged.includes(id)} onPress={() => toggle(id)} />
          ))}
          {suggestions.map((n) => (
            <Chip key={`s-${n}`} label={`+ ${n}`} color={colors.yellow} onPress={() => addManual(n)} />
          ))}
        </Row>
        {suggestions.length > 0 && (
          <T dim size={12} style={{ marginBottom: 6 }}>
            הצהובים הם שמות שזיהיתי — לחץ כדי לשמור אותם
          </T>
        )}
        <Row style={{ gap: 8, alignItems: 'center' }}>
          <Input value={newName} onChangeText={setNewName} placeholder="הוסף שם…" style={{ flex: 1, minWidth: 0 }} onSubmitEditing={() => addManual(newName)} />
          <GradientButton small title="הוסף" colors={gradients.calm} onPress={() => addManual(newName)} />
        </Row>

        {quotes.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <T bold style={{ marginBottom: 6 }}>
              💬 מה אמרו לך
            </T>
            {quotes.map((q, i) => (
              <T key={i} dim size={14} style={{ marginBottom: 4 }}>
                {personName(people, q.personId)}: "{q.text}"
              </T>
            ))}
          </View>
        )}

        <GradientButton title="שמור בארכיון" icon="💾" colors={gradients.primary} onPress={save} style={{ marginTop: 18 }} />
      </Card>

      {todayEntries.length > 0 && (
        <>
          <SectionTitle>היום כבר תיעדת</SectionTitle>
          {todayEntries.map((e) => (
            <MiniEntry key={e.id} entry={e} onPress={() => onOpenEntry(e.id)} />
          ))}
        </>
      )}

      {memory && (
        <>
          <SectionTitle>🕰️ זוכר את זה?</SectionTitle>
          <Pressable onPress={() => onOpenEntry(memory.id)}>
            <Card style={{ borderColor: colors.primary }}>
              <T dim size={13}>
                {formatShortDate(memory.createdAt)} · {MOODS[memory.mood - 1]}
              </T>
              <T style={{ marginTop: 6, lineHeight: 22 }} numberOfLines={4}>
                {memory.text || '🎙️ הקלטה קולית'}
              </T>
              {memory.people.length > 0 && (
                <T dim size={13} style={{ marginTop: 6 }}>
                  👥 {memory.people.map((p) => personName(people, p)).join(', ')}
                </T>
              )}
            </Card>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function Stat({ emoji, value, label }: { emoji: string; value: number; label: string }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6 }}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <T bold size={22} style={{ textAlign: 'center' }}>
        {value}
      </T>
      <T dim size={12} style={{ textAlign: 'center' }}>
        {label}
      </T>
    </Card>
  );
}

export function MiniEntry({ entry, onPress }: { entry: Entry; onPress: () => void }) {
  const { people } = useStore();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, marginBottom: 10 })}>
      <Card>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <T bold size={15}>
            🕐 {formatTimeSeconds(entry.createdAt)}
          </T>
          <Text style={{ fontSize: 20 }}>
            {entry.audioUri ? '🎙️ ' : ''}
            {MOODS[entry.mood - 1]}
          </Text>
        </Row>
        {entry.text ? (
          <T dim style={{ marginTop: 6, lineHeight: 21 }} numberOfLines={3}>
            {entry.text}
          </T>
        ) : null}
        {entry.people.length > 0 && (
          <T size={13} style={{ marginTop: 6, color: colors.primaryHi }}>
            👥 {entry.people.map((p) => personName(people, p)).join(' · ')}
          </T>
        )}
      </Card>
    </Pressable>
  );
}
