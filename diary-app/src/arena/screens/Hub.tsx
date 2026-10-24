import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Image, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { notify } from '../../components/ui';
import { dayKey } from '../../lib/dates';
import { useStore } from '../../lib/store';
import { ELEMENTS, itemDef, rankOf, RARITY, Slot, SPECIES } from '../data';
import { powerOf, stageInWorld, worldOfStage, xpToNext } from '../progress';
import { WORLD_ART } from '../simArt';
import Sprite from '../Sprite';
import { useArena } from '../state';
import { Bar, Counter, FloatHeart, GL, GT, ItemIcon, OUTLINE, Pulse, StoneButton } from '../ui';
import { play } from '../../lib/sound';
import * as Haptics from 'expo-haptics';

export type HubGo = 'map' | 'play' | 'ranked' | 'bag' | 'chests' | 'ranks' | 'guards' | 'skins' | 'fighters' | 'upgrade';

const SLOT_ORDER: Slot[] = ['weapon', 'head', 'armor', 'charm'];
const SLOT_EMPTY: Record<Slot, string> = { weapon: 'Sword', head: 'Crown2', armor: 'Armor_Leather', charm: 'Ring1' };

/**
 * The game's home, laid out like a real mobile brawler lobby: profile and currencies on top, menu tiles down
 * both sides, your fighter on a glowing stage in the middle, the mode and a huge PLAY button at the bottom.
 */
export default function Hub({ go, onClose }: { go: (to: HubGo) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { s, claimDiaryBonus } = useArena();
  const { entries } = useStore();
  const f = s.fighter!;
  const sp = SPECIES[f.species];
  const rank = rankOf(s.trophies);
  const need = xpToNext(f.level);
  const w = worldOfStage(s.stage);
  const today = dayKey(new Date());
  const bonusReady = entries.some((e) => dayKey(e.createdAt) === today) && s.diaryBonusDay !== today;
  const hero = Math.min(width * 0.6, height * 0.33, 290);
  const [petted, setPetted] = useState(0);
  const [hearts, setHearts] = useState<{ id: number; x: number; emoji: string }[]>([]);

  return (
    <View style={{ flex: 1, backgroundColor: '#12082A' }}>
      {/* the ruins' stone pedestal (80% down the art) lands where the fighter stands */}
      <Image source={WORLD_ART.lobby_jungle} style={{ position: 'absolute', left: -(height * 1.25 * 0.75 - width) / 2, top: -height * 0.34, width: height * 1.25 * 0.75, height: height * 1.25 }} resizeMode="cover" />
      <LinearGradient colors={['rgba(10,6,4,0.75)', 'rgba(10,6,4,0)', 'rgba(10,6,4,0)', 'rgba(10,6,4,0.85)']} locations={[0, 0.2, 0.7, 1]} style={{ position: 'absolute', width: '100%', height: '100%' }} />

      {/* top bar: profile on the right, currencies on the left */}
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 10, flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
        <Pressable onPress={() => go('ranks')} accessibilityLabel={`${f.name}, ${rank.label}`} style={{ flexDirection: 'row-reverse', alignItems: 'center', flexShrink: 1 }}>
          <View style={{ width: 54, height: 54, borderRadius: 12, borderWidth: 3, borderColor: OUTLINE, backgroundColor: ELEMENTS[sp.element].color, overflow: 'hidden', alignItems: 'center', zIndex: 1 }}>
            <Sprite char={f.species} skin={f.skin} size={84} style={{ marginTop: -6 }} />
          </View>
          <View style={{ marginRight: -6, paddingRight: 12, paddingLeft: 8, paddingVertical: 4, backgroundColor: 'rgba(8,4,20,0.78)', borderRadius: 10, borderWidth: 2.5, borderColor: OUTLINE, minWidth: 120 }}>
            <GT size={14} numberOfLines={1} style={{ textAlign: 'right' }}>{f.name}</GT>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
              <ItemIcon icon="Chalice" size={18} />
              <GT size={14} color="#FDE047">{s.trophies.toLocaleString()}</GT>
              <View style={{ marginRight: 4 }}>
                <ItemIcon icon={rank.icon} size={20} />
              </View>
            </View>
          </View>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Counter icon="Coin" value={s.coins} />
        <Counter icon="Crystal1" value={s.gems} />
        <Pressable onPress={onClose} accessibilityLabel="סגור" hitSlop={8} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(8,4,20,0.78)', borderWidth: 2.5, borderColor: OUTLINE, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* level strip */}
      <View style={{ marginTop: 8, marginHorizontal: 12, flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 34, height: 34, borderRadius: 8, transform: [{ rotate: '45deg' }], backgroundColor: '#3B82F6', borderWidth: 3, borderColor: OUTLINE, alignItems: 'center', justifyContent: 'center' }}>
          <GT size={13} style={{ transform: [{ rotate: '-45deg' }] }}>{f.level}</GT>
        </View>
        <View style={{ flex: 1 }}>
          <Bar value={s.xp / need} color={['#22D3EE', '#818CF8']} height={12} />
        </View>
        <GL size={11}>{`${s.xp.toLocaleString()}/${need.toLocaleString()}`}</GL>
      </View>

      {bonusReady && (
        <Pressable onPress={() => claimDiaryBonus(today) && notify('success')} style={{ marginTop: 8, marginHorizontal: 12 }}>
          <Pulse>
            <LinearGradient colors={['#F472B6', '#8B5CF6']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 0 }} style={{ borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10, flexDirection: 'row-reverse', alignItems: 'center', gap: 8, borderWidth: 3, borderColor: OUTLINE }}>
              <ItemIcon icon="Book2_Open" size={30} />
              <GT size={13} style={{ flex: 1, textAlign: 'right' }}>בונוס יומן! לחץ לתיבה + ניסיון כפול</GT>
            </LinearGradient>
          </Pulse>
        </Pressable>
      )}

      {/* middle: your fighter on a glowing stage, menu tiles down both sides on top of it */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 }}>
        {/* feet on the middle of the stage */}
        {/* tap your fighter to pet it: hearts, a happy jump, a sound */}
        <Pressable
          onPress={() => {
            play('pop', 0.5);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setPetted((n) => (n % 2 ? n + 2 : n + 1));
            const id = Date.now();
            setHearts((h) => [...h.slice(-8), ...[0, 1, 2].map((k) => ({ id: id + k, x: hero * (0.25 + Math.random() * 0.5), emoji: ['💖', '💗', '✨', '💜'][Math.floor(Math.random() * 4)] }))]);
          }}
          accessibilityRole="button"
          accessibilityLabel={`ללטף את ${f.name}`}
          style={{ marginBottom: 58 + hero * 0.3 }}
        >
          <Sprite char={f.species} skin={f.skin} size={hero} live lobby anim={petted % 2 ? 'win' : 'idle'} animId={petted} once={petted % 2 === 1} onEnd={() => setPetted((n) => (n % 2 ? n + 1 : n))} />
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: hero * 0.2, width: hero, height: 1 }}>
            {hearts.map((h) => (
              <FloatHeart key={h.id} x={h.x} emoji={h.emoji} onDone={() => setHearts((all) => all.filter((x) => x.id !== h.id))} />
            ))}
          </View>
        </Pressable>
        <Pressable onPress={() => go('skins')} accessibilityLabel="החלף סקין" style={{ position: 'absolute', bottom: 70, right: width / 2 - hero * 0.55, width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(8,4,20,0.8)', borderWidth: 2.5, borderColor: OUTLINE, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="shirt" size={20} color="#fff" />
        </Pressable>
        {/* name plate + gear */}
        <View style={{ position: 'absolute', bottom: 0, alignItems: 'center' }}>
          <Pressable onPress={() => go('upgrade')} accessibilityLabel="שדרג את הדמות שלך" style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: 'rgba(8,4,20,0.8)', borderRadius: 10, borderWidth: 2.5, borderColor: OUTLINE, paddingHorizontal: 10, paddingVertical: 2 }}>
            <GT size={16}>{f.name}</GT>
            <GL color={ELEMENTS[sp.element].color}>{ELEMENTS[sp.element].icon}</GL>
            <GL color="#FDE68A">{`⚡ ${powerOf(f).toLocaleString()}`}</GL>
            <View style={{ backgroundColor: '#22C55E', borderRadius: 6, borderWidth: 2, borderColor: OUTLINE, paddingHorizontal: 6 }}>
              <GT size={11}>⬆ שדרג</GT>
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 6 }}>
            {SLOT_ORDER.map((slot) => {
              const o = f.equip[slot];
              const d = o && itemDef(o.id);
              return (
                <Pressable key={slot} onPress={() => go('bag')} accessibilityLabel={d ? d.name : 'מקום ריק'} style={{ width: 40, height: 40, borderRadius: 9, borderWidth: 2.5, borderColor: d ? RARITY[d.rarity].color : OUTLINE, backgroundColor: 'rgba(8,4,20,0.75)', alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ opacity: d ? 1 : 0.3 }}>
                    <ItemIcon icon={d ? d.icon : SLOT_EMPTY[slot]} size={30} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={{ position: 'absolute', top: 6, right: 8, gap: 8 }}>
          <StoneButton icon="ic3_chest" label="תיבות" onPress={() => go('chests')} badge={s.chests.length} />
          <StoneButton icon="ic3_skins" label="סקינים" onPress={() => go('skins')} />
          <StoneButton icon="ic3_bag" label="תיק" onPress={() => go('bag')} badge={s.inventory.length} />
          {s.guards.length > 0 && (
            <Pressable onPress={() => go('guards')} accessibilityLabel="השומרים שלך" style={{ width: 74, borderRadius: 14, borderWidth: 3, borderColor: OUTLINE, backgroundColor: 'rgba(10,5,25,0.72)', paddingVertical: 4, alignItems: 'center', gap: 2 }}>
              <GL size={10} color="#FDE68A">שומרים</GL>
              {s.guards.slice(0, 3).map((g) => (
                <View key={g} style={{ alignItems: 'center' }}>
                  <Sprite char={g} size={40} />
                  <GL size={9} color="#E9D5FF">⚔️+4% ❤️+4%</GL>
                </View>
              ))}
            </Pressable>
          )}
        </View>
        <View style={{ position: 'absolute', top: 6, left: 8, gap: 8 }}>
          <StoneButton icon="ic3_ranks" label="דרגות" onPress={() => go('ranks')} />
          <StoneButton icon="ic3_guards" label="שומרים" onPress={() => go('guards')} badge={s.guards.length} />
          <StoneButton icon="ic3_events" label="אונליין" onPress={() => go('ranked')} />
          <StoneButton icon="ic3_badge" label="לוחמים" onPress={() => go('fighters')} />
        </View>
      </View>

      {/* bottom: mode (the world map) and PLAY */}
      <View style={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 12, gap: 8 }}>
        <Pressable onPress={() => go('map')} accessibilityLabel="מפת השלבים" style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
          <LinearGradient colors={[w.colors[1], w.colors[0]]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={{ height: 54, borderRadius: 12, borderWidth: 3, borderColor: OUTLINE, flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 10, gap: 10, overflow: 'hidden' }}>
            <ItemIcon icon="ic3_map" size={46} />
            <View style={{ flex: 1 }}>
              <GT size={16} style={{ textAlign: 'right' }}>{w.name}</GT>
              <GL size={11} color="#FEF3C7" style={{ textAlign: 'right' }}>{`שלב ${stageInWorld(s.stage)} · לחץ למפה`}</GL>
            </View>
            <Ionicons name="map" size={22} color="#fff" />
          </LinearGradient>
        </Pressable>
        <Pressable onPress={() => go('play')} accessibilityRole="button" accessibilityLabel="קרב!">
          {({ pressed }) => (
            <View style={{ height: 82 }}>
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 74, borderRadius: 16, backgroundColor: '#B45309', borderWidth: 3.5, borderColor: OUTLINE }} />
              <LinearGradient colors={['#FEF08A', '#FACC15', '#F59E0B']} style={{ height: 74, marginTop: pressed ? 8 : 0, borderRadius: 16, borderWidth: 3.5, borderColor: OUTLINE, alignItems: 'center', justifyContent: 'center' }}>
                <View pointerEvents="none" style={{ position: 'absolute', top: 4, left: 10, right: 10, height: 22, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.4)' }} />
                <GT size={38}>קרב!</GT>
              </LinearGradient>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}
