import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Image, StyleProp, View, ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Anim, View as Facing } from './assets';
import { CHAR_ART } from './simArt';
import { reportCrash } from '../lib/cloud';
import { MODELS3D } from '../arena3d/models';
import type { Pose3 } from '../arena3d/Fighter3D';

// three.js only loads once a live 3D fighter is actually on screen
const Fighter3D = React.lazy(() => import('../arena3d/Fighter3D'));

type Props = {
  char: string;
  /** a skin id (see SKINS) drawn instead of the base look */
  skin?: string;
  anim?: Anim;
  /** kept for old call sites; the art is the same from both sides */
  view?: Facing;
  /** mirror the art so the fighter faces left (the art faces right) */
  flip?: boolean;
  size: number;
  fps?: number;
  /** play `anim` once, then call onEnd (death holds its last pose) */
  once?: boolean;
  onEnd?: () => void;
  style?: StyleProp<ViewStyle>;
  /** draw the live 3D model when this fighter has one (only for the big hero spots: one GL view each) */
  live?: boolean;
  /** bump to replay the same animation (punch after punch) */
  animId?: number;
  /** live 3D only: the special move's clip, and the lobby's relaxed loop instead of the fight stance */
  special?: string;
  lobby?: boolean;
};

/** Every fighter can play every animation: they're motion on the illustration, not frames. */
export const hasAnim = (_char: string, _anim: Anim) => true;

const DUR: Record<Anim, number> = { idle: 0, attack: 480, hit: 420, death: 750, win: 900 };
const ease = Easing.inOut(Easing.quad);

/**
 * A fighter illustration brought to life with squash-and-stretch: breathing on idle, a wind-up and lunge on
 * attack, a white flash and shake when hit, a fall on defeat and victory hops.
 */
export default function Sprite(props: Props) {
  const [failed, setFailed] = useState(false);
  const { char, skin, live } = props;
  // a skin with its own 3D model shows in 3D too; other skins fall back to their illustration
  const model = skin ? (MODELS3D[skin] ? skin : undefined) : MODELS3D[char] ? char : undefined;
  if (live && model && !failed) {
    const pose: Pose3 = props.special && props.anim === 'attack' ? 'special' : props.lobby && (props.anim ?? 'idle') === 'idle' ? 'lobby' : (props.anim ?? 'idle');
    return (
      <View style={[{ width: props.size, height: props.size }, props.style]} pointerEvents="none">
        <Guard onError={() => setFailed(true)}>
          <Suspense fallback={<Flat {...props} />}>
            <Fighter3D char={model} pose={pose} poseId={props.animId} special={props.special} flip={props.flip} once={props.once} size={props.size} onDone={() => props.once && props.onEnd?.()} />
          </Suspense>
        </Guard>
      </View>
    );
  }
  return <Flat {...props} />;
}

let reported3d = false;

/** If the 3D view can't start on this device, fall back to the illustration. */
class Guard extends React.Component<{ onError: () => void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: Error) {
    // tell us what went wrong on this phone (no personal data), once per session
    if (!reported3d) {
      reported3d = true;
      reportCrash(`3d-fail: ${e?.message ?? e}`, e?.stack).catch(() => {});
    }
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Flat({ char, skin, anim = 'idle', flip, size, once, onEnd, style }: Props) {
  const src = CHAR_ART[skin ?? char] ?? CHAR_ART[char] ?? CHAR_ART.dragon;
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const rot = useSharedValue(0);
  const op = useSharedValue(1);
  const flash = useSharedValue(0);
  const endRef = useRef(onEnd);
  useEffect(() => {
    endRef.current = onEnd;
  });

  useEffect(() => {
    for (const v of [sx, sy, tx, ty, rot, op, flash]) cancelAnimation(v);
    const fwd = flip ? -1 : 1;
    const settle = (ms: number) => {
      for (const v of [sx, sy]) v.value = withTiming(1, { duration: ms });
      for (const v of [tx, ty, rot]) v.value = withTiming(0, { duration: ms });
    };
    if (anim === 'idle') {
      settle(120);
      op.value = withTiming(1, { duration: 150 });
      sy.value = withDelay(120, withRepeat(withTiming(1.035, { duration: 850, easing: ease }), -1, true));
      sx.value = withDelay(120, withRepeat(withTiming(0.985, { duration: 850, easing: ease }), -1, true));
      ty.value = withDelay(120, withRepeat(withTiming(-size * 0.012, { duration: 850, easing: ease }), -1, true));
    } else if (anim === 'attack') {
      // wind up (squash back), lunge (stretch forward and tilt), settle
      sx.value = withSequence(withTiming(1.12, { duration: 110 }), withTiming(0.92, { duration: 120 }), withTiming(1, { duration: 250 }));
      sy.value = withSequence(withTiming(0.88, { duration: 110 }), withTiming(1.1, { duration: 120 }), withTiming(1, { duration: 250 }));
      tx.value = withSequence(withTiming(-fwd * size * 0.06, { duration: 110 }), withTiming(fwd * size * 0.2, { duration: 120 }), withTiming(0, { duration: 250, easing: ease }));
      rot.value = withSequence(withTiming(-fwd * 6, { duration: 110 }), withTiming(fwd * 10, { duration: 120 }), withTiming(0, { duration: 250 }));
    } else if (anim === 'hit') {
      flash.value = withSequence(withTiming(0.7, { duration: 40 }), withTiming(0, { duration: 220 }));
      tx.value = withSequence(...[1, -1, 0.7, -0.5, 0].map((k) => withTiming(-fwd * k * size * 0.05, { duration: 70 })));
      rot.value = withSequence(withTiming(-fwd * 9, { duration: 80 }), withTiming(0, { duration: 300, easing: ease }));
      sy.value = withSequence(withTiming(0.92, { duration: 80 }), withTiming(1, { duration: 300 }));
    } else if (anim === 'death') {
      flash.value = withSequence(withTiming(0.8, { duration: 50 }), withTiming(0, { duration: 400 }));
      rot.value = withTiming(-fwd * 78, { duration: 650, easing: Easing.in(Easing.quad) });
      ty.value = withTiming(size * 0.16, { duration: 650, easing: Easing.in(Easing.quad) });
      tx.value = withTiming(-fwd * size * 0.12, { duration: 650 });
      op.value = withDelay(350, withTiming(0.45, { duration: 400 }));
    } else if (anim === 'win') {
      const hop = () => withSequence(withTiming(-size * 0.16, { duration: 220, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) }), withTiming(0, { duration: 230 }));
      const squash = (a: number, b: number) => withSequence(withTiming(a, { duration: 220 }), withTiming(a, { duration: 200 }), withTiming(b, { duration: 90 }), withTiming(1, { duration: 140 }));
      ty.value = once ? hop() : withRepeat(hop(), -1);
      sy.value = once ? squash(1.06, 0.86) : withRepeat(squash(1.06, 0.86), -1);
      sx.value = once ? squash(0.96, 1.12) : withRepeat(squash(0.96, 1.12), -1);
    }
    if (!once || anim === 'idle') return;
    const id = setTimeout(() => endRef.current?.(), DUR[anim]);
    return () => clearTimeout(id);
  }, [anim, once, flip, size, sx, sy, tx, ty, rot, op, flash]);

  const body = useAnimatedStyle(() => ({
    opacity: op.value,
    // scale from the feet, not the middle
    transform: [{ translateX: tx.value }, { translateY: ty.value + (size * (1 - sy.value)) / 2 }, { rotate: `${rot.value}deg` }, { scaleX: sx.value * (flip ? -1 : 1) }, { scaleY: sy.value }],
  }));
  const white = useAnimatedStyle(() => ({ opacity: flash.value }));
  const shadow = useAnimatedStyle(() => ({ opacity: 0.32 * op.value, transform: [{ scaleX: 1 + (ty.value / size) * 1.2 + (sx.value - 1) }] }));

  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      <Animated.View style={[{ position: 'absolute', left: size * 0.2, right: size * 0.2, bottom: size * 0.005, height: size * 0.09, borderRadius: size, backgroundColor: '#000' }, shadow]} />
      <Animated.View style={[{ width: size, height: size }, body]}>
        <Image source={src} style={{ width: size, height: size }} resizeMode="contain" fadeDuration={0} />
        <Animated.Image source={src} style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size, tintColor: '#FFFFFF' }, white]} resizeMode="contain" fadeDuration={0} />
      </Animated.View>
    </View>
  );
}
