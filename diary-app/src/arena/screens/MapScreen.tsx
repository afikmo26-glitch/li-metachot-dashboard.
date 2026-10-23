import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Image, Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { WORLD_ART } from '../simArt';
import { elementBonus, ELEMENTS, SPECIES, STAGES_PER_WORLD, WORLDS } from '../data';
import { enemyForStage, isBoss, isWorldBoss, stageRewards } from '../progress';
import Sprite from '../Sprite';
import { useArena } from '../state';
import { Float, GButton, GL, GT, ItemIcon, Pill, Pulse } from '../ui';

// Where the 10 stages of a chapter sit on screen (x, y as fractions), bottom to top
const PATH = [
  [0.5, 0.9], [0.27, 0.82], [0.5, 0.74], [0.75, 0.66], [0.55, 0.58], [0.25, 0.5], [0.42, 0.42], [0.72, 0.35], [0.55, 0.27], [0.5, 0.15],
];

/** The world map: five worlds, each in chapters of ten stages with a boss at the end. */
export default function MapScreen({ onBack, onFight }: { onBack: () => void; onFight: (stage: number) => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { s } = useArena();
  const cur = s.stage;
  const [world, setWorld] = useState(Math.floor((cur - 1) / STAGES_PER_WORLD));
  const [chapter, setChapter] = useState(Math.floor(((cur - 1) % STAGES_PER_WORLD) / 10));
  const [pick, setPick] = useState<number | null>(null);
  const w = WORLDS[world];
  const first = world * STAGES_PER_WORLD + chapter * 10 + 1;
  const H = height - insets.top - insets.bottom - 150;
  const pts = PATH.map(([x, y]) => [x * width, y * H] as const);
  const d = pts.map(([x, y], i) => (i ? `L${x},${y}` : `M${x},${y}`)).join(' ');

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0620' }}>
      <Image source={WORLD_ART[`map_${w.bg}`]} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 12, paddingBottom: 8, backgroundColor: 'rgba(10,5,25,0.7)' }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={onBack} accessibilityLabel="חזרה" hitSlop={8} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <GT size={18} style={{ textAlign: 'right' }}>{`עולם ${w.id} · ${w.name}`}</GT>
            <GL size={11} style={{ textAlign: 'right' }}>{`שלבים ${first}–${first + 9} · פרק ${chapter + 1} מתוך 5`}</GL>
          </View>
          <Pill icon="Coin" value={s.coins} />
        </View>
        <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 8 }}>
          {WORLDS.map((ww, i) => {
            const open = cur > i * STAGES_PER_WORLD;
            const on = i === world;
            return (
              <Pressable
                key={ww.id}
                disabled={!open}
                onPress={() => {
                  setWorld(i);
                  setChapter(i === Math.floor((cur - 1) / STAGES_PER_WORLD) ? Math.floor(((cur - 1) % STAGES_PER_WORLD) / 10) : 0);
                }}
                accessibilityLabel={`עולם ${ww.id}${open ? '' : ' נעול'}`}
                style={{ flex: 1, height: 34, borderRadius: 10, overflow: 'hidden', opacity: open ? 1 : 0.45, borderWidth: on ? 2 : 0, borderColor: '#fff' }}
              >
                <LinearGradient colors={ww.colors} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  {open ? <GT size={13}>{ww.id}</GT> : <Ionicons name="lock-closed" size={14} color="#fff" />}
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <Svg width={width} height={H} style={{ position: 'absolute' }}>
          <Path d={d} stroke="rgba(60,30,10,0.55)" strokeWidth={22} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d={d} stroke="#FCD34D" strokeWidth={6} fill="none" strokeDasharray="2 14" strokeLinecap="round" />
        </Svg>
        {pts.map(([x, y], i) => {
          const stage = first + i;
          const boss = isBoss(stage);
          const done = (s.stars[stage] ?? 0) > 0;
          const isCur = stage === cur;
          const locked = stage > cur;
          const size = boss ? 70 : 52;
          const node = (
            <Pressable
              onPress={() => setPick(stage)}
              disabled={locked}
              accessibilityLabel={`שלב ${stage}${boss ? ', בוס' : ''}${locked ? ', נעול' : ''}`}
              style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: isCur ? '#FFFFFF' : done ? '#DCFCE7' : '#64748B', backgroundColor: locked ? '#334155' : isCur ? '#EAB308' : boss ? '#B91C1C' : '#16A34A' }}
            >
              {locked ? <Ionicons name="lock-closed" size={18} color="#CBD5E1" /> : <GT size={boss ? 18 : 16}>{(stage - 1) % STAGES_PER_WORLD + 1}</GT>}
            </Pressable>
          );
          return (
            <View key={stage} style={{ position: 'absolute', left: x - 40, top: y - 40, width: 80, height: 80, alignItems: 'center', justifyContent: 'center' }}>
              {done && (
                <View style={{ position: 'absolute', top: boss ? -6 : 2, flexDirection: 'row', zIndex: 2 }}>
                  {[1, 2, 3].map((k) => (
                    <View key={k} style={{ opacity: (s.stars[stage] ?? 0) >= k ? 1 : 0.25, marginTop: k === 2 ? -4 : 0 }}>
                      <ItemIcon icon="Star" size={18} />
                    </View>
                  ))}
                </View>
              )}
              {boss && !locked && (
                <View style={{ position: 'absolute', top: -58 }} pointerEvents="none">
                  <Float amount={5}>
                    <Sprite char={enemyForStage(stage).species} size={70} fps={10} />
                  </Float>
                </View>
              )}
              {isCur ? <Pulse>{node}</Pulse> : node}
            </View>
          );
        })}
        {pts.findIndex((_, i) => first + i === cur) >= 0 && s.fighter && (
          <View pointerEvents="none" style={{ position: 'absolute', left: pts[cur - first][0] - 34, top: pts[cur - first][1] - 92 }}>
            <Float amount={6} ms={500}>
              <Sprite char={s.fighter.species} skin={s.fighter.skin} size={64} fps={12} />
            </Float>
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row-reverse', gap: 10, paddingHorizontal: 14, paddingBottom: insets.bottom + 12, paddingTop: 8, backgroundColor: 'rgba(10,5,25,0.7)' }}>
        <GButton title="פרק קודם" tone="purple" size={14} height={44} style={{ flex: 1 }} disabled={chapter === 0} onPress={() => setChapter((c) => Math.max(0, c - 1))} />
        <GButton title="פרק הבא" tone="purple" size={14} height={44} style={{ flex: 1 }} disabled={chapter === 4 || first + 10 > cur} onPress={() => setChapter((c) => Math.min(4, c + 1))} />
      </View>

      {pick !== null && <StageSheet stage={pick} onClose={() => setPick(null)} onFight={() => onFight(pick)} />}
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
