import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, Platform, StyleProp, View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type Spark = { id: number; x: number; y: number; color: string; big: boolean };

/** One burst where a finger touched: a ring that pops out and a handful of star sparks flying off. */
export function Burst({ x, y, color = '#FDE047', big = false, onDone }: { x: number; y: number; color?: string; big?: boolean; onDone: () => void }) {
  const v = useSharedValue(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    v.value = withTiming(1, { duration: big ? 520 : 380, easing: Easing.out(Easing.cubic) });
    const id = setTimeout(() => done.current(), big ? 540 : 400);
    return () => clearTimeout(id);
  }, [v, big]);
  const R = big ? 70 : 44;
  const ring = useAnimatedStyle(() => ({ opacity: 1 - v.value, transform: [{ scale: 0.2 + v.value }] }));
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: R * 2, height: R * 2, borderRadius: R, borderWidth: big ? 5 : 3, borderColor: color }, ring]} />
      {Array.from({ length: big ? 9 : 6 }, (_, i) => (
        <Ray key={i} v={v} angle={(i / (big ? 9 : 6)) * Math.PI * 2 + (i % 2) * 0.3} dist={R * (0.9 + (i % 3) * 0.25)} color={i % 2 ? '#FFFFFF' : color} size={big ? 12 : 8} />
      ))}
    </View>
  );
}

function Ray({ v, angle, dist, color, size }: { v: ReturnType<typeof useSharedValue<number>>; angle: number; dist: number; color: string; size: number }) {
  const st = useAnimatedStyle(() => ({
    opacity: 1 - v.value,
    transform: [{ translateX: Math.cos(angle) * dist * v.value }, { translateY: Math.sin(angle) * dist * v.value }, { rotate: `${45 + v.value * 90}deg` }, { scale: 1 - v.value * 0.6 }],
  }));
  return <Animated.View style={[{ position: 'absolute', width: size, height: size, backgroundColor: color, borderRadius: 2 }, st]} />;
}

/** Remembers bursts to draw; `add` spawns one. */
export function useBursts() {
  const [list, setList] = useState<Spark[]>([]);
  const next = useRef(1);
  const add = useCallback((x: number, y: number, color = '#FDE047', big = false) => {
    const id = next.current++;
    setList((l) => [...l.slice(-10), { id, x, y, color, big }]);
  }, []);
  const layer = list.map((s) => <Burst key={s.id} x={s.x} y={s.y} color={s.color} big={s.big} onDone={() => setList((l) => l.filter((k) => k.id !== s.id))} />);
  return { add, layer };
}

/**
 * Wraps the whole game: every touch anywhere draws a little burst under the finger. It only listens, so
 * buttons underneath still get their presses.
 */
export function TapLayer({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { add, layer } = useBursts();
  const onTouch = (e: GestureResponderEvent) => {
    const t = e.nativeEvent.touches?.[0] ?? e.nativeEvent;
    add(t.pageX, t.pageY, '#FFFFFF');
  };
  // the web has no touch events for a mouse; listen to mouse down there instead
  const web = Platform.OS === 'web' ? ({ onMouseDown: (e: { nativeEvent: { pageX: number; pageY: number } }) => add(e.nativeEvent.pageX, e.nativeEvent.pageY, '#FFFFFF') } as object) : {};
  return (
    <View style={[{ flex: 1 }, style]} onTouchStart={Platform.OS === 'web' ? undefined : onTouch} {...web}>
      {children}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
        {layer}
      </View>
    </View>
  );
}
