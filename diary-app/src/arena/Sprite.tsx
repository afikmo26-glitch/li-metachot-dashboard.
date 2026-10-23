import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleProp, View, ViewStyle } from 'react-native';
import { Anim, SHEET_FRAMES, SHEETS, View as Facing } from './assets';

type Props = {
  char: string;
  anim?: Anim;
  view?: Facing;
  size: number;
  fps?: number;
  /** play `anim` once, then call onEnd (and hold the last frame for death) */
  once?: boolean;
  onEnd?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Whether a character has its own frames for an animation (otherwise the screen fakes it with motion). */
export const hasAnim = (char: string, anim: Anim) => !!SHEET_FRAMES[char]?.[anim];

/**
 * A 3D-rendered character, played from its sprite sheets. Every sheet stays mounted (only the active one is
 * visible) so switching from idle to attack never flashes while an image decodes.
 */
export default function Sprite({ char, anim = 'idle', view = 'front', size, fps = 14, once, onEnd, style }: Props) {
  const sheets = SHEETS[char]?.[view] ?? SHEETS[char]?.front ?? {};
  const frames = SHEET_FRAMES[char] ?? {};
  const active: Anim = sheets[anim] ? anim : 'idle';
  const count = frames[active] ?? 1;
  // the frame belongs to one animation; switching animation starts it from frame 0
  const animKey = `${char}|${view}|${active}`;
  const [st, setSt] = useState({ key: animKey, f: 0 });
  const frame = st.key === animKey ? st.f : 0;
  const endRef = useRef(onEnd);
  useEffect(() => {
    endRef.current = onEnd;
  });

  useEffect(() => {
    let f = 0;
    const id = setInterval(() => {
      f++;
      if (f >= count) {
        if (once) {
          clearInterval(id);
          endRef.current?.();
          return;
        }
        f = 0;
      }
      setSt({ key: animKey, f });
    }, 1000 / fps);
    return () => clearInterval(id);
  }, [animKey, count, fps, once]);

  return (
    <View style={[{ width: size, height: size, overflow: 'hidden' }, style]} pointerEvents="none">
      {(Object.keys(sheets) as Anim[]).map((a) => {
        const n = frames[a] ?? 1;
        const on = a === active;
        return (
          <Image
            key={a}
            source={sheets[a] as number}
            fadeDuration={0}
            style={{ position: 'absolute', left: 0, top: 0, width: size * n, height: size, opacity: on ? 1 : 0, transform: [{ translateX: on ? -Math.min(frame, n - 1) * size : 0 }] }}
          />
        );
      })}
    </View>
  );
}
