import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, runOnJS, SharedValue, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { notify } from '../../components/ui';
import { play as sfx } from '../../lib/sound';
import { Anim } from '../assets';
import { assist, Battle, drain, MAX_ENERGY, newBattle, play, Side, starsOf, tap, tick } from '../battle';
import { useBursts } from '../TapFx';
import { ELEMENTS, MOVES, MoveId, SPECIES } from '../data';
import { WORLD_ART } from '../simArt';
import { Fighter } from '../progress';
import Sprite from '../Sprite';
import { SPECIAL_CLIP } from '../../arena3d/Fighter3D';
import { GL, GT, ItemIcon, MOVE_ICON } from '../ui';

export type BattleResult = { win: boolean; stars: number; hpLeft: number };

type Floater = { id: number; side: Side; text: string; color: string; big?: boolean; dx: number };
type Fx = { id: number; move: MoveId; from: Side };

/**
 * The duel: your fighter stands bottom-left facing right, the opponent top-right facing you, on the world's
 * arena; cards along the bottom spend energy on moves.
 */
export default function BattleScreen({ me, foe, foeName, skill, guards = [], onEnd, bg = 'arena_forest' }: { me: Fighter; foe: Fighter; foeName: string; skill: number; guards?: string[]; onEnd: (r: BattleResult) => void; bg?: string }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const bRef = useRef<Battle>(newBattle({ ...me, handicap: 1 + guards.length * 0.04 }, foe, skill));
  const b = bRef.current;
  const [, setFrame] = useState(0);
  const [count, setCount] = useState(3);
  const [anim, setAnim] = useState<[Anim, Anim]>(['idle', 'idle']);
  const [animIds, setAnimIds] = useState<[number, number]>([0, 0]);
  const [specials, setSpecials] = useState<[string | undefined, string | undefined]>([undefined, undefined]);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [fx, setFx] = useState<Fx[]>([]);
  const [banner, setBanner] = useState<{ id: number; text: string; color: string } | null>(null);
  const ended = useRef(false);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  });

  // where each fighter stands on screen: a diagonal, so they face each other across the arena floor
  const pos: [{ x: number; y: number }, { x: number; y: number }] = [
    { x: width * 0.3, y: height * 0.65 },
    { x: width * (guards.length ? 0.6 : 0.7), y: height * 0.47 },
  ];
  const bursts = useBursts();
  const [combo, setCombo] = useState(0);
  const [guardHit, setGuardHit] = useState<{ i: number; id: number } | null>(null);
  const [tapped, setTapped] = useState(false);
  const lunge = [useSharedValue(0), useSharedValue(0)];
  const flash = [useSharedValue(0), useSharedValue(0)];
  const shake = useSharedValue(0);
  const screenFlash = useSharedValue(0);

  // 3-2-1 countdown, then the loop runs at 20 fps
  useEffect(() => {
    if (count <= 0) return;
    sfx('tap', 0.5);
    const id = setTimeout(() => setCount((c) => c - 1), 750);
    return () => clearTimeout(id);
  }, [count]);

  useEffect(() => {
    if (count > 0) return;
    const DT = 0.05;
    const guardAt = guards.slice(0, 3).map((_, i) => 3 + i * 3);
    const id = setInterval(() => {
      tick(b, DT);
      guardAt.forEach((at, i) => {
        if (b.t >= at && !b.over) {
          assist(b, i);
          guardAt[i] = at + 9;
        }
      });
      const events = drain(b);
      for (const e of events) {
        if (e.kind === 'hit') {
          const from = (e.side === 0 ? 1 : 0) as Side;
          lunge[from].value = withSequence(withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 9 }));
          flash[e.side].value = withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 220 }));
          if (e.guard !== undefined) {
            // a guard's strike: its card lights up, sparks in its element's colour fly off the opponent
            const g = guards[e.guard];
            setGuardHit({ i: e.guard, id: e.id });
            bursts.add(pos[1].x, pos[1].y - 40, g ? ELEMENTS[SPECIES[g as keyof typeof SPECIES]?.element ?? 'fire'].color : '#FDE047', true);
            setAnimFor(1, 'hit');
          } else if (e.tap) {
            // a tap: quick jab, the target flinches, sparks fly off it
            lunge[0].value = withSequence(withTiming(0.6, { duration: 60 }), withTiming(0, { duration: 140 }));
            setAnimFor(0, 'attack');
            if ((e.combo ?? 0) % 3 === 0) setAnimFor(1, 'hit');
            const tp = pos[1];
            bursts.add(tp.x + (Math.random() - 0.5) * 60, tp.y - 30 + (Math.random() - 0.5) * 60, e.crit ? '#FDE047' : '#FB923C', e.crit);
            setCombo(e.combo ?? 0);
          } else {
            setAnimFor(from, 'attack');
            setTimeout(() => setAnimFor(e.side, 'hit'), 140);
            bursts.add(pos[e.side].x, pos[e.side].y - 30, e.move ? MOVES[e.move].color : '#FFFFFF', true);
          }
          addFloat(e.side, `-${e.amount}`, e.crit ? '#FDE047' : e.strong ? '#FB923C' : '#FFFFFF', e.crit || !!e.move);
          if (e.crit) addFloat(e.side, e.tap ? `קומבו ×${e.combo}!` : 'קריטי!', '#FDE047', false);
          sfx('tap', e.move ? 0.6 : e.tap ? 0.18 : 0.35);
        } else if (e.kind === 'move') {
          const m = MOVES[e.move];
          setFx((f) => [...f.slice(-3), { id: e.id, move: e.move, from: e.side }]);
          setBanner({ id: e.id, text: m.name, color: m.color });
          setAnimFor(e.side, 'attack', SPECIAL_CLIP[m.element ?? SPECIES[b.c[e.side].fighter.species].element]);
          sfx('whoosh', 0.5);
          if (e.move === 'thunder' || e.move === 'quake' || e.move === 'smash') {
            shake.value = withSequence(withTiming(1, { duration: 50 }), withTiming(-1, { duration: 50 }), withTiming(1, { duration: 50 }), withTiming(0, { duration: 80 }));
            screenFlash.value = withSequence(withTiming(e.move === 'thunder' ? 0.7 : 0.35, { duration: 60 }), withTiming(0, { duration: 300 }));
          }
        } else if (e.kind === 'heal') addFloat(e.side, `+${e.amount}`, '#4ADE80', true);
        else if (e.kind === 'blocked') addFloat(e.side, 'נחסם!', '#6EE7B7', true);
        else if (e.kind === 'burn') addFloat(e.side, `-${e.amount}`, '#FB923C', false);
      }
      setFrame((n) => n + 1);
      if (b.over && !ended.current) {
        ended.current = true;
        clearInterval(id);
        const win = b.winner === 0;
        setAnim(win ? ['win', 'death'] : ['death', 'win']);
        if (win) {
          sfx('levelup', 0.6);
          notify('success');
        } else sfx('error', 0.5);
        setTimeout(() => onEndRef.current({ win, stars: starsOf(b), hpLeft: b.c[0].hp / b.c[0].maxHp }), 2200);
      }
    }, DT * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  function setAnimFor(side: Side, a: Anim, special?: string) {
    setAnim((cur) => {
      const n: [Anim, Anim] = [...cur] as [Anim, Anim];
      n[side] = a;
      return n;
    });
    // replay even when the same animation is already playing (punch, punch, punch)
    setAnimIds((cur) => (side === 0 ? [cur[0] + 1, cur[1]] : [cur[0], cur[1] + 1]));
    setSpecials((cur) => (side === 0 ? [special, cur[1]] : [cur[0], special]));
  }
  function addFloat(side: Side, text: string, color: string, big: boolean) {
    const id = Math.random();
    setFloaters((f) => [...f.slice(-8), { id, side, text, color, big, dx: Math.random() * 60 - 30 }]);
  }

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value * 8 }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: screenFlash.value }));
  const me0 = b.c[0];
  const foe1 = b.c[1];
  const secs = Math.max(0, Math.ceil(b.limit - b.t));

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0620' }}>
      <Animated.View style={[StyleSheet.absoluteFill, shakeStyle]}>
        <Image source={WORLD_ART[bg] ?? WORLD_ART.arena_forest} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }} resizeMode="cover" />
        {[1, 0].map((sd) => {
          const side = sd as Side;
          const c = b.c[side];
          const sp = SPECIES[c.fighter.species];
          const size = Math.min(210, width * 0.5) * (sp.scale ?? 1);
          const p = pos[side];
          const frozen = b.t < c.freezeUntil;
          const stunned = b.t < c.stunUntil;
          const burning = b.t < c.burnUntil;
          return (
            <FighterView
              key={side}
              side={side}
              char={c.fighter.species}
              anim={anim[side]}
              size={size}
              x={p.x}
              y={p.y}
              lunge={lunge[side]}
              flash={flash[side]}
              hp={c.hp / c.maxHp}
              level={c.fighter.level}
              name={side === 0 ? c.fighter.name : foeName}
              element={sp.element}
              frozen={frozen}
              stunned={stunned}
              burning={burning}
              shield={c.shield}
              skin={side === 0 ? me.skin : foe.skin}
              animId={animIds[side]}
              special={specials[side]}
              onAnimEnd={() => !b.over && setAnimFor(side, 'idle')}
            />
          );
        })}
        {fx.map((f) => (
          <MoveFx key={f.id} move={f.move} from={pos[f.from]} to={pos[f.from === 0 ? 1 : 0]} self={MOVES[f.move].power === 0} onDone={() => setFx((all) => all.filter((x) => x.id !== f.id))} />
        ))}
        {floaters.map((f) => (
          <FloatNum key={f.id} f={f} x={pos[f.side].x + f.dx} y={pos[f.side].y - 120} onDone={() => setFloaters((all) => all.filter((x) => x.id !== f.id))} />
        ))}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#FEF9C3' }, flashStyle]} />
      {/* your guards: a column on the right, each with what it adds and a strike every few seconds */}
      {guards.length > 0 && (
        <View pointerEvents="none" style={{ position: 'absolute', right: 6, top: insets.top + 92, gap: 8 }}>
          {guards.slice(0, 3).map((g, i) => {
            const sp = SPECIES[g as keyof typeof SPECIES];
            const el = sp ? ELEMENTS[sp.element] : ELEMENTS.fire;
            const lit = guardHit?.i === i;
            return (
              <View key={g} style={{ width: 72, borderRadius: 14, borderWidth: 3, borderColor: lit ? '#FDE047' : el.color, backgroundColor: lit ? 'rgba(253,224,71,0.35)' : 'rgba(10,5,25,0.72)', alignItems: 'center', paddingBottom: 3, overflow: 'hidden' }}>
                <Sprite key={lit ? guardHit?.id : 'idle'} char={g} anim={lit ? 'attack' : 'idle'} once={lit} size={54} />
                <GL size={9} color="#FDE68A">⚔️+4%  ❤️+4%</GL>
              </View>
            );
          })}
          <GL size={9} color="#E9D5FF" style={{ textAlign: 'center' }}>שומרים</GL>
        </View>
      )}
      {/* tap anywhere on the arena to hit */}
      <View
        accessibilityLabel="הכה"
        onStartShouldSetResponder={() => true}
        onResponderGrant={() => {
          if (count > 0 || b.over) return;
          if (tap(b) && !tapped) setTapped(true);
        }}
        style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 70, bottom: insets.bottom + 170 }}
      />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {bursts.layer}
      </View>
      {combo >= 3 && !b.over && (
        <View pointerEvents="none" style={{ position: 'absolute', top: height * 0.2, left: 0, right: 0, alignItems: 'center' }}>
          <GT key={combo} size={combo >= 20 ? 40 : combo >= 10 ? 34 : 28} color={combo >= 20 ? '#F472B6' : combo >= 10 ? '#FDE047' : '#FFFFFF'}>{`×${combo} קומבו`}</GT>
        </View>
      )}
      {count <= 0 && !tapped && !b.over && (
        <View pointerEvents="none" style={{ position: 'absolute', top: height * 0.24, left: 0, right: 0, alignItems: 'center' }}>
          <GT size={24} color="#FDE047">👆 הקש מהר כדי להכות!</GT>
        </View>
      )}

      {/* top bar: opponent and clock */}
      <LinearGradient colors={['rgba(20,8,40,0.92)', 'rgba(20,8,40,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 8, paddingHorizontal: 12, paddingBottom: 18, flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <GT size={16} style={{ textAlign: 'right' }}>
            {foeName}
          </GT>
          <GL size={11} color="#FBCFE8" style={{ textAlign: 'right' }}>{`${SPECIES[foe1.fighter.species].name} · רמה ${foe1.fighter.level} · ${ELEMENTS[SPECIES[foe1.fighter.species].element].label}`}</GL>
        </View>
        <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 2, borderColor: secs <= 10 ? '#F87171' : '#FDE68A' }}>
          <GT size={18} color={secs <= 10 ? '#FCA5A5' : '#FDE68A'}>{`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}</GT>
        </View>
      </LinearGradient>

      {banner && <Banner key={banner.id} text={banner.text} color={banner.color} />}

      {/* bottom: energy and the four cards */}
      <LinearGradient colors={['rgba(20,8,40,0)', 'rgba(20,8,40,0.95)']} locations={[0, 0.25]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + 10, paddingTop: 26, paddingHorizontal: 10 }}>
        <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
          {me0.deck.map((m) => {
            const mv = MOVES[m];
            const cooling = mv.effect === 'heal' && b.t < me0.healReadyAt;
            const can = me0.energy >= mv.cost && !cooling && !b.over && count <= 0;
            return (
              <Pressable
                key={m}
                onPress={() => {
                  if (play(b, 0, m)) setFrame((n) => n + 1);
                  else sfx('error', 0.25);
                }}
                accessibilityLabel={`${mv.name}, ${mv.cost} אנרגיה`}
                style={({ pressed }) => ({ flex: 1, transform: [{ scale: pressed && can ? 0.92 : 1 }, { translateY: can ? -4 : 0 }] })}
              >
                {/* a dark metal card tinted by the move's colour, its medallion in the middle */}
                <LinearGradient colors={can ? ['#3A3F4B', '#1C1F27'] : ['#2A2D35', '#15171C']} style={{ height: 118, borderRadius: 16, borderWidth: 3, borderColor: can ? mv.color : '#3F4450', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6, overflow: 'hidden' }}>
                  <LinearGradient colors={[`${mv.color}55`, 'transparent']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 70 }} />
                  <View style={{ position: 'absolute', top: 6, opacity: can ? 1 : 0.4 }}>
                    <ItemIcon icon={`mv_${m}`} size={72} />
                  </View>
                  <GT size={12} numberOfLines={1}>
                    {mv.name}
                  </GT>
                  {cooling && (
                    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                      <GT size={20}>{Math.ceil(me0.healReadyAt - b.t)}</GT>
                    </View>
                  )}
                </LinearGradient>
                <View style={{ position: 'absolute', top: -10, right: -6, width: 30, height: 30, borderRadius: 15, backgroundColor: can ? '#7C3AED' : '#475569', borderWidth: 3, borderColor: '#E9D5FF', alignItems: 'center', justifyContent: 'center' }}>
                  <GT size={14}>{mv.cost}</GT>
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={{ marginTop: 12, flexDirection: 'row-reverse', alignItems: 'center' }}>
          <View style={{ flex: 1, height: 28, borderRadius: 8, backgroundColor: '#11151C', borderWidth: 3, borderColor: '#4B5563', overflow: 'hidden', justifyContent: 'center', marginLeft: -14 }}>
            <LinearGradient colors={['#0EA5E9', '#67E8F9']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 0 }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${(me0.energy / MAX_ENERGY) * 100}%` }} />
            <View style={{ flexDirection: 'row-reverse', position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
              {Array.from({ length: MAX_ENERGY - 1 }, (_, i) => (
                <View key={i} style={{ flex: 1, borderLeftWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} />
              ))}
              <View style={{ flex: 1 }} />
            </View>
            <GT size={13}>{`אנרגיה ${Math.floor(me0.energy)}`}</GT>
          </View>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#1F2937', borderWidth: 3, borderColor: '#9CA3AF', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
            <GT size={22} color="#67E8F9">⚡</GT>
          </View>
        </View>
      </LinearGradient>

      {count > 0 && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' }]}>
          <CountNum key={count} n={count} />
        </View>
      )}
    </View>
  );
}

function FighterView(props: {
  side: Side;
  char: string;
  anim: Anim;
  size: number;
  x: number;
  y: number;
  lunge: SharedValue<number>;
  flash: SharedValue<number>;
  hp: number;
  level: number;
  name: string;
  element: keyof typeof ELEMENTS;
  frozen: boolean;
  stunned: boolean;
  burning: boolean;
  shield: boolean;
  skin?: string;
  onAnimEnd: () => void;
  animId: number;
  special?: string;
}) {
  const { side, size, x, y, lunge, flash } = props;
  const dir = side === 0 ? 1 : -1; // the player lunges up-right, the opponent down-left
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: lunge.value * 40 * dir }, { translateY: -lunge.value * 30 * dir }] }));
  const fl = useAnimatedStyle(() => ({ opacity: 1 - flash.value * 0.12 }));
  const once = props.anim !== 'idle' && props.anim !== 'win';
  return (
    <View style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, alignItems: 'center' }} pointerEvents="none">
      <View style={{ position: 'absolute', top: -34, width: 120, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
          <View style={{ backgroundColor: side === 0 ? '#2563EB' : '#DC2626', borderRadius: 6, paddingHorizontal: 5, borderWidth: 1.5, borderColor: '#fff' }}>
            <GT size={10}>{props.level}</GT>
          </View>
          <GT size={11} numberOfLines={1}>
            {props.name}
          </GT>
        </View>
        <View style={{ width: 104, height: 11, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1.5, borderColor: '#1E1033', overflow: 'hidden', marginTop: 2 }}>
          <LinearGradient colors={side === 0 ? ['#22D3EE', '#3B82F6'] : ['#FB7185', '#E11D48']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${Math.max(0, props.hp) * 100}%`, height: '100%' }} />
        </View>
      </View>
      <Animated.View style={[st, fl]}>
        <Sprite char={props.char} skin={props.skin} flip={side === 1} anim={props.anim} animId={props.animId} special={props.special} live size={size} once={once} onEnd={props.onAnimEnd} />
      </Animated.View>
      {props.shield && <View style={{ position: 'absolute', top: size * 0.05, width: size * 0.95, height: size * 0.95, borderRadius: size, borderWidth: 3, borderColor: '#6EE7B7', backgroundColor: 'rgba(52,211,153,0.18)' }} />}
      {props.frozen && <View style={{ position: 'absolute', top: size * 0.1, width: size * 0.85, height: size * 0.85, borderRadius: 20, backgroundColor: 'rgba(125,211,252,0.45)', borderWidth: 2, borderColor: '#E0F2FE' }} />}
      {props.burning && (
        <View style={{ position: 'absolute', bottom: size * 0.1, flexDirection: 'row', gap: 4 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ width: 12, height: 18, borderRadius: 8, backgroundColor: i === 1 ? '#FDBA74' : '#F97316', opacity: 0.85 }} />
          ))}
        </View>
      )}
      {props.stunned && (
        <View style={{ position: 'absolute', top: 0, flexDirection: 'row', gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <ItemIcon key={i} icon="Star" size={20} />
          ))}
        </View>
      )}
    </View>
  );
}

/** The move's 3D icon flies from the caster to its target and bursts there (or glows on the caster for self moves). */
function MoveFx({ move, from, to, self, onDone }: { move: MoveId; from: { x: number; y: number }; to: { x: number; y: number }; self: boolean; onDone: () => void }) {
  const m = MOVES[move];
  const t = useSharedValue(0);
  const burst = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: self ? 10 : 320, easing: Easing.in(Easing.quad) });
    burst.value = withDelay(self ? 0 : 300, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }, (done) => done && runOnJS(onDone)()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const target = self ? from : to;
  const proj = useAnimatedStyle(() => ({
    opacity: self ? 0 : 1 - burst.value,
    transform: [{ translateX: from.x + (to.x - from.x) * t.value - 32 }, { translateY: from.y + (to.y - from.y) * t.value - 60 }, { rotate: `${t.value * 540}deg` }, { scale: 1 + t.value * 0.4 }],
  }));
  const ring = useAnimatedStyle(() => ({ opacity: 1 - burst.value, transform: [{ scale: 0.3 + burst.value * 1.9 }] }));
  const icon = useAnimatedStyle(() => ({ opacity: burst.value < 0.7 ? 1 : (1 - burst.value) / 0.3, transform: [{ scale: 0.6 + burst.value * 0.9 }, { translateY: -burst.value * 30 }] }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {move === 'thunder' || move === 'zap' ? (
        <Svg width={90} height={target.y} style={{ position: 'absolute', left: target.x - 45, top: 0 }}>
          <Path d={`M55 0 L20 ${target.y * 0.45} L45 ${target.y * 0.45} L25 ${target.y - 40} L75 ${target.y * 0.35} L50 ${target.y * 0.35} L70 0 Z`} fill="#FEF9C3" stroke="#FACC15" strokeWidth={3} opacity={0.95} />
        </Svg>
      ) : null}
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, proj]}>
        <ItemIcon icon={MOVE_ICON[move]} size={64} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: target.x - 70, top: target.y - 110, width: 140, height: 140, borderRadius: 70, borderWidth: 8, borderColor: m.color, backgroundColor: `${m.color}33` }, ring]} />
      {self && (
        <Animated.View style={[{ position: 'absolute', left: target.x - 36, top: target.y - 150 }, icon]}>
          <ItemIcon icon={MOVE_ICON[move]} size={72} />
        </Animated.View>
      )}
    </View>
  );
}

function FloatNum({ f, x, y, onDone }: { f: Floater; x: number; y: number; onDone: () => void }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }, (d) => d && runOnJS(onDone)());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = useAnimatedStyle(() => ({ opacity: v.value < 0.7 ? 1 : (1 - v.value) / 0.3, transform: [{ translateY: -v.value * 60 }, { scale: v.value < 0.15 ? 0.6 + v.value * 4 : 1.2 - v.value * 0.2 }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x - 60, top: y, width: 120, alignItems: 'center' }, st]}>
      <GT size={f.big ? 26 : 18} color={f.color}>
        {f.text}
      </GT>
    </Animated.View>
  );
}

function Banner({ text, color }: { text: string; color: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withSequence(withTiming(1, { duration: 180 }), withDelay(600, withTiming(2, { duration: 250 })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = useAnimatedStyle(() => ({ opacity: v.value <= 1 ? v.value : 2 - v.value, transform: [{ scale: v.value <= 1 ? 0.6 + v.value * 0.4 : 1 + (v.value - 1) * 0.2 }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: '45%', left: 0, right: 0, alignItems: 'center' }, st]}>
      <GT size={30} color={color}>
        {text}
      </GT>
    </Animated.View>
  );
}

function CountNum({ n }: { n: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.back(2)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = useAnimatedStyle(() => ({ opacity: 1.4 - v.value, transform: [{ scale: 0.4 + v.value * 1.1 }] }));
  return (
    <Animated.View style={st}>
      <GT size={110} color="#FDE68A">
        {n}
      </GT>
    </Animated.View>
  );
}
