import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, useWindowDimensions, View } from 'react-native';
import Animated, { SlideInLeft, SlideInRight, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';
import { WORLD_ART } from './simArt';
import { ELEMENTS, SPECIES, SpeciesId } from './data';
import { findOpponent, publish } from './online';
import { botOpponent, enemyForStage, Fighter, isBoss, stageSkill, worldOfStage, stageInWorld } from './progress';
import BattleScreen, { BattleResult } from './screens/BattleScreen';
import { BagScreen, GuardsScreen, RanksScreen, SkinsScreen } from './screens/Collection';
import Hub, { HubGo } from './screens/Hub';
import MapScreen from './screens/MapScreen';
import Pick from './screens/Pick';
import { ChestsScreen, ResultInfo, ResultScreen } from './screens/Rewards';
import Sprite from './Sprite';
import { useArena } from './state';
import { TapLayer } from './TapFx';
import { Float, GL, GT, Rays } from './ui';

type Fight = { mode: 'stage'; stage: number; foe: Fighter; foeName: string; skill: number; bg: string } | { mode: 'ranked'; foe: Fighter; foeName: string; skill: number; trophies: number; bg: string };

/** Ranked fights happen on the arena of your fighter's element. */
const HOME_ARENA: Record<string, string> = { fire: 'volcano', water: 'ocean', nature: 'forest', earth: 'forest', storm: 'storm', shadow: 'shadow' };
type Route = 'hub' | 'map' | 'matching' | 'battle' | 'result' | 'bag' | 'chests' | 'ranks' | 'guards' | 'skins';

/** "הסים שלך" (Your Sim): the whole game, opened full screen from the diary. Every touch sparkles. */
export default function Arena({ onClose }: { onClose: () => void }) {
  return (
    <TapLayer>
      <Game onClose={onClose} />
    </TapLayer>
  );
}

function Game({ onClose }: { onClose: () => void }) {
  const { ready, s, winStage, loseStage, ranked } = useArena();
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
  if (intro) return <Intro onDone={endIntro} />;
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
        setResult({ win: true, stars: r.stars, coins: got.coins, xp: got.xp, gems: got.gems, chest: got.chest, levelUps: got.levelUps, newGuard: got.newGuard, title: fight.foeName });
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
    else if (to === 'play') startStage(s.stage);
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
    default:
      return <Hub go={go} onClose={onClose} />;
  }
}

/** The game's own title screen, every time it opens: lightning, the fighters jump in, the logo slams down. */
function Intro({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const flash = useSharedValue(1);
  const logo = useSharedValue(0);
  useEffect(() => {
    flash.value = withSequence(withTiming(0, { duration: 500 }), withDelay(700, withTiming(0.85, { duration: 60 })), withTiming(0, { duration: 450 }));
    logo.value = withDelay(750, withSpring(1, { damping: 7, stiffness: 160 }));
    const id = setTimeout(onDone, 3000);
    return () => clearTimeout(id);
  }, [onDone, flash, logo]);
  const flashSt = useAnimatedStyle(() => ({ opacity: flash.value }));
  const logoSt = useAnimatedStyle(() => ({ opacity: Math.min(1, logo.value * 2), transform: [{ scale: 2.4 - logo.value * 1.4 }, { rotate: `${(1 - logo.value) * -8}deg` }] }));
  const hero = Math.min(width * 0.5, 230);
  return (
    <Pressable onPress={onDone} accessibilityRole="button" accessibilityLabel="הסים שלך, לחץ להתחלה" style={{ flex: 1, backgroundColor: '#05010D' }}>
      <Image source={WORLD_ART.arena_shadow} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.55 }} resizeMode="cover" />
      <LinearGradient colors={['rgba(5,1,13,0.9)', 'rgba(60,10,90,0.25)', 'rgba(5,1,13,0.95)']} style={{ position: 'absolute', width: '100%', height: '100%' }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Rays size={760} color="rgba(168,85,247,0.1)" />
        <Animated.View style={logoSt}>
          <GT size={58} color="#FDE047" style={{ textShadowColor: '#7C2D12', textShadowOffset: { width: 0, height: 6 } }}>
            הסים שלך
          </GT>
          <View style={{ alignSelf: 'center', marginTop: 2, backgroundColor: '#DC2626', borderRadius: 6, borderWidth: 3, borderColor: '#120A24', paddingHorizontal: 12, transform: [{ rotate: '-3deg' }] }}>
            <GT size={14}>ARENA</GT>
          </View>
        </Animated.View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 20 }}>
          <Animated.View entering={SlideInRight.delay(250).springify().damping(12)}>
            <Sprite char="cat" anim="idle" size={hero * 0.7} />
          </Animated.View>
          <Animated.View entering={ZoomIn.delay(100).springify().damping(9)} style={{ marginHorizontal: -hero * 0.15, zIndex: 1 }}>
            <Sprite char="dragon" anim="idle" size={hero} />
          </Animated.View>
          <Animated.View entering={SlideInLeft.delay(400).springify().damping(12)}>
            <Sprite char="wolf" anim="idle" size={hero * 0.7} flip />
          </Animated.View>
        </View>
        <Float>
          <GT size={15} color="#E9D5FF" style={{ marginTop: 34 }}>
            ⚡ לחץ להתחלה ⚡
          </GT>
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
