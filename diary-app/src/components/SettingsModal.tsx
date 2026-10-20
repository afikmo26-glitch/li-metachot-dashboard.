import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Account, changePassword, saveAccount } from '../lib/account';
import { AiConfig, aiTest, EMPTY_AI, loadAiConfig, saveAiConfig } from '../lib/ai';
import { pad } from '../lib/dates';
import { scheduleBedtime, scheduleMorningRecap, sendTestNotification } from '../lib/notifications';
import { useStore } from '../lib/store';
import { colors, gradients } from '../lib/theme';
import type { Settings } from '../lib/types';
import { Card, GhostButton, GradientButton, Input, Row, SectionTitle, T, tap } from './ui';

type Props = {
  visible: boolean;
  onClose: () => void;
  account: Account;
  onAccountChange: (a: Account) => void;
  onLock: () => void;
};

export default function SettingsModal({ visible, onClose, account, onAccountChange, onLock }: Props) {
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

          <SectionTitle>👤 החשבון שלי</SectionTitle>
          <AccountCard account={account} onAccountChange={onAccountChange} onLock={onLock} />

          <SectionTitle>✨ צ'אט חכם (AI)</SectionTitle>
          <AiCard />

          <SectionTitle>🛡️ אבטחה ופרטיות</SectionTitle>
          <Card style={{ gap: 6 }}>
            <T size={14}>🔐 כל היומן מוצפן על הטלפון (AES-256), והמפתח שמור בכספת המאובטחת של המכשיר</T>
            <T size={14}>🔑 הסיסמה נשמרת כ-hash חזק (PBKDF2) ולא כטקסט</T>
            <T size={14}>⛔ 5 ניסיונות כניסה שגויים חוסמים ל-30 שניות</T>
            <T size={14}>🫂 "המקום לפרוק" מוצפן בסיסמה נפרדת, ננעל ביציאה ואי אפשר לצלם בו מסך</T>
            <T size={14}>📵 אין גיבוי אוטומטי של היומן לענן של גוגל, כדי שלא ייצא מהטלפון</T>
            <T dim size={12} style={{ marginTop: 4, lineHeight: 18 }}>
              כשה-AI מופעל, ההודעות שלך בצ'אט נשלחות לשרת שלך ול-Claude כדי לקבל תשובה. בלי AI שום דבר לא יוצא מהטלפון.
            </T>
          </Card>

          <SectionTitle>איך לקרוא לך?</SectionTitle>
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

function AiCard() {
  const [cfg, setCfg] = useState<AiConfig>(EMPTY_AI);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadAiConfig().then(setCfg);
  }, []);

  const update = (patch: Partial<AiConfig>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    saveAiConfig(next).catch(() => {});
  };

  const test = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const reply = await aiTest(cfg);
      setStatus({ text: `מחובר ✓ (${reply.slice(0, 40)})`, ok: true });
    } catch (e) {
      setStatus({ text: `לא הצלחתי להתחבר: ${(e as Error).message}`, ok: false });
    }
    setBusy(false);
  };

  return (
    <Card>
      <T dim size={13} style={{ lineHeight: 19, marginBottom: 10 }}>
        עם AI, יומי והמקום לפרוק עונים לך כמו בן אדם אמיתי. צריך שרת קטן (הוראות ב-README של הפרויקט). בלי שרת הם עובדים במצב רגיל.
      </T>
      <Input
        value={cfg.url}
        onChangeText={(url) => update({ url: url.trim() })}
        placeholder="כתובת השרת, למשל https://diary-ai.xxx.workers.dev"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={{ textAlign: 'left', writingDirection: 'ltr' }}
      />
      <Input
        value={cfg.appKey}
        onChangeText={(appKey) => update({ appKey: appKey.trim() })}
        placeholder="מפתח האפליקציה (APP_KEY)"
        secureTextEntry
        autoCapitalize="none"
        style={{ marginTop: 8, textAlign: 'left', writingDirection: 'ltr' }}
      />
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <T style={{ flex: 1 }}>💜 AI בשיחה עם יומי</T>
        <Switch value={cfg.diary} onValueChange={(diary) => update({ diary })} trackColor={{ true: colors.primary, false: colors.border }} />
      </Row>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <T style={{ flex: 1 }}>🫂 AI במקום לפרוק</T>
        <Switch value={cfg.vent} onValueChange={(vent) => update({ vent })} trackColor={{ true: colors.primary, false: colors.border }} />
      </Row>
      <GhostButton title={busy ? 'בודק…' : '🔌 בדוק חיבור'} onPress={test} style={{ marginTop: 12 }} />
      {status && (
        <T size={13} style={{ marginTop: 8, color: status.ok ? colors.green : colors.red }}>
          {status.text}
        </T>
      )}
    </Card>
  );
}

function AccountCard({ account, onAccountChange, onLock }: { account: Account; onAccountChange: (a: Account) => void; onLock: () => void }) {
  const [changing, setChanging] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const toggleLock = async (lockEnabled: boolean) => {
    const a = { ...account, lockEnabled };
    await saveAccount(a);
    onAccountChange(a);
  };

  const submit = async () => {
    const res = await changePassword(account, current, next);
    if (typeof res === 'string') {
      setMsg({ text: res, ok: false });
      return;
    }
    onAccountChange(res);
    setMsg({ text: 'הסיסמה עודכנה ✓', ok: true });
    setCurrent('');
    setNext('');
    setChanging(false);
  };

  return (
    <Card>
      <Row style={{ alignItems: 'center', gap: 12 }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <T bold size={22} style={{ color: '#fff', textAlign: 'center' }}>
            {account.displayName.slice(0, 1)}
          </T>
        </View>
        <View style={{ flex: 1 }}>
          <T bold size={17}>
            {account.displayName}
          </T>
          <T dim size={14}>
            @{account.username}
          </T>
        </View>
      </Row>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
        <T style={{ flex: 1 }}>🔒 בקש סיסמה בכל פתיחה</T>
        <Switch value={account.lockEnabled} onValueChange={toggleLock} trackColor={{ true: colors.primary, false: colors.border }} />
      </Row>
      {changing ? (
        <View style={{ gap: 8, marginTop: 12 }}>
          <Input value={current} onChangeText={setCurrent} placeholder="סיסמה נוכחית" secureTextEntry />
          <Input value={next} onChangeText={setNext} placeholder="סיסמה חדשה" secureTextEntry />
          <Row style={{ gap: 10 }}>
            <GradientButton small title="עדכן" colors={gradients.primary} onPress={submit} />
            <GhostButton title="ביטול" onPress={() => setChanging(false)} />
          </Row>
        </View>
      ) : (
        <Row style={{ gap: 10, marginTop: 12 }}>
          <GhostButton title="שינוי סיסמה" onPress={() => setChanging(true)} style={{ flex: 1 }} />
          {account.lockEnabled && <GhostButton title="נעל עכשיו" onPress={onLock} style={{ flex: 1 }} />}
        </Row>
      )}
      {msg && (
        <T size={14} style={{ marginTop: 8, color: msg.ok ? colors.green : colors.red }}>
          {msg.text}
        </T>
      )}
    </Card>
  );
}

export function TimePicker({
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
      {/* Row is right-to-left but "22:30" reads left-to-right: minutes arrows go on the right, hours on the left */}
      {!hourOnly && <Stepper onUp={() => step(0, 15)} onDown={() => step(0, -15)} />}
      <View style={{ backgroundColor: colors.bgDeep, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 10 }}>
        <T bold size={34} style={{ textAlign: 'center', fontVariant: ['tabular-nums'] }}>
          {pad(hour)}:{pad(minute)}
        </T>
      </View>
      <Stepper onUp={() => step(1, 0)} onDown={() => step(-1, 0)} />
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
