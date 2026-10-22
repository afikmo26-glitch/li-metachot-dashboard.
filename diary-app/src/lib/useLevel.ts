import { useMemo } from 'react';
import { levelOf, totalXp } from './pet';
import { useStore } from './store';

/** The user's XP and level, from everything they do in the app. */
export function useLevel() {
  const { game, pet, entries, people, savingsTx } = useStore();
  return useMemo(() => {
    const xp = totalXp(game, pet, entries, people, savingsTx);
    return { xp, ...levelOf(xp) };
  }, [game, pet, entries, people, savingsTx]);
}
