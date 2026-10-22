import { useMemo } from 'react';
import { levelOf, totalXp } from './pet';
import { useStore } from './store';

/** The user's XP and level, from everything they do in the app. */
export function useLevel() {
  const { game, pet, entries, people, savingsTx, studySessions } = useStore();
  return useMemo(() => {
    const xp = totalXp(game, pet, entries, people, savingsTx, studySessions);
    return { xp, ...levelOf(xp) };
  }, [game, pet, entries, people, savingsTx, studySessions]);
}
