import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pad } from '../lib/dates';
import { scheduleBedtime, scheduleMorningRecap, sendTestNotification } from '../lib/notifications';
import { useStore } from '../lib/store';
import { colors, gradients } from '../lib/theme';
import type { Settings } from '../lib/types';
import { Card, GhostButton, GradientButton, Input, Row, SectionTitle, T, tap } from './ui';

export default function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { settings, updateSettings, entries, people } = useStore();
  const [draft, setDraft] = useState<Settings>(settings);

  const save = async () => {
    updateSettings(draft);
    await scheduleBedtime(draft).catch(() => {});
    await scheduleMorningRecap(draft, entries[0], people).catch(() => {});
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onShow={() => setDraft(settings)} onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <T bold size={26}>
              ⚙️ הגדרות
            </T>
            <Pressable onPress={onClose} hitSlop={12}>
              <T bold style={{ color: colors.primaryHi }}>סגור ✕</T>
            </Pressable>
          </Row>

          <SectionTitle>👤 איך לקרוא לך?</SectionTitle>
          <Input value={draft.userName} onChangeText={(userName) => setDraft({ ...draft, userName })} placeholder="השם שלך" />

          <SectionTitle>🌙 תזכורת לפני השינה</SectionTitle>
          <Card>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <T style={{ flex: 1 }}>כל ערב אשאל "איך היה היום?"</T>
              <Switch
                value={draft.bedtimeEnabled}
                onValueChange={(bedtimeEnabled) => setDraft({ ...draft, bedtimeEnabled })}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </Row>
            {draft.bedtimeEnabled && (
              <TimePicker
                hour={draft.bedtimeHour}
                minute={draft.bedtimeMinute}
                onChange={(bedtimeHour, bedtimeMinute) => setDraft({ ...draft, bedtimeHour, bedtimeMinute })}
              />
            )}
          </Card>

          <SectionTitle>☀️ סיכום בבוקר</SectionTitle>
          <Card>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <T style={{ flex: 1 }}>למחרת בבוקר אזכיר לך מה היה אתמול ומה אנשים אמרו לך</T>
              <Switch
                value={draft.morningRecapEnabled}
                onValueChange={(morningRecapEnabled) => setDraft({ ...draft, morningRecapEnabled })}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </Row>
            {draft.morningRecapEnabled && (
              <TimePicker hour={draft.morningHour} minute={0} hourOnly onChange={(morningHour) => setDraft({ ...draft, morningHour })} />
            )}
          </Card>

          <GradientButton title="שמור הגדרות" icon="💾" colors={gradients.primary} onPress={save} style={{ marginTop: 24 }} />
          <GhostButton
            title="🔔 שלח התראת ניסיון"
            style={{ marginTop: 10 }}
            onPress={async () => {
              const ok = await sendTestNotification().catch(() => false);
              Alert.alert(ok ? 'נשלח!' : 'אין הרשאה', ok ? 'ההתראה תגיע בעוד כמה שניות' : 'אפשר התראות בהגדרות הטלפון');
            }}
          />
          <T dim size={12} style={{ textAlign: 'center', marginTop: 20, lineHeight: 18 }}>
            🔒 כל המידע נשמר רק על הטלפון שלך — שום דבר לא נשלח לשרת.
          </T>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function TimePicker({
  hour,
  minute,
  onChange,
  hourOnly,
}: {
  hour: number;
  minute: number;
  onChange: (h: number, m: number) => void;
  hourOnly?: boolean;
}) {
  const step = (dh: number, dm: number) => {
    tap();
    let m = minute + dm;
    let h = hour + dh;
    if (m >= 60) {
      m -= 60;
      h += 1;
    }
    if (m < 0) {
      m += 60;
      h -= 1;
    }
    onChange((h + 24) % 24, m);
  };
  return (
    <Row style={{ justifyContent: 'center', alignItems: 'center', marginTop: 16, gap: 18 }}>
      <Stepper onUp={() => step(1, 0)} onDown={() => step(-1, 0)} />
      <View style={{ backgroundColor: colors.bgDeep, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 10 }}>
        <T bold size={34} style={{ textAlign: 'center', fontVariant: ['tabular-nums'] }}>
          {pad(hour)}:{pad(minute)}
        </T>
      </View>
      {!hourOnly && <Stepper onUp={() => step(0, 15)} onDown={() => step(0, -15)} />}
    </Row>
  );
}

function Stepper({ onUp, onDown }: { onUp: () => void; onDown: () => void }) {
  const btn = { width: 44, height: 36, borderRadius: 12, backgroundColor: colors.cardHi, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ gap: 6 }}>
      <Pressable onPress={onUp} style={btn}>
        <T bold size={18} style={{ textAlign: 'center' }}>▲</T>
      </Pressable>
      <Pressable onPress={onDown} style={btn}>
        <T bold size={18} style={{ textAlign: 'center' }}>▼</T>
      </Pressable>
    </View>
  );
}
