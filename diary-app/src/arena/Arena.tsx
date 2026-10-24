import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';
import { WORLD_ART } from './simArt';
import { ELEMENTS, SPECIES, SpeciesId } from './data';
import { findOpponent, publish } from './online';
import { botOpponent, enemyForStage, Fighter, isBoss, stageSkill, worldOfStage, stageInWorld } from './progress';
import BattleScreen, { BattleResult } from './screens/BattleScreen';
import { BagScreen, FightersScreen, GuardsScreen, RanksScreen, SkinsScreen, UpgradeScreen } from './screens/Collection';
import Hub, { HubGo } from './screens/Hub';
import MapScreen from './screens/MapScreen';
import Pick from './screens/Pick';
import { ChestsScreen, ResultInfo, ResultScreen } from './screens/Rewards';
import BrawlScreen from './screens/BrawlScreen';
import Sprite from './Sprite';
import { useArena } from './state';
import { TapLayer } from './TapFx';
import { Float, GL, GT, ItemIcon, Rays } from './ui';

type Fight = { mode: 'stage'; stage: number; foe: Fighter; foeName: string; skill: number; bg: string } | { mode: 'ranked'; foe: Fighter; foeName: string; skill: number; trophies: number; bg: string };

/** Ranked fights happen on the arena of your fighter's element. */
const HOME_ARENA: Record<string, string> = { fire: 'volcano', water: 'ocean', nature: 'forest', earth: 'forest', storm: 'storm', shadow: 'shadow' };
type Route = 'hub' | 'map' | 'matching' | 'battle' | 'result' | 'bag' | 'chests' | 'ranks' | 'guards' | 'skins' | 'fighters' | 'upgrade' | 'brawl';

/** "הסים שלך" (Your Sim): the whole game, opened full screen from the diary. Every touch sparkles. */
export default function Arena({ onClose }: { onClose: () => void }) {
  return (
    <TapLayer>
      <Game onClose={onClose} />
    </TapLayer>
  );
}

function Game({ onClose }: { onClose: () => void }) {
  const { ready, s, winStage, loseStage, ranked, brawlDone } = useArena();
  const [route, setRoute] = useState<Route>('hub');
  const [fight, setFight] = useState<Fight | null>(null);
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [battleKey, setBattleKey] = useState(0);
  const [intro, setIntro] = useState(true);
  const endIntro = useCallback(() => setIntro(false), []);

  // Keep the online card up to date (trophies, level, gear) — quietly, it's fine to be offline
  const last = useRef('');
  useEffect(() => {
    if (!s.fighter) return;
    const sig = `${s.trophies}:${s.fighter.level}:${s.fighter.species}:${JSON.stringify(s.fighter.equip)}`;
    if (sig === last.current) return;
    last.current = sig;
    const id = setTimeout(() => publish(s).catch(() => {}), 1500);
    return () => clearTimeout(id);
  }, [s]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: '#12082A' }} />;
  if (intro) return <Intro onDone={endIntro} char={s.fighter?.species ?? 'dragon'} skin={s.fighter?.skin} />;
  if (!s.fighter) return <Pick onDone={() => setRoute('hub')} />;
  const guards = s.guards.slice(0, 3);

  const startStage = (stage: number) => {
    const foe = enemyForStage(stage);
    setFight({ mode: 'stage', stage, foe, foeName: isBoss(stage) ? `בוס: ${foe.name}` : `${worldOfStage(stage).name} · שלב ${stageInWorld(stage)}`, skill: stageSkill(stage), bg: `arena_${worldOfStage(stage).bg}` });
    setBattleKey((k) => k + 1);
    setRoute('battle');
  };

  const startRanked = async () => {
    setRoute('matching');
    const started = Date.now();
    const real = await findOpponent(s.trophies);
    const opp = real ?? botOpponent(s.trophies, s.fighter!.level);
    // let the "searching" moment breathe a little
    await new Promise((r) => setTimeout(r, Math.max(0, 1600 - (Date.now() - started))));
    setFight({ mode: 'ranked', foe: opp.fighter, foeName: opp.player, skill: 0.7, trophies: opp.trophies, bg: `arena_${HOME_ARENA[SPECIES[s.fighter!.species].element]}` });
    setBattleKey((k) => k + 1);
    setRoute('battle');
  };

  const onBattleEnd = (r: BattleResult) => {
    if (!fight) return;
    if (fight.mode === 'stage') {
      if (r.win) {
        const got = winStage(fight.stage, r.stars);
        setResult({ win: true, stars: r.stars, coins: got.coins, xp: got.xp, gems: got.gems, chest: got.chest, levelUps: got.levelUps, newGuard: got.newGuard, trophies: got.trophies, title: fight.foeName });
      } else {
        loseStage();
        setResult({ win: false, stars: 0, coins: 0, xp: 0, levelUps: 0, title: `${fight.foeName} · שדרג חפצים ונסה שוב!` });
      }
    } else {
      const got = ranked(r.win, fight.trophies);
      setResult({ win: r.win, stars: r.stars, coins: got.coins, xp: got.xp, levelUps: got.levelUps, trophies: got.delta, title: `קרב מדורג נגד ${fight.foeName}` });
    }
    setRoute('result');
  };

  const go = (to: HubGo) => {
    if (to === 'ranked') startRanked();
    else if (to === 'play') {
      if (s.mode === 'chaos') setRoute('brawl');
      else startStage(s.stage);
    }
    else setRoute(to);
  };

  switch (route) {
    case 'map':
      return <MapScreen onBack={() => setRoute('hub')} onFight={startStage} />;
    case 'matching':
      return <Matching species={s.fighter.species} skin={s.fighter.skin} />;
    case 'battle':
      return fight ? <BattleScreen key={battleKey} me={s.fighter} foe={fight.foe} foeName={fight.foeName} skill={fight.skill} guards={guards} onEnd={onBattleEnd} bg={fight.bg} /> : null;
    case 'result':
      return result ? (
        <ResultScreen
          r={result}
          char={s.fighter.species}
          skin={s.fighter.skin}
          onContinue={() => setRoute(fight?.mode === 'stage' ? 'map' : 'hub')}
          onRetry={fight?.mode === 'stage' && !result.win ? () => startStage(fight.stage) : fight?.mode === 'ranked' ? startRanked : undefined}
        />
      ) : null;
    case 'bag':
      return <BagScreen onBack={() => setRoute('hub')} />;
    case 'chests':
      return <ChestsScreen onBack={() => setRoute('hub')} />;
    case 'ranks':
      return <RanksScreen onBack={() => setRoute('hub')} />;
    case 'guards':
      return <GuardsScreen onBack={() => setRoute('hub')} />;
    case 'skins':
      return <SkinsScreen onBack={() => setRoute('hub')} />;
    case 'fighters':
      return <FightersScreen onBack={() => setRoute('hub')} />;
    case 'upgrade':
      return <UpgradeScreen onBack={() => setRoute('hub')} />;
    case 'brawl':
      return (
        <BrawlScreen
          me={s.fighter}
          onEnd={(r) => {
            if (!r.waves) return setRoute('hub');
            const got = brawlDone(r.won, r.kills);
            setFight(null);
            setResult({ win: r.won, stars: r.won ? 3 : 0, coins: got.coins, xp: got.xp, levelUps: got.levelUps, trophies: got.trophies, title: `זירת הכאוס · ${r.kills} נוצחו` });
            setRoute('result');
          }}
        />
      );
    default:
      return <Hub go={go} onClose={onClose} />;
  }
}

/** The game's own title screen: moonlit ruins, your fighter inside a glowing glass orb, the title on the arch. */
function Intro({ onDone, char, skin }: { onDone: () => void; char: string; skin?: string }) {
  const { width, height } = useWindowDimensions();
  const flash = useSharedValue(1);
  const logo = useSharedValue(0);
  const orb = useSharedValue(0);
  useEffect(() => {
    flash.value = withTiming(0, { duration: 600 });
    orb.value = withRepeat(withTiming(1, { duration: 2200 }), -1, true);
    logo.value = withDelay(400, withSpring(1, { damping: 8, stiffness: 150 }));
    const id = setTimeout(onDone, 3600);
    return () => clearTimeout(id);
  }, [onDone, flash, logo, orb]);
  const flashSt = useAnimatedStyle(() => ({ opacity: flash.value }));
  const logoSt = useAnimatedStyle(() => ({ opacity: Math.min(1, logo.value * 2), transform: [{ scale: 1.8 - logo.value * 0.8 }] }));
  const glow = useAnimatedStyle(() => ({ opacity: 0.55 + orb.value * 0.35, transform: [{ scale: 1 + orb.value * 0.03 }] }));
  const R = Math.min(width * 0.78, 330);
  // the art's rune pedestal sits 62% down; the orb rests on it
  const cy = height * 0.6;
  return (
    <Pressable onPress={onDone} accessibilityRole="button" accessibilityLabel="הסים שלך, לחץ להתחלה" style={{ flex: 1, backgroundColor: '#0B0618' }}>
      <Image source={WORLD_ART.intro_ruins} style={{ position: 'absolute', left: -(height * 0.75 - width) / 2, top: 0, width: height * 0.75, height }} resizeMode="cover" />
      <LinearGradient colors={['rgba(11,6,24,0.1)', 'rgba(11,6,24,0)', 'rgba(11,6,24,0.55)']} style={{ position: 'absolute', width: '100%', height: '100%' }} />
      <Animated.View style={[{ position: 'absolute', top: height * 0.13, left: 0, right: 0, alignItems: 'center' }, logoSt]}>
        <GT size={50} color="#FDE68A" style={{ textShadowColor: '#5B2A06', textShadowOffset: { width: 0, height: 5 } }}>
          הסים שלך
        </GT>
        <ItemIcon icon="ic3_badge" size={84} />
      </Animated.View>
      {/* glass orb */}
      <Animated.View style={[{ position: 'absolute', left: width / 2 - R / 2, top: cy - R / 2 - R * 0.1, width: R, height: R, borderRadius: R / 2, borderWidth: 4, borderColor: 'rgba(147,197,253,0.85)', backgroundColor: 'rgba(96,165,250,0.12)' }, glow]} />
      <View pointerEvents="none" style={{ position: 'absolute', left: width / 2 - R / 2 + 14, top: cy - R / 2 - R * 0.1 + 14, width: R - 28, height: R - 28, borderRadius: R, borderWidth: 2, borderColor: 'rgba(253,230,138,0.5)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: width / 2 - R * 0.28, top: cy - R * 0.52, width: R * 0.22, height: R * 0.1, borderRadius: R, backgroundColor: 'rgba(255,255,255,0.35)', transform: [{ rotate: '-30deg' }] }} />
      <Animated.View entering={ZoomIn.delay(150).springify().damping(10)} style={{ position: 'absolute', left: width / 2 - R * 0.36, top: cy - R * 0.42, width: R * 0.72, height: R * 0.72 }}>
        <Sprite char={char} skin={skin} size={R * 0.72} live lobby />
      </Animated.View>
      {/* rune stone plate */}
      <View style={{ position: 'absolute', top: cy + R * 0.42, left: 0, right: 0, alignItems: 'center' }}>
        <Float amount={4}>
          <LinearGradient colors={['#3B4A5C', '#1F2937']} style={{ paddingHorizontal: 22, paddingVertical: 8, borderRadius: 10, borderWidth: 3, borderColor: '#0E1520', flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
            <GT size={13} color="#67E8F9">ᚱ ᛟ ᚾ</GT>
            <GT size={16} color="#E0F2FE">⚡ לחץ להתחלה ⚡</GT>
            <GT size={13} color="#67E8F9">ᛞ ᛗ ᛉ</GT>
          </LinearGradient>
        </Float>
      </View>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF' }, flashSt]} />
    </Pressable>
  );
}

/** "Looking for an opponent…" between tapping ranked battle and the fight. */
function Matching({ species, skin }: { species: SpeciesId; skin?: string }) {
  const el = ELEMENTS[SPECIES[species].element];
  return (
    <LinearGradient colors={['#1D4ED8', '#2A1052', '#12082A']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Rays size={520} color="rgba(255,255,255,0.07)" />
      <Float>
        <Sprite char={species} skin={skin} anim="win" size={220} />
      </Float>
      <GT size={24} style={{ marginTop: 10 }}>
        מחפש יריב בישראל…
      </GT>
      <GL style={{ marginTop: 6 }} color={el.color}>{`${el.icon} מחזיק אצבעות!`}</GL>
      <ActivityIndicator color="#fff" size="large" style={{ marginTop: 18 }} />
    </LinearGradient>
  );
}
