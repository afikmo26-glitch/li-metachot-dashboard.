import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { play } from '../../lib/sound';
import { ChestKind, CHESTS, OwnedItem } from '../progress';
import { itemDef, RARITY, SpeciesId, SPECIES } from '../data';
import Sprite from '../Sprite';
import { useArena } from '../state';
import { Float, GButton, GL, GT, ItemIcon, ItemTile, Pill, Rays } from '../ui';

export type ResultInfo = {
  win: boolean;
  stars: number;
  coins: number;
  xp: number;
  gems?: number;
  chest?: boolean;
  levelUps: number;
  trophies?: number;
  newGuard?: SpeciesId;
  title: string;
};

function Star({ on, delay }: { on: boolean; delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withSpring(1, { damping: 7 }));
    if (on) setTimeout(() => play('pop', 0.5), delay);
  }, [v, delay, on]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: v.value }, { rotate: `${(1 - v.value) * -90}deg` }], opacity: on ? 1 : 0.25 }));
  return (
    <Animated.View style={st}>
      <ItemIcon icon="Star" size={on ? 74 : 60} />
    </Animated.View>
  );
}

/** After a battle: victory or defeat, stars, rewards, level-ups, a creature that joined you. */
export function ResultScreen({ r, char, onContinue, onRetry }: { r: ResultInfo; char: string; onContinue: () => void; onRetry?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={r.win ? ['#1D4ED8', '#3B0764', '#12082A'] : ['#7F1D1D', '#2A0F1F', '#12082A']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: 18, alignItems: 'center' }}>
        <GT size={40} color={r.win ? '#FDE68A' : '#FCA5A5'}>
          {r.win ? 'ניצחון!' : 'הפסד'}
        </GT>
        <GL size={14} style={{ marginTop: 4 }}>
          {r.title}
        </GL>
        {r.win && (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 14 }}>
            <Star on={r.stars >= 1} delay={250} />
            <View style={{ marginBottom: 14 }}>
              <Star on={r.stars >= 2} delay={550} />
            </View>
            <Star on={r.stars >= 3} delay={850} />
          </View>
        )}
        <View style={{ height: 230, alignItems: 'center', justifyContent: 'center' }}>
          {r.win && <Rays size={380} color="rgba(253,224,71,0.1)" />}
          <Sprite char={char} anim={r.win ? 'win' : 'death'} once={!r.win} size={220} />
        </View>
        <View style={{ flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Pill icon="Coin" value={`+${r.coins}`} />
          <Pill icon="Book1_Open" value={`+${r.xp} XP`} color="#93C5FD" />
          {r.gems ? <Pill icon="Crystal1" value={`+${r.gems}`} color="#67E8F9" /> : null}
          {r.trophies !== undefined ? <Pill icon="Chalice" value={`${r.trophies >= 0 ? '+' : ''}${r.trophies}`} color={r.trophies >= 0 ? '#FDE68A' : '#FCA5A5'} /> : null}
          {r.chest ? <Pill icon="Chest_Closed" value="תיבה חדשה!" color="#F59E0B" /> : null}
        </View>
        {r.levelUps > 0 && (
          <Float style={{ marginTop: 16 }}>
            <LinearGradient colors={['#22D3EE', '#6366F1']} style={{ borderRadius: 18, paddingHorizontal: 22, paddingVertical: 10, borderWidth: 2, borderColor: '#fff' }}>
              <GT size={22}>{`עלית ${r.levelUps > 1 ? `${r.levelUps} רמות` : 'רמה'}! ⬆`}</GT>
            </LinearGradient>
          </Float>
        )}
        {r.newGuard && (
          <View style={{ marginTop: 16, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 18, padding: 12, borderWidth: 2, borderColor: '#A78BFA', width: '100%' }}>
            <GT size={16}>{`${SPECIES[r.newGuard].name} הצטרף כשומר!`}</GT>
            <Sprite char={r.newGuard} anim="win" size={120} />
            <GL size={12}>שומרים מחזקים אותך בקרב (+4% לכל שומר פעיל)</GL>
          </View>
        )}
        <GButton title={r.win ? 'המשך' : 'חזרה'} size={20} style={{ marginTop: 20, alignSelf: 'stretch' }} onPress={onContinue} />
        {onRetry && <GButton title="נסה שוב" tone="purple" size={17} style={{ marginTop: 8, alignSelf: 'stretch' }} onPress={onRetry} />}
      </ScrollView>
    </LinearGradient>
  );
}

function ChestOpening({ kind, items, coins, gems, onDone }: { kind: ChestKind; items: OwnedItem[]; coins: number; gems: number; onDone: () => void }) {
  const [phase, setPhase] = useState<'shake' | 'open'>('shake');
  const wob = useSharedValue(0);
  useEffect(() => {
    wob.value = withRepeat(withSequence(withTiming(1, { duration: 70 }), withTiming(-1, { duration: 70 })), 8, true);
    play('whoosh', 0.5);
    const id = setTimeout(() => {
      setPhase('open');
      play('levelup', 0.6);
    }, 1300);
    return () => clearTimeout(id);
  }, [wob]);
  const st = useAnimatedStyle(() => ({ transform: [{ rotate: `${wob.value * 8}deg` }, { scale: 1 + Math.abs(wob.value) * 0.05 }] }));
  const best = items.reduce((m, it) => Math.max(m, ['common', 'rare', 'epic', 'legendary', 'mythic'].indexOf(itemDef(it.id)?.rarity ?? 'common')), 0);
  const glow = RARITY[(['common', 'rare', 'epic', 'legendary', 'mythic'] as const)[best]].color;
  return (
    <Pressable onPress={phase === 'open' ? onDone : undefined} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(5,2,15,0.88)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <View style={{ alignItems: 'center', justifyContent: 'center', height: 260 }}>
        <Rays size={460} color={`${phase === 'open' ? glow : '#ffffff'}22`} />
        <Animated.View style={st}>
          <ItemIcon icon={phase === 'open' ? 'Chest_Open' : 'Chest_Closed'} size={190} />
        </Animated.View>
      </View>
      <GT size={24}>{CHESTS[kind].name}</GT>
      {phase === 'open' && (
        <>
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 14 }}>
            {items.map((it, i) => (
              <Reveal key={it.uid} delay={i * 220}>
                <ItemTile item={it} size={78} />
                <GL size={11} color={RARITY[itemDef(it.id)!.rarity].color} style={{ marginTop: 2 }}>
                  {itemDef(it.id)!.name}
                </GL>
              </Reveal>
            ))}
          </View>
          <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 14 }}>
            <Pill icon="Coin" value={`+${coins}`} />
            {gems ? <Pill icon="Crystal1" value={`+${gems}`} color="#67E8F9" /> : null}
          </View>
          <GL style={{ marginTop: 16 }}>לחץ כדי להמשיך</GL>
        </>
      )}
    </Pressable>
  );
}

function Reveal({ children, delay }: { children: React.ReactNode; delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withSpring(1, { damping: 8 }));
  }, [v, delay]);
  const st = useAnimatedStyle(() => ({ opacity: Math.min(1, v.value * 2), transform: [{ scale: 0.3 + v.value * 0.7 }, { translateY: (1 - v.value) * 60 }] }));
  return <Animated.View style={[{ alignItems: 'center' }, st]}>{children}</Animated.View>;
}

/** Your chests, and a little shop that sells better ones for gems. */
export function ChestsScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { s, open, buyChest } = useArena();
  const [opening, setOpening] = useState<{ kind: ChestKind; items: OwnedItem[]; coins: number; gems: number } | null>(null);
  return (
    <LinearGradient colors={['#78350F', '#2A1052', '#12082A']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24, paddingHorizontal: 14 }}>
        <Header title="תיבות אוצר" onBack={onBack} />
        <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 6 }}>
          <Pill icon="Coin" value={s.coins} />
          <Pill icon="Crystal1" value={s.gems} color="#67E8F9" />
        </View>
        <GT size={16} style={{ textAlign: 'right', marginTop: 16 }}>
          התיבות שלך
        </GT>
        {s.chests.length === 0 ? (
          <GL style={{ marginTop: 8, textAlign: 'right' }}>אין תיבות כרגע. מנצחים בוסים, קרבות מדורגים, וכותבים ביומן כדי לקבל עוד!</GL>
        ) : (
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
            {s.chests.map((k, i) => (
              <Pressable
                key={`${k}${i}`}
                onPress={() => {
                  const res = open(i);
                  setOpening({ kind: k, ...res });
                }}
                accessibilityLabel={`פתח ${CHESTS[k].name}`}
                style={({ pressed }) => ({ width: '31%', transform: [{ scale: pressed ? 0.95 : 1 }] })}
              >
                <View style={{ height: 120, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 2, borderColor: CHESTS[k].color, alignItems: 'center', justifyContent: 'center' }}>
                  <Float amount={4}>
                    <ItemIcon icon="Chest_Closed" size={70} />
                  </Float>
                  <GT size={12}>{CHESTS[k].name}</GT>
                  <GL size={10}>לחץ לפתוח</GL>
                </View>
              </Pressable>
            ))}
          </View>
        )}
        <GT size={16} style={{ textAlign: 'right', marginTop: 22 }}>
          חנות תיבות
        </GT>
        {(['silver', 'gold', 'magic'] as ChestKind[]).map((k) => (
          <View key={k} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginTop: 10, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 16, padding: 10, borderWidth: 1.5, borderColor: CHESTS[k].color }}>
            <ItemIcon icon={k === 'magic' ? 'Chest_Ingots' : 'Chest_Closed'} size={56} />
            <View style={{ flex: 1 }}>
              <GT size={15} style={{ textAlign: 'right' }}>
                {CHESTS[k].name}
              </GT>
              <GL size={11} style={{ textAlign: 'right' }}>{`${CHESTS[k].items} חפצים · סיכוי גבוה יותר לנדירים`}</GL>
            </View>
            <GButton title={`${CHESTS[k].cost}`} tone="blue" size={15} height={42} disabled={s.gems < CHESTS[k].cost} onPress={() => buyChest(k)}>
              <ItemIcon icon="Crystal1" size={22} />
            </GButton>
          </View>
        ))}
      </ScrollView>
      {opening && <ChestOpening {...opening} onDone={() => setOpening(null)} />}
    </LinearGradient>
  );
}

export function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
      <Pressable onPress={onBack} accessibilityLabel="חזרה" hitSlop={8} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="chevron-forward" size={22} color="#fff" />
      </Pressable>
      <GT size={22} style={{ flex: 1, textAlign: 'right' }}>
        {title}
      </GT>
    </View>
  );
}
