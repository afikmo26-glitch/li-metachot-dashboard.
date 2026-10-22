import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TimePicker } from '../components/SettingsModal';
import { Chip, FadeIn, GhostButton, GradientButton, Input, Row, T, tap } from '../components/ui';
import { Account, AuthProvider, checkLogin, createLocalAccount, resetPassword, validateSignup, wipeAllData } from '../lib/account';
import { maskContact, normalizeContact, sendRecoveryCode, verifyRecoveryCode } from '../lib/recovery';
import { scheduleBedtime } from '../lib/notifications';
import { usePrefs } from '../lib/prefs';
import { useStore } from '../lib/store';
import IntroScreen from './IntroScreen';
import { FloatingEmojis, LogoBurst, PopEmoji, Pulse } from '../components/Wow';
import { play } from '../lib/sound';
import { biometricAvailable, biometricLabel, biometricUnlock } from '../lib/biometric';
import { colors, gradients, layout } from '../lib/theme';
import { LANGS, t } from '../i18n';

const SLIDES = [
  {
    emoji: '📔',
    title: 'היומן שזוכר הכל',
    text: 'כל ערב מספרים איך היה היום. האפליקציה שומרת הכל עם תאריך ושעה מדויקים, ולאט לאט לומדת להכיר אותך.',
  },
  {
    emoji: '🎙️💜',
    title: 'מקליטים ומדברים עם יומי',
    text: 'לוחצים על המיקרופון ומספרים. אחר כך יומי שואל כמה שאלות: את מי פגשת, מה אמרו לך, מה היה הכי טוב. הוא כותב את היומן בשבילך.',
  },
  {
    emoji: '👥',
    title: 'זוכר את האנשים שלך',
    text: 'כל שם שתזכיר נשמר, יחד עם מה שהאדם אמר לך ומתי פגשתם. במסך "אנשים" רואים את כל ההיסטוריה.',
  },
  {
    emoji: '🗓️🔔',
    title: 'לוח שנה ותזכורות',
    text: 'ימי הולדת ואירועים עם התראה ביום עצמו. כל ערב תזכורת "איך היה היום?", ובבוקר סיכום של אתמול.',
  },
  {
    emoji: '🎮🧠',
    title: 'משחק זיכרון',
    text: 'מי אמר את זה? את מי פגשת באותו יום? כל רשומה ביומן הופכת לשאלה. צוברים XP ועולים רמות.',
  },
];

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient colors={gradients.app} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 22, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Dots({ count, index }: { count: number; index: number }) {
  return (
    <Row style={{ justifyContent: 'center', gap: 8, marginVertical: 22 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{ width: i === index ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === index ? colors.primaryHi : colors.border }}
        />
      ))}
    </Row>
  );
}

/** First run: tutorial → create account → pick reminder time. */
export function Onboarding({ onDone }: { onDone: (a: Account) => void }) {
  const [step, setStep] = useState<'welcome' | 'slides' | 'signup' | 'intro' | 'reminder'>('welcome');
  const [slide, setSlide] = useState(0);
  const [account, setAccount] = useState<Account | null>(null);

  if (step === 'welcome') {
    return (
      <Welcome
        onStart={() => {
          play('whoosh', 0.5);
          setStep('slides');
        }}
        onSkip={() => setStep('signup')}
      />
    );
  }

  if (step === 'slides') {
    const s = SLIDES[slide];
    const last = slide === SLIDES.length - 1;
    return (
      <Screen>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable onPress={() => setStep('signup')} hitSlop={12}>
            <T dim>{t('דלג')}</T>
          </Pressable>
          <LanguagePicker />
        </Row>
        <View style={{ alignItems: 'center', marginTop: 30 }}>
          <View
            style={{
              width: 170,
              height: 170,
              borderRadius: 85,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PopEmoji emoji={s.emoji} id={slide} />
          </View>
          <FadeIn key={slide}>
            <T bold size={28} style={{ textAlign: 'center', marginTop: 28 }}>
              {t(s.title)}
            </T>
            <T dim size={17} style={{ textAlign: 'center', marginTop: 12, lineHeight: 26, maxWidth: 360 }}>
              {t(s.text)}
            </T>
          </FadeIn>
        </View>
        <Dots count={SLIDES.length} index={slide} />
        <GradientButton
          title={last ? t('בוא נתחיל') : t('הבא')}
          colors={gradients.primary}
          onPress={() => (last ? setStep('signup') : setSlide(slide + 1))}
        />
        {slide > 0 && <GhostButton title={t('הקודם')} onPress={() => setSlide(slide - 1)} style={{ marginTop: 10, borderWidth: 0 }} />}
      </Screen>
    );
  }

  if (step === 'signup' || !account) {
    return (
      <Signup
        onCreated={(a) => {
          setAccount(a);
          setStep('intro');
        }}
      />
    );
  }

  if (step === 'intro') return <IntroScreen onDone={() => setStep('reminder')} />;

  return <ReminderStep onDone={() => onDone(account)} />;
}

const PROMISES = ['🎙️ מספרים במקום לכתוב — יומי כותב בשבילך', '💞 זוכר כל מי שחשוב לך ומה אמרו לך', '🎮 הופך את הזיכרונות שלך למשחק', '🔒 מוצפן ופרטי — רק אצלך בטלפון'];

/** The very first screen: the logo springs in, emojis drift up, and the app says what it is in one breath. */
function Welcome({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <LinearGradient colors={gradients.app} style={{ flex: 1 }}>
      <FloatingEmojis />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 22, justifyContent: 'center' }}>
          <Row style={{ justifyContent: 'flex-end' }}>
            <LanguagePicker />
          </Row>
          <View style={{ alignItems: 'center', marginTop: 6 }}>
            <LogoBurst />
            <FadeIn delay={350}>
              <T bold size={38} style={{ textAlign: 'center' }}>
                {t('היומן שלי')}
              </T>
            </FadeIn>
            <FadeIn delay={650}>
              <T size={19} style={{ textAlign: 'center', marginTop: 8, lineHeight: 28, color: colors.primaryHi, maxWidth: 340 }}>
                {t('החבר שמקשיב לך כל ערב, מכיר את האנשים שלך — ולא שוכח אף רגע')}
              </T>
            </FadeIn>
          </View>
          <View style={{ marginTop: 26, gap: 10 }}>
            {PROMISES.map((p, i) => (
              <FadeIn key={p} delay={1000 + i * 220}>
                <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 }}>
                  <T size={16}>{t(p)}</T>
                </View>
              </FadeIn>
            ))}
          </View>
          <FadeIn delay={1000 + PROMISES.length * 220 + 150}>
            <Pulse>
              <GradientButton title={t('בוא נתחיל ✨')} colors={gradients.primary} onPress={onStart} style={{ marginTop: 26 }} />
            </Pulse>
            <GhostButton title={t('כבר מכיר/ה — ישר להרשמה')} onPress={onSkip} style={{ marginTop: 10, borderWidth: 0 }} />
          </FadeIn>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Signup({ onCreated }: { onCreated: (a: Account) => void }) {
  const { updateSettings } = useStore();
  const { prefs, setPrefs } = usePrefs();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState('');

  const social = (p: AuthProvider) => {
    tap();
    setError(null);
    setInfo(
      t('התחברות עם {provider} תופעל בגרסה הבאה. בינתיים צור חשבון עם שם משתמש וסיסמה, ואפשר יהיה לחבר אותו אחר כך.', { provider: p === 'google' ? 'Google' : 'Apple' }),
    );
  };

  const create = async () => {
    const contact = normalizeContact(recovery);
    const err = validateSignup(displayName, username, password, confirm) ?? (contact ? null : t('כתוב אימייל או מספר טלפון תקין, כדי שאפשר יהיה לשחזר את הסיסמה'));
    setError(err);
    setInfo(null);
    if (err) return;
    setBusy(true);
    const a = await createLocalAccount(displayName, username, password, contact ?? undefined);
    updateSettings({ userName: a.displayName });
    setBusy(false);
    onCreated(a);
  };

  return (
    <Screen>
      <T bold size={28} style={{ textAlign: 'center' }}>
        {t('יצירת חשבון')}
      </T>
      <T dim style={{ textAlign: 'center', marginTop: 6, marginBottom: 22 }}>
        {t('היומן שלך מוגן בסיסמה ונשמר רק על הטלפון')}
      </T>

      <SocialButton label={t('המשך עם Google')} icon="G" bg="#FFFFFF" fg="#1F1F1F" onPress={() => social('google')} />
      <SocialButton label={t('המשך עם Apple')} icon={Platform.OS === 'ios' ? '\uF8FF' : ''} bg="#000000" fg="#FFFFFF" onPress={() => social('apple')} />

      <Row style={{ alignItems: 'center', gap: 10, marginVertical: 18 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <T dim size={13}>
          {t('או עם שם משתמש')}
        </T>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </Row>

      <View style={{ gap: 10 }}>
        <Input value={displayName} onChangeText={setDisplayName} placeholder={t('השם שלך (איך לקרוא לך)')} autoComplete="name" />
        <GenderPicker value={prefs.gender} onChange={(gender) => setPrefs({ gender }, false, false)} />
        <Input
          value={username}
          onChangeText={setUsername}
          placeholder={t('שם משתמש (באנגלית)')}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username-new"
          style={{ textAlign: 'left', writingDirection: 'ltr' }}
        />
        <Input value={password} onChangeText={setPassword} placeholder={t('סיסמה (לפחות 6 תווים)')} secureTextEntry autoComplete="new-password" />
        <Input value={confirm} onChangeText={setConfirm} placeholder={t('אימות סיסמה')} secureTextEntry autoComplete="new-password" />
        <Input
          value={recovery}
          onChangeText={setRecovery}
          placeholder={t('אימייל או מספר טלפון (לשחזור סיסמה)')}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          onSubmitEditing={create}
          style={{ textAlign: 'left', writingDirection: 'ltr' }}
        />
        <T dim size={12}>
          {t('משמש רק לשליחת קוד אם תשכח את הסיסמה')}
        </T>
      </View>

      {error && <Notice text={error} color={colors.red} />}
      {info && <Notice text={info} color={colors.yellow} />}

      <GradientButton title={busy ? t('יוצר…') : t('צור חשבון')} colors={gradients.primary} onPress={create} disabled={busy} style={{ marginTop: 18 }} />
    </Screen>
  );
}

function ReminderStep({ onDone }: { onDone: () => void }) {
  const { settings, updateSettings } = useStore();
  const [hour, setHour] = useState(settings.bedtimeHour);
  const [minute, setMinute] = useState(settings.bedtimeMinute);

  const finish = async () => {
    const next = { ...settings, bedtimeHour: hour, bedtimeMinute: minute, bedtimeEnabled: true };
    updateSettings(next);
    await scheduleBedtime(next).catch(() => {});
    onDone();
  };

  return (
    <Screen>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 70 }}>🌙</Text>
        <T bold size={26} style={{ textAlign: 'center', marginTop: 16 }}>
          {t('מתי אתה הולך לישון?')}
        </T>
        <T dim size={16} style={{ textAlign: 'center', marginTop: 8, lineHeight: 24 }}>
          {t('בשעה הזו אשלח לך כל ערב "איך היה היום?". אפשר לשנות בהגדרות.')}
        </T>
      </View>
      <TimePicker
        hour={hour}
        minute={minute}
        onChange={(h, m) => {
          setHour(h);
          setMinute(m);
        }}
      />
      <GradientButton title={t('אשר התראות וסיים')} icon="🔔" colors={gradients.primary} onPress={finish} style={{ marginTop: 30 }} />
      <GhostButton
        title={t('אולי אחר כך')}
        style={{ marginTop: 10, borderWidth: 0 }}
        onPress={() => {
          updateSettings({ bedtimeEnabled: false });
          onDone();
        }}
      />
    </Screen>
  );
}

/** Shown on app open when the account has "ask for password" on. */
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export function Login({ account, onUnlock, onReset }: { account: Account; onUnlock: (a: Account) => void; onReset: () => void }) {
  const [username, setUsername] = useState(account.username);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fails, setFails] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [canBio, setCanBio] = useState(false);
  const [bioLabel, setBioLabel] = useState('');

  const bio = async () => {
    if (await biometricUnlock()) onUnlock(account);
  };

  // Offer fingerprint / Face ID right away when the user turned it on
  useEffect(() => {
    if (!account.biometric) return;
    biometricLabel().then(setBioLabel);
    biometricAvailable().then((ok) => {
      setCanBio(ok);
      if (ok) bio();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async () => {
    if (busy) return;
    const wait = Math.ceil((lockedUntil - Date.now()) / 1000);
    if (wait > 0) {
      setError(t('יותר מדי ניסיונות. נסה שוב בעוד {n} שניות', { n: wait }));
      return;
    }
    setBusy(true);
    const ok = await checkLogin(account, username, password);
    setBusy(false);
    if (ok) {
      onUnlock(ok);
      return;
    }
    const n = fails + 1;
    setFails(n);
    setPassword('');
    if (n % MAX_ATTEMPTS === 0) {
      setLockedUntil(Date.now() + LOCKOUT_SECONDS * 1000);
      setError(t('{n} ניסיונות שגויים. הכניסה נחסמה ל-{s} שניות', { n: MAX_ATTEMPTS, s: LOCKOUT_SECONDS }));
    } else {
      setError(t('שם משתמש או סיסמה שגויים'));
    }
  };

  return (
    <Screen>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 64 }}>🔒</Text>
        <T bold size={26} style={{ textAlign: 'center', marginTop: 14 }}>
          {t('שלום {name}', { name: account.displayName })}
        </T>
        <T dim style={{ textAlign: 'center', marginTop: 4, marginBottom: 22 }}>
          {t('הכנס סיסמה כדי לפתוח את היומן')}
        </T>
      </View>
      <View style={{ gap: 10 }}>
        <Input
          value={username}
          onChangeText={setUsername}
          placeholder={t('שם משתמש')}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ textAlign: 'left', writingDirection: 'ltr' }}
        />
        <Input value={password} onChangeText={setPassword} placeholder={t('סיסמה')} secureTextEntry onSubmitEditing={login} autoFocus />
      </View>
      {error && <Notice text={error} color={colors.red} />}
      <GradientButton title={busy ? t('בודק…') : t('כניסה')} colors={gradients.primary} onPress={login} disabled={busy} style={{ marginTop: 18 }} />
      {canBio && <GhostButton title={t('🔓 פתח עם {method}', { method: bioLabel })} onPress={bio} style={{ marginTop: 10 }} />}

      {!forgot ? (
        <GhostButton title={t('שכחתי סיסמה')} onPress={() => setForgot(true)} style={{ marginTop: 10, borderWidth: 0 }} />
      ) : (
        <ForgotPassword account={account} onCancel={() => setForgot(false)} onUnlock={onUnlock} onReset={onReset} />
      )}
    </Screen>
  );
}

/** Forgot password: a code to the recovery email/phone, then a new password. Starting over (wiping) is the last resort. */
function ForgotPassword({ account, onCancel, onUnlock, onReset }: { account: Account; onCancel: () => void; onUnlock: (a: Account) => void; onReset: () => void }) {
  const [step, setStep] = useState<'send' | 'code' | 'password'>('send');
  const [code, setCode] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wipe, setWipe] = useState(!account.recovery);
  const contact = account.recovery;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('שגיאה'));
    }
    setBusy(false);
  };

  const send = () =>
    run(async () => {
      await sendRecoveryCode(contact!);
      setStep('code');
    });

  const check = () =>
    run(async () => {
      const err = await verifyRecoveryCode(contact!, code);
      if (err) setError(err);
      else setStep('password');
    });

  const save = () =>
    run(async () => {
      if (pass !== pass2) return setError(t('הסיסמאות לא תואמות'));
      const res = await resetPassword(account, pass);
      if (typeof res === 'string') setError(res);
      else onUnlock(res);
    });

  return (
    <View style={{ marginTop: 18, backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: wipe ? colors.red : colors.primary }}>
      {contact && !wipe && (
        <>
          <T bold size={17}>
            {t('🔑 שחזור סיסמה')}
          </T>
          {step === 'send' && (
            <>
              <T dim size={14} style={{ marginTop: 6, lineHeight: 20 }}>
                {t('נשלח קוד של 6 ספרות אל {contact}', { contact: maskContact(contact) })}
              </T>
              <GradientButton title={busy ? t('שולח…') : t('שלח לי קוד')} colors={gradients.primary} onPress={send} disabled={busy} style={{ marginTop: 12 }} />
            </>
          )}
          {step === 'code' && (
            <>
              <T dim size={14} style={{ marginTop: 6, lineHeight: 20 }}>
                {t('הקוד נשלח אל {contact}. הוא בתוקף ל-10 דקות.', { contact: maskContact(contact) })}
              </T>
              <Input
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                style={{ marginTop: 10, textAlign: 'center', letterSpacing: 8, fontSize: 22 }}
              />
              <GradientButton title={busy ? t('בודק…') : t('אמת קוד')} colors={gradients.primary} onPress={check} disabled={busy || code.length !== 6} style={{ marginTop: 10 }} />
              <GhostButton title={t('שלח קוד חדש')} onPress={send} style={{ marginTop: 6, borderWidth: 0 }} />
            </>
          )}
          {step === 'password' && (
            <View style={{ gap: 8, marginTop: 10 }}>
              <T dim size={14}>
                {t('✓ אומת! בחר סיסמה חדשה')}
              </T>
              <Input value={pass} onChangeText={setPass} placeholder={t('סיסמה חדשה')} secureTextEntry autoComplete="new-password" />
              <Input value={pass2} onChangeText={setPass2} placeholder={t('אימות סיסמה')} secureTextEntry autoComplete="new-password" onSubmitEditing={save} />
              <GradientButton title={t('שמור והיכנס')} colors={gradients.primary} onPress={save} disabled={busy} />
            </View>
          )}
          {error && <Notice text={error} color={colors.red} />}
          <Row style={{ gap: 10, marginTop: 10 }}>
            <GhostButton title={t('ביטול')} onPress={onCancel} style={{ flex: 1 }} />
            <GhostButton title={t('אין לי גישה')} onPress={() => setWipe(true)} style={{ flex: 1 }} />
          </Row>
        </>
      )}
      {wipe && (
        <>
          <T bold>{contact ? t('אין גישה לאימייל או לטלפון?') : t('לא הוגדר אימייל או טלפון לשחזור')}</T>
          <T dim size={14} style={{ marginTop: 6, lineHeight: 20 }}>
            {t('היומן נשמר רק על הטלפון ואין שרת ששומר את הסיסמה. אפשר להתחיל מחדש, אבל כל היומן, האנשים והאירועים יימחקו לתמיד.')}
          </T>
          <Row style={{ gap: 10, marginTop: 12 }}>
            <GhostButton title={t('ביטול')} onPress={contact ? () => setWipe(false) : onCancel} style={{ flex: 1 }} />
            <GhostButton
              title={t('מחק הכל והתחל מחדש')}
              color={colors.red}
              style={{ flex: 1, borderColor: colors.red }}
              onPress={async () => {
                await wipeAllData();
                onReset();
              }}
            />
          </Row>
        </>
      )}
    </View>
  );
}

/** "How should I talk to you?" — male, female, or the neutral slash forms. */
export function GenderPicker({ value, onChange }: { value?: 'm' | 'f'; onChange: (g: 'm' | 'f' | undefined) => void }) {
  const opts: { key: 'm' | 'f' | undefined; label: string }[] = [
    { key: 'm', label: t('🙋‍♂️ זכר') },
    { key: 'f', label: t('🙋‍♀️ נקבה') },
    { key: undefined, label: t('🙂 לא משנה') },
  ];
  return (
    <View>
      <T bold size={14} style={{ marginBottom: 6 }}>
        {t('איך לפנות אליך?')}
      </T>
      <Row style={{ flexWrap: 'wrap' }}>
        {opts.map((o) => (
          <Chip key={o.label} label={o.label} active={value === o.key} onPress={() => onChange(o.key)} />
        ))}
      </Row>
    </View>
  );
}

/** Compact language switch for the first screens, before there is a settings screen. */
function LanguagePicker() {
  const { prefs, setPrefs } = usePrefs();
  return (
    <Row style={{ gap: 6 }}>
      {LANGS.map((l) => (
        <Pressable
          key={l.code}
          onPress={() => setPrefs({ lang: l.code })}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: prefs.lang === l.code ? colors.primary : colors.border,
            backgroundColor: prefs.lang === l.code ? colors.primary : 'transparent',
          }}
        >
          <T size={12} bold style={{ color: prefs.lang === l.code ? '#fff' : colors.textDim }}>
            {l.label}
          </T>
        </Pressable>
      ))}
    </Row>
  );
}

function SocialButton({ label, icon, bg, fg, onPress }: { label: string; icon: string; bg: string; fg: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderRadius: 16,
        paddingVertical: 14,
        marginBottom: 10,
        flexDirection: layout.row,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        opacity: pressed ? 0.85 : 1,
        borderWidth: 1,
        borderColor: colors.border,
      })}
    >
      <Text style={{ color: fg, fontSize: 18, fontWeight: '800' }}>{icon}</Text>
      <Text style={{ color: fg, fontSize: 16, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function Notice({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ marginTop: 12, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: color }}>
      <T size={14} style={{ color, lineHeight: 20 }}>
        {text}
      </T>
    </View>
  );
}
