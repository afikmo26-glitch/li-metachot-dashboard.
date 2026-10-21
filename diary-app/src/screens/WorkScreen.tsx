import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TimePicker } from '../components/SettingsModal';
import { Card, Chip, Empty, GhostButton, GradientButton, Input, notify, Row, ScreenTitle, SectionTitle, T, tap } from '../components/ui';
import { isRTL, t } from '../i18n';
import { formatShortDate, formatTime, monthName } from '../lib/dates';
import { cancelShiftReminder, scheduleShiftReminder } from '../lib/notifications';
import { newId, useStore } from '../lib/store';
import { colors, gradients, layout } from '../lib/theme';
import type { Shift, Workplace } from '../lib/types';
import { fmtClock, fmtHM, makeTimes, money, monthReportText, monthTotals, shiftMinutes, shiftsInMonth, timeRange, WORK_EMOJIS } from '../lib/work';

/**
 * Shift clock: clock in and out with one button (or add a shift by hand), for one or more workplaces.
 * Hours add up per month, with an estimated pay and a report to send the employer.
 */
export default function WorkScreen() {
  const { workplaces, shifts, activeShift, setActiveShift, saveShift, settings } = useStore();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Shift | 'new' | null>(null);
  const [placesOpen, setPlacesOpen] = useState(false);
  const [tick, setTick] = useState(Date.now());

  const place = workplaces.find((w) => w.id === (placeId ?? workplaces[0]?.id));
  const running = activeShift ? workplaces.find((w) => w.id === activeShift.workplaceId) : undefined;

  useEffect(() => {
    if (!activeShift) return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeShift]);

  const monthShifts = useMemo(() => shiftsInMonth(shifts, ym.y, ym.m), [shifts, ym]);
  const totals = useMemo(() => monthTotals(monthShifts, workplaces), [monthShifts, workplaces]);

  const clockIn = async () => {
    if (!place) return;
    tap('heavy');
    const start = new Date().toISOString();
    setActiveShift({ workplaceId: place.id, start });
    const notificationId = await scheduleShiftReminder(place.name).catch(() => undefined);
    if (notificationId) setActiveShift({ workplaceId: place.id, start, notificationId });
  };

  const clockOut = () => {
    if (!activeShift) return;
    const end = new Date();
    const mins = (end.getTime() - new Date(activeShift.start).getTime()) / 60000;
    const finish = () => {
      cancelShiftReminder(activeShift.notificationId);
      if (mins >= 1) saveShift({ id: newId(), workplaceId: activeShift.workplaceId, start: activeShift.start, end: end.toISOString() });
      setActiveShift(null);
      notify('success');
      if (mins >= 1) Alert.alert(t('המשמרת נשמרה ✓'), t('עבדת {h} שעות', { h: fmtHM(mins) }));
    };
    if (mins < 1) {
      Alert.alert(t('המשמרת קצרה מדקה'), t('לבטל אותה בלי לשמור?'), [
        { text: t('המשך משמרת'), style: 'cancel' },
        { text: t('בטל'), style: 'destructive', onPress: finish },
      ]);
    } else finish();
  };

  const shiftMonth = (d: number) => {
    tap();
    const m = ym.m + d;
    setYm({ y: ym.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 });
  };

  const shareText = () => Share.share({ message: monthReportText(settings.userName, ym.y, ym.m, monthShifts, workplaces) }).catch(() => {});

  const sharePdf = async () => {
    const text = monthReportText(settings.userName, ym.y, ym.m, monthShifts, workplaces);
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
    const html = `<html dir="${isRTL() ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>body{font-family:-apple-system,Arial,sans-serif;font-size:15px;line-height:1.7;color:#1e1b4b;padding:24px}
      .t{font-size:22px;font-weight:700;color:#6d28d9}</style></head><body>${text
        .split('\n')
        .map((l, i) => (i === 0 ? `<div class="t">${esc(l)}</div>` : `<div>${esc(l) || '&nbsp;'}</div>`))
        .join('')}</body></html>`;
    try {
      if (Platform.OS === 'web') return void (await Print.printAsync({ html }));
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    } catch {
      Alert.alert(t('שגיאה'), t('לא הצלחתי ליצור את הקובץ'));
    }
  };

  if (!workplaces.length) {
    return (
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <ScreenTitle title={t('⏱️ השעות שלי')} subtitle={t('שעון משמרות: כניסה ויציאה בלחיצה, וסיכום שעות ושכר לכל חודש')} />
        <Card style={{ marginTop: 10 }}>
          <T bold size={17}>
            {t('איפה את/ה עובד/ת?')}
          </T>
          <T dim size={14} style={{ marginTop: 4, marginBottom: 10 }}>
            {t('אפשר להוסיף כמה מקומות עבודה, ולכל אחד שכר לשעה')}
          </T>
          <PlaceForm onSaved={() => notify('success')} />
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      <ScreenTitle
        title={t('⏱️ השעות שלי')}
        subtitle={settings.userName ? t('{name} · {n} מקומות עבודה', { name: settings.userName, n: workplaces.length }) : undefined}
        right={
          <Pressable onPress={() => setPlacesOpen(true)} hitSlop={10}>
            <T bold style={{ color: colors.primaryHi }}>
              {t('🏢 מקומות')}
            </T>
          </Pressable>
        }
      />

      {/* The clock */}
      <Card style={{ alignItems: 'center', paddingVertical: 22, borderColor: activeShift ? colors.green : colors.border, borderWidth: activeShift ? 2 : 1 }}>
        {activeShift ? (
          <>
            <T bold size={16} style={{ color: colors.green }}>
              {t('🟢 במשמרת ב{place}', { place: running?.name ?? t('מקום עבודה') })}
            </T>
            <Text style={{ color: colors.text, fontSize: 52, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 6 }}>
              {fmtClock(tick - new Date(activeShift.start).getTime())}
            </Text>
            <T dim size={14}>
              {t('התחלת ב-{time}', { time: formatTime(activeShift.start) })}
            </T>
            <Pressable
              onPress={clockOut}
              style={({ pressed }) => ({ marginTop: 18, width: 170, height: 170, borderRadius: 85, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}
            >
              <Text style={{ fontSize: 40 }}>⏹️</Text>
              <T bold size={18} style={{ color: '#fff', textAlign: 'center' }}>
                {t('סיום משמרת')}
              </T>
            </Pressable>
          </>
        ) : (
          <>
            {workplaces.length > 1 && (
              <Row style={{ flexWrap: 'wrap', justifyContent: 'center', marginBottom: 6 }}>
                {workplaces.map((w) => (
                  <Chip key={w.id} label={`${w.emoji} ${w.name}`} active={place?.id === w.id} onPress={() => setPlaceId(w.id)} />
                ))}
              </Row>
            )}
            <Pressable
              onPress={clockIn}
              style={({ pressed }) => ({ width: 190, height: 190, borderRadius: 95, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}
            >
              <Text style={{ fontSize: 44 }}>▶️</Text>
              <T bold size={19} style={{ color: '#fff', textAlign: 'center' }}>
                {t('כניסה למשמרת')}
              </T>
              <T size={13} style={{ color: '#fff', textAlign: 'center', opacity: 0.9 }}>
                {place ? `${place.emoji} ${place.name}` : ''}
              </T>
            </Pressable>
          </>
        )}
        <GhostButton title={t('✍️ הוספת משמרת ידנית')} onPress={() => setEditing('new')} style={{ marginTop: 16, alignSelf: 'stretch' }} />
      </Card>

      {/* Month summary */}
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
        <Pressable onPress={() => shiftMonth(-1)} hitSlop={12}>
          <T bold size={22}>{layout.isRTL ? '›' : '‹'}</T>
        </Pressable>
        <T bold size={18}>
          {monthName(ym.m)} {ym.y}
        </T>
        <Pressable onPress={() => shiftMonth(1)} hitSlop={12}>
          <T bold size={22}>{layout.isRTL ? '‹' : '›'}</T>
        </Pressable>
      </Row>
      <Row style={{ gap: 10, marginTop: 10 }}>
        <Stat value={fmtHM(totals.minutes)} label={t('שעות')} />
        <Stat value={String(monthShifts.length)} label={t('משמרות')} />
        {totals.hasPay && <Stat value={money(totals.pay)} label={t('שכר משוער')} />}
      </Row>
      {totals.byPlace.length > 1 &&
        totals.byPlace.map((p) => (
          <Card key={p.workplaceId} style={{ marginTop: 8, padding: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T bold>
                {p.place?.emoji ?? '💼'} {p.place?.name ?? t('מקום שנמחק')}
              </T>
              <T dim>
                {t('{h} שעות · {n} משמרות', { h: fmtHM(p.minutes), n: p.shifts })}
                {p.pay !== undefined ? ` · ${money(p.pay)}` : ''}
              </T>
            </Row>
          </Card>
        ))}

      {monthShifts.length > 0 && (
        <Row style={{ gap: 10, marginTop: 12 }}>
          <GhostButton title={t('📤 שלח דוח')} onPress={shareText} style={{ flex: 1 }} />
          <GhostButton title={t('📄 דוח PDF')} onPress={sharePdf} style={{ flex: 1 }} />
        </Row>
      )}

      <SectionTitle>{t('🗓️ המשמרות של החודש')}</SectionTitle>
      {monthShifts.length === 0 ? (
        <Empty emoji="🕐" title={t('אין משמרות בחודש הזה')} text={t('לחץ "כניסה למשמרת" כשאתה מתחיל לעבוד, או הוסף משמרת ידנית')} />
      ) : (
        monthShifts.map((s) => {
          const w = workplaces.find((x) => x.id === s.workplaceId);
          return (
            <Pressable key={s.id} onPress={() => setEditing(s)} style={{ marginBottom: 8 }}>
              <Card style={{ padding: 12 }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <T bold>
                      {formatShortDate(s.start)} · {w?.emoji ?? '💼'} {w?.name ?? t('מקום שנמחק')}
                    </T>
                    <T dim size={13}>
                      {timeRange(s.start, s.end)}
                      {s.breakMin ? ` · ${t('הפסקה {n} דק׳', { n: s.breakMin })}` : ''}
                      {s.note ? ` · ${s.note}` : ''}
                    </T>
                  </View>
                  <T bold size={18} style={{ color: colors.primaryHi }}>
                    {fmtHM(shiftMinutes(s))}
                  </T>
                </Row>
              </Card>
            </Pressable>
          );
        })
      )}

      {editing && <ShiftModal shift={editing === 'new' ? null : editing} defaultPlace={place?.id} onClose={() => setEditing(null)} />}
      <PlacesModal visible={placesOpen} onClose={() => setPlacesOpen(false)} />
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: 12 }}>
      <T bold size={22} style={{ textAlign: 'center' }}>
        {value}
      </T>
      <T dim size={12} style={{ textAlign: 'center' }}>
        {label}
      </T>
    </Card>
  );
}

const BREAKS = [0, 15, 30, 45, 60];

/** Add or edit a shift by hand: workplace, day, start and end times, break and a note. */
function ShiftModal({ shift, defaultPlace, onClose }: { shift: Shift | null; defaultPlace?: string; onClose: () => void }) {
  const { workplaces, saveShift, deleteShift } = useStore();
  const s0 = shift ? new Date(shift.start) : new Date(new Date().setHours(16, 0, 0, 0));
  const e0 = shift ? new Date(shift.end) : new Date(new Date().setHours(17, 0, 0, 0));
  const [placeId, setPlaceId] = useState(shift?.workplaceId ?? defaultPlace ?? workplaces[0]?.id);
  const [day, setDay] = useState(new Date(s0.getFullYear(), s0.getMonth(), s0.getDate()));
  const [dayText, setDayText] = useState('');
  const [start, setStart] = useState({ h: s0.getHours(), m: s0.getMinutes() });
  const [end, setEnd] = useState({ h: e0.getHours(), m: e0.getMinutes() });
  const [breakMin, setBreakMin] = useState(shift?.breakMin ?? 0);
  const [note, setNote] = useState(shift?.note ?? '');

  const times = makeTimes(day, start.h, start.m, end.h, end.m);
  const mins = shiftMinutes({ ...times, breakMin });
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const dayChips = [0, 1, 2].map((ago) => new Date(today.getTime() - ago * 86400000));
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  const typedDay = (v: string) => {
    setDayText(v);
    const m = v.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/);
    if (!m) return;
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : today.getFullYear();
    const d = new Date(y, +m[2] - 1, +m[1]);
    if (!isNaN(d.getTime()) && d.getDate() === +m[1]) setDay(d);
  };

  const save = () => {
    if (!placeId) return;
    saveShift({ id: shift?.id ?? newId(), workplaceId: placeId, ...times, ...(breakMin ? { breakMin } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
    notify('success');
    onClose();
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <T bold size={22}>
              {shift ? t('✏️ עריכת משמרת') : t('✍️ משמרת חדשה')}
            </T>
            <Pressable onPress={onClose} hitSlop={12}>
              <T bold style={{ color: colors.primaryHi }}>
                {t('סגור ✕')}
              </T>
            </Pressable>
          </Row>

          <SectionTitle>{t('איפה?')}</SectionTitle>
          <Row style={{ flexWrap: 'wrap' }}>
            {workplaces.map((w) => (
              <Chip key={w.id} label={`${w.emoji} ${w.name}`} active={placeId === w.id} onPress={() => setPlaceId(w.id)} />
            ))}
          </Row>

          <SectionTitle>{t('באיזה יום?')}</SectionTitle>
          <Row style={{ flexWrap: 'wrap' }}>
            {dayChips.map((d, i) => (
              <Chip key={i} label={[t('היום'), t('אתמול'), t('שלשום')][i]} active={sameDay(d, day)} onPress={() => setDay(d)} />
            ))}
          </Row>
          <Input value={dayText} onChangeText={typedDay} placeholder={t('או תאריך: יום/חודש (למשל 14/3)')} keyboardType="numbers-and-punctuation" />
          <T dim size={13} style={{ marginTop: 4 }}>
            {formatShortDate(day)}
          </T>

          <SectionTitle>{t('משעה')}</SectionTitle>
          <TimePicker hour={start.h} minute={start.m} minuteStep={5} onChange={(h, m) => setStart({ h, m })} />
          <SectionTitle>{t('עד שעה')}</SectionTitle>
          <TimePicker hour={end.h} minute={end.m} minuteStep={5} onChange={(h, m) => setEnd({ h, m })} />
          {new Date(times.end).getDate() !== new Date(times.start).getDate() && (
            <T dim size={13} style={{ textAlign: 'center', marginTop: 6 }}>
              {t('🌙 המשמרת נגמרה אחרי חצות')}
            </T>
          )}

          <SectionTitle>{t('הפסקה')}</SectionTitle>
          <Row style={{ flexWrap: 'wrap' }}>
            {BREAKS.map((b) => (
              <Chip key={b} label={b ? t('{n} דק׳', { n: b }) : t('בלי')} active={breakMin === b} onPress={() => setBreakMin(b)} />
            ))}
          </Row>
          <Input value={note} onChangeText={setNote} placeholder={t('הערה (לא חובה), למשל "החלפתי את דני"')} style={{ marginTop: 8 }} />

          <Card style={{ marginTop: 16, alignItems: 'center' }}>
            <T dim>{t('סה״כ')}</T>
            <T bold size={30}>
              {fmtHM(mins)}
            </T>
          </Card>
          <GradientButton title={t('שמור משמרת')} icon="💾" colors={gradients.primary} onPress={save} style={{ marginTop: 16 }} />
          {shift && (
            <GhostButton
              title={t('🗑️ מחק משמרת')}
              color={colors.red}
              style={{ marginTop: 10, borderColor: colors.red }}
              onPress={() =>
                Alert.alert(t('למחוק את המשמרת?'), '', [
                  { text: t('ביטול'), style: 'cancel' },
                  {
                    text: t('מחק'),
                    style: 'destructive',
                    onPress: () => {
                      deleteShift(shift.id);
                      onClose();
                    },
                  },
                ])
              }
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/** New or edited workplace: name, an emoji, role and hourly wage. */
function PlaceForm({ place, onSaved }: { place?: Workplace; onSaved: () => void }) {
  const { saveWorkplace } = useStore();
  const [name, setName] = useState(place?.name ?? '');
  const [emoji, setEmoji] = useState(place?.emoji ?? WORK_EMOJIS[0]);
  const [role, setRole] = useState(place?.role ?? '');
  const [wage, setWage] = useState(place?.wage ? String(place.wage) : '');

  const save = () => {
    if (!name.trim()) return;
    const w = parseFloat(wage.replace(',', '.'));
    saveWorkplace({ id: place?.id ?? newId(), name: name.trim(), emoji, ...(role.trim() ? { role: role.trim() } : {}), ...(w > 0 ? { wage: w } : {}) });
    if (!place) {
      setName('');
      setRole('');
      setWage('');
    }
    onSaved();
  };

  return (
    <View style={{ gap: 8 }}>
      <Input value={name} onChangeText={setName} placeholder={t('שם מקום העבודה (למשל מרפאת שיניים, מקדונלדס)')} />
      <Input value={role} onChangeText={setRole} placeholder={t('תפקיד (לא חובה), למשל אחראי משמרת')} />
      <Input value={wage} onChangeText={setWage} placeholder={t('שכר לשעה ב-₪ (לא חובה)')} keyboardType="decimal-pad" />
      <Row style={{ flexWrap: 'wrap' }}>
        {WORK_EMOJIS.map((e) => (
          <Chip key={e} label={e} active={emoji === e} onPress={() => setEmoji(e)} />
        ))}
      </Row>
      <GradientButton title={place ? t('שמור') : t('➕ הוסף מקום עבודה')} colors={gradients.primary} onPress={save} />
    </View>
  );
}

function PlacesModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { workplaces, deleteWorkplace, shifts } = useStore();
  const [editId, setEditId] = useState<string | null>(null);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <T bold size={22}>
              {t('🏢 מקומות העבודה שלי')}
            </T>
            <Pressable onPress={onClose} hitSlop={12}>
              <T bold style={{ color: colors.primaryHi }}>
                {t('סגור ✕')}
              </T>
            </Pressable>
          </Row>
          {workplaces.map((w) => (
            <Card key={w.id} style={{ marginTop: 12 }}>
              {editId === w.id ? (
                <PlaceForm place={w} onSaved={() => setEditId(null)} />
              ) : (
                <Row style={{ alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 28 }}>{w.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <T bold size={17}>
                      {w.name}
                    </T>
                    <T dim size={13}>
                      {[w.role, w.wage ? t('{w} ₪ לשעה', { w: w.wage }) : '', t('{n} משמרות', { n: shifts.filter((s) => s.workplaceId === w.id).length })].filter(Boolean).join(' · ')}
                    </T>
                  </View>
                  <Chip label={t('✏️')} onPress={() => setEditId(w.id)} />
                  <Chip
                    label="🗑️"
                    onPress={() =>
                      Alert.alert(t('למחוק את {name}?', { name: w.name }), t('המשמרות שכבר נשמרו יישארו'), [
                        { text: t('ביטול'), style: 'cancel' },
                        { text: t('מחק'), style: 'destructive', onPress: () => deleteWorkplace(w.id) },
                      ])
                    }
                  />
                </Row>
              )}
            </Card>
          ))}
          <SectionTitle>{t('➕ מקום עבודה נוסף')}</SectionTitle>
          <Card>
            <PlaceForm onSaved={() => notify('success')} />
          </Card>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
