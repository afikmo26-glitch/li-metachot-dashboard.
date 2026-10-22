import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, ScrollViewInstance, Text, TextInputInstance, View } from 'react-native';
import ChatModal, { BotAvatar, BOT_NAME, PendingRecording } from '../components/ChatModal';
import Recorder from '../components/Recorder';
import { Card, Chip, GradientButton, Input, notify, Row, SectionTitle, T, tap } from '../components/ui';
import { persistRecording } from '../lib/audio';
import { computeStreak, dayKey, dayNamesShort, formatLongDate, formatTime, formatTimeSeconds, greeting, parseDayKey } from '../lib/dates';
import { extractQuotes, findKnownPeople, suggestNewNames } from '../lib/names';
import { scheduleMorningRecap } from '../lib/notifications';
import { newId, personName, useStore } from '../lib/store';
import { circleEmoji, circleOf } from '../lib/circles';
import RecapModal, { recentEntries } from '../components/RecapModal';
import DayExtras, { EMPTY_EXTRAS, Extras } from '../components/DayExtras';
import DictateButton from '../components/DictateButton';
import ForYou from '../components/ForYou';
import GoalsModal from '../components/GoalsModal';
import PhotoTimeline from '../components/PhotoTimeline';
import { usePrefs } from '../lib/prefs';
import { GenderPicker } from './AuthScreens';
import { colors, gradients, layout, MOOD_LABELS, MOODS } from '../lib/theme';
import type { Entry } from '../lib/types';
import { t } from '../i18n';
import Pet, { PetHandle } from '../components/pet/Pet';
import { currentLove, isNight, petLine, stageOf } from '../lib/pet';
import { useLevel } from '../lib/useLevel';
import MoodInsights from '../components/MoodInsights';
import { HeroCarousel, MemoryCard, MusicCard, nextEvent, QuickActions, Slide } from '../components/Hero';
import { promptOfTheDay } from '../lib/prompts';
import { daysUntil, openHomework, upcomingExams, whenLabel } from '../lib/study';

type Props = {
  onOpenPet: () => void;
  onOpenStudy: () => void;
  onOpenSettings: () => void;
  onOpenEntry: (id: string) => void;
  onOpenIntro?: () => void;
  onOpenCalendar: () => void;
};

export default function TodayScreen({ onOpenPet, onOpenStudy, onOpenSettings, onOpenEntry, onOpenIntro, onOpenCalendar }: Props) {
  const { entries, people, events, settings, saveEntry, addPerson, activeShift, workplaces, pet } = useStore();
  const [text, setText] = useState('');
  const [mood, setMood] = useState(3);
  const [recording, setRecording] = useState<PendingRecording | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatOpening, setChatOpening] = useState<string | undefined>();
  const [moodOpen, setMoodOpen] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  const { prefs, setPrefs } = usePrefs();
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [extras, setExtras] = useState<Extras>(EMPTY_EXTRAS);
  const [draftId, setDraftId] = useState(newId);
  const [interim, setInterim] = useState('');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const scroll = useRef<ScrollViewInstance>(null);
  const input = useRef<TextInputInstance>(null);
  const anchors = useRef({ record: 0, extras: 0 });
  const scrollTo = (k: 'record' | 'extras') => scroll.current?.scrollTo({ y: Math.max(0, anchors.current[k] - 12), animated: true });

  const detected = useMemo(() => findKnownPeople(text, people), [text, people]);
  const tagged = useMemo(() => [...new Set([...detected, ...manual])].filter((id) => !excluded.has(id)), [detected, manual, excluded]);
  const suggestions = useMemo(() => suggestNewNames(text, people), [text, people]);
  const quotes = useMemo(() => extractQuotes(text, people, tagged), [text, people, tagged]);

  const days = useMemo(() => new Set(entries.map((e) => dayKey(e.createdAt))), [entries]);
  const streak = computeStreak(days);
  const todayKey = dayKey(new Date());
  const todayEntries = entries.filter((e) => dayKey(e.createdAt) === todayKey);

  const todayEvents = useMemo(() => {
    const now = new Date();
    return events.filter((ev) => {
      const d = parseDayKey(ev.date);
      return ev.yearly ? d.getMonth() === now.getMonth() && d.getDate() === now.getDate() : ev.date === todayKey;
    });
  }, [events, todayKey]);

  const answerer = (pet.hatched && pet.name) || t('יומי');
  const upcoming = nextEvent(events);
  const slides: Slide[] = [
    {
      key: 'q',
      tag: t('💭 שאלת היום'),
      title: promptOfTheDay(),
      cta: t('לענות ל{name} 💬', { name: answerer }),
      colors: ['#7C3AED', '#DB2777'],
      onPress: () => {
        setChatOpening(promptOfTheDay());
        setChatOpen(true);
      },
    },
    ...(streak > 0
      ? [
          {
            key: 'streak',
            tag: t('🔥 רצף של {n} ימים', { n: streak }),
            title: todayEntries.length ? t('כבר כתבת היום — כל הכבוד!') : t('עוד יום אחד והרצף ממשיך'),
            cta: t('לכתוב עכשיו'),
            colors: ['#0EA5E9', '#6366F1'] as const,
            onPress: () => scrollTo('record'),
          },
        ]
      : []),
    ...(upcoming
      ? [
          {
            key: 'event',
            tag: upcoming.days === 1 ? t('מחר') : t('בעוד {n} ימים', { n: upcoming.days }),
            title: `${upcoming.kind === 'birthday' ? '🎂' : upcoming.kind === 'anniversary' ? '💍' : '📌'} ${upcoming.title}`,
            cta: t('ללוח השנה'),
            colors: ['#F97316', '#E11D48'] as const,
            onPress: onOpenCalendar,
          },
        ]
      : []),
    ...(recentEntries(entries).length >= 3
      ? [
          {
            key: 'recap',
            tag: t('החודש שלך מוכן!'),
            title: t('מצב הרוח, האנשים והרגעים של 30 הימים האחרונים'),
            cta: t('לצפות ✨'),
            colors: ['#6D28D9', '#EC4899'] as const,
            onPress: () => setRecapOpen(true),
          },
        ]
      : []),
    {
      key: 'talk',
      tag: t(BOT_NAME),
      title: t('דבר עם {bot} על היום', { bot: t(BOT_NAME) }),
      cta: t('לדבר עכשיו'),
      colors: ['#059669', '#0EA5E9'],
      onPress: () => setChatOpen(true),
    },
  ];

  const addManual = (name: string) => {
    if (!name.trim()) return;
    const p = addPerson(name);
    setManual((m) => [...m, p.id]);
    setExcluded((s) => {
      const n = new Set(s);
      n.delete(p.id);
      return n;
    });
    setNewName('');
  };

  const toggle = (id: string) => {
    setExcluded((s) => {
      const n = new Set(s);
      if (tagged.includes(id)) n.add(id);
      else n.delete(id);
      return n;
    });
    if (!detected.includes(id) && !manual.includes(id)) setManual((m) => [...m, id]);
  };

  const save = async () => {
    if (!text.trim() && !recording && !extras.photoUri) {
      Alert.alert(t('עוד רגע…'), t('הקלט או כתוב משהו על היום שלך לפני השמירה 🙂'));
      return;
    }
    Keyboard.dismiss();
    const id = draftId;
    const gratitude = extras.gratitude.map((g) => g.trim()).filter(Boolean);
    const audioUri = recording ? await persistRecording(recording.uri, id) : undefined;
    const entry: Entry = {
      id,
      createdAt: (recording?.startedAt ?? new Date()).toISOString(),
      text: text.trim(),
      audioUri,
      durationMs: recording?.durationMs,
      mood,
      people: tagged,
      quotes,
      ...(extras.photoUri ? { photoUri: extras.photoUri } : {}),
      ...(gratitude.length ? { gratitude } : {}),
      ...(extras.sleep !== undefined ? { sleep: extras.sleep } : {}),
      ...(extras.workout !== undefined ? { workout: extras.workout } : {}),
    };
    saveEntry(entry);
    scheduleMorningRecap(settings, entry, people).catch(() => {});
    notify('success');
    setText('');
    setMood(3);
    setRecording(null);
    setExcluded(new Set());
    setManual([]);
    setExtras(EMPTY_EXTRAS);
    setDraftId(newId());
    Alert.alert(
      t('נשמר בארכיון ✨'),
      `${formatLongDate(entry.createdAt)}\n${t('בשעה {time}', { time: formatTimeSeconds(entry.createdAt) })}${
        tagged.length ? `\n\n${t('אנשים: {names}', { names: tagged.map((id) => personName(people, id)).join(', ') })}` : ''
      }`,
    );
  };

  return (
    <ScrollView ref={scroll} contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Row style={{ alignItems: 'center', gap: 12 }}>
        <Pressable
          onPress={onOpenSettings}
          hitSlop={6}
          accessibilityLabel={t('תפריט והגדרות')}
          style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="menu" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T size={13} style={{ color: colors.textMute }}>
            {greeting()} · {formatLongDate(new Date())}
          </T>
          <T bold size={24} numberOfLines={1}>
            {settings.userName || t('היומן שלי')}
          </T>
        </View>
        {streak > 0 && (
          <LinearGradient
            colors={['rgba(251,146,60,0.22)', 'rgba(244,63,94,0.22)']}
            style={{ flexDirection: layout.row, alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(251,146,60,0.45)' }}
          >
            <Ionicons name="flame" size={15} color={colors.orange} />
            <T bold size={14} style={{ color: '#FED7AA' }}>
              {streak}
            </T>
          </LinearGradient>
        )}
      </Row>

      <HeroCarousel slides={slides} />
      <QuickActions
        actions={[
          { key: 'rec', label: t('הקלטה'), icon: 'mic', colors: ['#F472B6', '#A855F7'], onPress: () => scrollTo('record') },
          { key: 'photo', label: t('תמונה'), icon: 'camera', colors: ['#22D3EE', '#6366F1'], onPress: () => scrollTo('extras') },
          {
            key: 'write',
            label: t('כתיבה'),
            icon: 'create',
            colors: ['#34D399', '#059669'],
            onPress: () => {
              scrollTo('record');
              setTimeout(() => input.current?.focus(), 400);
            },
          },
          { key: 'study', label: t('לימוד'), icon: 'timer', colors: ['#FBBF24', '#F97316'], onPress: onOpenStudy },
        ]}
      />

      <PetHello onOpen={onOpenPet} />
      <StudySoon onOpen={onOpenStudy} />
      <MemoryCard entries={entries} onOpen={onOpenEntry} />
      <MusicCard />

      <Row style={{ marginTop: 14, gap: 10 }}>
        <Stat emoji="🔥" value={streak} label={t('ימים ברצף')} />
        <Stat emoji="📖" value={days.size} label={t('ימים בארכיון')} />
        <Stat emoji="💞" value={people.filter((p) => circleOf(p) === 'family' || circleOf(p) === 'friends').length} label={t('משפחה וחברים')} />
      </Row>

      {onOpenIntro && (
        <Pressable
          onPress={onOpenIntro}
          style={({ pressed }) => ({
            marginTop: 14,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Card style={{ borderColor: colors.yellow }}>
            <Row style={{ alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 27 }}>👋</Text>
              <View style={{ flex: 1 }}>
                <T bold size={17}>
                  {t('ספר לי קצת על עצמך')}
                </T>
                <T dim size={13}>
                  {t('משפחה, חברים ועבודה, כדי שיומי והמשחק יכירו אותך')}
                </T>
              </View>
            </Row>
          </Card>
        </Pressable>
      )}

      {!prefs.genderAsked && !prefs.gender && prefs.lang !== 'en' && (
        <Card style={{ marginTop: 14, borderColor: colors.primary }}>
          <GenderPicker value={prefs.gender} onChange={(gender) => setPrefs({ gender, genderAsked: true })} />
        </Card>
      )}

      {activeShift && (
        <Card
          style={{
            marginTop: 14,
            borderColor: colors.green,
            paddingVertical: 12,
          }}
        >
          <T bold style={{ color: colors.green }}>
            {t('🟢 במשמרת ב{place} · התחלת ב-{time}', {
              place: workplaces.find((w) => w.id === activeShift.workplaceId)?.name ?? t('מקום עבודה'),
              time: formatTime(activeShift.start),
            })}
          </T>
        </Card>
      )}

      {recentEntries(entries).length >= 3 && (
        <Pressable
          onPress={() => setRecapOpen(true)}
          style={({ pressed }) => ({
            marginTop: 14,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <LinearGradient colors={['#6D28D9', '#A855F7', '#EC4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 16 }}>
            <Row style={{ alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 27 }}>✨</Text>
              <View style={{ flex: 1 }}>
                <T bold size={17} style={{ color: '#fff' }}>
                  {t('החודש שלך מוכן!')}
                </T>
                <T size={13} style={{ color: 'rgba(255,255,255,0.85)' }}>
                  {t('מצב הרוח, האנשים והרגעים של 30 הימים האחרונים')}
                </T>
              </View>
              <T bold size={22} style={{ color: '#fff' }}>
                {layout.isRTL ? '‹' : '›'}
              </T>
            </Row>
          </LinearGradient>
        </Pressable>
      )}

      <WeekStrip onOpen={() => setMoodOpen(true)} />

      <Pressable
        onPress={() => setChatOpen(true)}
        style={({ pressed }) => ({
          marginTop: 14,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Card style={{ borderColor: colors.primary }}>
          <Row style={{ alignItems: 'center', gap: 12 }}>
            <BotAvatar size={46} />
            <View style={{ flex: 1 }}>
              <T bold size={17}>
                {t('דבר עם {bot} על היום', { bot: t(BOT_NAME) })}
              </T>
              <T dim size={13}>
                {t('אשאל אותך כמה שאלות ואכתוב את היומן בשבילך')}
              </T>
            </View>
            <T dim size={20}>
              {layout.isRTL ? '‹' : '›'}
            </T>
          </Row>
        </Card>
      </Pressable>

      {todayEvents.length > 0 && (
        <Card style={{ marginTop: 14, borderColor: colors.orange }}>
          {todayEvents.map((ev) => (
            <T key={ev.id} bold>
              {ev.kind === 'birthday' ? '🎂' : ev.kind === 'anniversary' ? '💍' : '📌'} {t('היום: {title}', { title: ev.title })}
            </T>
          ))}
        </Card>
      )}

      <Card style={{ marginTop: 16, paddingVertical: 20 }} onLayout={(e) => (anchors.current.record = e.nativeEvent.layout.y)}>
        <T bold size={20} style={{ textAlign: 'center' }}>
          {t('איך היה היום שלך?')}
        </T>
        <Recorder
          hasRecording={!!recording}
          onRecorded={(uri, durationMs, startedAt, transcript) => {
            setRecording({ uri, durationMs, startedAt, transcript });
            setChatOpen(true);
          }}
        />

        <View>
          <Input
            ref={input}
            multiline
            value={interim ? `${text}${text ? ' ' : ''}${interim}` : text}
            onChangeText={setText}
            placeholder={t('ספר מה קרה היום, מי פגשת ומה אמרו לך… או לחץ על המיקרופון ודבר')}
            style={{
              minHeight: 120,
              textAlignVertical: 'top',
              marginTop: 10,
              lineHeight: 22,
              paddingBottom: 52,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: 8,
              [layout.isRTL ? 'left' : 'right']: 8,
            }}
          >
            <DictateButton onText={(said) => setText((cur) => (cur.trim() ? `${cur.trim()} ${said}` : said))} onInterim={setInterim} />
          </View>
        </View>

        <T bold style={{ marginTop: 16, marginBottom: 8 }}>
          {t('מצב רוח: {mood}', { mood: t(MOOD_LABELS[mood - 1]) })}
        </T>
        <Row style={{ justifyContent: 'space-between' }}>
          {MOODS.map((m, i) => (
            <Pressable
              key={m}
              onPress={() => {
                tap();
                setMood(i + 1);
              }}
              style={{
                padding: 8,
                borderRadius: 16,
                backgroundColor: mood === i + 1 ? colors.cardHi : 'transparent',
                borderWidth: mood === i + 1 ? 1.5 : 0,
                borderColor: colors.primaryHi,
              }}
            >
              <Text style={{ fontSize: mood === i + 1 ? 36 : 28 }}>{m}</Text>
            </Pressable>
          ))}
        </Row>

        <View onLayout={(e) => (anchors.current.extras = anchors.current.record + e.nativeEvent.layout.y)}>
          <DayExtras value={extras} onChange={setExtras} entryId={draftId} />
        </View>

        <T bold style={{ marginTop: 16, marginBottom: 8 }}>
          {t('💞 מי היה איתך היום?')}
        </T>
        {people.length === 0 && suggestions.length === 0 ? (
          <T dim size={14} style={{ marginBottom: 8 }}>
            {t('כשתזכיר שמות בטקסט אזהה אותם אוטומטית. אפשר גם להוסיף ידנית:')}
          </T>
        ) : null}
        <Row style={{ flexWrap: 'wrap' }}>
          {[...new Set([...detected, ...manual])].map((id) => (
            <Chip key={id} label={`${circleEmoji(people.find((x) => x.id === id))} ${personName(people, id)}`} active={tagged.includes(id)} onPress={() => toggle(id)} />
          ))}
          {suggestions.map((n) => (
            <Chip key={`s-${n}`} label={`+ ${n}`} color={colors.yellow} onPress={() => addManual(n)} />
          ))}
        </Row>
        {suggestions.length > 0 && (
          <T dim size={12} style={{ marginBottom: 6 }}>
            {t('הצהובים הם שמות שזיהיתי — לחץ כדי לשמור אותם')}
          </T>
        )}
        <Row style={{ gap: 8, alignItems: 'center' }}>
          <Input value={newName} onChangeText={setNewName} placeholder={t('הוסף שם…')} style={{ flex: 1, minWidth: 0 }} onSubmitEditing={() => addManual(newName)} />
          <GradientButton small title={t('הוסף')} colors={gradients.calm} onPress={() => addManual(newName)} />
        </Row>

        {quotes.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <T bold style={{ marginBottom: 6 }}>
              {t('💬 מה אמרו לך')}
            </T>
            {quotes.map((q, i) => (
              <T key={i} dim size={14} style={{ marginBottom: 4 }}>
                {personName(people, q.personId)}: "{q.text}"
              </T>
            ))}
          </View>
        )}

        <GradientButton title={t('שמור בארכיון')} icon="💾" colors={gradients.primary} onPress={save} style={{ marginTop: 18 }} />
      </Card>

      {todayEntries.length > 0 && (
        <>
          <SectionTitle>{t('היום כבר תיעדת')}</SectionTitle>
          {todayEntries.map((e) => (
            <MiniEntry key={e.id} entry={e} onPress={() => onOpenEntry(e.id)} />
          ))}
        </>
      )}

      <ForYou onOpenEntry={onOpenEntry} onOpenGoals={() => setGoalsOpen(true)} onOpenPhotos={() => setPhotosOpen(true)} />

      <GoalsModal visible={goalsOpen} onClose={() => setGoalsOpen(false)} />
      <PhotoTimeline visible={photosOpen} onClose={() => setPhotosOpen(false)} onOpenEntry={onOpenEntry} />
      <RecapModal visible={recapOpen} onClose={() => setRecapOpen(false)} />
      <MoodInsights visible={moodOpen} onClose={() => setMoodOpen(false)} />
      <ChatModal
        visible={chatOpen}
        opening={chatOpening}
        recording={recording}
        onClose={() => {
          setChatOpen(false);
          setChatOpening(undefined);
        }}
        onSaved={(entry) => {
          setChatOpen(false);
          setRecording(null);
          Alert.alert(t('נשמר בארכיון ✨'), `${formatLongDate(entry.createdAt)}\n${t('בשעה {time}', { time: formatTimeSeconds(entry.createdAt) })}`);
        }}
      />
    </ScrollView>
  );
}

/** An exam this week or homework due soon, one tap from studying. */
function StudySoon({ onOpen }: { onOpen: () => void }) {
  const { exams, homework } = useStore();
  const exam = upcomingExams(exams).find((e) => daysUntil(e.date) <= 7);
  const hw = openHomework(homework).filter((h) => daysUntil(h.due) <= 1);
  if (!exam && !hw.length) return null;
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => ({
        marginTop: 12,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <Card style={{ borderColor: colors.orange }}>
        <Row style={{ alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 24 }}>📚</Text>
          <View style={{ flex: 1 }}>
            {exam && (
              <T bold size={16}>
                {t('מבחן ב{subject} {when}', {
                  subject: t(exam.subject),
                  when: whenLabel(exam.date),
                })}
              </T>
            )}
            {hw.length > 0 && (
              <T dim size={13}>
                {t('{n} משימות להגשה עד מחר', { n: hw.length })}
              </T>
            )}
            <T size={12} style={{ color: colors.primaryHi, marginTop: 2 }}>
              {t('לחץ כדי ללמוד ביחד 🤓')}
            </T>
          </View>
        </Row>
      </Card>
    </Pressable>
  );
}

/** The pet says hi (and waves) every time the app opens; tap to go play with it. */
function PetHello({ onOpen }: { onOpen: () => void }) {
  const { pet, entries, settings } = useStore();
  const { level } = useLevel();
  const ref = useRef<PetHandle>(null);
  const wrote = entries.some((e) => dayKey(e.createdAt) === dayKey(new Date()));
  const todayMood = entries.find((e) => dayKey(e.createdAt) === dayKey(new Date()))?.mood;
  useEffect(() => {
    const hi = setTimeout(() => ref.current?.wave(), 700);
    return () => clearTimeout(hi);
  }, []);
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => ({
        marginTop: 14,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <Card style={{ paddingVertical: 8, borderColor: colors.primary }}>
        <Row style={{ alignItems: 'center', gap: 6 }}>
          <Pet ref={ref} pet={pet} stage={stageOf(pet, level)} size={104} sleeping={isNight()} interactive={false} onTap={onOpen} onEggTap={onOpen} />
          <View style={{ flex: 1 }}>
            <View
              style={{
                backgroundColor: colors.cardHi,
                borderRadius: 16,
                padding: 10,
              }}
            >
              <T size={15} style={{ lineHeight: 21 }}>
                {pet.hatched ? petLine(pet, settings.userName, wrote, currentLove(pet), new Date(), todayMood) : t('🥚 יש לך ביצה! בוא נבקע אותה ביחד')}
              </T>
            </View>
            <T dim size={12} style={{ marginTop: 6 }}>
              {pet.hatched ? t('{name} · לחץ כדי לשחק איתו 🐾', { name: pet.name }) : t('לחץ כדי לבקר אותה 🐾')}
            </T>
          </View>
        </Row>
      </Card>
    </Pressable>
  );
}

/** Mood of each of the last 7 days, today on the left (RTL: oldest on the right). */
function WeekStrip({ onOpen }: { onOpen: () => void }) {
  const { entries } = useStore();
  const days = useMemo(() => {
    const out: {
      key: string;
      label: string;
      mood: number | null;
      today: boolean;
    }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = dayKey(d);
      const es = entries.filter((e) => dayKey(e.createdAt) === k);
      out.push({
        key: k,
        label: dayNamesShort()[d.getDay()],
        mood: es.length ? Math.round(es.reduce((a, e) => a + e.mood, 0) / es.length) : null,
        today: i === 0,
      });
    }
    return out;
  }, [entries]);
  return (
    <Pressable onPress={onOpen}>
      <Card style={{ marginTop: 14, paddingVertical: 12 }}>
        <Row
          style={{
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <T bold size={15}>
            {t('השבוע שלך')}
          </T>
          <T size={12} style={{ color: colors.primaryHi }}>
            {t('📊 לגרף החודש')}
          </T>
        </Row>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          {days.map((d) => (
            <View key={d.key} style={{ alignItems: 'center', flex: 1 }}>
              <View
                style={{
                  width: 18,
                  height: d.mood ? 14 + d.mood * 9 : 6,
                  borderRadius: 9,
                  backgroundColor: d.mood ? [colors.red, colors.orange, colors.yellow, colors.green, colors.primaryHi][d.mood - 1] : colors.border,
                }}
              />
              <Text style={{ fontSize: 16, marginTop: 6 }}>{d.mood ? MOODS[d.mood - 1] : '·'}</Text>
              <T dim={!d.today} bold={d.today} size={11} style={{ textAlign: 'center' }}>
                {d.label}
              </T>
            </View>
          ))}
        </Row>
      </Card>
    </Pressable>
  );
}

function Stat({ emoji, value, label }: { emoji: string; value: number; label: string }) {
  return (
    <Card
      style={{
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 6,
      }}
    >
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <T bold size={22} style={{ textAlign: 'center' }}>
        {value}
      </T>
      <T dim size={12} style={{ textAlign: 'center' }}>
        {label}
      </T>
    </Card>
  );
}

export function MiniEntry({ entry, onPress }: { entry: Entry; onPress: () => void }) {
  const { people } = useStore();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.8 : 1,
        marginBottom: 10,
      })}
    >
      <Card>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <T bold size={15}>
            🕐 {formatTimeSeconds(entry.createdAt)}
          </T>
          <Text style={{ fontSize: 20 }}>
            {entry.photoUri ? '📸 ' : ''}
            {entry.audioUri ? '🎙️ ' : ''}
            {MOODS[entry.mood - 1]}
          </Text>
        </Row>
        {entry.text ? (
          <T dim style={{ marginTop: 6, lineHeight: 21 }} numberOfLines={3}>
            {entry.text}
          </T>
        ) : null}
        {entry.people.length > 0 && (
          <T size={13} style={{ marginTop: 6, color: colors.primaryHi }}>
            {entry.people.map((p) => `${circleEmoji(people.find((x) => x.id === p))} ${personName(people, p)}`).join('  ')}
          </T>
        )}
      </Card>
    </Pressable>
  );
}
