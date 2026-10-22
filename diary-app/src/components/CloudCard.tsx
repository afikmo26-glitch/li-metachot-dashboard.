import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import Modal from './AppModal';
import { t } from '../i18n';
import { Account, checkLogin } from '../lib/account';
import {
  backupNow,
  cloudConfigured,
  cloudMeta,
  CloudError,
  CloudSession,
  deleteCloudAccount,
  loadSession,
  mergeBackups,
  restoreFromCloud,
  setCloudPassword,
  signOut,
} from '../lib/cloud';
import { useStore } from '../lib/store';
import { colors, gradients } from '../lib/theme';
import { useBackupData } from '../lib/useCloudSync';
import { ConnectStep } from '../screens/CloudScreens';
import { Card, GhostButton, GradientButton, Input, notify, Row, T } from './ui';

const PROVIDER: Record<CloudSession['provider'], string> = { google: 'Google', apple: 'Apple', email: '✉️', phone: '📱' };

/** Settings → cloud: connect once, see the last backup, back up now, sign out, or delete the account. */
export default function CloudCard({ account }: { account: Account }) {
  const { restoreAll } = useStore();
  const data = useBackupData();
  const [configured, setConfigured] = useState(false);
  const [session, setSession] = useState<CloudSession | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [needPassword, setNeedPassword] = useState(false);
  const [oldNeeded, setOldNeeded] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const refresh = () => loadSession().then(setSession);
  useEffect(() => {
    cloudConfigured().then(setConfigured);
    refresh();
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    } finally {
      setBusy(false);
      refresh();
    }
  };

  /** After signing in: the diary password becomes the cloud key; a copy already in the cloud is merged with this phone. */
  const lockWithPassword = () =>
    run(async () => {
      if (oldNeeded) {
        // The cloud copy was made with an older password: open it, merge, then re-lock everything with today's password
        const remote = await restoreFromCloud(password);
        const merged = mergeBackups(data, remote);
        restoreAll(merged);
        setOldNeeded(false);
        setPassword('');
        setMsg({ text: t('עכשיו כתוב את הסיסמה הנוכחית של היומן'), ok: true });
        return;
      }
      if (!(await checkLogin(account, account.username, password))) throw new Error(t('הסיסמה שגויה'));
      const meta = await cloudMeta();
      let toUpload = data;
      if (meta?.exists) {
        try {
          const remote = await restoreFromCloud(password);
          toUpload = mergeBackups(data, remote);
          restoreAll(toUpload);
        } catch (e) {
          if (e instanceof CloudError && !e.status) {
            setOldNeeded(true);
            setPassword('');
            throw new Error(t('הגיבוי בענן ננעל בסיסמה אחרת. כתוב את הסיסמה שהייתה ליומן כשגיבית'));
          }
          throw e;
        }
      }
      await setCloudPassword(password, !meta?.exists);
      await backupNow(toUpload);
      setNeedPassword(false);
      setPassword('');
      notify('success');
      setMsg({ text: t('מחובר ומגובה ✓ מעכשיו כל שינוי נשמר בענן אוטומטית'), ok: true });
    });

  if (!configured) {
    return (
      <Card>
        <T size={14}>{t('☁️ גיבוי בענן יופעל כשהשרת של האפליקציה יחובר')}</T>
      </Card>
    );
  }

  return (
    <Card style={{ gap: 8 }}>
      {session ? (
        <>
          <T bold>
            {t('☁️ מחובר כ-{who}', { who: `${PROVIDER[session.provider]} ⁦${session.label}⁩` })}
          </T>
          <T dim size={13}>
            {session.lastSync ? t('גיבוי אחרון: {date}', { date: new Date(session.lastSync).toLocaleString() }) : t('עוד לא גובה')}
          </T>
          {!session.key || needPassword ? (
            <>
              <T size={14}>{oldNeeded ? t('סיסמת היומן מהגיבוי הקודם:') : t('כתוב את סיסמת היומן — היא נועלת את הגיבוי, כך שרק את/ה יכול/ה לפתוח אותו')}</T>
              <Input value={password} onChangeText={setPassword} secureTextEntry placeholder={t('סיסמת היומן')} onSubmitEditing={lockWithPassword} />
              <GradientButton title={busy ? t('רגע…') : t('🔒 הפעל גיבוי מוצפן')} colors={gradients.primary} onPress={lockWithPassword} disabled={busy || !password} small />
            </>
          ) : (
            <Row style={{ gap: 8, flexWrap: 'wrap' }}>
              <GhostButton title={busy ? t('מגבה…') : t('⬆️ גבה עכשיו')} onPress={() => run(async () => void (await backupNow(data)))} style={{ flex: 1 }} />
              <GhostButton title={t('התנתק')} onPress={() => run(signOut)} style={{ flex: 1 }} />
            </Row>
          )}
          <GhostButton
            title={t('🗑️ מחק את החשבון והגיבוי מהענן')}
            color={colors.red}
            onPress={() =>
              Alert.alert(t('למחוק את החשבון?'), t('הגיבוי בענן והחשבון יימחקו לצמיתות. היומן בטלפון הזה נשאר.'), [
                { text: t('ביטול'), style: 'cancel' },
                {
                  text: t('מחק'),
                  style: 'destructive',
                  onPress: () =>
                    run(async () => {
                      await deleteCloudAccount();
                      setMsg({ text: t('החשבון והגיבוי נמחקו'), ok: true });
                    }),
                },
              ])
            }
          />
        </>
      ) : (
        <>
          <T size={14} style={{ lineHeight: 20 }}>
            {t('התחבר פעם אחת עם Google, אימייל או טלפון — והיומן יישמר מוצפן בענן ויחזור אליך גם בטלפון חדש.')}
          </T>
          <GradientButton title={t('☁️ התחבר וגבה')} colors={gradients.primary} onPress={() => setConnecting(true)} small />
        </>
      )}
      {msg && (
        <T size={13} style={{ color: msg.ok ? colors.green : colors.red }}>
          {msg.text}
        </T>
      )}
      <Modal visible={connecting} animationType="slide" onRequestClose={() => setConnecting(false)}>
        <View style={{ flex: 1 }}>
          <ConnectStep
            title={t('חיבור לענן')}
            onSkip={() => setConnecting(false)}
            onDone={(s) => {
              setSession(s);
              setConnecting(false);
              setNeedPassword(true);
            }}
          />
        </View>
      </Modal>
    </Card>
  );
}
