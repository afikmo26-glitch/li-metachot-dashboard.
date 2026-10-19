import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, ScrollViewInstance, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { persistRecording } from '../lib/audio';
import {
  Answer,
  BotQuestion,
  composeEntryText,
  moodFromAnswer,
  nextQuestion,
  openingQuestion,
  personNotes,
  saidQuotes,
  tomorrowNote,
} from '../lib/interviewer';
import { extractQuotes, findKnownPeople } from '../lib/names';
import { scheduleMorningRecap, scheduleTomorrowReminder } from '../lib/notifications';
import { newId, useStore } from '../lib/store';
import { colors, gradients, MOODS, rtl } from '../lib/theme';
import type { ChatMessage, Entry, Person } from '../lib/types';
import { Chip, GhostButton, GradientButton, notify, Row, T, tap } from './ui';

export type PendingRecording = { uri: string; durationMs: number; startedAt: Date };

type Props = {
  visible: boolean;
  recording: PendingRecording | null;
  onClose: () => void;
  onSaved: (entry: Entry) => void;
};

export const BOT_NAME = 'יומי';

export default function ChatModal({ visible, recording, onClose, onSaved }: Props) {
  const { people, settings, addPerson, updatePerson, saveEntry } = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [question, setQuestion] = useState<BotQuestion | null>(null);
  const [typing, setTyping] = useState(false);
  const [done, setDone] = useState(false);
  const [input, setInput] = useState('');
  const scroll = useRef<ScrollViewInstance>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ask = (q: BotQuestion | null, extra?: string) => {
    setTyping(true);
    timer.current = setTimeout(() => {
      setTyping(false);
      if (q) {
        setMessages((m) => [...m, ...(extra ? [{ from: 'bot' as const, text: extra }] : []), { from: 'bot', text: q.text }]);
        setQuestion(q);
      } else {
        setMessages((m) => [...m, { from: 'bot', text: 'תודה ששיתפת 💜 הנה מה שרשמתי ביומן:' }]);
        setQuestion(null);
        setDone(true);
      }
    }, 700);
  };

  // Fresh conversation every time the chat opens
  useEffect(() => {
    if (!visible) return;
    setMessages(recording ? [{ from: 'bot', text: '🎙️ ההקלטה שלך נשמרה. בוא נוסיף כמה פרטים כדי שאזכור הכל.' }] : []);
    setAnswers([]);
    setDone(false);
    setInput('');
    ask(openingQuestion(settings.userName || undefined));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [messages, typing, done]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || !question || typing) return;
    tap();
    const nextAnswers = [...answers, { question, text: t }];
    setAnswers(nextAnswers);
    setMessages((m) => [...m, { from: 'me', text: t }]);
    setInput('');
    setQuestion(null);
    const reaction = question.kind === 'who' ? `רשמתי: ${question.name} — ${t} 👍` : undefined;
    // People named in "who is X?" answers count as known from here on
    const known: Person[] = [
      ...people,
      ...personNotes(nextAnswers)
        .filter((n) => !people.some((p) => p.name === n.name))
        .map((n) => ({ id: `new:${n.name}`, name: n.name, firstSeen: '' })),
    ];
    ask(nextQuestion(nextAnswers, known), reaction);
  };

  const draft = useMemo(() => {
    if (!done) return null;
    const notes = personNotes(answers);
    const said = saidQuotes(answers);
    const text = composeEntryText(answers);
    // Preview people list: existing + names the user confirmed during the chat
    const preview: Person[] = [
      ...people,
      ...notes.filter((n) => !people.some((p) => p.name === n.name)).map((n) => ({ id: `new:${n.name}`, name: n.name, firstSeen: '' })),
    ];
    const ids = [...new Set([...findKnownPeople(text, preview), ...notes.map((n) => preview.find((p) => p.name === n.name)!.id)])];
    return { text, notes, said, ids, preview, mood: moodFromAnswer(answers.find((a) => a.question.kind === 'mood')?.text ?? '') };
  }, [done, answers, people]);

  const save = async () => {
    if (!draft) return;
    // Create people met during the chat, with their notes
    const all = [...people];
    for (const n of draft.notes) {
      const p = addPerson(n.name);
      if (n.note) updatePerson({ ...p, note: n.note });
      if (!all.some((x) => x.id === p.id)) all.push(p);
    }
    const ids = draft.ids.map((id) => (id.startsWith('new:') ? all.find((p) => p.name === id.slice(4))!.id : id));
    const quotes = [
      ...draft.said.map((q) => ({ personId: all.find((p) => p.name === q.name)?.id ?? '', text: q.text })).filter((q) => q.personId),
      ...extractQuotes(draft.text, all, ids),
    ];
    const id = newId();
    const entry: Entry = {
      id,
      createdAt: (recording?.startedAt ?? new Date()).toISOString(),
      text: draft.text,
      audioUri: recording ? await persistRecording(recording.uri, id) : undefined,
      durationMs: recording?.durationMs,
      mood: draft.mood,
      people: [...new Set([...ids, ...quotes.map((q) => q.personId)])],
      quotes,
      chat: messages,
    };
    saveEntry(entry);
    scheduleMorningRecap(settings, entry, all).catch(() => {});
    const note = tomorrowNote(answers);
    if (note) scheduleTomorrowReminder(settings, note).catch(() => {});
    notify('success');
    onSaved(entry);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Row style={{ alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Row style={{ alignItems: 'center', gap: 10 }}>
              <BotAvatar />
              <View>
                <T bold size={18}>
                  {BOT_NAME}
                </T>
                <T dim size={12}>
                  {typing ? 'מקליד…' : 'החבר שזוכר הכל'}
                </T>
              </View>
            </Row>
            <Pressable onPress={onClose} hitSlop={12}>
              <T bold style={{ color: colors.primaryHi }}>סגור ✕</T>
            </Pressable>
          </Row>

          <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
            {messages.map((m, i) => (
              <Bubble key={i} msg={m} />
            ))}
            {typing && <Bubble msg={{ from: 'bot', text: '• • •' }} />}

            {done && draft && (
              <View style={{ backgroundColor: colors.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.primary, marginTop: 4 }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <T bold>📖 הרשומה של היום</T>
                  <Text style={{ fontSize: 24 }}>{MOODS[draft.mood - 1]}</Text>
                </Row>
                <T style={{ marginTop: 8, lineHeight: 22 }}>{draft.text || (recording ? '🎙️ הקלטה קולית' : '—')}</T>
                {draft.ids.length > 0 && (
                  <Row style={{ flexWrap: 'wrap', marginTop: 10 }}>
                    {draft.ids.map((id) => (
                      <Chip key={id} active label={draft.preview.find((p) => p.id === id)?.name ?? ''} />
                    ))}
                  </Row>
                )}
                <GradientButton title="שמור ביומן" icon="💾" colors={gradients.primary} onPress={save} style={{ marginTop: 12 }} />
                <GhostButton title="ביטול" onPress={onClose} style={{ marginTop: 8 }} />
              </View>
            )}
          </ScrollView>

          {!done && (
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: 10, backgroundColor: colors.bgDeep }}>
              {question?.chips && !typing && (
                <Row style={{ flexWrap: 'wrap', marginBottom: 6 }}>
                  {question.chips.map((c) => (
                    <Chip key={c} label={c} onPress={() => send(c)} />
                  ))}
                </Row>
              )}
              <Row style={{ alignItems: 'flex-end', gap: 8 }}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="כתוב או הכתב בקול עם 🎤 במקלדת…"
                  placeholderTextColor={colors.textMute}
                  multiline
                  style={{
                    flex: 1,
                    minWidth: 0,
                    maxHeight: 120,
                    backgroundColor: colors.card,
                    color: colors.text,
                    borderRadius: 20,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    fontSize: 16,
                    ...rtl,
                  }}
                />
                <Pressable
                  onPress={() => send(input)}
                  disabled={!input.trim() || typing}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: input.trim() && !typing ? colors.primary : colors.cardHi,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 20, color: '#fff' }}>➤</Text>
                </Pressable>
              </Row>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export function BotAvatar({ size = 40 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.5 }}>💜</Text>
    </View>
  );
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const mine = msg.from === 'me';
  return (
    <View style={{ flexDirection: 'row', justifyContent: mine ? 'flex-start' : 'flex-end' }}>
      <View
        style={{
          maxWidth: '82%',
          backgroundColor: mine ? colors.primary : colors.cardHi,
          borderRadius: 18,
          borderTopRightRadius: mine ? 18 : 4,
          borderTopLeftRadius: mine ? 4 : 18,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      >
        <T style={{ lineHeight: 22, color: '#fff' }}>{msg.text}</T>
      </View>
    </View>
  );
}
