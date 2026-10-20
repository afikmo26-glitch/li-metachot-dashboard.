import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteRecording } from '../lib/audio';
import { formatDuration, formatLongDate, formatTimeSeconds } from '../lib/dates';
import { extractQuotes, findKnownPeople } from '../lib/names';
import { personName, useStore } from '../lib/store';
import { colors, gradients, layout, MOOD_LABELS, MOODS } from '../lib/theme';
import { Card, Chip, GhostButton, GradientButton, Input, Row, T } from './ui';
import { t } from '../i18n';

export default function EntryModal({ entryId, onClose }: { entryId: string | null; onClose: () => void }) {
  const { entries, people, saveEntry, deleteEntry } = useStore();
  const entry = entries.find((e) => e.id === entryId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    setEditing(false);
  }, [entryId]);

  if (!entry) return null;

  const remove = () =>
    Alert.alert(t('למחוק את הרשומה?'), t('אי אפשר לשחזר אחרי מחיקה.'), [
      { text: t('ביטול'), style: 'cancel' },
      {
        text: t('מחק'),
        style: 'destructive',
        onPress: () => {
          deleteRecording(entry.audioUri);
          deleteEntry(entry.id);
          onClose();
        },
      },
    ]);

  const saveEdit = () => {
    const ids = [...new Set([...entry.people, ...findKnownPeople(draft, people)])];
    saveEntry({ ...entry, text: draft.trim(), people: ids, quotes: extractQuotes(draft, people, ids) });
    setEditing(false);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Pressable onPress={onClose} hitSlop={12}>
              <T bold size={16} style={{ color: colors.primaryHi }}>
                {t('סגור ✕')}
              </T>
            </Pressable>
            <Text style={{ fontSize: 34 }}>{MOODS[entry.mood - 1]}</Text>
          </Row>

          <T bold size={22} style={{ marginTop: 12 }}>
            {formatLongDate(entry.createdAt)}
          </T>
          <T dim style={{ marginTop: 2 }}>
            🕐 {t('בשעה {time}', { time: formatTimeSeconds(entry.createdAt) })} · {t(MOOD_LABELS[entry.mood - 1])}
          </T>

          {entry.audioUri ? <AudioPlayerCard uri={entry.audioUri} durationMs={entry.durationMs} /> : null}

          <Card style={{ marginTop: 14 }}>
            {editing ? (
              <>
                <Input multiline value={draft} onChangeText={setDraft} style={{ minHeight: 140, textAlignVertical: 'top', lineHeight: 22 }} />
                <Row style={{ gap: 10, marginTop: 10 }}>
                  <GradientButton small title={t('שמור')} colors={gradients.primary} onPress={saveEdit} />
                  <GhostButton title={t('ביטול')} onPress={() => setEditing(false)} />
                </Row>
              </>
            ) : (
              <Pressable
                onLongPress={() => {
                  setDraft(entry.text);
                  setEditing(true);
                }}
              >
                <T style={{ lineHeight: 24 }}>{entry.text || t('אין טקסט — רק הקלטה קולית 🎙️')}</T>
                <T dim size={12} style={{ marginTop: 8 }}>
                  {t('לחיצה ארוכה לעריכה')}
                </T>
              </Pressable>
            )}
          </Card>

          {entry.chat && entry.chat.length > 0 && (
            <>
              <Pressable onPress={() => setShowChat((v) => !v)} style={{ marginTop: 14 }}>
                <T bold style={{ color: colors.primaryHi }}>
                  {showChat ? t('💬 הסתר את השיחה עם יומי') : t('💬 הצג את השיחה עם יומי ({n} הודעות)', { n: entry.chat.length })}
                </T>
              </Pressable>
              {showChat &&
                entry.chat.map((m, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: (m.from === 'me') === layout.isRTL ? 'flex-start' : 'flex-end', marginTop: 8 }}>
                    <View style={{ maxWidth: '85%', backgroundColor: m.from === 'me' ? colors.primary : colors.cardHi, borderRadius: 16, padding: 10 }}>
                      <T size={14} style={{ color: m.from === 'me' ? colors.onPrimary : colors.text }}>
                        {m.text}
                      </T>
                    </View>
                  </View>
                ))}
            </>
          )}

          {entry.people.length > 0 && (
            <>
              <T bold style={{ marginTop: 16, marginBottom: 8 }}>
                {t('👥 אנשים')}
              </T>
              <Row style={{ flexWrap: 'wrap' }}>
                {entry.people.map((id) => (
                  <Chip key={id} label={personName(people, id)} active />
                ))}
              </Row>
            </>
          )}

          {entry.quotes.length > 0 && (
            <>
              <T bold style={{ marginTop: 12, marginBottom: 8 }}>
                {t('💬 מה אמרו')}
              </T>
              {entry.quotes.map((q, i) => (
                <Card key={i} style={{ marginBottom: 8, padding: 12 }}>
                  <T bold size={14} style={{ color: colors.pink }}>
                    {personName(people, q.personId)}
                  </T>
                  <T style={{ marginTop: 2 }}>"{q.text}"</T>
                </Card>
              ))}
            </>
          )}

          <GhostButton title={t('🗑️ מחק רשומה')} color={colors.red} onPress={remove} style={{ marginTop: 24, borderColor: colors.red }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function AudioPlayerCard({ uri, durationMs }: { uri: string; durationMs?: number }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const total = status.duration ? status.duration * 1000 : durationMs ?? 0;
  const progress = total ? Math.min(1, (status.currentTime * 1000) / total) : 0;

  const toggle = () => {
    if (status.playing) {
      player.pause();
    } else {
      if (status.didJustFinish || (total && status.currentTime * 1000 >= total - 200)) player.seekTo(0);
      player.play();
    }
  };

  return (
    <Card style={{ marginTop: 14 }}>
      <Row style={{ alignItems: 'center', gap: 12 }}>
        <Pressable onPress={toggle}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 22 }}>{status.playing ? '⏸️' : '▶️'}</Text>
          </View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.bgDeep, overflow: 'hidden', transform: [{ scaleX: layout.flip }] }}>
            <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: colors.pink }} />
          </View>
          <T dim size={13} style={{ marginTop: 6 }}>
            {formatDuration(status.currentTime * 1000)} / {formatDuration(total)}
          </T>
        </View>
      </Row>
    </Card>
  );
}
