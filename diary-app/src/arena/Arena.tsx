import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ELEMENTS, SPECIES, SpeciesId } from './data';
import { findOpponent, publish } from './online';
import { botOpponent, enemyForStage, Fighter, isBoss, stageSkill, worldOfStage, stageInWorld } from './progress';
import BattleScreen, { BattleResult } from './screens/BattleScreen';
import { BagScreen, GuardsScreen, RanksScreen } from './screens/Collection';
import Hub, { HubGo } from './screens/Hub';
import MapScreen from './screens/MapScreen';
import Pick from './screens/Pick';
import { ChestsScreen, ResultInfo, ResultScreen } from './screens/Rewards';
import Sprite from './Sprite';
import { useArena } from './state';
import { Float, GL, GT, Rays } from './ui';

type Fight = { mode: 'stage'; stage: number; foe: Fighter; foeName: string; skill: number } | { mode: 'ranked'; foe: Fighter; foeName: string; skill: number; trophies: number };
type Route = 'hub' | 'map' | 'matching' | 'battle' | 'result' | 'bag' | 'chests' | 'ranks' | 'guards';

/** Pet Arena ("קרב החיות"): the whole game, opened full screen from the diary. */
export default function Arena({ onClose }: { onClose: () => void }) {
  const { ready, s, winStage, loseStage, ranked } = useArena();
  const [route, setRoute] = useState<Route>('hub');
  const [fight, setFight] = useState<Fight | null>(null);
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [battleKey, setBattleKey] = useState(0);

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
  if (!s.fighter) return <Pick onDone={() => setRoute('hub')} />;
  const guards = s.guards.slice(0, 3);

  const startStage = (stage: number) => {
    const foe = enemyForStage(stage);
    setFight({ mode: 'stage', stage, foe, foeName: isBoss(stage) ? `בוס: ${foe.name}` : `${worldOfStage(stage).name} · שלב ${stageInWorld(stage)}`, skill: stageSkill(stage) });
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
    setFight({ mode: 'ranked', foe: opp.fighter, foeName: opp.player, skill: 0.7, trophies: opp.trophies });
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
    else setRoute(to);
  };

  switch (route) {
    case 'map':
      return <MapScreen onBack={() => setRoute('hub')} onFight={startStage} />;
    case 'matching':
      return <Matching species={s.fighter.species} />;
    case 'battle':
      return fight ? <BattleScreen key={battleKey} me={s.fighter} foe={fight.foe} foeName={fight.foeName} skill={fight.skill} guards={guards} onEnd={onBattleEnd} /> : null;
    case 'result':
      return result ? (
        <ResultScreen
          r={result}
          char={s.fighter.species}
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
    default:
      return <Hub go={go} onClose={onClose} />;
  }
}

/** "Looking for an opponent…" between tapping ranked battle and the fight. */
function Matching({ species }: { species: SpeciesId }) {
  const el = ELEMENTS[SPECIES[species].element];
  return (
    <LinearGradient colors={['#1D4ED8', '#2A1052', '#12082A']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Rays size={520} color="rgba(255,255,255,0.07)" />
      <Float>
        <Sprite char={species} anim="win" size={200} />
      </Float>
      <GT size={24} style={{ marginTop: 10 }}>
        מחפש יריב בישראל…
      </GT>
      <GL style={{ marginTop: 6 }} color={el.color}>{`${el.icon} מחזיק אצבעות!`}</GL>
      <ActivityIndicator color="#fff" size="large" style={{ marginTop: 18 }} />
    </LinearGradient>
  );
}
