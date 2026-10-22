import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Account, changePassword, saveAccount } from '../lib/account';
import { AiConfig, aiTest, EMPTY_AI, hasBuiltInAi, loadAiConfig, saveAiConfig } from '../lib/ai';
import { biometricAvailable, biometricLabel, biometricUnlock } from '../lib/biometric';
import { maskContact, normalizeContact } from '../lib/recovery';
import { pad } from '../lib/dates';
import { scheduleBedtime, scheduleMorningRecap, schedulePhotoReminder, sendTestNotification } from '../lib/notifications';
import { useStore } from '../lib/store';
import { usePrefs } from '../lib/prefs';
import { colors, gradients, THEME_UNLOCK, ThemeName, THEMES } from '../lib/theme';
import { levelInfo } from '../lib/game';
import { GenderPicker } from '../screens/AuthScreens';
import { exportBackup, importBackup, MIN_BACKUP_PASSWORD } from '../lib/backup';
import { shareYearBook } from '../lib/yearbook';
import type { Settings } from '../lib/types';
import { Card, Chip, GhostButton, GradientButton, Input, Row, SectionTitle, T, tap } from './ui';
import { LANGS, t } from '../i18n';

type Props = {
  visible: boolean;
  onClose: () => void;
  account: Account;
  onAccountChange: (a: Account) => void;
  onLock: () => void;
  onOpenIntro: () => void;
};

export default function SettingsModal({ visible, onClose, account, onAccountChange, onLock, onOpenIntro }: Props) {
  const { settings, updateSettings, entries, people } = useStore();
  const [draft, setDraft] = useState<Settings>(settings);

  const save = async () => {
    updateSettings(draft);
    await scheduleBedtime(draft).catch(() => {});
    await scheduleMorningRecap(draft, entries[0], people).catch(() => {});
    await schedulePhotoReminder(draft).catch(() => {});
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onShow={() => setDraft(settings)} onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <T bold size={26}>
              {t('⚙️ הגדרות')}
            </T>
            <Pressable onPress={onClose} hitSlop={12}>
              <T bold style={{ color: colors.primaryHi }}>{t('סגור ✕')}</T>
            </Pressable>
          </Row>

          <SectionTitle>{t('🎨 תצוגה')}</SectionTitle>
          <DisplayCard />

          <SectionTitle>{t('👤 החשבון שלי')}</SectionTitle>
          <AccountCard account={account} onAccountChange={onAccountChange} onLock={onLock} />
          <GhostButton title={t('👋 ההיכרות שלי (משפחה, חברים, עבודה)')} onPress={onOpenIntro} style={{ marginTop: 10 }} />

          <SectionTitle>{t('✨ צ\'אט חכם (AI)')}</SectionTitle>
          <AiCard />

          <SectionTitle>{t('🛡️ אבטחה ופרטיות')}</SectionTitle>
          <Card style={{ gap: 6 }}>
            <T size={14}>{t('🔐 כל היומן מוצפן על הטלפון (AES-256), והמפתח שמור בכספת המאובטחת של המכשיר')}</T>
            <T size={14}>{t('🔑 הסיסמה נשמרת כ-hash חזק (PBKDF2) ולא כטקסט')}</T>
            <T size={14}>{t('⛔ 5 ניסיונות כניסה שגויים חוסמים ל-30 שניות')}</T>
            <T size={14}>{t('🫂 "המקום לפרוק" מוצפן בסיסמה נפרדת, ננעל ביציאה ואי אפשר לצלם בו מסך')}</T>
            <T size={14}>{t('📵 אין גיבוי אוטומטי של היומן לענן של גוגל, כדי שלא ייצא מהטלפון')}</T>
            <T dim size={12} style={{ marginTop: 4, lineHeight: 18 }}>
              {t('כשה-AI מופעל, ההודעות שלך בצ\'אט נשלחות לשרת שלך ול-Claude כדי לקבל תשובה. בלי AI שום דבר לא יוצא מהטלפון.')}
            </T>
          </Card>

          <SectionTitle>{t('איך לקרוא לך?')}</SectionTitle>
          <Input value={draft.userName} onChangeText={(userName) => setDraft({ ...draft, userName })} placeholder={t('השם שלך')} />

          <SectionTitle>{t('🌙 תזכורת לפני השינה')}</SectionTitle>
          <Card>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <T style={{ flex: 1 }}>{t('כל ערב אשאל "איך היה היום?"')}</T>
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

          <SectionTitle>{t('☀️ סיכום בבוקר')}</SectionTitle>
          <Card>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <T style={{ flex: 1 }}>{t('למחרת בבוקר אזכיר לך מה היה אתמול ומה אנשים אמרו לך')}</T>
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

          <SectionTitle>{t('📸 תמונה יומית')}</SectionTitle>
          <Card>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <T style={{ flex: 1 }}>{t('תזכורת בערב לצרף תמונה של היום (לא חובה)')}</T>
              <Switch value={!!draft.photoReminder} onValueChange={(photoReminder) => setDraft({ ...draft, photoReminder })} trackColor={{ true: colors.primary, false: colors.border }} />
            </Row>
          </Card>

          <GradientButton title={t('שמור הגדרות')} icon="💾" colors={gradients.primary} onPress={save} style={{ marginTop: 24 }} />

          <SectionTitle>{t('💾 גיבוי וספר השנה')}</SectionTitle>
          <BackupCard />

          <SectionTitle>{t('💎 פרימיום')}</SectionTitle>
          <PremiumCard />
          <GhostButton
            title={t('🔔 שלח התראת ניסיון')}
            style={{ marginTop: 10 }}
            onPress={async () => {
              const ok = await sendTestNotification().catch(() => false);
              Alert.alert(ok ? t('נשלח!') : t('אין הרשאה'), ok ? t('ההתראה תגיע בעוד כמה שניות') : t('אפשר התראות בהגדרות הטלפון'));
            }}
          />
          <T dim size={12} style={{ textAlign: 'center', marginTop: 20, lineHeight: 18 }}>
            {t('🔒 כל המידע נשמר רק על הטלפון שלך — שום דבר לא נשלח לשרת.')}
          </T>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function DisplayCard() {
  const { prefs, setPrefs } = usePrefs();
  const { game } = useStore();
  const level = levelInfo(game.xp).level;
  return (
    <Card>
      <T bold size={14} style={{ marginBottom: 8 }}>
        {t('🌐 שפה')}
      </T>
      <Row style={{ flexWrap: 'wrap' }}>
        {LANGS.map((l) => (
          <Chip key={l.code} label={l.label} active={prefs.lang === l.code} onPress={() => setPrefs({ lang: l.code }, true)} />
        ))}
      </Row>
      <T bold size={14} style={{ marginTop: 10, marginBottom: 10 }}>
        {t('🎨 צבעים')}
      </T>
      <Row style={{ flexWrap: 'wrap', gap: 12 }}>
        {(Object.keys(THEMES) as ThemeName[]).map((name) => {
          const th = THEMES[name];
          const active = prefs.theme === name;
          const need = THEME_UNLOCK[name] ?? 1;
          const locked = level < need;
          return (
            <Pressable
              key={name}
              onPress={() =>
                locked
                  ? Alert.alert(t('🔒 נפתח ברמה {n}', { n: need }), t('שחק במשחק הזיכרון ועשה את האתגרים השבועיים כדי לעלות רמה'))
                  : setPrefs({ theme: name }, true)
              }
              style={{ alignItems: 'center', width: 64, opacity: locked ? 0.45 : 1 }}
              accessibilityLabel={t(th.label)}
            >
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  backgroundColor: th.palette.bg,
                  borderWidth: active ? 3 : 1,
                  borderColor: active ? th.palette.primaryHi : colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {locked ? (
                  <T size={18}>🔒</T>
                ) : (
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: th.swatch === th.palette.bg ? th.palette.primary : th.swatch }} />
                )}
              </View>
              <T size={11} bold={active} style={{ textAlign: 'center', marginTop: 4 }}>
                {t(th.label)}
              </T>
            </Pressable>
          );
        })}
      </Row>
      <View style={{ marginTop: 14 }}>
        <GenderPicker value={prefs.gender} onChange={(gender) => setPrefs({ gender }, true)} />
      </View>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
        <T style={{ flex: 1 }}>{t('🔊 צלילים באפליקציה')}</T>
        <Switch value={prefs.sounds} onValueChange={(sounds) => setPrefs({ sounds }, true)} trackColor={{ true: colors.primary, false: colors.border }} />
      </Row>
    </Card>
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
      setStatus({ text: t('מחובר ✓ ({reply})', { reply: reply.slice(0, 40) }), ok: true });
    } catch (e) {
      setStatus({ text: t('לא הצלחתי להתחבר: {err}', { err: (e as Error).message }), ok: false });
    }
    setBusy(false);
  };

  return (
    <Card>
      <T dim size={13} style={{ lineHeight: 19, marginBottom: 10 }}>
        {t('עם AI, יומי והמקום לפרוק עונים לך כמו בן אדם אמיתי. בלי AI הם עובדים במצב רגיל.')}
      </T>
      {hasBuiltInAi() && (
        <T size={13} style={{ color: colors.green, marginBottom: 10, lineHeight: 19 }}>
          {t('✨ AI מובנה פעיל באפליקציה (Google Gemini). אפשר להשאיר את השדות למטה ריקים.')}
        </T>
      )}
      <T bold size={14} style={{ marginBottom: 6 }}>
        {t('🔑 מפתח Gemini (Google AI Studio)')}
      </T>
      <Input
        value={cfg.geminiKey ?? ''}
        onChangeText={(geminiKey) => update({ geminiKey: geminiKey.trim() })}
        placeholder={hasBuiltInAi() ? t('לא חובה — יש AI מובנה') : 'AIza... / AQ...'}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        style={{ textAlign: 'left', writingDirection: 'ltr' }}
      />
      <T dim size={12} style={{ marginTop: 6, marginBottom: 12, lineHeight: 17 }}>
        {t('מפתח חינמי מ-aistudio.google.com. נשמר מוצפן רק בטלפון הזה.')}
      </T>
      <T bold size={14} style={{ marginBottom: 6 }}>
        {t('🔑 או: מפתח Claude אישי')}
      </T>
      <Input
        value={cfg.claudeKey}
        onChangeText={(claudeKey) => update({ claudeKey: claudeKey.trim() })}
        placeholder="sk-ant-..."
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        style={{ textAlign: 'left', writingDirection: 'ltr' }}
      />
      <T dim size={12} style={{ marginTop: 6, marginBottom: 12, lineHeight: 17 }}>
        {t('המפתח נשמר מוצפן רק בטלפון הזה. כל הודעה עולה בערך 1–3 סנט מהקרדיט שלך.')}
      </T>
      <T bold size={14} style={{ marginBottom: 6 }}>
        {t('🌐 או: שרת משלך (לשיתוף עם חברים)')}
      </T>
      <Input
        value={cfg.url}
        onChangeText={(url) => update({ url: url.trim() })}
        placeholder={t('כתובת השרת, למשל https://diary-ai.xxx.workers.dev')}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={{ textAlign: 'left', writingDirection: 'ltr' }}
      />
      <Input
        value={cfg.appKey}
        onChangeText={(appKey) => update({ appKey: appKey.trim() })}
        placeholder={t('מפתח האפליקציה (APP_KEY)')}
        secureTextEntry
        autoCapitalize="none"
        style={{ marginTop: 8, textAlign: 'left', writingDirection: 'ltr' }}
      />
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <T style={{ flex: 1 }}>{t('💜 AI בשיחה עם יומי')}</T>
        <Switch value={cfg.diary} onValueChange={(diary) => update({ diary })} trackColor={{ true: colors.primary, false: colors.border }} />
      </Row>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <T style={{ flex: 1 }}>{t('🫂 AI במקום לפרוק')}</T>
        <Switch value={cfg.vent} onValueChange={(vent) => update({ vent })} trackColor={{ true: colors.primary, false: colors.border }} />
      </Row>
      <GhostButton title={busy ? t('בודק…') : t('🔌 בדוק חיבור')} onPress={test} style={{ marginTop: 12 }} />
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

  const [canBio, setCanBio] = useState(false);
  const [bioLabel, setBioLabel] = useState('');
  const [editContact, setEditContact] = useState(false);
  const [contact, setContact] = useState(account.recovery ?? '');

  const saveContact = async () => {
    const c = normalizeContact(contact);
    if (!c) {
      setMsg({ text: t('כתוב אימייל או מספר טלפון תקין'), ok: false });
      return;
    }
    const a = { ...account, recovery: c };
    await saveAccount(a);
    onAccountChange(a);
    setEditContact(false);
    setMsg({ text: t('פרטי השחזור עודכנו ✓'), ok: true });
  };

  useEffect(() => {
    biometricAvailable().then(setCanBio);
    biometricLabel().then(setBioLabel);
  }, []);

  // Turning it on asks for the finger/face once, so we know it works on this phone
  const toggleBio = async (on: boolean) => {
    if (on && !(await biometricUnlock())) return;
    const a = { ...account, biometric: on };
    await saveAccount(a);
    onAccountChange(a);
  };

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
    setMsg({ text: t('הסיסמה עודכנה ✓'), ok: true });
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
        <T style={{ flex: 1 }}>{t('🔒 בקש סיסמה בכל פתיחה')}</T>
        <Switch value={account.lockEnabled} onValueChange={toggleLock} trackColor={{ true: colors.primary, false: colors.border }} />
      </Row>
      <View style={{ marginTop: 12 }}>
        <T>{t('🔑 שחזור סיסמה אל: {contact}', { contact: account.recovery ? maskContact(account.recovery) : t('לא הוגדר') })}</T>
        {editContact ? (
          <Row style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
            <Input
              value={contact}
              onChangeText={setContact}
              placeholder={t('אימייל או מספר טלפון')}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ flex: 1, minWidth: 0, textAlign: 'left', writingDirection: 'ltr' }}
            />
            <GradientButton small title={t('שמור')} colors={gradients.primary} onPress={saveContact} />
          </Row>
        ) : (
          <GhostButton title={account.recovery ? t('שינוי אימייל / טלפון') : t('הוסף אימייל או טלפון')} onPress={() => setEditContact(true)} style={{ marginTop: 8 }} />
        )}
      </View>
      {canBio && account.lockEnabled && (
        <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <T style={{ flex: 1 }}>{t('🔓 פתיחה עם {method}', { method: bioLabel })}</T>
          <Switch value={!!account.biometric} onValueChange={toggleBio} trackColor={{ true: colors.primary, false: colors.border }} />
        </Row>
      )}
      {changing ? (
        <View style={{ gap: 8, marginTop: 12 }}>
          <Input value={current} onChangeText={setCurrent} placeholder={t('סיסמה נוכחית')} secureTextEntry />
          <Input value={next} onChangeText={setNext} placeholder={t('סיסמה חדשה')} secureTextEntry />
          <Row style={{ gap: 10 }}>
            <GradientButton small title={t('עדכן')} colors={gradients.primary} onPress={submit} />
            <GhostButton title={t('ביטול')} onPress={() => setChanging(false)} />
          </Row>
        </View>
      ) : (
        <Row style={{ gap: 10, marginTop: 12 }}>
          <GhostButton title={t('שינוי סיסמה')} onPress={() => setChanging(true)} style={{ flex: 1 }} />
          {account.lockEnabled && <GhostButton title={t('נעל עכשיו')} onPress={onLock} style={{ flex: 1 }} />}
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
  minuteStep = 15,
}: {
  hour: number;
  minute: number;
  onChange: (h: number, m: number) => void;
  hourOnly?: boolean;
  minuteStep?: number;
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
      {!hourOnly && <Stepper onUp={() => step(0, minuteStep)} onDown={() => step(0, -minuteStep)} />}
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

/** Encrypted backup file (export / restore) and the printable year book. */
function BackupCard() {
  const store = useStore();
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const year = new Date().getFullYear();

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : t('שגיאה'), ok: false });
    }
    setBusy(false);
  };

  const doExport = () =>
    run(async () => {
      if (pass.length < MIN_BACKUP_PASSWORD) throw new Error(t('סיסמת גיבוי של לפחות {n} תווים', { n: MIN_BACKUP_PASSWORD }));
      const { entries, people, events, settings, game, profile, followUps, goals, workplaces, shifts, savingsGoals, savingsTx } = store;
      await exportBackup({ entries, people, events, settings, game, profile, followUps, goals, workplaces, shifts, savingsGoals, savingsTx }, pass);
      setMsg({ text: t('הגיבוי נוצר ✓ שמור אותו במקום בטוח, ואל תשכח את הסיסמה'), ok: true });
    });

  const doImport = () =>
    run(async () => {
      if (!pass) throw new Error(t('כתוב את סיסמת הגיבוי'));
      const data = await importBackup(pass);
      if (!data) return;
      Alert.alert(t('לשחזר את הגיבוי?'), t('{n} רשומות. כל מה שיש עכשיו באפליקציה יוחלף.', { n: data.entries.length }), [
        { text: t('ביטול'), style: 'cancel' },
        {
          text: t('שחזר'),
          onPress: () => {
            store.restoreAll(data);
            setMsg({ text: t('השחזור הושלם ✓'), ok: true });
          },
        },
      ]);
    });

  return (
    <Card>
      <T dim size={14} style={{ lineHeight: 20 }}>
        {t('קובץ גיבוי מוצפן של כל היומן. אפשר לשמור אותו בדרייב, במייל או לשלוח לעצמך, ולשחזר בטלפון חדש. תמונות והקלטות לא נכללות.')}
      </T>
      <Input value={pass} onChangeText={setPass} placeholder={t('סיסמת גיבוי')} secureTextEntry style={{ marginTop: 10 }} />
      <Row style={{ gap: 10, marginTop: 10 }}>
        <GhostButton title={busy ? t('רגע…') : t('⬆️ צור גיבוי')} onPress={doExport} style={{ flex: 1 }} />
        <GhostButton title={t('⬇️ שחזר מגיבוי')} onPress={doImport} style={{ flex: 1 }} />
      </Row>
      {msg && (
        <T size={14} style={{ marginTop: 8, color: msg.ok ? colors.green : colors.red }}>
          {msg.text}
        </T>
      )}
      <GradientButton
        title={t('📖 ספר השנה שלי {year} (PDF)', { year })}
        colors={gradients.calm}
        style={{ marginTop: 14 }}
        onPress={() => run(() => shareYearBook(year, store.entries, store.people, store.settings.userName))}
      />
      <T dim size={12} style={{ marginTop: 6, lineHeight: 18 }}>
        {t('כל הימים, האנשים והתמונות של השנה, מוכן להדפסה או לשליחה')}
      </T>
    </Card>
  );
}

function PremiumCard() {
  const perks = ['✨ צ׳אט AI מלא עם יומי', '☁️ גיבוי אוטומטי בענן', '📖 ספר שנה מודפס בהנחה', '🎨 כל ערכות הצבע', '📊 תובנות מתקדמות'];
  return (
    <Card style={{ borderColor: colors.yellow }}>
      <T bold size={17}>
        {t('💎 היומן שלי פרימיום — בקרוב')}
      </T>
      {perks.map((p) => (
        <T key={p} dim size={14} style={{ marginTop: 4 }}>
          {t(p)}
        </T>
      ))}
      <T dim size={12} style={{ marginTop: 8 }}>
        {t('כל מה שיש עכשיו באפליקציה נשאר חינמי')}
      </T>
    </Card>
  );
}

