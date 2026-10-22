import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { t } from '../i18n';
import { dayKey, monthName } from '../lib/dates';
import { moodByDay, moodLinks } from '../lib/insights';
import { useStore } from '../lib/store';
import { colors, layout, MOOD_LABELS, MOODS } from '../lib/theme';
import { entryTopics, topicLabel } from '../lib/topics';
import type { Topic } from '../lib/topics';
import { Card, Row, T } from './ui';

/** The mood over a month: a colored calendar, a 30-day line, and what goes with the good days. */

const moodColor = (m: number) => [colors.red, colors.orange, colors.yellow, colors.green, colors.primaryHi][Math.min(4, Math.max(0, Math.round(m) - 1))];

export default function MoodInsights({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { entries, people, studySessions } = useStore();
  const { width } = useWindowDimensions();
  const [offset, setOffset] = useState(0);
  const days = useMemo(() => moodByDay(entries), [entries]);
  const byKey = useMemo(() => new Map(days.map((d) => [d.key, d.mood])), [days]);
  const links = useMemo(
    () => moodLinks(entries, people, new Set(studySessions.map((s) => dayKey(s.start))), entryTopics, (k) => topicLabel(k as Topic)),
    [entries, people, studySessions],
  );

  const now = new Date();
  const month = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const first = month.getDay();
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  const monthMoods = cells.filter(Boolean).map((d) => byKey.get(dayKey(d as Date))).filter((x): x is number => x !== undefined);
  const monthAvg = monthMoods.length ? monthMoods.reduce((a, b) => a + b, 0) / monthMoods.length : null;

  // 30-day line
  const W = Math.min(width, 520) - 72;
  const H = 120;
  const pts = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return byKey.get(dayKey(d));
  });
  const xy = pts.map((m, i) => (m === undefined ? null : { x: layout.isRTL ? W - (i / 29) * W : (i / 29) * W, y: H - ((m - 1) / 4) * (H - 16) - 8, m }));
  const line = xy.filter(Boolean) as { x: number; y: number; m: number }[];
  const cellW = (Math.min(width, 520) - 72) / 7;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <T bold size={24}>
              {t('📊 מצב הרוח שלי')}
            </T>
            <Pressable onPress={onClose} hitSlop={12}>
              <T bold style={{ color: colors.primaryHi }}>
                {t('סגור ✕')}
              </T>
            </Pressable>
          </Row>

          <Card style={{ marginTop: 14 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Pressable onPress={() => setOffset(offset + 1)} hitSlop={10}>
                <T bold style={{ color: colors.primaryHi }}>
                  {layout.isRTL ? '→' : '←'}
                </T>
              </Pressable>
              <T bold size={17}>
                {monthName(month.getMonth())} {month.getFullYear()}
              </T>
              <Pressable onPress={() => offset > 0 && setOffset(offset - 1)} hitSlop={10} style={{ opacity: offset > 0 ? 1 : 0.3 }}>
                <T bold style={{ color: colors.primaryHi }}>
                  {layout.isRTL ? '←' : '→'}
                </T>
              </Pressable>
            </Row>
            <View style={{ flexDirection: layout.row, flexWrap: 'wrap', marginTop: 10 }}>
              {cells.map((d, i) => {
                const m = d ? byKey.get(dayKey(d)) : undefined;
                return (
                  <View key={i} style={{ width: cellW, height: cellW, padding: 3 }}>
                    {d && (
                      <View style={{ flex: 1, borderRadius: 10, backgroundColor: m !== undefined ? moodColor(m) : colors.bgDeep, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: m !== undefined ? '#1F1233' : colors.textMute }}>{d.getDate()}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
            {monthAvg !== null && (
              <T dim size={13} style={{ marginTop: 8, textAlign: 'center' }}>
                {t('ממוצע החודש: {emoji} {label} · {n} ימים', { emoji: MOODS[Math.round(monthAvg) - 1], label: t(MOOD_LABELS[Math.round(monthAvg) - 1]), n: monthMoods.length })}
              </T>
            )}
          </Card>

          <Card style={{ marginTop: 14 }}>
            <T bold style={{ marginBottom: 8 }}>
              {t('30 הימים האחרונים')}
            </T>
            {line.length < 2 ? (
              <T dim>{t('כתוב עוד כמה ימים ויופיע כאן גרף 📈')}</T>
            ) : (
              <Svg width={W} height={H}>
                {[1, 2, 3, 4, 5].map((m) => (
                  <Line key={m} x1={0} x2={W} y1={H - ((m - 1) / 4) * (H - 16) - 8} y2={H - ((m - 1) / 4) * (H - 16) - 8} stroke={colors.border} strokeWidth={1} />
                ))}
                <Polyline points={line.map((p) => `${p.x},${p.y}`).join(' ')} stroke={colors.primaryHi} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                {line.map((p, i) => (
                  <Circle key={i} cx={p.x} cy={p.y} r={4.5} fill={moodColor(p.m)} />
                ))}
              </Svg>
            )}
          </Card>

          <Card style={{ marginTop: 14 }}>
            <T bold style={{ marginBottom: 8 }}>
              {t('🔍 מה הולך עם הימים הטובים שלך')}
            </T>
            {links.length === 0 ? (
              <T dim style={{ lineHeight: 21 }}>
                {t('אחרי כמה שבועות של כתיבה (עם שינה, ספורט ואנשים) אגלה לך מה עושה לך טוב.')}
              </T>
            ) : (
              links.map((l) => (
                <T key={l} size={15} style={{ marginBottom: 6, lineHeight: 22 }}>
                  {l}
                </T>
              ))
            )}
          </Card>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
