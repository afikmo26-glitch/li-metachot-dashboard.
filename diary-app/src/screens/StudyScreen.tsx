import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Pet, { PetHandle } from '../components/pet/Pet';
import { Card, Chip, GhostButton, GradientButton, Input, notify, Row, SectionTitle, T, tap } from '../components/ui';
import { Confetti } from '../components/Wow';
import { t } from '../i18n';
import { formatShortDate } from '../lib/dates';
import { cancelNotifications, scheduleExamReminders, scheduleStudyEnd } from '../lib/notifications';
import { stageOf } from '../lib/pet';
import { play } from '../lib/sound';
import { newId, useStore } from '../lib/store';
import { DURATIONS, nextDays, openHomework, pastExams, SUBJECTS, upcomingExams, weekStudy, whenLabel } from '../lib/study';
import { colors, gradients, layout } from '../lib/theme';
import type { Exam, Homework } from '../lib/types';
import { useLevel } from '../lib/useLevel';
import { fmtClock, fmtHM } from '../lib/work';

/** Study with me: the pet studies alongside a timer, plus exams (with reminders) and homework. */

const ACTIVE = 'diary.studyActive.v1';
type Active = { start: string; minutes: number; subject?: string; notificationId?: string };

export default function StudyScreen() {
  const { exams, homework, studySessions, saveExam, deleteExam, saveHomework, deleteHomework } = useStore();
  const [examOpen, setExamOpen] = useState<Exam | null | 'new'>(null);
  const [hwOpen, setHwOpen] = useState(false);
  const week = useMemo(() => weekStudy(studySessions), [studySessions]);
  const upcoming = upcomingExams(exams);
  const past = pastExams(exams).slice(0, 5);
  const hw = openHomework(homework);
  const doneHw = homework.filter((h) => h.done).slice(-3);

  return (
    <View>
      <StudyTimer />

      <Row style={{ gap: 10, marginTop: 12 }}>
        <Stat value={fmtHM(week.minutes)} label={t('שעות לימוד השבוע')} />
        <Stat value={String(week.sessions)} label={t('סשנים')} />
        <Stat value={String(upcoming.length)} label={t('מבחנים קרובים')} />
      </Row>
      {week.bySubject.length > 0 && (
        <T dim size={13} style={{ marginTop: 8 }}>
          {week.bySubject.map(([s, m]) => `${t(s)} ${fmtHM(m)}`).join(' · ')}
        </T>
      )}

      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionTitle>{t('📝 מבחנים')}</SectionTitle>
        <Chip label={t('+ מבחן')} onPress={() => setExamOpen('new')} />
      </Row>
      {upcoming.length === 0 ? (
        <T dim>{t('אין מבחנים קרובים. הוסף מבחן ותקבל תזכורת יום לפני ובבוקר 🍀')}</T>
      ) : (
        upcoming.map((e) => (
          <Pressable key={e.id} onPress={() => setExamOpen(e)}>
            <Card style={{ marginBottom: 8, borderColor: whenLabel(e.date) === t('מחר') || whenLabel(e.date) === t('היום!') ? colors.orange : colors.border }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <T bold size={16}>
                    {t(e.subject)}
                  </T>
                  <T dim size={13}>
                    {formatShortDate(e.date)}
                    {e.time ? ` · ⁦${e.time}⁩` : ''}
                    {e.note ? ` · ${e.note}` : ''}
                  </T>
                </View>
                <View style={{ backgroundColor: colors.cardHi, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
                  <T bold size={13}>
                    {whenLabel(e.date)}
                  </T>
                </View>
              </Row>
            </Card>
          </Pressable>
        ))
      )}
      {past.length > 0 && (
        <T dim size={13} style={{ marginTop: 4 }}>
          {t('מבחנים שעברו: {list}', { list: past.map((e) => `${t(e.subject)}${e.grade ? ` (${e.grade})` : ''}`).join(', ') })}
        </T>
      )}

      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionTitle>{t('✏️ שיעורי בית')}</SectionTitle>
        <Chip label={t('+ משימה')} onPress={() => setHwOpen(true)} />
      </Row>
      {hw.length === 0 && <T dim>{t('הכל בוצע! 🎉')}</T>}
      {[...hw, ...doneHw].map((h) => (
        <Pressable
          key={h.id}
          onPress={() => {
            tap();
            saveHomework({ ...h, done: !h.done });
            if (!h.done) notify('success');
          }}
          onLongPress={() =>
            Alert.alert(t('למחוק את המשימה?'), h.title, [
              { text: t('ביטול'), style: 'cancel' },
              { text: t('מחק'), style: 'destructive', onPress: () => deleteHomework(h.id) },
            ])
          }
        >
          <Row style={{ alignItems: 'center', gap: 10, paddingVertical: 8, opacity: h.done ? 0.5 : 1 }}>
            <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: h.done ? colors.green : colors.border, backgroundColor: h.done ? colors.green : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {h.done && <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <T bold style={{ textDecorationLine: h.done ? 'line-through' : 'none' }}>
                {h.title}
              </T>
              <T dim size={12}>
                {t(h.subject)} · {t('להגשה {when}', { when: whenLabel(h.due) })}
              </T>
            </View>
          </Row>
        </Pressable>
      ))}

      <ExamModal
        exam={examOpen}
        onClose={() => setExamOpen(null)}
        onSave={async (e) => {
          await cancelNotifications(e.notificationIds);
          const notificationIds = await scheduleExamReminders(t(e.subject), e.date).catch(() => []);
          saveExam({ ...e, notificationIds });
          setExamOpen(null);
          notify('success');
        }}
        onDelete={async (e) => {
          await cancelNotifications(e.notificationIds);
          deleteExam(e.id);
          setExamOpen(null);
        }}
      />
      <HomeworkModal
        visible={hwOpen}
        onClose={() => setHwOpen(false)}
        onSave={(h) => {
          saveHomework(h);
          setHwOpen(false);
        }}
      />
    </View>
  );
}

/** The timer, with the pet in study glasses next to it. Survives leaving the screen (the start time is saved). */
export function StudyTimer() {
  const { pet, saveStudySession, exams } = useStore();
  const { level } = useLevel();
  const ref = useRef<PetHandle>(null);
  const [active, setActive] = useState<Active | null>(null);
  const [minutes, setMinutes] = useState(25);
  const [subject, setSubject] = useState<string | undefined>(upcomingExams(exams)[0]?.subject);
  const [now, setNow] = useState(Date.now());
  const [boom, setBoom] = useState(0);
  const finishing = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(ACTIVE).then((raw) => raw && setActive(JSON.parse(raw)));
  }, []);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  const endAt = active ? new Date(active.start).getTime() + active.minutes * 60000 : 0;
  const left = active ? Math.max(0, endAt - now) : minutes * 60000;

  const finish = async (completed: boolean) => {
    if (!active || finishing.current) return;
    finishing.current = true;
    const mins = Math.round((Math.min(Date.now(), endAt) - new Date(active.start).getTime()) / 60000);
    await cancelNotifications([active.notificationId]);
    await AsyncStorage.removeItem(ACTIVE);
    if (mins >= 1) saveStudySession({ id: newId(), subject: active.subject, start: active.start, minutes: mins });
    setActive(null);
    finishing.current = false;
    if (completed) {
      play('levelup', 0.5);
      setBoom((b) => b + 1);
      setTimeout(() => ref.current?.celebrate(), 300);
    }
  };

  useEffect(() => {
    if (active && left === 0) finish(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, active]);

  const start = async () => {
    tap('medium');
    const a: Active = { start: new Date().toISOString(), minutes, subject };
    a.notificationId = await scheduleStudyEnd(minutes * 60, pet.name).catch(() => undefined);
    await AsyncStorage.setItem(ACTIVE, JSON.stringify(a));
    setNow(Date.now());
    setActive(a);
    ref.current?.wave();
  };

  const studyPet = { ...pet, hatched: true, wear: { ...pet.wear, glasses: pet.wear.glasses ?? 'round' } };
  const progress = active ? 1 - left / (active.minutes * 60000) : 0;

  return (
    <Card style={{ borderColor: colors.primary }}>
      <T bold size={20} style={{ textAlign: 'center' }}>
        {t('📚 לומדים ביחד')}
      </T>
      <T dim size={13} style={{ textAlign: 'center', marginTop: 2 }}>
        {active ? t('{name} לומד איתך — אל תעזוב אותו לבד! 🤓', { name: pet.name || t('יומי') }) : t('בחר מקצוע וזמן, ו{name} ילמד לידך', { name: pet.name || t('יומי') })}
      </T>
      <Row style={{ alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 }}>
        <View>
          <Pet ref={ref} pet={studyPet} stage={pet.hatched ? stageOf(pet, level) : 'baby'} size={130} interactive={false} />
          <Text style={{ position: 'absolute', bottom: 6, [layout.isRTL ? 'right' : 'left']: -4, fontSize: 30 }}>📖</Text>
        </View>
        <View style={{ alignItems: 'center', minWidth: 130 }}>
          <Text style={{ fontSize: 44, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] }}>{fmtClock(left).slice(3)}</Text>
          {active && (
            <View style={{ width: 130, height: 8, borderRadius: 4, backgroundColor: colors.bgDeep, overflow: 'hidden', marginTop: 6 }}>
              <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: colors.green }} />
            </View>
          )}
          {active?.subject && (
            <T dim size={13} style={{ marginTop: 4 }}>
              {t(active.subject)}
            </T>
          )}
        </View>
      </Row>
      {!active ? (
        <>
          <Row style={{ justifyContent: 'center', flexWrap: 'wrap', marginTop: 4 }}>
            {DURATIONS.map((m) => (
              <Chip key={m} label={t('{n} דק׳', { n: m })} active={minutes === m} onPress={() => setMinutes(m)} />
            ))}
          </Row>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 6 }}>
            {SUBJECTS.map((s) => (
              <Chip key={s} label={t(s)} active={subject === s} onPress={() => setSubject(subject === s ? undefined : s)} />
            ))}
          </ScrollView>
          <GradientButton title={t('▶️ מתחילים ללמוד')} colors={gradients.primary} onPress={start} style={{ marginTop: 8 }} />
        </>
      ) : (
        <GhostButton title={t('⏹️ סיימתי מוקדם')} onPress={() => finish(false)} style={{ marginTop: 10 }} />
      )}
      <T dim size={11} style={{ textAlign: 'center', marginTop: 8 }}>
        {t('כל סשן של 10+ דקות = 10 XP (עד 40 ביום)')}
      </T>
      <Confetti fire={boom} pieces={40} />
    </Card>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
      <T bold size={20}>
        {value}
      </T>
      <T dim size={11} style={{ textAlign: 'center' }}>
        {label}
      </T>
    </Card>
  );
}

function DayChips({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const days = useMemo(() => nextDays(60), []);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
      {days.map((d) => (
        <Chip key={d.key} label={d.label} active={value === d.key} onPress={() => onChange(d.key)} />
      ))}
    </ScrollView>
  );
}

function SubjectChips({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return (
    <>
      <Row style={{ flexWrap: 'wrap' }}>
        {SUBJECTS.map((s) => (
          <Chip key={s} label={t(s)} active={value === s} onPress={() => onChange(s)} />
        ))}
      </Row>
      <Input value={SUBJECTS.includes(value) ? '' : value} onChangeText={onChange} placeholder={t('או מקצוע אחר…')} style={{ marginTop: 6 }} />
    </>
  );
}

function ExamModal({ exam, onClose, onSave, onDelete }: { exam: Exam | null | 'new'; onClose: () => void; onSave: (e: Exam) => void; onDelete: (e: Exam) => void }) {
  const editing = exam && exam !== 'new' ? exam : null;
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState(nextDays(8)[7].key);
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [grade, setGrade] = useState('');
  useEffect(() => {
    if (!exam) return;
    setSubject(editing?.subject ?? '');
    setDate(editing?.date ?? nextDays(8)[7].key);
    setTime(editing?.time ?? '');
    setNote(editing?.note ?? '');
    setGrade(editing?.grade ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam]);
  return (
    <Modal visible={!!exam} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0009', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, maxHeight: '90%' }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <T bold size={22}>
              {editing ? t('📝 עריכת מבחן') : t('📝 מבחן חדש')}
            </T>
            <T bold style={{ marginTop: 12, marginBottom: 6 }}>
              {t('מקצוע')}
            </T>
            <SubjectChips value={subject} onChange={setSubject} />
            <T bold style={{ marginTop: 12, marginBottom: 6 }}>
              {t('מתי?')}
            </T>
            <DayChips value={date} onChange={setDate} />
            <Input value={time} onChangeText={setTime} placeholder={t('שעה (לא חובה), למשל 08:30')} style={{ marginTop: 6, textAlign: 'left', writingDirection: 'ltr' }} />
            <Input value={note} onChangeText={setNote} placeholder={t('על מה המבחן? (לא חובה)')} style={{ marginTop: 6 }} />
            {editing && (
              <Input value={grade} onChangeText={setGrade} placeholder={t('ציון (אחרי המבחן)')} style={{ marginTop: 6 }} />
            )}
            <GradientButton
              title={t('שמור')}
              colors={gradients.primary}
              disabled={!subject.trim()}
              onPress={() =>
                onSave({
                  id: editing?.id ?? newId(),
                  subject: subject.trim(),
                  date,
                  time: /^\d{1,2}:\d{2}$/.test(time.trim()) ? time.trim() : undefined,
                  note: note.trim() || undefined,
                  grade: grade.trim() || undefined,
                  notificationIds: editing?.notificationIds,
                })
              }
              style={{ marginTop: 14 }}
            />
            {editing && <GhostButton title={t('🗑️ מחק מבחן')} color={colors.red} onPress={() => onDelete(editing)} style={{ marginTop: 8 }} />}
            <GhostButton title={t('ביטול')} onPress={onClose} style={{ marginTop: 8, borderWidth: 0 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function HomeworkModal({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (h: Homework) => void }) {
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(nextDays(2)[1].key);
  useEffect(() => {
    if (visible) {
      setSubject('');
      setTitle('');
      setDue(nextDays(2)[1].key);
    }
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0009', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, maxHeight: '90%' }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <T bold size={22}>
              {t('✏️ משימה חדשה')}
            </T>
            <Input value={title} onChangeText={setTitle} placeholder={t('מה צריך לעשות? (למשל: תרגילים 1-10 עמ׳ 45)')} style={{ marginTop: 12 }} />
            <T bold style={{ marginTop: 12, marginBottom: 6 }}>
              {t('מקצוע')}
            </T>
            <SubjectChips value={subject} onChange={setSubject} />
            <T bold style={{ marginTop: 12, marginBottom: 6 }}>
              {t('להגשה עד')}
            </T>
            <DayChips value={due} onChange={setDue} />
            <GradientButton
              title={t('הוסף')}
              colors={gradients.primary}
              disabled={!title.trim()}
              onPress={() => onSave({ id: newId(), subject: subject.trim() || t('כללי'), title: title.trim(), due, done: false })}
              style={{ marginTop: 14 }}
            />
            <GhostButton title={t('ביטול')} onPress={onClose} style={{ marginTop: 8, borderWidth: 0 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
