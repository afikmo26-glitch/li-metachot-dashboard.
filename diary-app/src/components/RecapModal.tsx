import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { circleInfo, circleOf } from '../lib/circles';
import { dayKey, dayNamesShort, formatShortDate } from '../lib/dates';
import { personName, useStore } from '../lib/store';
import { layout, MOODS } from '../lib/theme';
import type { Circle, Entry } from '../lib/types';
import { Avatar } from '../screens/PeopleScreen';
import { FadeIn, Row, T, tap } from './ui';
import { Confetti, PopEmoji } from './Wow';

/** "Your month": a story-style recap of the last 30 days, in the spirit of Spotify Wrapped. */

const DAYS = 30;
const SLIDE_MS = 6000;
const WHITE = '#FFFFFF';
const BGS: [string, string, string][] = [
  ['#6D28D9', '#A855F7', '#EC4899'],
  ['#0EA5E9', '#6366F1', '#8B5CF6'],
  ['#F97316', '#EC4899', '#BE185D'],
  ['#059669', '#0EA5E9', '#6366F1'],
  ['#DB2777', '#9333EA', '#4C1D95'],
  ['#CA8A04', '#EA580C', '#BE123C'],
  ['#4C1D95', '#7C3AED', '#EC4899'],
];

export function recentEntries(entries: Entry[]): Entry[] {
  const since = Date.now() - DAYS * 86400000;
  return entries.filter((e) => new Date(e.createdAt).getTime() >= since);
}

type Recap = ReturnType<typeof useRecap>;

function useRecap() {
  const { entries, people } = useStore();
  return useMemo(() => {
    const es = recentEntries(entries);
    const days = new Set(es.map((e) => dayKey(e.createdAt)));
    const avg = es.length ? es.reduce((a, e) => a + e.mood, 0) / es.length : 3;
    const counts = new Map<string, number>();
    es.forEach((e) => e.people.forEach((p) => counts.set(p, (counts.get(p) ?? 0) + 1)));
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => ({ name: personName(people, id), n }));
    const circles: Record<Circle, number> = { family: 0, friends: 0, work: 0, other: 0 };
    for (const [id, n] of counts) {
      const p = people.find((x) => x.id === id);
      circles[(p && circleOf(p)) ?? 'other'] += n;
    }
    // Happiest weekday: highest average mood among weekdays with at least one entry
    const byDay = Array.from({ length: 7 }, () => [] as number[]);
    es.forEach((e) => byDay[new Date(e.createdAt).getDay()].push(e.mood));
    const happiestDay = byDay
      .map((m, i) => ({ i, avg: m.length ? m.reduce((a, b) => a + b, 0) / m.length : 0 }))
      .sort((a, b) => b.avg - a.avg)[0];
    const quotes = es.flatMap((e) => e.quotes.map((q) => ({ text: q.text, name: personName(people, q.personId) })));
    const best = [...es].sort((a, b) => b.mood - a.mood || b.text.length - a.text.length)[0];
    // Mood per day, oldest first, 0 for a day with no entry
    const strip = Array.from({ length: DAYS }, (_, i) => {
      const k = dayKey(new Date(Date.now() - (DAYS - 1 - i) * 86400000));
      const m = es.filter((e) => dayKey(e.createdAt) === k).map((e) => e.mood);
      return m.length ? Math.round(m.reduce((a, b) => a + b, 0) / m.length) : 0;
    });
    return {
      entries: es.length,
      days: days.size,
      avg,
      top,
      circles,
      happiestDay: happiestDay?.avg ? dayNamesShort()[happiestDay.i] : null,
      quote: quotes.length ? quotes[Math.floor(Math.random() * quotes.length)] : null,
      best,
      strip,
      words: es.reduce((a, e) => a + (e.text.trim() ? e.text.trim().split(/\s+/).length : 0), 0),
    };
  }, [entries, people]);
}

export default function RecapModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const r = useRecap();
  const slides = useMemo(() => buildSlides(r), [r]);
  const [i, setI] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setI(0);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: SLIDE_MS, easing: Easing.linear, useNativeDriver: false });
    anim.start(({ finished }) => {
      if (finished && i < slides.length - 1) setI(i + 1);
    });
    return () => anim.stop();
  }, [i, visible, slides.length, progress]);

  const go = (d: number) => {
    tap();
    const n = i + d;
    if (n < 0) return;
    if (n >= slides.length) onClose();
    else setI(n);
  };

  const share = () => {
    const lines = [
      t('✨ החודש שלי ב"היומן שלי"'),
      t('📖 {n} ימים שסיפרתי עליהם', { n: r.days }),
      r.top[0] ? t('💞 הכי הרבה זמן עם {name}', { name: r.top[0].name }) : '',
      t('מצב הרוח הממוצע שלי: {mood}', { mood: MOODS[Math.round(r.avg) - 1] }),
    ].filter(Boolean);
    Share.share({ message: lines.join('\n') }).catch(() => {});
  };

  const slide = slides[Math.min(i, slides.length - 1)];
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <LinearGradient colors={BGS[i % BGS.length]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          {/* progress bars, in reading direction */}
          <View style={{ flexDirection: layout.row, gap: 5, paddingHorizontal: 14, paddingTop: 8 }}>
            {slides.map((_, k) => (
              <View key={k} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden', transform: [{ scaleX: layout.flip }] }}>
                <Animated.View
                  style={{
                    height: '100%',
                    backgroundColor: WHITE,
                    width: k < i ? '100%' : k > i ? '0%' : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  }}
                />
              </View>
            ))}
          </View>
          <Row style={{ justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10 }}>
            <T bold size={15} style={{ color: WHITE }}>
              {t('✨ החודש שלך')}
            </T>
            <Pressable onPress={onClose} hitSlop={14} accessibilityLabel={t('סגור')}>
              <Text style={{ color: WHITE, fontSize: 22 }}>✕</Text>
            </Pressable>
          </Row>

          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 26 }}>
            <FadeIn key={i}>{slide.body}</FadeIn>
          </View>

          {i === slides.length - 1 && (
            <Pressable onPress={share} style={{ alignSelf: 'center', marginBottom: 30, backgroundColor: WHITE, borderRadius: 999, paddingHorizontal: 26, paddingVertical: 14 }}>
              <T bold size={17} style={{ color: '#4C1D95' }}>
                {t('📤 שתף את החודש שלי')}
              </T>
            </Pressable>
          )}

          {/* tap zones: start side goes back, end side goes forward (like Instagram stories) */}
          <View style={{ position: 'absolute', top: 110, bottom: i === slides.length - 1 ? 100 : 0, left: 0, right: 0, flexDirection: layout.row }}>
            <Pressable style={{ flex: 1 }} onPress={() => go(-1)} accessibilityLabel={t('הקודם')} />
            <Pressable style={{ flex: 2 }} onPress={() => go(1)} accessibilityLabel={t('הבא')} />
          </View>
        </SafeAreaView>
        {i === slides.length - 1 && <Confetti fire={i} pieces={50} />}
      </LinearGradient>
    </Modal>
  );
}

function Big({ children, size = 34 }: { children: React.ReactNode; size?: number }) {
  return (
    <T bold size={size} style={{ color: WHITE, textAlign: 'center', lineHeight: size * 1.25 }}>
      {children}
    </T>
  );
}

function Small({ children }: { children: React.ReactNode }) {
  return (
    <T size={18} style={{ color: 'rgba(255,255,255,0.88)', textAlign: 'center', marginTop: 12, lineHeight: 26 }}>
      {children}
    </T>
  );
}

function buildSlides(r: Recap): { body: React.ReactNode }[] {
  const slides: { body: React.ReactNode }[] = [];
  slides.push({
    body: (
      <View style={{ alignItems: 'center' }}>
        <PopEmoji emoji="📔" id="intro" size={84} />
        <Big size={30}>{t('30 הימים האחרונים שלך')}</Big>
        <T bold size={96} style={{ color: WHITE, textAlign: 'center', marginTop: 10 }}>
          {r.days}
        </T>
        <Big size={24}>{t('ימים שסיפרת עליהם')}</Big>
        {r.words > 0 && <Small>{t('{n} מילים נכתבו ביומן שלך', { n: r.words })}</Small>}
      </View>
    ),
  });
  slides.push({
    body: (
      <View style={{ alignItems: 'center' }}>
        <PopEmoji emoji={MOODS[Math.round(r.avg) - 1]} id="mood" size={96} />
        <Big>{t('ככה הרגשת החודש')}</Big>
        <View style={{ flexDirection: layout.row, alignItems: 'flex-end', gap: 3, height: 90, marginTop: 22 }}>
          {r.strip.map((m, k) => (
            <View key={k} style={{ width: 7, height: m ? 14 + m * 15 : 6, borderRadius: 4, backgroundColor: m ? WHITE : 'rgba(255,255,255,0.25)', opacity: m ? 0.45 + m * 0.11 : 1 }} />
          ))}
        </View>
        {r.happiestDay && <Small>{t('הימים הכי שמחים שלך: יום {day} 🌞', { day: r.happiestDay })}</Small>}
      </View>
    ),
  });
  if (r.top.length) {
    slides.push({
      body: (
        <View style={{ alignItems: 'center' }}>
          <PopEmoji emoji="💞" id="people" size={72} />
          <Big>{t('האנשים של החודש')}</Big>
          <View style={{ marginTop: 22, gap: 14, alignSelf: 'stretch' }}>
            {r.top.map((p, k) => (
              <FadeIn key={p.name} delay={300 + k * 250}>
                <Row style={{ alignItems: 'center', gap: 14, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 18, padding: 12 }}>
                  <T bold size={26} style={{ color: WHITE, width: 30, textAlign: 'center' }}>
                    {k + 1}
                  </T>
                  <Avatar name={p.name} size={50} />
                  <View style={{ flex: 1 }}>
                    <T bold size={20} style={{ color: WHITE }}>
                      {p.name}
                    </T>
                    <T size={14} style={{ color: 'rgba(255,255,255,0.8)' }}>
                      {t('הוזכר/ה {n} פעמים', { n: p.n })}
                    </T>
                  </View>
                </Row>
              </FadeIn>
            ))}
          </View>
        </View>
      ),
    });
    const total = Object.values(r.circles).reduce((a, b) => a + b, 0);
    const parts = (Object.keys(r.circles) as Circle[]).filter((c) => r.circles[c] > 0);
    if (total && parts.length > 1) {
      slides.push({
        body: (
          <View style={{ alignItems: 'center' }}>
            <PopEmoji emoji="🧭" id="circles" size={72} />
            <Big>{t('עם מי עבר עליך החודש')}</Big>
            <View style={{ alignSelf: 'stretch', marginTop: 24, gap: 14 }}>
              {parts.map((c) => {
                const pct = Math.round((r.circles[c] / total) * 100);
                return (
                  <View key={c}>
                    <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                      <T bold size={17} style={{ color: WHITE }}>
                        {circleInfo(c).emoji} {t(circleInfo(c).label)}
                      </T>
                      <T bold size={17} style={{ color: WHITE }}>
                        {pct}%
                      </T>
                    </Row>
                    <View style={{ height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden', transform: [{ scaleX: layout.flip }] }}>
                      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: WHITE, borderRadius: 6 }} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ),
      });
    }
  }
  if (r.quote) {
    slides.push({
      body: (
        <View style={{ alignItems: 'center' }}>
          <PopEmoji emoji="💬" id="quote" size={72} />
          <Big size={24}>{t('המשפט של החודש')}</Big>
          <Big size={30}>"{r.quote.text}"</Big>
          <Small>— {r.quote.name}</Small>
        </View>
      ),
    });
  }
  if (r.best) {
    slides.push({
      body: (
        <View style={{ alignItems: 'center' }}>
          <PopEmoji emoji={MOODS[r.best.mood - 1]} id="best" size={84} />
          <Big>{t('אחד הימים הכי טובים שלך')}</Big>
          <Small>{formatShortDate(r.best.createdAt)}</Small>
          {r.best.text ? (
            <T size={19} numberOfLines={6} style={{ color: WHITE, textAlign: 'center', marginTop: 16, lineHeight: 28 }}>
              "{r.best.text}"
            </T>
          ) : null}
        </View>
      ),
    });
  }
  slides.push({
    body: (
      <View style={{ alignItems: 'center' }}>
        <PopEmoji emoji="🏆" id="end" size={96} />
        <Big>{t('איזה חודש!')}</Big>
        <Small>{t('כל ערב שאת/ה מספר/ת — אני מכיר אותך קצת יותר. נתראה הערב 🌙')}</Small>
      </View>
    ),
  });
  return slides;
}
