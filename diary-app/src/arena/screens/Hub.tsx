import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dayKey } from '../../lib/dates';
import { notify } from '../../components/ui';
import { useStore } from '../../lib/store';
import { WORLD_ART } from '../simArt';
import { ELEMENTS, itemDef, rankOf, RARITY, Slot, SLOTS, SPECIES } from '../data';
import { powerOf, stageInWorld, worldOfStage, xpToNext } from '../progress';
import Sprite from '../Sprite';
import { useArena } from '../state';
import { Bar, Float, GButton, GL, GT, ItemIcon, Pill, Pulse, Rays } from '../ui';

export type HubGo = 'map' | 'ranked' | 'bag' | 'chests' | 'ranks' | 'guards' | 'skins';

const SLOT_ORDER: Slot[] = ['weapon', 'head', 'armor', 'charm'];
const SLOT_EMPTY: Record<Slot, string> = { weapon: 'Sword', head: 'Crown2', armor: 'Armor_Leather', charm: 'Ring1' };

/** The fighter's home: level, rank, gear, and the way into every part of the game. */
export default function Hub({ go, onClose }: { go: (to: HubGo) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { s, claimDiaryBonus } = useArena();
  const { entries } = useStore();
  const f = s.fighter!;
  const sp = SPECIES[f.species];
  const rank = rankOf(s.trophies);
  const need = xpToNext(f.level);
  const w = worldOfStage(s.stage);
  const today = dayKey(new Date());
  const wroteToday = entries.some((e) => dayKey(e.createdAt) === today);
  const bonusReady = wroteToday && s.diaryBonusDay !== today;

  return (
    <View style={{ flex: 1, backgroundColor: '#12082A' }}>
      <Image source={WORLD_ART[`arena_${w.bg}`]} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.75 }} resizeMode="cover" />
      <LinearGradient colors={['rgba(18,8,42,0.85)', 'rgba(18,8,42,0.2)', 'rgba(18,8,42,0.9)']} locations={[0, 0.45, 1]} style={{ position: 'absolute', width: '100%', height: '100%' }} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 14 }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: '#3B82F6', borderWidth: 2.5, borderColor: '#BFDBFE', alignItems: 'center', justifyContent: 'center' }}>
            <GT size={18}>{f.level}</GT>
          </View>
          <View style={{ flex: 1 }}>
            <GL size={11} style={{ textAlign: 'right' }}>{`רמה ${f.level} / 500 · ${s.xp.toLocaleString()} / ${need.toLocaleString()}`}</GL>
            <Bar value={s.xp / need} color={['#22D3EE', '#818CF8']} height={11} style={{ marginTop: 3 }} />
          </View>
          <Pressable onPress={onClose} accessibilityLabel="סגור" hitSlop={8} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <Pill icon="Coin" value={s.coins} />
          <Pill icon="Crystal1" value={s.gems} color="#67E8F9" />
          <Pill icon="Chalice" value={s.trophies} color="#FDE68A" />
        </View>

        {bonusReady && (
          <Pressable
            onPress={() => {
              if (claimDiaryBonus(today)) notify('success');
            }}
            style={{ marginTop: 12 }}
          >
            <Pulse>
              <LinearGradient colors={['#F472B6', '#8B5CF6']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 0 }} style={{ borderRadius: 16, padding: 12, flexDirection: 'row-reverse', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: '#FBCFE8' }}>
                <ItemIcon icon="Book2_Open" size={40} />
                <View style={{ flex: 1 }}>
                  <GT size={15} style={{ textAlign: 'right' }}>
                    בונוס יומן! כתבת היום
                  </GT>
                  <GL size={12} color="#FCE7F3" style={{ textAlign: 'right' }}>
                    לחץ לקבל תיבת כסף + ניסיון כפול ל-3 קרבות
                  </GL>
                </View>
              </LinearGradient>
            </Pulse>
          </Pressable>
        )}

        <View style={{ height: 300, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
          <Rays size={380} color="rgba(255,255,255,0.06)" />
          <View style={{ position: 'absolute', bottom: 34, width: 190, height: 40, borderRadius: 95, backgroundColor: 'rgba(0,0,0,0.35)' }} />
          <Float>
            <Sprite char={f.species} skin={f.skin} size={270} />
          </Float>
          {SLOT_ORDER.map((slot, i) => {
            const o = f.equip[slot];
            const d = o && itemDef(o.id);
            const pos = [
              { right: 0, top: 30 },
              { left: 0, top: 30 },
              { right: 0, top: 160 },
              { left: 0, top: 160 },
            ][i];
            return (
              <Pressable key={slot} onPress={() => go('bag')} accessibilityLabel={`${SLOTS[slot]}: ${d ? d.name : 'ריק'}`} style={[{ position: 'absolute', width: 66, height: 74, borderRadius: 14, borderWidth: 2, borderColor: d ? RARITY[d.rarity].color : 'rgba(255,255,255,0.2)', backgroundColor: d ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' }, pos]}>
                <View style={{ opacity: d ? 1 : 0.25 }}>
                  <ItemIcon icon={d ? d.icon : SLOT_EMPTY[slot]} size={46} />
                </View>
                <GL size={10} color={d ? '#fff' : '#A78BFA'}>
                  {d ? `רמה ${o!.level}` : SLOTS[slot]}
                </GL>
              </Pressable>
            );
          })}
        </View>

        <View style={{ alignItems: 'center', marginTop: -10 }}>
          <GT size={26}>{f.name}</GT>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <GL color={ELEMENTS[sp.element].color}>{`${ELEMENTS[sp.element].icon} ${ELEMENTS[sp.element].label}`}</GL>
            <GL>·</GL>
            <GL color="#FDE68A">{`כוח ${powerOf(f).toLocaleString()}`}</GL>
          </View>
        </View>

        <Pressable onPress={() => go('ranks')} style={{ marginTop: 12, flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 16, padding: 10, borderWidth: 1.5, borderColor: rank.color }}>
          <ItemIcon icon={rank.icon} size={44} />
          <View style={{ flex: 1 }}>
            <GT size={16} style={{ textAlign: 'right' }} color={rank.color}>
              {rank.label}
            </GT>
            <Bar value={rank.progress} color={rank.color} height={8} style={{ marginTop: 4 }} />
            <GL size={11} style={{ textAlign: 'right', marginTop: 2 }}>
              {rank.next ? `עוד ${(rank.next.min - s.trophies).toLocaleString()} גביעים ל${rank.next.name}` : 'הדרגה הגבוהה ביותר!'}
            </GL>
          </View>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>

        <GButton title={`שלב ${stageInWorld(s.stage)} · ${w.name}`} size={19} tone="gold" height={60} style={{ marginTop: 14 }} onPress={() => go('map')}>
          <ItemIcon icon="Sword_Golden" size={32} />
        </GButton>
        <GButton title="קרב מדורג אונליין" size={18} tone="blue" style={{ marginTop: 8 }} onPress={() => go('ranked')}>
          <ItemIcon icon="Chalice" size={30} />
        </GButton>

        <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 10 }}>
          {(
            [
              ['bag', 'תיק', 'Backpack', s.inventory.length],
              ['chests', 'תיבות', 'Chest_Closed', s.chests.length],
              ['skins', 'סקינים', 'it_king_crown', 0],
              ['guards', 'שומרים', 'Padlock', s.guards.length],
            ] as const
          ).map(([to, label, icon, n]) => (
            <Pressable key={to} onPress={() => go(to)} accessibilityLabel={label} style={({ pressed }) => ({ flex: 1, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
              <View style={{ height: 92, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.42)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <ItemIcon icon={icon} size={46} />
                <GT size={13}>{label}</GT>
                {n > 0 && (
                  <View style={{ position: 'absolute', top: 6, left: 8, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                    <GT size={11}>{n}</GT>
                  </View>
                )}
              </View>
            </Pressable>
          ))}
        </View>
        <GL size={11} color="#A78BFA" style={{ marginTop: 10 }}>{`${s.wins} ניצחונות · ${s.losses} הפסדים`}</GL>
      </ScrollView>
    </View>
  );
}
