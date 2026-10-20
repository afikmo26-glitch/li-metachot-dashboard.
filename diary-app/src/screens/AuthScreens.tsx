import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TimePicker } from '../components/SettingsModal';
import { GhostButton, GradientButton, Input, Row, T, tap } from '../components/ui';
import { Account, AuthProvider, checkLogin, createLocalAccount, validateSignup, wipeAllData } from '../lib/account';
import { scheduleBedtime } from '../lib/notifications';
import { useStore } from '../lib/store';
import { colors, gradients } from '../lib/theme';

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
  const [step, setStep] = useState<'slides' | 'signup' | 'reminder'>('slides');
  const [slide, setSlide] = useState(0);
  const [account, setAccount] = useState<Account | null>(null);

  if (step === 'slides') {
    const s = SLIDES[slide];
    const last = slide === SLIDES.length - 1;
    return (
      <Screen>
        <Row style={{ justifyContent: 'flex-start' }}>
          <Pressable onPress={() => setStep('signup')} hitSlop={12}>
            <T dim>דלג</T>
          </Pressable>
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
            <Text style={{ fontSize: 70 }}>{s.emoji}</Text>
          </View>
          <T bold size={28} style={{ textAlign: 'center', marginTop: 28 }}>
            {s.title}
          </T>
          <T dim size={17} style={{ textAlign: 'center', marginTop: 12, lineHeight: 26, maxWidth: 360 }}>
            {s.text}
          </T>
        </View>
        <Dots count={SLIDES.length} index={slide} />
        <GradientButton
          title={last ? 'בוא נתחיל' : 'הבא'}
          colors={gradients.primary}
          onPress={() => (last ? setStep('signup') : setSlide(slide + 1))}
        />
        {slide > 0 && <GhostButton title="הקודם" onPress={() => setSlide(slide - 1)} style={{ marginTop: 10, borderWidth: 0 }} />}
      </Screen>
    );
  }

  if (step === 'signup' || !account) {
    return (
      <Signup
        onCreated={(a) => {
          setAccount(a);
          setStep('reminder');
        }}
      />
    );
  }

  return <ReminderStep onDone={() => onDone(account)} />;
}

function Signup({ onCreated }: { onCreated: (a: Account) => void }) {
  const { updateSettings } = useStore();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const social = (p: AuthProvider) => {
    tap();
    setError(null);
    setInfo(
      `התחברות עם ${p === 'google' ? 'Google' : 'Apple'} תופעל בגרסה הבאה. בינתיים צור חשבון עם שם משתמש וסיסמה, ואפשר יהיה לחבר אותו אחר כך.`,
    );
  };

  const create = async () => {
    const err = validateSignup(displayName, username, password, confirm);
    setError(err);
    setInfo(null);
    if (err) return;
    setBusy(true);
    const a = await createLocalAccount(displayName, username, password);
    updateSettings({ userName: a.displayName });
    setBusy(false);
    onCreated(a);
  };

  return (
    <Screen>
      <T bold size={28} style={{ textAlign: 'center' }}>
        יצירת חשבון
      </T>
      <T dim style={{ textAlign: 'center', marginTop: 6, marginBottom: 22 }}>
        היומן שלך מוגן בסיסמה ונשמר רק על הטלפון
      </T>

      <SocialButton label="המשך עם Google" icon="G" bg="#FFFFFF" fg="#1F1F1F" onPress={() => social('google')} />
      <SocialButton label="המשך עם Apple" icon={Platform.OS === 'ios' ? '\uF8FF' : ''} bg="#000000" fg="#FFFFFF" onPress={() => social('apple')} />

      <Row style={{ alignItems: 'center', gap: 10, marginVertical: 18 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <T dim size={13}>
          או עם שם משתמש
        </T>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </Row>

      <View style={{ gap: 10 }}>
        <Input value={displayName} onChangeText={setDisplayName} placeholder="השם שלך (איך לקרוא לך)" autoComplete="name" />
        <Input
          value={username}
          onChangeText={setUsername}
          placeholder="שם משתמש (באנגלית)"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username-new"
          style={{ textAlign: 'left', writingDirection: 'ltr' }}
        />
        <Input value={password} onChangeText={setPassword} placeholder="סיסמה (לפחות 6 תווים)" secureTextEntry autoComplete="new-password" />
        <Input value={confirm} onChangeText={setConfirm} placeholder="אימות סיסמה" secureTextEntry autoComplete="new-password" onSubmitEditing={create} />
      </View>

      {error && <Notice text={error} color={colors.red} />}
      {info && <Notice text={info} color={colors.yellow} />}

      <GradientButton title={busy ? 'יוצר…' : 'צור חשבון'} colors={gradients.primary} onPress={create} disabled={busy} style={{ marginTop: 18 }} />
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
          מתי אתה הולך לישון?
        </T>
        <T dim size={16} style={{ textAlign: 'center', marginTop: 8, lineHeight: 24 }}>
          בשעה הזו אשלח לך כל ערב "איך היה היום?". אפשר לשנות בהגדרות.
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
      <GradientButton title="אשר התראות וסיים" icon="🔔" colors={gradients.primary} onPress={finish} style={{ marginTop: 30 }} />
      <GhostButton
        title="אולי אחר כך"
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

  const login = async () => {
    if (busy) return;
    const wait = Math.ceil((lockedUntil - Date.now()) / 1000);
    if (wait > 0) {
      setError(`יותר מדי ניסיונות. נסה שוב בעוד ${wait} שניות`);
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
      setError(`${MAX_ATTEMPTS} ניסיונות שגויים. הכניסה נחסמה ל-${LOCKOUT_SECONDS} שניות`);
    } else {
      setError('שם משתמש או סיסמה שגויים');
    }
  };

  return (
    <Screen>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 64 }}>🔒</Text>
        <T bold size={26} style={{ textAlign: 'center', marginTop: 14 }}>
          שלום {account.displayName}
        </T>
        <T dim style={{ textAlign: 'center', marginTop: 4, marginBottom: 22 }}>
          הכנס סיסמה כדי לפתוח את היומן
        </T>
      </View>
      <View style={{ gap: 10 }}>
        <Input
          value={username}
          onChangeText={setUsername}
          placeholder="שם משתמש"
          autoCapitalize="none"
          autoCorrect={false}
          style={{ textAlign: 'left', writingDirection: 'ltr' }}
        />
        <Input value={password} onChangeText={setPassword} placeholder="סיסמה" secureTextEntry onSubmitEditing={login} autoFocus />
      </View>
      {error && <Notice text={error} color={colors.red} />}
      <GradientButton title={busy ? 'בודק…' : 'כניסה'} colors={gradients.primary} onPress={login} disabled={busy} style={{ marginTop: 18 }} />

      {!forgot ? (
        <GhostButton title="שכחתי סיסמה" onPress={() => setForgot(true)} style={{ marginTop: 10, borderWidth: 0 }} />
      ) : (
        <View style={{ marginTop: 18, backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.red }}>
          <T bold>אין דרך לשחזר את הסיסמה</T>
          <T dim size={14} style={{ marginTop: 6, lineHeight: 20 }}>
            היומן נשמר רק על הטלפון ואין שרת ששומר את הסיסמה. אפשר להתחיל מחדש, אבל כל היומן, האנשים והאירועים יימחקו לתמיד.
          </T>
          <Row style={{ gap: 10, marginTop: 12 }}>
            <GhostButton title="ביטול" onPress={() => setForgot(false)} style={{ flex: 1 }} />
            <GhostButton
              title="מחק הכל והתחל מחדש"
              color={colors.red}
              style={{ flex: 1, borderColor: colors.red }}
              onPress={async () => {
                await wipeAllData();
                onReset();
              }}
            />
          </Row>
        </View>
      )}
    </Screen>
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
        flexDirection: 'row-reverse',
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
