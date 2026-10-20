import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, Text, View } from 'react-native';
import ChatModal, { BotAvatar, BOT_NAME, PendingRecording } from '../components/ChatModal';
import Recorder from '../components/Recorder';
import { Card, Chip, GradientButton, Input, notify, Row, SectionTitle, T, tap } from '../components/ui';
import { persistRecording } from '../lib/audio';
import { computeStreak, dayKey, dayNamesShort, formatLongDate, formatShortDate, formatTimeSeconds, greeting, parseDayKey } from '../lib/dates';
import { extractQuotes, findKnownPeople, suggestNewNames } from '../lib/names';
import { scheduleMorningRecap } from '../lib/notifications';
import { newId, personName, useStore } from '../lib/store';
import { colors, gradients, layout, MOOD_LABELS, MOODS } from '../lib/theme';
import type { Entry } from '../lib/types';
import { t } from '../i18n';

type Props = { onOpenSettings: () => void; onOpenEntry: (id: string) => void; onOpenIntro?: () => void };

export default function TodayScreen({ onOpenSettings, onOpenEntry, onOpenIntro }: Props) {
  const { entries, people, events, settings, saveEntry, addPerson } = useStore();
  const [text, setText] = useState('');
  const [mood, setMood] = useState(3);
  const [recording, setRecording] = useState<PendingRecording | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
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
      Alert.alert(t('עוד רגע…'), t('הקלט או כתוב משהו על היום שלך לפני השמירה 🙂'));
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
      t('נשמר בארכיון ✨'),
      `${formatLongDate(entry.createdAt)}\n${t('בשעה {time}', { time: formatTimeSeconds(entry.createdAt) })}${
        tagged.length ? `\n\n${t('אנשים: {names}', { names: tagged.map((id) => personName(people, id)).join(', ') })}` : ''
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
        <Pressable onPress={onOpenSettings} hitSlop={12} style={{ padding: 6 }} accessibilityLabel={t('הגדרות')}>
          <Ionicons name="settings-outline" size={26} color={colors.textDim} />
        </Pressable>
      </Row>

      <Row style={{ marginTop: 14, gap: 10 }}>
        <Stat emoji="🔥" value={streak} label={t('ימים ברצף')} />
        <Stat emoji="📖" value={days.size} label={t('ימים בארכיון')} />
        <Stat emoji="👥" value={people.length} label={t('אנשים')} />
      </Row>

      {onOpenIntro && (
        <Pressable onPress={onOpenIntro} style={({ pressed }) => ({ marginTop: 14, opacity: pressed ? 0.85 : 1 })}>
          <Card style={{ borderColor: colors.yellow }}>
            <Row style={{ alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 34 }}>👋</Text>
              <View style={{ flex: 1 }}>
                <T bold size={17}>
                  {t('ספר לי קצת על עצמך')}
                </T>
                <T dim size={13}>
                  {t('משפחה, חברים ועבודה, כדי שיומי והמשחק יכירו אותך')}
                </T>
              </View>
            </Row>
          </Card>
        </Pressable>
      )}

      <WeekStrip />

      <Pressable onPress={() => setChatOpen(true)} style={({ pressed }) => ({ marginTop: 14, opacity: pressed ? 0.85 : 1 })}>
        <Card style={{ borderColor: colors.primary }}>
          <Row style={{ alignItems: 'center', gap: 12 }}>
            <BotAvatar size={46} />
            <View style={{ flex: 1 }}>
              <T bold size={17}>
                {t('דבר עם {bot} על היום', { bot: t(BOT_NAME) })}
              </T>
              <T dim size={13}>
                {t('אשאל אותך כמה שאלות ואכתוב את היומן בשבילך')}
              </T>
            </View>
            <T dim size={20}>
              {layout.isRTL ? '‹' : '›'}
            </T>
          </Row>
        </Card>
      </Pressable>

      {todayEvents.length > 0 && (
        <Card style={{ marginTop: 14, borderColor: colors.orange }}>
          {todayEvents.map((ev) => (
            <T key={ev.id} bold>
              {ev.kind === 'birthday' ? '🎂' : ev.kind === 'anniversary' ? '💍' : '📌'} {t('היום: {title}', { title: ev.title })}
            </T>
          ))}
        </Card>
      )}

      <Card style={{ marginTop: 16, paddingVertical: 20 }}>
        <T bold size={20} style={{ textAlign: 'center' }}>
          {t('איך היה היום שלך?')}
        </T>
        <Recorder
          hasRecording={!!recording}
          onRecorded={(uri, durationMs, startedAt) => {
            setRecording({ uri, durationMs, startedAt });
            setChatOpen(true);
          }}
        />

        <Input
          multiline
          value={text}
          onChangeText={setText}
          placeholder={t('ספר מה קרה היום, מי פגשת ומה אמרו לך… (טיפ: לחץ על 🎤 במקלדת כדי להכתיב בקול)')}
          style={{ minHeight: 120, textAlignVertical: 'top', marginTop: 10, lineHeight: 22 }}
        />

        <T bold style={{ marginTop: 16, marginBottom: 8 }}>
          {t('מצב רוח: {mood}', { mood: t(MOOD_LABELS[mood - 1]) })}
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
          {t('👥 אנשים מהיום')}
        </T>
        {people.length === 0 && suggestions.length === 0 ? (
          <T dim size={14} style={{ marginBottom: 8 }}>
            {t('כשתזכיר שמות בטקסט אזהה אותם אוטומטית. אפשר גם להוסיף ידנית:')}
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
            {t('הצהובים הם שמות שזיהיתי — לחץ כדי לשמור אותם')}
          </T>
        )}
        <Row style={{ gap: 8, alignItems: 'center' }}>
          <Input value={newName} onChangeText={setNewName} placeholder={t('הוסף שם…')} style={{ flex: 1, minWidth: 0 }} onSubmitEditing={() => addManual(newName)} />
          <GradientButton small title={t('הוסף')} colors={gradients.calm} onPress={() => addManual(newName)} />
        </Row>

        {quotes.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <T bold style={{ marginBottom: 6 }}>
              {t('💬 מה אמרו לך')}
            </T>
            {quotes.map((q, i) => (
              <T key={i} dim size={14} style={{ marginBottom: 4 }}>
                {personName(people, q.personId)}: "{q.text}"
              </T>
            ))}
          </View>
        )}

        <GradientButton title={t('שמור בארכיון')} icon="💾" colors={gradients.primary} onPress={save} style={{ marginTop: 18 }} />
      </Card>

      {todayEntries.length > 0 && (
        <>
          <SectionTitle>{t('היום כבר תיעדת')}</SectionTitle>
          {todayEntries.map((e) => (
            <MiniEntry key={e.id} entry={e} onPress={() => onOpenEntry(e.id)} />
          ))}
        </>
      )}

      {memory && (
        <>
          <SectionTitle>{t('🕰️ זוכר את זה?')}</SectionTitle>
          <Pressable onPress={() => onOpenEntry(memory.id)}>
            <Card style={{ borderColor: colors.primary }}>
              <T dim size={13}>
                {formatShortDate(memory.createdAt)} · {MOODS[memory.mood - 1]}
              </T>
              <T style={{ marginTop: 6, lineHeight: 22 }} numberOfLines={4}>
                {memory.text || t('🎙️ הקלטה קולית')}
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
      <ChatModal
        visible={chatOpen}
        recording={recording}
        onClose={() => setChatOpen(false)}
        onSaved={(entry) => {
          setChatOpen(false);
          setRecording(null);
          Alert.alert(t('נשמר בארכיון ✨'), `${formatLongDate(entry.createdAt)}\n${t('בשעה {time}', { time: formatTimeSeconds(entry.createdAt) })}`);
        }}
      />
    </ScrollView>
  );
}

/** Mood of each of the last 7 days, today on the left (RTL: oldest on the right). */
function WeekStrip() {
  const { entries } = useStore();
  const days = useMemo(() => {
    const out: { key: string; label: string; mood: number | null; today: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = dayKey(d);
      const es = entries.filter((e) => dayKey(e.createdAt) === k);
      out.push({
        key: k,
        label: dayNamesShort()[d.getDay()],
        mood: es.length ? Math.round(es.reduce((a, e) => a + e.mood, 0) / es.length) : null,
        today: i === 0,
      });
    }
    return out;
  }, [entries]);
  return (
    <Card style={{ marginTop: 14, paddingVertical: 12 }}>
      <T bold size={15} style={{ marginBottom: 10 }}>
        {t('השבוע שלך')}
      </T>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        {days.map((d) => (
          <View key={d.key} style={{ alignItems: 'center', flex: 1 }}>
            <View
              style={{
                width: 18,
                height: d.mood ? 14 + d.mood * 9 : 6,
                borderRadius: 9,
                backgroundColor: d.mood ? [colors.red, colors.orange, colors.yellow, colors.green, colors.primaryHi][d.mood - 1] : colors.border,
              }}
            />
            <Text style={{ fontSize: 16, marginTop: 6 }}>{d.mood ? MOODS[d.mood - 1] : '·'}</Text>
            <T dim={!d.today} bold={d.today} size={11} style={{ textAlign: 'center' }}>
              {d.label}
            </T>
          </View>
        ))}
      </Row>
    </Card>
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
