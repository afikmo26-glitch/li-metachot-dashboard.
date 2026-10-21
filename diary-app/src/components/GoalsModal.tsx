import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { formatShortDate } from '../lib/dates';
import { newId, useStore } from '../lib/store';
import { colors, gradients, layout } from '../lib/theme';
import { Card, Chip, Empty, GhostButton, GradientButton, Input, Row, T, notify } from './ui';

/** Personal goals; Yomi checks in on each one once a week from the Today screen. */

const IDEAS = ['לרוץ 5 ק״מ', 'לקרוא ספר בחודש', 'לישון 7 שעות', 'להתקשר להורים פעם בשבוע', 'לחסוך כסף', 'ללמוד משהו חדש'];
const PROGRESS = ['😣', '😕', '😐', '🙂', '🚀'];

export default function GoalsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { goals, saveGoal, deleteGoal } = useStore();
  const [title, setTitle] = useState('');
  const active = goals.filter((g) => !g.done);
  const done = goals.filter((g) => g.done);

  const add = (text: string) => {
    if (!text.trim()) return;
    saveGoal({ id: newId(), title: text.trim(), createdAt: new Date().toISOString(), checkins: [] });
    setTitle('');
    notify('success');
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <T bold size={26}>
              {t('🎯 המטרות שלי')}
            </T>
            <Pressable onPress={onClose} hitSlop={12}>
              <T bold style={{ color: colors.primaryHi }}>
                {t('סגור ✕')}
              </T>
            </Pressable>
          </Row>
          <T dim style={{ marginTop: 4 }}>
            {t('פעם בשבוע אשאל איך מתקדם')}
          </T>

          <Row style={{ gap: 8, marginTop: 14, alignItems: 'center' }}>
            <Input value={title} onChangeText={setTitle} placeholder={t('מטרה חדשה…')} style={{ flex: 1, minWidth: 0 }} onSubmitEditing={() => add(title)} />
            <GradientButton small title={t('הוסף')} colors={gradients.primary} onPress={() => add(title)} />
          </Row>
          {active.length === 0 && (
            <Row style={{ flexWrap: 'wrap', marginTop: 10 }}>
              {IDEAS.map((i) => (
                <Chip key={i} label={`+ ${t(i)}`} onPress={() => add(t(i))} />
              ))}
            </Row>
          )}

          {active.length === 0 && done.length === 0 ? (
            <Empty emoji="🌱" title={t('עוד אין מטרות')} text={t('מטרה קטנה ופשוטה היא התחלה מצוינת')} />
          ) : (
            active.map((g) => {
              const last = g.checkins[g.checkins.length - 1];
              return (
                <Card key={g.id} style={{ marginTop: 12 }}>
                  <T bold size={17}>
                    {g.title}
                  </T>
                  <T dim size={13}>
                    {t('מאז {date}', { date: formatShortDate(g.createdAt) })}
                    {last ? ` · ${t('בפעם האחרונה: {p}', { p: PROGRESS[last.progress - 1] })}` : ''}
                  </T>
                  {g.checkins.length > 0 && (
                    <View style={{ flexDirection: layout.row, gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
                      {g.checkins.slice(-12).map((c, i) => (
                        <Text key={i} style={{ fontSize: 18 }}>
                          {PROGRESS[c.progress - 1]}
                        </Text>
                      ))}
                    </View>
                  )}
                  <Row style={{ gap: 10, marginTop: 10 }}>
                    <GhostButton
                      title={t('🏆 הושגה!')}
                      onPress={() => {
                        saveGoal({ ...g, done: true });
                        notify('success');
                      }}
                      style={{ flex: 1 }}
                    />
                    <GhostButton
                      title={t('🗑️')}
                      color={colors.red}
                      style={{ borderColor: colors.red }}
                      onPress={() =>
                        Alert.alert(t('למחוק את המטרה?'), g.title, [
                          { text: t('ביטול'), style: 'cancel' },
                          { text: t('מחק'), style: 'destructive', onPress: () => deleteGoal(g.id) },
                        ])
                      }
                    />
                  </Row>
                </Card>
              );
            })
          )}

          {done.length > 0 && (
            <>
              <T bold style={{ marginTop: 22 }}>
                {t('🏆 מטרות שהשגת ({n})', { n: done.length })}
              </T>
              {done.map((g) => (
                <T key={g.id} dim style={{ marginTop: 6 }}>
                  ✓ {g.title}
                </T>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
