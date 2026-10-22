import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Chip, GhostButton, GradientButton, Input, Row, T, tap } from '../components/ui';
import { t } from '../i18n';
import { appleAvailable, CloudSession, googleAvailable, signInWithApple, signInWithGoogle, startCode, verifyCode } from '../lib/cloud';
import { normalizeContact } from '../lib/recovery';
import { colors, gradients } from '../lib/theme';
import { Notice, Screen, SocialButton } from './AuthScreens';
import { NeonBadge } from '../components/neon';

/** Sign-up steps around the cloud account: how old are you, sign in once, and the code screen. */

export const MIN_AGE = 13;

/** "How old are you?" — under 13 can't continue (the app is rated 13+). */
export function AgeStep({ onDone }: { onDone: (age: number) => void }) {
  const [age, setAge] = useState<number | null>(null);
  const [tooYoung, setTooYoung] = useState(false);
  const ages = Array.from({ length: 13 }, (_, i) => i + 13);

  if (tooYoung) {
    return (
      <Screen>
        <View style={{ alignItems: 'center' }}>
          <NeonBadge>🌱</NeonBadge>
          <T bold size={24} style={{ textAlign: 'center', marginTop: 12 }}>
            {t('האפליקציה מיועדת לגיל 13 ומעלה')}
          </T>
          <T dim size={16} style={{ textAlign: 'center', marginTop: 10, lineHeight: 24 }}>
            {t('נשמח לראות אותך כאן כשתגדל קצת 💜 בינתיים, יומן על נייר הוא דרך מעולה לספר על היום.')}
          </T>
        </View>
        <GhostButton title={t('טעיתי בגיל')} onPress={() => setTooYoung(false)} style={{ marginTop: 24 }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ alignItems: 'center' }}>
        <NeonBadge>🎂</NeonBadge>
        <T bold size={26} style={{ textAlign: 'center', marginTop: 10 }}>
          {t('בן/בת כמה את/ה?')}
        </T>
        <T dim style={{ textAlign: 'center', marginTop: 6 }}>
          {t('כדי שהאפליקציה תתאים לך ותשמור עליך')}
        </T>
      </View>
      <Row style={{ flexWrap: 'wrap', justifyContent: 'center', marginTop: 18 }}>
        <Chip label={t('פחות מ-13')} onPress={() => setTooYoung(true)} />
        {ages.map((a) => (
          <Chip key={a} label={a === 25 ? '25+' : String(a)} active={age === a} onPress={() => setAge(a)} />
        ))}
      </Row>
      <GradientButton title={t('המשך')} colors={gradients.primary} disabled={age === null} onPress={() => age !== null && onDone(age)} style={{ marginTop: 22 }} />
    </Screen>
  );
}

/**
 * Sign in once with Google, Apple, email or phone — the diary is then backed up (encrypted) and comes back on a new phone.
 * `onSkip` keeps the diary on this phone only.
 */
export function ConnectStep({ onDone, onSkip, title }: { onDone: (s: CloudSession) => void; onSkip?: () => void; title?: string }) {
  const [mode, setMode] = useState<'pick' | 'email' | 'phone' | 'code'>('pick');
  const [contact, setContact] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<CloudSession | null>) => {
    setBusy(true);
    setError(null);
    try {
      const s = await fn();
      if (s) onDone(s);
    } catch (e) {
      setError((e as Error).message || t('שגיאה'));
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const c = normalizeContact(contact);
    if (!c || (mode === 'email' && !c.includes('@')) || (mode === 'phone' && c.includes('@'))) {
      setError(mode === 'email' ? t('כתוב כתובת אימייל תקינה') : t('כתוב מספר טלפון תקין'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setDevCode(await startCode(c));
      setSentTo(c);
      setCode('');
      setMode('code');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ alignItems: 'center' }}>
        <NeonBadge>☁️🔒</NeonBadge>
        <T bold size={26} style={{ textAlign: 'center', marginTop: 10 }}>
          {title ?? t('מתחברים פעם אחת')}
        </T>
        <T dim size={15} style={{ textAlign: 'center', marginTop: 6, lineHeight: 22 }}>
          {t('היומן נשמר מוצפן בענן, וחוזר אליך גם בטלפון חדש. רק את/ה יכול/ה לפתוח אותו — גם לנו אין גישה.')}
        </T>
      </View>

      <View style={{ marginTop: 22 }}>
        {mode === 'pick' && (
          <>
            {googleAvailable() && <SocialButton label={t('המשך עם Google')} kind="google" onPress={() => run(signInWithGoogle)} />}
            {appleAvailable() && <SocialButton label={t('המשך עם Apple')} kind="apple" onPress={() => run(signInWithApple)} />}
            <SocialButton label={t('המשך עם אימייל')} kind="email" onPress={() => setMode('email')} />
            <SocialButton label={t('המשך עם מספר טלפון')} kind="phone" onPress={() => setMode('phone')} />
          </>
        )}
        {(mode === 'email' || mode === 'phone') && (
          <>
            <Input
              value={contact}
              onChangeText={setContact}
              placeholder={mode === 'email' ? t('האימייל שלך') : t('מספר הטלפון שלך')}
              keyboardType={mode === 'email' ? 'email-address' : 'phone-pad'}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={mode === 'email' ? 'email' : 'tel'}
              onSubmitEditing={send}
              style={{ textAlign: 'left', writingDirection: 'ltr' }}
            />
            <GradientButton title={busy ? t('שולח…') : t('שלח לי קוד')} colors={gradients.primary} onPress={send} disabled={busy} style={{ marginTop: 12 }} />
            <GhostButton title={t('חזרה')} onPress={() => setMode('pick')} style={{ marginTop: 8, borderWidth: 0 }} />
          </>
        )}
        {mode === 'code' && (
          <>
            <T style={{ textAlign: 'center', marginBottom: 10 }}>{t('שלחנו קוד בן 6 ספרות אל {to}', { to: `⁦${sentTo}⁩` })}</T>
            {devCode && (
              <T dim size={12} style={{ textAlign: 'center', marginBottom: 6 }}>
                {t('מצב בדיקה — הקוד: {code}', { code: devCode })}
              </T>
            )}
            <Input
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              onSubmitEditing={() => code.length === 6 && run(() => verifyCode(sentTo, code))}
              style={{ textAlign: 'center', fontSize: 26, letterSpacing: 8 }}
            />
            <GradientButton
              title={busy ? t('בודק…') : t('אישור')}
              colors={gradients.primary}
              disabled={busy || code.length !== 6}
              onPress={() => run(() => verifyCode(sentTo, code))}
              style={{ marginTop: 12 }}
            />
            <GhostButton title={t('שלח שוב / שנה כתובת')} onPress={() => setMode(sentTo.includes('@') ? 'email' : 'phone')} style={{ marginTop: 8, borderWidth: 0 }} />
          </>
        )}
      </View>

      {error && <Notice text={error} color={colors.red} />}

      {onSkip && mode === 'pick' && (
        <Pressable
          onPress={() => {
            tap();
            onSkip();
          }}
          style={{ marginTop: 18, alignItems: 'center' }}
          hitSlop={10}
        >
          <T dim>{t('דלג — לשמור רק בטלפון הזה')}</T>
        </Pressable>
      )}
      {Platform.OS === 'web' && mode === 'pick' && (
        <T dim size={12} style={{ textAlign: 'center', marginTop: 10 }}>
          {t('התחברות עם Google זמינה באפליקציה בטלפון')}
        </T>
      )}
    </Screen>
  );
}

/** Found a cloud copy: the diary password opens it. */
export function RestoreStep({
  updatedAt,
  onRestore,
  onFresh,
}: {
  updatedAt?: string;
  onRestore: (password: string) => Promise<string | null>;
  onFresh: () => void;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setError(await onRestore(password));
    setBusy(false);
  };
  return (
    <Screen>
      <View style={{ alignItems: 'center' }}>
        <NeonBadge>📦✨</NeonBadge>
        <T bold size={26} style={{ textAlign: 'center', marginTop: 10 }}>
          {t('מצאנו את היומן שלך!')}
        </T>
        {updatedAt && (
          <T dim style={{ textAlign: 'center', marginTop: 6 }}>
            {t('גיבוי אחרון: {date}', { date: new Date(updatedAt).toLocaleString() })}
          </T>
        )}
        <T dim size={15} style={{ textAlign: 'center', marginTop: 10, lineHeight: 22 }}>
          {t('כתוב את סיסמת היומן כדי לפתוח אותו. זו הסיסמה שבחרת כשנרשמת.')}
        </T>
      </View>
      <Input value={password} onChangeText={setPassword} placeholder={t('סיסמת היומן')} secureTextEntry onSubmitEditing={go} style={{ marginTop: 20 }} />
      {error && <Notice text={error} color={colors.red} />}
      <GradientButton title={busy ? t('פותח…') : t('שחזר את היומן')} colors={gradients.primary} disabled={busy || password.length < 1} onPress={go} style={{ marginTop: 14 }} />
      <GhostButton title={t('להתחיל יומן חדש במקום')} onPress={onFresh} style={{ marginTop: 10, borderWidth: 0 }} />
    </Screen>
  );
}
