import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import Modal, { CloseButton } from './AppModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { colors } from '../lib/theme';
import { Chip, GhostButton, Row, T, tap } from './ui';

/** Guided breathing: a circle that grows on the in-breath and shrinks on the out-breath. */

type Pattern = { key: string; label: string; steps: { kind: 'in' | 'hold' | 'out'; secs: number }[] };

const PATTERNS: Pattern[] = [
  { key: 'calm', label: 'רגיעה 4-6', steps: [{ kind: 'in', secs: 4 }, { kind: 'out', secs: 6 }] },
  { key: 'box', label: 'נשימת קופסה', steps: [{ kind: 'in', secs: 4 }, { kind: 'hold', secs: 4 }, { kind: 'out', secs: 4 }, { kind: 'hold', secs: 4 }] },
  { key: 'sleep', label: 'לשינה 4-7-8', steps: [{ kind: 'in', secs: 4 }, { kind: 'hold', secs: 7 }, { kind: 'out', secs: 8 }] },
];
const LABELS = { in: 'שאיפה…', hold: 'החזק…', out: 'נשיפה…' };
const MINUTES = [1, 3, 5];

export default function Breathing({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [pattern, setPattern] = useState(PATTERNS[0]);
  const [minutes, setMinutes] = useState(1);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');
  const [left, setLeft] = useState(0);
  const scale = useRef(new Animated.Value(0.55)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    scale.stopAnimation();
    setRunning(false);
  };

  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    tap('medium');
    setRunning(true);
    const end = Date.now() + minutes * 60000;
    let i = 0;
    const next = () => {
      if (Date.now() >= end) {
        stop();
        setLeft(0);
        return;
      }
      const step = pattern.steps[i % pattern.steps.length];
      i++;
      setPhase(step.kind);
      setLeft(Math.ceil((end - Date.now()) / 1000));
      if (step.kind !== 'hold') {
        Animated.timing(scale, { toValue: step.kind === 'in' ? 1 : 0.55, duration: step.secs * 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }).start();
      }
      timer.current = setTimeout(next, step.secs * 1000);
    };
    next();
  };

  const close = () => {
    stop();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: 22 }}>
        <CloseButton onPress={close} />
        <T bold size={26} style={{ textAlign: 'center', marginTop: 10 }}>
          {t('🌬️ רגע לנשום')}
        </T>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View
            style={{
              width: 260,
              height: 260,
              borderRadius: 130,
              backgroundColor: colors.primary + '55',
              borderWidth: 3,
              borderColor: colors.primaryHi,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale }],
            }}
          >
            <Text style={{ color: colors.text, fontSize: 26, fontWeight: '700' }}>{running ? t(LABELS[phase]) : '🫁'}</Text>
          </Animated.View>
          {running && (
            <T dim style={{ marginTop: 30 }}>
              {t('עוד {s} שניות', { s: left })}
            </T>
          )}
        </View>
        {!running ? (
          <>
            <Row style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
              {PATTERNS.map((p) => (
                <Chip key={p.key} label={t(p.label)} active={pattern.key === p.key} onPress={() => setPattern(p)} />
              ))}
            </Row>
            <Row style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
              {MINUTES.map((m) => (
                <Chip key={m} label={t('{n} דק׳', { n: m })} active={minutes === m} onPress={() => setMinutes(m)} />
              ))}
            </Row>
            <GhostButton title={t('▶️ התחל')} onPress={start} style={{ marginTop: 8 }} />
          </>
        ) : (
          <GhostButton title={t('⏸️ עצור')} onPress={stop} />
        )}
      </SafeAreaView>
    </Modal>
  );
}
