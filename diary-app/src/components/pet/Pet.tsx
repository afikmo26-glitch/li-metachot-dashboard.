import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { GestureDetector, useCompetingGestures, useLongPressGesture, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { PetState, Stage } from '../../lib/pet';
import { STAGE_SCALE } from '../../lib/pet';
import { Arm, Body, Cheeks, Eye, Face, Glasses, Hair, HairBack, HappyEye, Hat, Mouth, Neck, OpenMouth, palette, SleepEye, SpeciesBack, SpeciesFront, Tongue } from './art';
import { Egg } from './Egg';

/**
 * The living pet. It breathes, blinks, looks around and sticks its tongue out on its own; follows your finger,
 * closes its eyes happily when petted, squishes into a hug on a long press and hops when tapped.
 * Everything moves on the UI thread (Reanimated); React only re-renders for hearts and the treat.
 */

export type PetHandle = { feed: () => void; wave: () => void; tongue: () => void; celebrate: () => void; hug: () => void };

type Props = {
  pet: Pick<PetState, 'species' | 'wear' | 'hatched' | 'eggTaps'>;
  stage: Stage;
  size: number;
  sleeping?: boolean;
  /** Full gestures (petting, hugging); off for the small pet on the home screen */
  interactive?: boolean;
  onTap?: () => void;
  onStroke?: () => void;
  onHug?: () => void;
  onEggTap?: () => void;
  ref?: React.Ref<PetHandle>;
};

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
const BREATH = Easing.inOut(Easing.sin);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export default function Pet({ pet, stage, size, sleeping, interactive = true, onTap, onStroke, onHug, onEggTap, ref }: Props) {
  const reduced = useReducedMotion();
  const S = size * STAGE_SCALE[stage];
  const u = S / 200;
  const uid = useRef(`p${Math.random().toString(36).slice(2, 8)}`).current;
  const p = palette(pet.wear.color, uid);
  const [awake, setAwake] = useState(false);
  const dozing = !!sleeping && !awake;

  const breath = useSharedValue(0);
  const sway = useSharedValue(0);
  const blink = useSharedValue(0);
  const tongue = useSharedValue(0);
  const happy = useSharedValue(0);
  const blush = useSharedValue(0);
  const squish = useSharedValue(0);
  const hop = useSharedValue(0);
  const lookX = useSharedValue(0);
  const lookY = useSharedValue(0);
  const wave = useSharedValue(0);
  const chomp = useSharedValue(0);
  const dist = useSharedValue(0);
  const petting = useSharedValue(0);

  // Breathing and a gentle sway, always on (slower and deeper while asleep)
  useEffect(() => {
    breath.set(0);
    breath.set(withRepeat(withTiming(1, { duration: dozing ? 2600 : 1700, easing: BREATH }), -1, true));
    if (!reduced && !dozing) sway.set(withRepeat(withSequence(withTiming(1, { duration: 2400, easing: BREATH }), withTiming(-1, { duration: 2400, easing: BREATH })), -1));
    else sway.set(withTiming(0, { duration: 400 }));
    return () => {
      cancelAnimation(breath);
      cancelAnimation(sway);
    };
  }, [dozing, reduced, breath, sway]);

  // Life: blinking, glancing around, a tongue now and then
  useEffect(() => {
    if (dozing || stage === 'egg') return;
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(() => alive && fn(), ms));
    const doBlink = () => {
      const twice = Math.random() < 0.2;
      blink.set(
        twice
          ? withSequence(withTiming(1, { duration: 70 }), withTiming(0, { duration: 90 }), withTiming(1, { duration: 70 }), withTiming(0, { duration: 110 }))
          : withSequence(withTiming(1, { duration: 70 }), withTiming(0, { duration: 120 })),
      );
      later(doBlink, rand(2200, 5200));
    };
    const doLook = () => {
      if (!petting.get()) {
        const x = rand(-1, 1);
        lookX.set(withSequence(withTiming(x, { duration: 280, easing: EASE_IN_OUT }), withDelay(rand(600, 1400), withTiming(0, { duration: 320, easing: EASE_IN_OUT }))));
        lookY.set(withSequence(withTiming(rand(-0.6, 0.6), { duration: 280 }), withDelay(900, withTiming(0, { duration: 320 }))));
      }
      later(doLook, rand(3500, 7000));
    };
    const doTongue = () => {
      if (!petting.get()) blep();
      later(doTongue, rand(9000, 16000));
    };
    later(doBlink, rand(800, 2500));
    later(doLook, rand(2000, 4000));
    later(doTongue, rand(4000, 8000));
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dozing, stage]);

  // Woken up by a tap at night: stays up a little, then dozes off again
  useEffect(() => {
    if (!awake) return;
    const t = setTimeout(() => setAwake(false), 20000);
    return () => clearTimeout(t);
  }, [awake]);

  const blep = useCallback(() => {
    tongue.set(withSequence(withTiming(1, { duration: 180, easing: EASE_OUT }), withDelay(900, withTiming(0, { duration: 220, easing: EASE_IN_OUT }))));
  }, [tongue]);

  // ---- Hearts ----
  const [hearts, setHearts] = useState<{ id: number; x: number; emoji: string }[]>([]);
  const heartId = useRef(0);
  const burst = useCallback((n = 1, emoji = '💗') => {
    setHearts((h) => [...h.slice(-12), ...Array.from({ length: n }, () => ({ id: ++heartId.current, x: rand(0.2, 0.8), emoji }))]);
  }, []);
  const dropHeart = useCallback((id: number) => setHearts((h) => h.filter((x) => x.id !== id)), []);

  // ---- Treat ----
  const [treat, setTreat] = useState(0);
  const treatY = useSharedValue(0);

  useImperativeHandle(
    ref,
    () => ({
      feed: () => {
        setTreat((n) => n + 1);
        treatY.set(0);
        treatY.set(withTiming(1, { duration: 650, easing: EASE_OUT }));
        setTimeout(() => {
          happy.set(withSequence(withTiming(1, { duration: 120 }), withDelay(1300, withTiming(0, { duration: 300 }))));
          chomp.set(withSequence(...[0, 1, 2].flatMap(() => [withTiming(1, { duration: 140 }), withTiming(0, { duration: 140 })])));
          setTreat(0);
          burst(4, '💗');
        }, 650);
      },
      wave: () => {
        wave.set(withSequence(...[0, 1, 2].flatMap(() => [withTiming(1, { duration: 180 }), withTiming(0, { duration: 180 })])));
      },
      tongue: blep,
      hug: () => {
        squish.set(withSequence(withSpring(1, { duration: 300, dampingRatio: 0.6 }), withDelay(700, withSpring(0, { duration: 450, dampingRatio: 0.45 }))));
        blush.set(withSequence(withTiming(1, { duration: 250 }), withDelay(900, withTiming(0, { duration: 600 }))));
        happy.set(withSequence(withTiming(1, { duration: 150 }), withDelay(900, withTiming(0, { duration: 300 }))));
        burst(5);
      },
      celebrate: () => {
        hop.set(withSequence(withTiming(1, { duration: 200, easing: EASE_OUT }), withSpring(0, { duration: 500, dampingRatio: 0.5 })));
        happy.set(withSequence(withTiming(1, { duration: 120 }), withDelay(1500, withTiming(0, { duration: 300 }))));
        burst(8, '✨');
      },
    }),
    [blep, blush, burst, chomp, happy, hop, squish, treatY, wave],
  );

  // ---- Gestures (worklets) ----
  const stroked = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    burst(1);
    onStroke?.();
  }, [burst, onStroke]);
  const hugged = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    burst(5);
    onHug?.();
  }, [burst, onHug]);
  const tapped = useCallback(() => {
    if (dozing) setAwake(true);
    else if (Math.random() < 0.4) blep();
    onTap?.();
  }, [blep, dozing, onTap]);

  const pan = usePanGesture({
    minDistance: 4,
    onBegin: () => {
      'worklet';
      dist.set(0);
    },
    onUpdate: (e) => {
      'worklet';
      if (!petting.get()) {
        petting.set(1);
        happy.set(withTiming(1, { duration: 150 }));
        blush.set(withTiming(1, { duration: 250 }));
      }
      lookX.set(Math.max(-1, Math.min(1, (e.x / S - 0.5) * 2)));
      lookY.set(Math.max(-1, Math.min(1, (e.y / S - 0.5) * 2)));
      dist.set(dist.get() + Math.abs(e.changeX) + Math.abs(e.changeY));
      if (dist.get() > 80) {
        dist.set(0);
        scheduleOnRN(stroked);
      }
    },
    onFinalize: () => {
      'worklet';
      petting.set(0);
      happy.set(withDelay(450, withTiming(0, { duration: 300 })));
      blush.set(withDelay(900, withTiming(0, { duration: 600 })));
      lookX.set(withSpring(0, { duration: 400, dampingRatio: 1 }));
      lookY.set(withSpring(0, { duration: 400, dampingRatio: 1 }));
    },
  });
  const press = useLongPressGesture({
    minDuration: 450,
    maxDistance: 14,
    onActivate: () => {
      'worklet';
      squish.set(withSpring(1, { duration: 300, dampingRatio: 0.6 }));
      happy.set(withTiming(1, { duration: 150 }));
      blush.set(withTiming(1, { duration: 250 }));
      scheduleOnRN(hugged);
    },
    onFinalize: () => {
      'worklet';
      squish.set(withSpring(0, { duration: 450, dampingRatio: 0.45 }));
      happy.set(withDelay(300, withTiming(0, { duration: 300 })));
      blush.set(withDelay(800, withTiming(0, { duration: 600 })));
    },
  });
  const tap = useTapGesture({
    maxDuration: 250,
    onActivate: () => {
      'worklet';
      hop.set(withSequence(withTiming(1, { duration: 170, easing: EASE_OUT }), withSpring(0, { duration: 450, dampingRatio: 0.55 })));
      scheduleOnRN(tapped);
    },
  });
  const gesture = useCompetingGestures(pan, press, tap);
  const tapOnly = useTapGesture({
    maxDuration: 400,
    onActivate: () => {
      'worklet';
      hop.set(withSequence(withTiming(1, { duration: 170, easing: EASE_OUT }), withSpring(0, { duration: 450, dampingRatio: 0.55 })));
      scheduleOnRN(tapped);
    },
  });

  // ---- Styles ----
  const bodyStyle = useAnimatedStyle(() => {
    const b = breath.get();
    const sq = squish.get();
    const amp = reduced ? 0.5 : 1;
    return {
      transform: [
        { translateY: -hop.get() * (reduced ? 4 : 22) * u },
        { rotate: `${sway.get() * 1.6 + lookX.get() * 2}deg` },
        { scaleX: 1 - 0.014 * b * amp + 0.12 * sq + 0.03 * chomp.get() },
        { scaleY: 1 + 0.034 * b * amp - 0.1 * sq - 0.03 * chomp.get() },
      ],
    };
  });
  const eyesStyle = useAnimatedStyle(() => ({
    opacity: 1 - happy.get(),
    transform: [{ translateX: lookX.get() * 3 * u }, { translateY: lookY.get() * 2.4 * u }, { scaleY: 1 - 0.9 * blink.get() }],
  }));
  const happyEyesStyle = useAnimatedStyle(() => ({ opacity: happy.get() }));
  const mouthStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.max(happy.get(), chomp.get()) }));
  const openMouthStyle = useAnimatedStyle(() => ({
    opacity: Math.max(happy.get(), chomp.get()),
    transform: [{ scaleY: 1 - 0.5 * chomp.get() }],
  }));
  const tongueStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: tongue.get() }], opacity: tongue.get() > 0.02 ? 1 - happy.get() : 0 }));
  const cheeksStyle = useAnimatedStyle(() => ({ opacity: 0.45 + 0.55 * blush.get() }));
  const leftArm = useAnimatedStyle(() => ({ transform: [{ rotate: `${18 - 78 * squish.get()}deg` }] }));
  const rightArm = useAnimatedStyle(() => ({ transform: [{ rotate: `${-18 + 78 * squish.get() - 120 * wave.get()}deg` }] }));
  const treatStyle = useAnimatedStyle(() => ({
    opacity: treatY.get() < 0.98 ? 1 : 0,
    transform: [{ translateY: (1 - treatY.get()) * 90 * u }, { scale: 1 - 0.45 * treatY.get() }],
  }));

  if (stage === 'egg') {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
        <Egg size={size * 0.8} taps={pet.eggTaps} onTap={onEggTap} />
      </View>
    );
  }

  const E = 24 * u;
  const eyeBox = (cx: number) => ({ position: 'absolute' as const, left: (cx - 12) * u, top: (108 - 14.5) * u, width: E, height: E * 1.2 });
  const at = (x: number, y: number, w: number, h: number) => ({ position: 'absolute' as const, left: x * u, top: y * u, width: w * u, height: h * u });

  const body = (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View style={{ width: S, height: S }}>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: S, height: S, transformOrigin: '50% 92%' }, bodyStyle]}>
          <HairBack id={pet.wear.hair} size={S} />
          <SpeciesBack species={pet.species} p={p} size={S} />
          <Body p={p} color={pet.wear.color} uid={uid} size={S} />
          <Hair id={pet.wear.hair} size={S} p={p} />
          <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: S, height: S }, cheeksStyle]} pointerEvents="none">
            <Cheeks size={S} />
          </Animated.View>
          {dozing ? (
            <>
              <View style={eyeBox(76)}>
                <SleepEye size={E} />
              </View>
              <View style={eyeBox(124)}>
                <SleepEye size={E} />
              </View>
            </>
          ) : (
            <>
              <Animated.View style={[eyeBox(76), { transformOrigin: '50% 60%' }, eyesStyle]}>
                <Eye size={E} night={pet.wear.color === 'night'} />
              </Animated.View>
              <Animated.View style={[eyeBox(124), { transformOrigin: '50% 60%' }, eyesStyle]}>
                <Eye size={E} night={pet.wear.color === 'night'} />
              </Animated.View>
              <Animated.View style={[eyeBox(76), happyEyesStyle]}>
                <HappyEye size={E} />
              </Animated.View>
              <Animated.View style={[eyeBox(124), happyEyesStyle]}>
                <HappyEye size={E} />
              </Animated.View>
            </>
          )}
          <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: S, height: S }, mouthStyle]} pointerEvents="none">
            <Mouth size={S} />
          </Animated.View>
          <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: S, height: S, transformOrigin: '50% 64%' }, openMouthStyle]} pointerEvents="none">
            <OpenMouth size={S} />
          </Animated.View>
          <Animated.View style={[at(92, 129, 16, 18.4), { transformOrigin: 'top' }, tongueStyle]} pointerEvents="none">
            <Tongue size={16 * u} />
          </Animated.View>
          <Face id={pet.wear.face} size={S} />
          <SpeciesFront species={pet.species} size={S} />
          <Glasses id={pet.wear.glasses} size={S} />
          <Neck id={pet.wear.neck} size={S} />
          <Hat id={pet.wear.hat} size={S} />
          <Animated.View style={[at(30, 124, 18, 28.8), { transformOrigin: 'top' }, leftArm]} pointerEvents="none">
            <Arm size={18 * u} color={p.shade} />
          </Animated.View>
          <Animated.View style={[at(152, 124, 18, 28.8), { transformOrigin: 'top' }, rightArm]} pointerEvents="none">
            <Arm size={18 * u} color={p.shade} />
          </Animated.View>
        </Animated.View>
        {treat > 0 && (
          <Animated.View style={[at(86, 118, 28, 28), treatStyle]} pointerEvents="none">
            <Text style={{ fontSize: 24 * u, textAlign: 'center' }}>🍪</Text>
          </Animated.View>
        )}
      </View>
      {dozing && <Zzz size={S} />}
      {hearts.map((h) => (
        <FloatingHeart key={h.id} id={h.id} x={h.x * size} size={size} emoji={h.emoji} onDone={dropHeart} />
      ))}
    </View>
  );

  return <GestureDetector gesture={interactive ? gesture : tapOnly}>{body}</GestureDetector>;
}

function FloatingHeart({ id, x, size, emoji, onDone }: { id: number; x: number; size: number; emoji: string; onDone: (id: number) => void }) {
  const t = useSharedValue(0);
  const drift = useRef(rand(-24, 24)).current;
  useEffect(() => {
    t.set(withTiming(1, { duration: 1300, easing: EASE_OUT }));
    const timer = setTimeout(() => onDone(id), 1350);
    return () => clearTimeout(timer);
  }, [id, onDone, t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.get() < 0.7 ? 1 : 1 - (t.get() - 0.7) / 0.3,
    transform: [{ translateY: -t.get() * size * 0.45 }, { translateX: drift * t.get() }, { scale: 0.7 + 0.5 * t.get() }],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', left: x - 12, top: size * 0.35 }, style]} pointerEvents="none">
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
    </Animated.View>
  );
}

function Zzz({ size }: { size: number }) {
  return (
    <View style={{ position: 'absolute', right: size * 0.08, top: size * 0.05 }} pointerEvents="none">
      {[0, 1, 2].map((i) => (
        <Z key={i} delay={i * 900} size={14 + i * 5} />
      ))}
    </View>
  );
}

function Z({ delay, size }: { delay: number; size: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delay, withRepeat(withTiming(1, { duration: 2700, easing: Easing.linear }), -1)));
    return () => cancelAnimation(t);
  }, [delay, t]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.sin(t.get() * Math.PI),
    transform: [{ translateY: -t.get() * 40 }, { translateX: t.get() * 14 }],
  }));
  return (
    <Animated.Text style={[{ position: 'absolute', fontSize: size, fontWeight: '800', color: '#C4B5FD' }, style]} pointerEvents="none">
      z
    </Animated.Text>
  );
}
