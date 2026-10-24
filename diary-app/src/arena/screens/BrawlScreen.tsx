import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { notify } from '../../components/ui';
import { play as sfx } from '../../lib/sound';
import { createGame, Game, Input, Spawn } from '../../arena3d/brawlGame';
import { MODELS3D } from '../../arena3d/models';
import { ELEMENTS, HAS_3D, SPECIES, SpeciesId } from '../data';
import { Fighter, statsOf } from '../progress';
import { Bar, GL, GT, ItemIcon, OUTLINE } from '../ui';

const BrawlScene = React.lazy(() => import('../../arena3d/BrawlScene'));

export type BrawlResult = { won: boolean; kills: number; waves: number };

/** Three waves of bots for "זירת הכאוס", tougher as you climb levels; a boss closes the last one. */
function plan(me: Fighter): { player: Spawn; waves: Spawn[][] } {
  const st = statsOf(me);
  const el = SPECIES[me.species].element;
  const model = me.skin && MODELS3D[me.skin] ? me.skin : MODELS3D[me.species] ? me.species : 'dragon';
  const hp = Math.round(st.hp * 9);
  const dmg = Math.round(st.atk * 3.2);
  const pickFoe = (): Spawn => {
    const sp = HAS_3D[Math.floor(Math.random() * HAS_3D.length)] as SpeciesId;
    return { model: sp, name: SPECIES[sp].name, color: ELEMENTS[SPECIES[sp].element].color, hp: Math.round(hp * 0.32), dmg: Math.round(dmg * 0.55) };
  };
  const boss: Spawn = { model: 'boss_lavadragon', name: 'מלך הלבה', color: '#F97316', hp: Math.round(hp * 1.2), dmg: Math.round(dmg * 0.8), boss: true };
  return {
    player: { model, name: me.name, color: ELEMENTS[el].color, hp, dmg },
    waves: [[pickFoe(), pickFoe()], [pickFoe(), pickFoe(), pickFoe()], [boss, pickFoe()]],
  };
}

/** A thumb joystick: drag from its centre; the knob follows up to its rim. */
function Joystick({ onMove }: { onMove: (mx: number, mz: number) => void }) {
  const R = 58;
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const origin = useRef({ x: 0, y: 0 });
  const set = (e: GestureResponderEvent) => {
    const dx = e.nativeEvent.pageX - origin.current.x;
    const dy = e.nativeEvent.pageY - origin.current.y;
    const len = Math.hypot(dx, dy);
    const k = len > R ? R / len : 1;
    setKnob({ x: dx * k, y: dy * k });
    onMove((dx * k) / R, (dy * k) / R);
  };
  const stop = () => {
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };
  return (
    <View
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => {
        origin.current = { x: e.nativeEvent.pageX - e.nativeEvent.locationX + R + 20, y: e.nativeEvent.pageY - e.nativeEvent.locationY + R + 20 };
        set(e);
      }}
      onResponderMove={set}
      onResponderRelease={stop}
      onResponderTerminate={stop}
      accessibilityLabel="ג׳ויסטיק"
      style={{ width: R * 2 + 40, height: R * 2 + 40, alignItems: 'center', justifyContent: 'center' }}
    >
      <View pointerEvents="none" style={{ width: R * 2, height: R * 2, borderRadius: R, backgroundColor: 'rgba(15,23,42,0.35)', borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#3B82F6', borderWidth: 3, borderColor: OUTLINE, transform: [{ translateX: knob.x }, { translateY: knob.y }] }} />
      </View>
    </View>
  );
}

/** "זירת הכאוס": the real-time arena mode. */
export default function BrawlScreen({ me, onEnd }: { me: Fighter; onEnd: (r: BrawlResult) => void }) {
  const insets = useSafeAreaInsets();
  const setup = useMemo(() => plan(me), [me]);
  // the engine is one mutable object for the whole fight; the HUD re-reads it ten times a second
  const [game] = useState<Game>(() => createGame(setup.player, setup.waves));
  const input = useRef<Input>({ mx: 0, mz: 0, fire: false, superFire: false });
  const [, setFrame] = useState(0);
  const lastHud = useRef(0);
  const ended = useRef(false);
  const element = SPECIES[me.species].element;
  const [failed, setFailed] = useState(false);
  const steer = (mx: number, mz: number) => {
    input.current.mx = mx;
    input.current.mz = mz;
  };
  const trigger = (on: boolean) => {
    input.current.fire = on;
  };
  const superNow = () => {
    input.current.superFire = true;
  };

  // the HUD only needs to refresh ten times a second
  const onTick = () => {
    const now = Date.now();
    if (now - lastHud.current > 100) {
      lastHud.current = now;
      setFrame((n) => n + 1);
    }
  };
  useEffect(() => {
    if (!game.over || ended.current) return;
    ended.current = true;
    if (game.won) {
      sfx('levelup', 0.6);
      notify('success');
    } else sfx('error', 0.5);
    const id = setTimeout(() => onEnd({ won: game.won, kills: game.kills, waves: game.wave }), 2200);
    return () => clearTimeout(id);
  });

  const p = game.player;
  const alive = game.enemies.filter((e) => e.alive).length;
  return (
    <View style={{ flex: 1, backgroundColor: '#5BB0F0' }}>
      {failed ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
          <GT size={20}>המצב הזה צריך תלת-ממד</GT>
          <GL style={{ marginTop: 8 }}>במכשיר הזה התלת-ממד לא עלה. נסה את מצב הדו-קרב.</GL>
          <Pressable onPress={() => onEnd({ won: false, kills: 0, waves: 0 })} style={{ marginTop: 16 }}>
            <GT size={16} color="#FDE047">חזרה</GT>
          </Pressable>
        </View>
      ) : (
        <SceneGuard onError={() => setFailed(true)}>
          <Suspense fallback={<GL style={{ marginTop: 200 }}>טוען את הזירה…</GL>}>
            <BrawlScene game={game} input={input} element={element} onTick={onTick} />
          </Suspense>
        </SceneGuard>
      )}

      {/* top: your life, the wave, enemies left */}
      <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(10,5,25,0.7)', borderRadius: 12, borderWidth: 2.5, borderColor: OUTLINE, padding: 6 }}>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
            <GT size={13}>{p.name}</GT>
            <GL size={11}>{`${Math.ceil(p.hp).toLocaleString()} / ${p.maxHp.toLocaleString()}`}</GL>
          </View>
          <Bar value={p.hp / p.maxHp} color={['#22D3EE', '#3B82F6']} height={12} style={{ marginTop: 3 }} />
        </View>
        <View style={{ backgroundColor: 'rgba(10,5,25,0.7)', borderRadius: 12, borderWidth: 2.5, borderColor: OUTLINE, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' }}>
          <GT size={14}>{`גל ${Math.max(1, game.wave)}/${game.waves}`}</GT>
          <GL size={10} color="#FCA5A5">{`${alive} אויבים`}</GL>
        </View>
      </View>
      {game.over && (
        <View pointerEvents="none" style={{ position: 'absolute', top: '38%', left: 0, right: 0, alignItems: 'center' }}>
          <GT size={44} color={game.won ? '#FDE047' : '#FCA5A5'}>{game.won ? 'ניצחון!' : 'הובסת!'}</GT>
        </View>
      )}

      {/* controls: joystick on the left, attack and super on the right */}
      <View style={{ position: 'absolute', left: 6, bottom: insets.bottom + 10 }}>
        <Joystick onMove={steer} />
      </View>
      <View style={{ position: 'absolute', right: 18, bottom: insets.bottom + 26, alignItems: 'center', gap: 14 }}>
        <Pressable
          onPress={() => {
            superNow();
            if (game.charge >= 1) sfx('whoosh', 0.7);
          }}
          accessibilityLabel="מכת על"
          style={{ width: 70, height: 70, borderRadius: 35, borderWidth: 4, borderColor: game.charge >= 1 ? '#FDE047' : OUTLINE, backgroundColor: game.charge >= 1 ? ELEMENTS[element].color : 'rgba(15,23,42,0.6)', alignItems: 'center', justifyContent: 'center', opacity: game.charge >= 1 ? 1 : 0.75 }}
        >
          <ItemIcon icon={`mv_${SPECIES[me.species].signature}`} size={52} />
          {game.charge < 1 && (
            <View style={{ position: 'absolute', bottom: -10, backgroundColor: OUTLINE, borderRadius: 8, paddingHorizontal: 6 }}>
              <GL size={10} color="#FDE68A">{`${Math.round(game.charge * 100)}%`}</GL>
            </View>
          )}
        </Pressable>
        <View
          onStartShouldSetResponder={() => true}
          onResponderGrant={() => {
            trigger(true);
            sfx('tap', 0.25);
          }}
          onResponderRelease={() => trigger(false)}
          onResponderTerminate={() => trigger(false)}
          accessibilityLabel="ירי"
          style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#EF4444', borderWidth: 4, borderColor: OUTLINE, alignItems: 'center', justifyContent: 'center' }}
        >
          <GT size={34}>👊</GT>
        </View>
      </View>
    </View>
  );
}

class SceneGuard extends React.Component<{ onError: () => void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
