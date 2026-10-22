import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, ScrollViewInstance, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { t } from '../i18n';
import { dayKey, parseDayKey } from '../lib/dates';
import { stageOf } from '../lib/pet';
import { usePrefs } from '../lib/prefs';
import { useStore } from '../lib/store';
import { colors, layout } from '../lib/theme';
import type { Entry } from '../lib/types';
import { useLevel } from '../lib/useLevel';
import Pet from './pet/Pet';
import { Row, T, tap } from './ui';

export type Slide = { key: string; tag: string; title: string; cta: string; colors: readonly [string, string]; onPress: () => void };

/** Big swipeable cards at the top of the home screen; they move on by themselves every few seconds. */
export function HeroCarousel({ slides }: { slides: Slide[] }) {
  const { width } = useWindowDimensions();
  const { pet } = useStore();
  const { level } = useLevel();
  const w = Math.min(width, 520) - 36;
  const ref = useRef<ScrollViewInstance>(null);
  const [index, setIndex] = useState(0);
  const touching = useRef(false);
  const count = slides.length;

  useEffect(() => {
    if (count < 2) return;
    const id = setInterval(() => {
      if (touching.current) return;
      setIndex((i) => {
        const next = (i + 1) % count;
        ref.current?.scrollTo({ x: next * w, animated: true });
        return next;
      });
    }, 4500);
    return () => clearInterval(id);
  }, [count, w]);

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    touching.current = false;
    setIndex(Math.round(e.nativeEvent.contentOffset.x / w) % Math.max(count, 1));
  };

  if (!count) return null;
  return (
    <View style={{ marginTop: 16 }}>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => (touching.current = true)}
        onMomentumScrollEnd={onEnd}
        style={{ width: w, borderRadius: 26 }}
      >
        {slides.map((s) => (
          <Pressable key={s.key} onPress={s.onPress} style={{ width: w }} accessibilityRole="button" accessibilityLabel={`${s.tag}: ${s.title}`}>
            <LinearGradient
              colors={s.colors}
              start={{ x: layout.isRTL ? 1 : 0, y: 0 }}
              end={{ x: layout.isRTL ? 0 : 1, y: 1 }}
              style={{ height: 188, borderRadius: 26, padding: 18, overflow: 'hidden' }}
            >
              <View style={{ alignSelf: layout.isRTL ? 'flex-end' : 'flex-start', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <T bold size={12} style={{ color: '#fff' }}>
                  {s.tag}
                </T>
              </View>
              <T bold size={22} numberOfLines={3} style={{ color: '#fff', marginTop: 10, lineHeight: 28, maxWidth: w - 150 }}>
                {s.title}
              </T>
              <View style={{ marginTop: 'auto', alignSelf: layout.isRTL ? 'flex-end' : 'flex-start', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, minHeight: 38, justifyContent: 'center' }}>
                <T bold size={14} style={{ color: '#1E1B4B' }}>
                  {s.cta}
                </T>
              </View>
              {pet.hatched && (
                <View pointerEvents="none" style={{ position: 'absolute', bottom: -6, [layout.isRTL ? 'left' : 'right']: 0 }}>
                  <Pet pet={pet} stage={stageOf(pet, level)} size={130} interactive={false} />
                </View>
              )}
            </LinearGradient>
          </Pressable>
        ))}
      </ScrollView>
      <Row style={{ justifyContent: 'center', marginTop: 4 }}>
        {slides.map((s, i) => (
          <Pressable
            key={s.key}
            onPress={() => {
              setIndex(i);
              ref.current?.scrollTo({ x: i * w, animated: true });
            }}
            hitSlop={6}
            accessibilityLabel={t('כרטיס {n}', { n: i + 1 })}
            style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}
          >
            <View style={{ width: i === index ? 22 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? colors.primaryHi : `${colors.textMute}80` }} />
          </Pressable>
        ))}
      </Row>
    </View>
  );
}

type Action = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; colors: readonly [string, string]; onPress: () => void };

/** Four big round shortcuts under the carousel. */
export function QuickActions({ actions }: { actions: Action[] }) {
  return (
    <Row style={{ gap: 10, marginTop: 6 }}>
      {actions.map((a) => (
        <Pressable
          key={a.key}
          onPress={() => {
            tap();
            a.onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          style={({ pressed }) => ({
            flex: 1,
            height: 84,
            borderRadius: 20,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}
        >
          <LinearGradient colors={a.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={a.icon} size={18} color="#fff" />
          </LinearGradient>
          <T size={12}>{a.label}</T>
        </Pressable>
      ))}
    </Row>
  );
}

/** An entry from this day a year, a month or a week ago, if there is one. */
function findMemory(entries: Entry[]): { entry: Entry; label: string } | null {
  {
    const now = new Date();
    const back = [
      { d: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()), label: t('היום לפני שנה') },
      { d: new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()), label: t('היום לפני חודש') },
      { d: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7), label: t('היום לפני שבוע') },
    ];
    for (const b of back) {
      const k = dayKey(b.d);
      const e = entries.find((x) => dayKey(x.createdAt) === k && (x.text || x.photoUri));
      if (e) return { entry: e, label: b.label };
    }
    return null;
  }
}

export function MemoryCard({ entries, onOpen }: { entries: Entry[]; onOpen: (id: string) => void }) {
  const m = findMemory(entries);
  if (!m) return null;
  return (
    <Pressable onPress={() => onOpen(m.entry.id)} accessibilityRole="button" style={({ pressed }) => ({ marginTop: 14, opacity: pressed ? 0.85 : 1 })}>
      <Row style={{ gap: 12, alignItems: 'center', padding: 14, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
        <LinearGradient colors={['#1E3A8A', '#6D28D9']} style={{ width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="time-outline" size={24} color="#C7D2FE" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <T size={12} style={{ color: colors.primaryHi }}>
            {m.label}
          </T>
          <T bold size={14} numberOfLines={2} style={{ marginTop: 2, lineHeight: 20 }}>
            {m.entry.text ? `“${m.entry.text.slice(0, 90)}${m.entry.text.length > 90 ? '…' : ''}”` : t('📸 תמונה מאותו יום')}
          </T>
        </View>
      </Row>
    </Pressable>
  );
}

function Bar({ delay }: { delay: number }) {
  const reduced = useReducedMotion();
  const h = useSharedValue(4);
  useEffect(() => {
    if (reduced) return;
    const id = setTimeout(() => {
      h.value = withRepeat(withSequence(withTiming(14, { duration: 400, easing: Easing.inOut(Easing.sin) }), withTiming(4, { duration: 400, easing: Easing.inOut(Easing.sin) })), -1);
    }, delay);
    return () => clearTimeout(id);
  }, [reduced, delay, h]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[{ width: 3, borderRadius: 2, backgroundColor: colors.cyan }, style]} />;
}

/** The background-music strip: play / pause, with a little equaliser while it plays. */
export function MusicCard() {
  const { prefs, setPrefs } = usePrefs();
  const on = !!prefs.music;
  return (
    <Row style={{ marginTop: 12, gap: 10, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
      <Pressable
        onPress={() => setPrefs({ music: !on }, false, false)}
        accessibilityLabel={on ? t('השתק מוזיקה') : t('נגן מוזיקה')}
        hitSlop={6}
        style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primaryHi, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name={on ? 'pause' : 'play'} size={16} color="#1E1B4B" style={on ? undefined : { marginLeft: 2 }} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <T bold size={13}>
          {t('מוזיקת רקע · גשם ופסנתר')}
        </T>
        <T size={11} style={{ color: colors.textMute }}>
          {on ? t('מתנגן ברקע בזמן שכותבים') : t('כבוי · לחץ כדי לנגן')}
        </T>
      </View>
      {on && (
        <Row style={{ gap: 2, alignItems: 'flex-end', height: 14 }}>
          {[0, 200, 400, 600].map((d) => (
            <Bar key={d} delay={d} />
          ))}
        </Row>
      )}
    </Row>
  );
}

/** The next birthday or event within two weeks, for a carousel card. */
export function nextEvent(events: { id: string; title: string; date: string; yearly: boolean; kind: string }[]) {
  const now = new Date();
  const today = parseDayKey(dayKey(now)).getTime();
  let best: { title: string; kind: string; days: number } | null = null;
  for (const ev of events) {
    const d = parseDayKey(ev.date);
    let when = d;
    if (ev.yearly) {
      when = new Date(now.getFullYear(), d.getMonth(), d.getDate());
      if (when.getTime() < today) when = new Date(now.getFullYear() + 1, d.getMonth(), d.getDate());
    }
    const days = Math.round((when.getTime() - today) / 86400000);
    if (days >= 1 && days <= 14 && (!best || days < best.days)) best = { title: ev.title, kind: ev.kind, days };
  }
  return best;
}
