import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Switch, Text, View } from 'react-native';
import Modal, { CloseButton } from '../components/AppModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Chip, Empty, GhostButton, GradientButton, Input, notify, Row, SectionTitle, T, tap } from '../components/ui';
import { Confetti } from '../components/Wow';
import { t } from '../i18n';
import { formatShortDate } from '../lib/dates';
import { scheduleSavingsReminder } from '../lib/notifications';
import {
  avgShiftPay,
  byMethod,
  crossedMilestone,
  goalTx,
  methodLabel,
  monthEarnings,
  pace,
  percent,
  QUICK_AMOUNTS,
  SAVE_EMOJIS,
  sumTx,
  tipOfTheDay,
  weekStreak,
} from '../lib/savings';
import { play } from '../lib/sound';
import { newId, useStore } from '../lib/store';
import { colors, gradients, layout } from '../lib/theme';
import type { SavingsGoal, SavingsTx } from '../lib/types';
import { money } from '../lib/work';

/**
 * "Let's save": goals with a target amount (and an optional date), deposits to the bank or in cash,
 * the pace needed to make it, milestones with confetti, and how many shifts it is worth.
 */
export default function SavingsScreen() {
  const { savingsGoals, savingsTx, shifts, workplaces, settings, updateSettings } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const active = savingsGoals.filter((g) => !g.done);
  const done = savingsGoals.filter((g) => g.done);
  const totalSaved = sumTx(savingsTx.filter((x) => active.some((g) => g.id === x.goalId)));
  const earned = useMemo(() => monthEarnings(shifts, workplaces), [shifts, workplaces]);
  const open = savingsGoals.find((g) => g.id === openId);

  return (
    <>
      <Card style={{ borderColor: colors.green }}>
        <T bold size={18}>
          {t('🐷 בוא נחסוך!')}
        </T>
        <T dim size={14} style={{ marginTop: 4 }}>
          {active.length ? t('חסכת עד עכשיו {sum} ל-{n} יעדים', { sum: money(totalSaved), n: active.length }) : t('בוחרים משהו שרוצים, וחוסכים בשבילו צעד אחרי צעד')}
        </T>
        {earned > 0 && (
          <T size={13} style={{ marginTop: 6, color: colors.green }}>
            {t('💼 החודש הרווחת בערך {sum}. אם תחסוך 10% — זה {ten}', { sum: money(earned), ten: money(earned * 0.1) })}
          </T>
        )}
        <T dim size={13} style={{ marginTop: 8, lineHeight: 19 }}>
          {tipOfTheDay()}
        </T>
      </Card>

      {active.length === 0 && !creating ? (
        <Empty emoji="🎯" title={t('עוד אין יעד חיסכון')} text={t('טלפון חדש? טיול? רישיון? כתוב כמה אתה רוצה לחסוך, ונתחיל')} />
      ) : (
        active.map((g) => <GoalCard key={g.id} goal={g} txs={goalTx(savingsTx, g.id)} onPress={() => setOpenId(g.id)} />)
      )}

      {creating ? (
        <Card style={{ marginTop: 12 }}>
          <GoalForm onDone={() => setCreating(false)} />
        </Card>
      ) : (
        <GradientButton title={t('➕ יעד חיסכון חדש')} colors={gradients.primary} onPress={() => setCreating(true)} style={{ marginTop: 12 }} />
      )}

      <Card style={{ marginTop: 12 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <T style={{ flex: 1 }}>{t('🔔 תזכורת לחסוך כל יום ראשון בערב')}</T>
          <Switch
            value={!!settings.savingsReminder}
            onValueChange={(savingsReminder) => {
              updateSettings({ savingsReminder });
              scheduleSavingsReminder({ ...settings, savingsReminder }).catch(() => {});
            }}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </Row>
      </Card>

      {done.length > 0 && (
        <>
          <SectionTitle>{t('🏆 יעדים שהשגת ({n})', { n: done.length })}</SectionTitle>
          {done.map((g) => (
            <Pressable key={g.id} onPress={() => setOpenId(g.id)}>
              <T dim style={{ marginBottom: 6 }}>
                ✓ {g.emoji} {g.name} · {money(g.target)}
              </T>
            </Pressable>
          ))}
        </>
      )}

      {open && <GoalModal goal={open} onClose={() => setOpenId(null)} />}
    </>
  );
}

function ProgressBar({ pct, height = 12 }: { pct: number; height?: number }) {
  return (
    <View style={{ height, backgroundColor: colors.bgDeep, borderRadius: height / 2, overflow: 'hidden', transform: [{ scaleX: layout.flip }] }}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: pct >= 100 ? colors.green : colors.primary, borderRadius: height / 2 }} />
    </View>
  );
}

function GoalCard({ goal, txs, onPress }: { goal: SavingsGoal; txs: SavingsTx[]; onPress: () => void }) {
  const p = pace(goal, txs);
  const pct = percent(p.saved, goal.target);
  return (
    <Pressable onPress={onPress} style={{ marginTop: 12 }}>
      <Card>
        <Row style={{ alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 27 }}>{goal.emoji}</Text>
          <View style={{ flex: 1 }}>
            <T bold size={17}>
              {goal.name}
            </T>
            <T dim size={13}>
              {t('{saved} מתוך {target}', { saved: money(p.saved), target: money(goal.target) })}
              {goal.deadline ? ` · ${t('עד {date}', { date: formatShortDate(`${goal.deadline}T12:00:00`) })}` : ''}
            </T>
          </View>
          <T bold size={20} style={{ color: pct >= 100 ? colors.green : colors.primaryHi }}>
            {Math.floor(pct)}%
          </T>
        </Row>
        <View style={{ marginTop: 10 }}>
          <ProgressBar pct={pct} />
        </View>
        {p.left > 0 && (
          <T dim size={12} style={{ marginTop: 6 }}>
            {p.perWeekNeeded !== null
              ? t('צריך בערך {sum} בשבוע כדי להספיק', { sum: money(Math.ceil(p.perWeekNeeded)) })
              : p.etaDate
                ? t('בקצב הזה תגיע ליעד ב-{date}', { date: formatShortDate(p.etaDate) })
                : t('עוד {sum} ליעד', { sum: money(p.left) })}
          </T>
        )}
      </Card>
    </Pressable>
  );
}

/** New or edited goal: what for, how much, an emoji and an optional date. */
function GoalForm({ goal, onDone }: { goal?: SavingsGoal; onDone: () => void }) {
  const { saveSavingsGoal } = useStore();
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(goal ? String(goal.target) : '');
  const [emoji, setEmoji] = useState(goal?.emoji ?? SAVE_EMOJIS[0]);
  const [deadline, setDeadline] = useState<string | undefined>(goal?.deadline);
  const [err, setErr] = useState('');

  const inMonths = (m: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + m);
    return d.toISOString().slice(0, 10);
  };

  const save = () => {
    const amount = parseFloat(target.replace(/[,₪\s]/g, ''));
    if (!name.trim()) return setErr(t('על מה חוסכים?'));
    if (!(amount > 0)) return setErr(t('כתוב סכום יעד, למשל 2000'));
    saveSavingsGoal({ id: goal?.id ?? newId(), name: name.trim(), emoji, target: amount, createdAt: goal?.createdAt ?? new Date().toISOString(), ...(deadline ? { deadline } : {}), ...(goal?.done ? { done: goal.done } : {}) });
    notify('success');
    onDone();
  };

  return (
    <View style={{ gap: 8 }}>
      <T bold size={16}>
        {goal ? t('✏️ עריכת היעד') : t('🎯 על מה חוסכים?')}
      </T>
      <Input value={name} onChangeText={setName} placeholder={t('למשל: טלפון חדש, טיול, רישיון נהיגה')} />
      <Input value={target} onChangeText={setTarget} placeholder={t('כמה כסף צריך? (₪)')} keyboardType="decimal-pad" />
      <Row style={{ flexWrap: 'wrap' }}>
        {SAVE_EMOJIS.map((e) => (
          <Chip key={e} label={e} active={emoji === e} onPress={() => setEmoji(e)} />
        ))}
      </Row>
      <T bold size={14}>
        {t('עד מתי? (לא חובה)')}
      </T>
      <Row style={{ flexWrap: 'wrap' }}>
        <Chip label={t('בלי תאריך')} active={!deadline} onPress={() => setDeadline(undefined)} />
        {[1, 3, 6, 12].map((m) => (
          <Chip key={m} label={m === 12 ? t('שנה') : t('{n} חודשים', { n: m })} active={deadline === inMonths(m)} onPress={() => setDeadline(inMonths(m))} />
        ))}
      </Row>
      {deadline && (
        <T dim size={13}>
          {t('יעד: {date}', { date: formatShortDate(`${deadline}T12:00:00`) })}
        </T>
      )}
      {err ? <T style={{ color: colors.red }}>{err}</T> : null}
      <Row style={{ gap: 10 }}>
        <GradientButton title={goal ? t('שמור') : t('🚀 יאללה, מתחילים')} colors={gradients.primary} onPress={save} style={{ flex: 1 }} />
        <GhostButton title={t('ביטול')} onPress={onDone} />
      </Row>
    </View>
  );
}

function GoalModal({ goal, onClose }: { goal: SavingsGoal; onClose: () => void }) {
  const { savingsTx, saveSavingsTx, deleteSavingsTx, saveSavingsGoal, deleteSavingsGoal, shifts, workplaces } = useStore();
  const txs = goalTx(savingsTx, goal.id);
  const p = pace(goal, txs);
  const pct = percent(p.saved, goal.target);
  const methods = byMethod(txs);
  const streak = weekStreak(txs);
  const shiftPay = avgShiftPay(shifts, workplaces);
  const [method, setMethod] = useState<SavingsTx['method']>('bank');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [withdraw, setWithdraw] = useState(false);
  const [editing, setEditing] = useState(false);
  const [party, setParty] = useState(0);

  const add = (value: number) => {
    if (!(value > 0)) return;
    const signed = withdraw ? -value : value;
    const before = p.saved;
    saveSavingsTx({ id: newId(), goalId: goal.id, amount: signed, at: new Date().toISOString(), method, ...(note.trim() ? { note: note.trim() } : {}) });
    setAmount('');
    setNote('');
    const hit = signed > 0 ? crossedMilestone(before, before + signed, goal.target) : null;
    if (hit) {
      setParty((n) => n + 1);
      play('levelup', 0.6);
      if (hit === 100) {
        saveSavingsGoal({ ...goal, done: true });
        Alert.alert(t('🏆 הגעת ליעד!'), t('חסכת {sum} בשביל {name}. כל הכבוד!', { sum: money(goal.target), name: goal.name }));
      } else Alert.alert(t('🎉 {n}% מהדרך!', { n: hit }), t('כבר חסכת {sum}. תמשיך ככה!', { sum: money(before + signed) }));
    } else notify('success');
  };

  const shareProgress = () =>
    Share.share({ message: t('🐷 אני חוסך/ת ל{name} {emoji} — כבר {pct}% ({saved} מתוך {target})!', { name: goal.name, emoji: goal.emoji, pct: Math.floor(pct), saved: money(p.saved), target: money(goal.target) }) }).catch(() => {});

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <CloseButton onPress={onClose} />
            <Pressable onPress={() => setEditing(!editing)} hitSlop={12}>
              <T bold style={{ color: colors.primaryHi }}>
                {t('✏️ עריכה')}
              </T>
            </Pressable>
          </Row>

          {editing ? (
            <Card style={{ marginTop: 12 }}>
              <GoalForm goal={goal} onDone={() => setEditing(false)} />
            </Card>
          ) : (
            <View style={{ alignItems: 'center', marginTop: 8 }}>
              <Text style={{ fontSize: 48 }}>{goal.emoji}</Text>
              <T bold size={24} style={{ textAlign: 'center' }}>
                {goal.name}
              </T>
              <T bold size={40} style={{ color: pct >= 100 ? colors.green : colors.primaryHi, marginTop: 6 }}>
                {money(p.saved)}
              </T>
              <T dim>{t('מתוך {target} · {pct}%', { target: money(goal.target), pct: Math.floor(pct) })}</T>
            </View>
          )}
          <View style={{ marginTop: 14 }}>
            <ProgressBar pct={pct} height={16} />
          </View>

          {/* Stats */}
          <Row style={{ gap: 10, marginTop: 14 }}>
            <Stat value={money(p.left)} label={t('נשאר')} />
            <Stat value={money(methods.bank)} label={t('🏦 בבנק')} />
            <Stat value={money(methods.cash)} label={t('💵 במזומן')} />
          </Row>
          <Card style={{ marginTop: 10, gap: 4 }}>
            {p.left === 0 ? (
              <T bold style={{ color: colors.green }}>
                {t('🏆 הגעת ליעד! מגיע לך')}
              </T>
            ) : (
              <>
                {p.daysToDeadline !== null && (
                  <T size={14}>
                    {t('📅 נשארו {n} ימים: צריך {week} בשבוע ({day} ביום)', { n: p.daysToDeadline, week: money(Math.ceil(p.perWeekNeeded ?? 0)), day: money(Math.ceil(p.perDayNeeded ?? 0)) })}
                  </T>
                )}
                {p.etaDate ? (
                  <T size={14}>
                    {t('📈 בקצב הנוכחי תגיע ליעד ב-{date}', { date: formatShortDate(p.etaDate) })}
                    {p.onTrack === false ? ` — ${t('קצת אחרי התאריך, אפשר להגביר')}` : p.onTrack ? ' ✓' : ''}
                  </T>
                ) : (
                  <T dim size={14}>
                    {t('📈 אחרי שבוע של חיסכון אראה מתי תגיע ליעד בקצב שלך')}
                  </T>
                )}
                {shiftPay && (
                  <T size={14}>
                    {t('💼 זה בערך עוד {n} משמרות עבודה', { n: Math.ceil(p.left / shiftPay) })}
                  </T>
                )}
              </>
            )}
            {streak > 1 && (
              <T size={14} style={{ color: colors.orange }}>
                {t('🔥 {n} שבועות ברצף שחסכת!', { n: streak })}
              </T>
            )}
          </Card>

          {/* Add money */}
          <SectionTitle>{withdraw ? t('➖ להוציא מהחיסכון') : t('➕ להוסיף לחיסכון')}</SectionTitle>
          <Row style={{ flexWrap: 'wrap' }}>
            {(['bank', 'cash', 'other'] as const).map((m) => (
              <Chip key={m} label={methodLabel(m)} active={method === m} onPress={() => setMethod(m)} />
            ))}
          </Row>
          <Row style={{ flexWrap: 'wrap' }}>
            {QUICK_AMOUNTS.map((a) => (
              <Chip key={a} label={`${withdraw ? '−' : '+'}₪${a}`} color={withdraw ? colors.red : colors.green} onPress={() => add(a)} />
            ))}
          </Row>
          <Row style={{ gap: 8, alignItems: 'center' }}>
            <Input value={amount} onChangeText={setAmount} placeholder={t('סכום אחר')} keyboardType="decimal-pad" style={{ flex: 1, minWidth: 0 }} />
            <GradientButton small title={withdraw ? t('הוצא') : t('הוסף')} colors={withdraw ? [colors.red, colors.orange] : [colors.green, colors.blue]} onPress={() => add(parseFloat(amount.replace(/[,₪\s]/g, '')))} />
          </Row>
          <Input value={note} onChangeText={setNote} placeholder={t('הערה (לא חובה), למשל "משכורת מהמרפאה"')} style={{ marginTop: 8 }} />
          <Pressable onPress={() => setWithdraw(!withdraw)} style={{ marginTop: 8 }}>
            <T size={13} style={{ color: colors.textDim }}>
              {withdraw ? t('↩️ חזרה להוספה') : t('צריך להוציא כסף מהחיסכון?')}
            </T>
          </Pressable>

          {/* History */}
          <SectionTitle>{t('🧾 היסטוריה')}</SectionTitle>
          {txs.length === 0 ? (
            <T dim>{t('עוד לא הוספת כסף. כל שקל נחשב!')}</T>
          ) : (
            txs.map((x) => (
              <Pressable
                key={x.id}
                onLongPress={() =>
                  Alert.alert(t('למחוק את הרשומה?'), `${money(x.amount)} · ${formatShortDate(x.at)}`, [
                    { text: t('ביטול'), style: 'cancel' },
                    { text: t('מחק'), style: 'destructive', onPress: () => deleteSavingsTx(x.id) },
                  ])
                }
              >
                <Row style={{ justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ flex: 1 }}>
                    <T size={14}>
                      {formatShortDate(x.at)} · {methodLabel(x.method)}
                    </T>
                    {x.note ? (
                      <T dim size={12}>
                        {x.note}
                      </T>
                    ) : null}
                  </View>
                  <T bold style={{ color: x.amount >= 0 ? colors.green : colors.red }}>
                    {x.amount >= 0 ? '+' : '−'}
                    {money(Math.abs(x.amount))}
                  </T>
                </Row>
              </Pressable>
            ))
          )}
          {txs.length > 0 && (
            <T dim size={11} style={{ marginTop: 4 }}>
              {t('לחיצה ארוכה על רשומה כדי למחוק')}
            </T>
          )}

          <GhostButton title={t('📤 שתף את ההתקדמות')} onPress={shareProgress} style={{ marginTop: 20 }} />
          {goal.done && <GhostButton title={t('↩️ החזר ליעדים פעילים')} onPress={() => saveSavingsGoal({ ...goal, done: false })} style={{ marginTop: 10 }} />}
          <GhostButton
            title={t('🗑️ מחק את היעד')}
            color={colors.red}
            style={{ marginTop: 10, borderColor: colors.red }}
            onPress={() =>
              Alert.alert(t('למחוק את {name}?', { name: goal.name }), t('כל ההיסטוריה של היעד תימחק'), [
                { text: t('ביטול'), style: 'cancel' },
                {
                  text: t('מחק'),
                  style: 'destructive',
                  onPress: () => {
                    txs.forEach((x) => deleteSavingsTx(x.id));
                    deleteSavingsGoal(goal.id);
                    onClose();
                  },
                },
              ])
            }
          />
        </ScrollView>
        {party > 0 && <Confetti fire={party} />}
      </SafeAreaView>
    </Modal>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6 }}>
      <T bold size={17} style={{ textAlign: 'center' }} numberOfLines={1}>
        {value}
      </T>
      <T dim size={12} style={{ textAlign: 'center' }}>
        {label}
      </T>
    </Card>
  );
}
