import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useState } from 'react';
import { Image, Pressable, ScrollView, ScrollViewInstance, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WORLD_ART } from '../simArt';
import { elementBonus, ELEMENTS, SPECIES, STAGES_PER_WORLD, WORLDS } from '../data';
import { enemyForStage, isBoss, isWorldBoss, stageRewards } from '../progress';
import Sprite from '../Sprite';
import { useArena } from '../state';
import { Float, GButton, GL, GT, ItemIcon, OUTLINE, Pill, Pulse } from '../ui';

const STEP = 92; // vertical distance between two stages
const BANNER = 150; // space for a world's title banner
const BOTTOM = 130;

/**
 * The world map: one long trail of every stage, from the first at the bottom to the last world's boss at the
 * top. Scroll up to go forward, down to go back; it opens on the stage you're up to.
 */
export default function MapScreen({ onBack, onFight }: { onBack: () => void; onFight: (stage: number) => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { s } = useArena();
  const cur = s.stage;
  const [pick, setPick] = useState<number | null>(null);
  const [islands, setIslands] = useState(true);
  const scroll = useRef<ScrollViewInstance>(null);
  const total = WORLDS.length * STAGES_PER_WORLD;
  const fullH = BOTTOM + total * STEP + WORLDS.length * BANNER + 200;
  // distance from the bottom of the trail to a stage's node
  const fromBottom = (stage: number) => BOTTOM + (stage - 1) * STEP + Math.floor((stage - 1) / STAGES_PER_WORLD) * BANNER;
  const yOf = (stage: number) => fullH - fromBottom(stage);
  const xOf = (stage: number) => width * (0.5 + 0.28 * Math.sin(stage * 0.75));
  const tile = width / 0.75; // one map picture, kept at its own proportions
  const focus = useRef(cur);
  const goTo = (stage: number, animated = true) => scroll.current?.scrollTo({ y: Math.max(0, yOf(stage) - height * 0.55), animated });

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0620' }}>
      <ScrollView ref={scroll} onContentSizeChange={() => goTo(focus.current, false)} showsVerticalScrollIndicator={false}>
        <View style={{ height: fullH }}>
          {/* each world's map art, repeated up its stretch of the trail */}
          {WORLDS.map((w, wi) => {
            const bottom = fromBottom(wi * STAGES_PER_WORLD + 1) - BOTTOM;
            const len = STAGES_PER_WORLD * STEP + BANNER;
            const n = Math.ceil(len / tile) + 1;
            return (
              <View key={w.id} style={{ position: 'absolute', left: 0, right: 0, top: fullH - bottom - len - BOTTOM, height: len + (wi === 0 ? BOTTOM : 0), overflow: 'hidden' }}>
                {Array.from({ length: n }, (_, k) => (
                  <Image key={k} source={WORLD_ART[`map_${w.bg}`]} style={{ position: 'absolute', left: 0, top: k * tile, width, height: tile, transform: k % 2 ? [{ scaleY: -1 }] : [] }} resizeMode="cover" />
                ))}
                <LinearGradient colors={['rgba(11,6,32,0.55)', 'rgba(11,6,32,0)', 'rgba(11,6,32,0)']} locations={[0, 0.06, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
                {/* world banner at the top of its stretch */}
                <View style={{ position: 'absolute', top: 20, left: 0, right: 0, alignItems: 'center' }}>
                  <LinearGradient colors={w.colors} style={{ paddingHorizontal: 22, paddingVertical: 8, borderRadius: 14, borderWidth: 3, borderColor: OUTLINE }}>
                    <GT size={18}>{`עולם ${w.id} · ${w.name}`}</GT>
                  </LinearGradient>
                </View>
              </View>
            );
          })}
          {/* the trail: dotted steps between stages */}
          {Array.from({ length: total - 1 }, (_, i) => {
            const a1 = i + 1;
            if (a1 % STAGES_PER_WORLD === 0) return null;
            return [0.33, 0.66].map((f) => (
              <View key={`${a1}-${f}`} style={{ position: 'absolute', left: xOf(a1) + (xOf(a1 + 1) - xOf(a1)) * f - 5, top: yOf(a1) + (yOf(a1 + 1) - yOf(a1)) * f - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: a1 < cur ? '#FCD34D' : 'rgba(255,255,255,0.45)', borderWidth: 2, borderColor: OUTLINE }} />
            ));
          })}
          {Array.from({ length: total }, (_, i) => {
            const stage = i + 1;
            const boss = isBoss(stage);
            const stars = s.stars[stage] ?? 0;
            const isCur = stage === cur;
            const locked = stage > cur;
            const size = boss ? 72 : 54;
            const node = (
              <Pressable
                onPress={() => setPick(stage)}
                disabled={locked}
                accessibilityLabel={`שלב ${stage}${boss ? ', בוס' : ''}${locked ? ', נעול' : ''}`}
                style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: OUTLINE, backgroundColor: locked ? '#475569' : isCur ? '#FACC15' : boss ? '#DC2626' : '#22C55E' }}
              >
                <View style={{ position: 'absolute', top: 3, left: 6, right: 6, height: size * 0.3, borderRadius: size, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                {locked ? <Ionicons name="lock-closed" size={18} color="#CBD5E1" /> : <GT size={boss ? 18 : 15}>{(stage - 1) % STAGES_PER_WORLD + 1}</GT>}
              </Pressable>
            );
            return (
              <View key={stage} style={{ position: 'absolute', left: xOf(stage) - 45, top: yOf(stage) - 45, width: 90, height: 90, alignItems: 'center', justifyContent: 'center' }}>
                {boss && !locked && (
                  <View style={{ position: 'absolute', top: -60 }} pointerEvents="none">
                    <Float amount={5}>
                      <Sprite char={enemyForStage(stage).species} size={72} />
                    </Float>
                  </View>
                )}
                {isCur ? <Pulse>{node}</Pulse> : node}
                {stars > 0 && (
                  <View style={{ position: 'absolute', bottom: 0, flexDirection: 'row' }}>
                    {[1, 2, 3].map((k) => (
                      <View key={k} style={{ opacity: stars >= k ? 1 : 0.3, marginTop: k === 2 ? 4 : 0 }}>
                        <ItemIcon icon="ui_star_ornate" size={18} />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
          {s.fighter && (
            <View pointerEvents="none" style={{ position: 'absolute', left: xOf(cur) - 40, top: yOf(cur) - 118 }}>
              <Float amount={6} ms={500}>
                <Sprite char={s.fighter.species} skin={s.fighter.skin} size={80} />
              </Float>
            </View>
          )}
        </View>
      </ScrollView>

      {/* header over the map */}
      <LinearGradient colors={['rgba(10,5,25,0.9)', 'rgba(10,5,25,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 8, paddingHorizontal: 12, paddingBottom: 20, flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
        <Pressable onPress={onBack} accessibilityLabel="חזרה" hitSlop={8} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 2.5, borderColor: OUTLINE, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-forward" size={22} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <GT size={17} style={{ textAlign: 'right' }}>מפת השלבים</GT>
          <GL size={11} style={{ textAlign: 'right' }}>גלול למעלה כדי להתקדם ⬆</GL>
        </View>
        <Pressable onPress={() => setIslands(true)} accessibilityLabel="מפת העולמות" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#0EA5E9', borderWidth: 2.5, borderColor: OUTLINE, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="earth" size={22} color="#fff" />
        </Pressable>
        <Pill icon="Coin" value={s.coins} />
      </LinearGradient>
      <Pressable onPress={() => goTo(cur)} accessibilityLabel="לשלב הנוכחי" style={{ position: 'absolute', left: 14, bottom: insets.bottom + 16, width: 54, height: 54, borderRadius: 16, backgroundColor: '#FACC15', borderWidth: 3, borderColor: OUTLINE, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="locate" size={26} color="#3B1505" />
      </Pressable>

      {islands && (
        <WorldIslands
          onBack={onBack}
          onPick={(wi) => {
            const first = wi * STAGES_PER_WORLD + 1;
            focus.current = cur >= first && cur < first + STAGES_PER_WORLD ? cur : first;
            setIslands(false);
            setTimeout(() => goTo(focus.current, false), 50);
          }}
        />
      )}
      {pick !== null && <StageSheet stage={pick} onClose={() => setPick(null)} onFight={() => onFight(pick)} />}
    </View>
  );
}

// Where each world's island is on the islands picture (fractions of its width and height)
const ISLAND_AT: [number, number][] = [
  [0.33, 0.3],
  [0.26, 0.6],
  [0.6, 0.45],
  [0.82, 0.32],
  [0.8, 0.68],
];

/** The overview: every world as an island in the sea, with the stars you earned there. Tap one to sail in. */
function WorldIslands({ onBack, onPick }: { onBack: () => void; onPick: (world: number) => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { s } = useArena();
  const size = Math.min(width, height - insets.top - 140);
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#1D8FE0' }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 12, flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
        <Pressable onPress={onBack} accessibilityLabel="חזרה" hitSlop={8} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 2.5, borderColor: OUTLINE, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-forward" size={22} color="#fff" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <View style={{ backgroundColor: 'rgba(10,20,50,0.75)', borderRadius: 12, borderWidth: 2.5, borderColor: OUTLINE, paddingHorizontal: 12, paddingVertical: 4 }}>
            <GT size={18}>🗺️ מפת העולמות</GT>
          </View>
        </View>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: size, height: size }}>
          <Image source={WORLD_ART.world_islands} style={{ width: size, height: size }} resizeMode="cover" />
          {WORLDS.map((w, wi) => {
            const first = wi * STAGES_PER_WORLD + 1;
            const open = s.stage >= first;
            let stars = 0;
            for (let k = first; k < first + STAGES_PER_WORLD; k++) stars += s.stars[k] ?? 0;
            const [fx, fy] = ISLAND_AT[wi];
            const here = s.stage >= first && s.stage < first + STAGES_PER_WORLD;
            const badge = (
              <Pressable onPress={() => open && onPick(wi)} disabled={!open} accessibilityLabel={`עולם ${w.id}, ${w.name}${open ? '' : ', נעול'}`} style={{ alignItems: 'center' }}>
                <LinearGradient colors={open ? w.colors : ['#64748B', '#334155']} style={{ width: 54, height: 54, borderRadius: 16, borderWidth: 3.5, borderColor: OUTLINE, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '45deg' }] }}>
                  <View style={{ transform: [{ rotate: '-45deg' }] }}>{open ? <GT size={20}>{w.id}</GT> : <Ionicons name="lock-closed" size={20} color="#fff" />}</View>
                </LinearGradient>
                <View style={{ marginTop: 6, backgroundColor: 'rgba(10,20,50,0.8)', borderRadius: 8, paddingHorizontal: 6, borderWidth: 2, borderColor: OUTLINE, flexDirection: 'row-reverse', alignItems: 'center', gap: 2 }}>
                  <ItemIcon icon="ui_star_ornate" size={14} />
                  <GT size={11}>{`${stars}/${STAGES_PER_WORLD * 3}`}</GT>
                </View>
                <GL size={10} color="#FFFFFF" style={{ marginTop: 2, textShadowColor: '#000', textShadowRadius: 3 }}>{w.name}</GL>
              </Pressable>
            );
            return (
              <View key={w.id} style={{ position: 'absolute', left: fx * size - 50, top: fy * size - 40, width: 100, alignItems: 'center' }}>
                {here ? <Pulse>{badge}</Pulse> : badge}
                {here && s.fighter && (
                  <View pointerEvents="none" style={{ position: 'absolute', top: -58 }}>
                    <Float amount={5}>
                      <Sprite char={s.fighter.species} skin={s.fighter.skin} size={56} />
                    </Float>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>
      <GL size={12} color="#E0F2FE" style={{ paddingBottom: insets.bottom + 16 }}>לחץ על אי כדי לראות את השלבים שלו</GL>
    </View>
  );
}

function StageSheet({ stage, onClose, onFight }: { stage: number; onClose: () => void; onFight: () => void }) {
  const { s } = useArena();
  const e = enemyForStage(stage);
  const me = s.fighter!;
  const adv = elementBonus(SPECIES[me.species].element, SPECIES[e.species].element);
  const disadv = elementBonus(SPECIES[e.species].element, SPECIES[me.species].element);
  const r = stageRewards(stage, 3, !s.stars[stage]);
  const boss = isWorldBoss(stage) ? 'בוס העולם!' : isBoss(stage) ? 'בוס!' : '';
  return (
    <Pressable onPress={onClose} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
      <Pressable onPress={() => {}} style={{ margin: 12, borderRadius: 24, overflow: 'hidden' }}>
        <LinearGradient colors={['#3B1C6E', '#160B33']} style={{ padding: 16, borderWidth: 2, borderColor: '#A78BFA', borderRadius: 24 }}>
          <GT size={20}>{`שלב ${stage}${boss ? ` · ${boss}` : ''}`}</GT>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginTop: 8 }}>
            <Sprite char={e.species} size={130} />
            <View style={{ flex: 1, gap: 4 }}>
              <GT size={20} style={{ textAlign: 'right' }}>
                {e.name}
              </GT>
              <GL style={{ textAlign: 'right' }} color={ELEMENTS[SPECIES[e.species].element].color}>{`${ELEMENTS[SPECIES[e.species].element].icon} ${ELEMENTS[SPECIES[e.species].element].label} · רמה ${e.level}`}</GL>
              <GL style={{ textAlign: 'right' }} color={adv > 1 ? '#4ADE80' : disadv > 1 ? '#F87171' : '#E9D5FF'}>
                {adv > 1 ? '✓ יש לך יתרון סוג!' : disadv > 1 ? '⚠ היריב חזק נגד הסוג שלך' : 'אין יתרון סוג'}
              </GL>
              <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                <Pill icon="Coin" value={`עד ${r.coins}`} />
                {r.gems ? <Pill icon="Crystal1" value={r.gems} color="#67E8F9" /> : null}
                {r.chest ? <Pill icon="Chest_Closed" value="תיבה" color="#F59E0B" /> : null}
              </View>
            </View>
          </View>
          <GButton title="קרב!" size={22} height={58} style={{ marginTop: 12 }} onPress={onFight} />
        </LinearGradient>
      </Pressable>
    </Pressable>
  );
}
