import { useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { backupNow, loadSession } from './cloud';
import { BackupData, useStore } from './store';

/** Everything that goes into a backup, from the store. */
export function useBackupData(): BackupData {
  const s = useStore();
  return useMemo(
    () => ({
      entries: s.entries,
      people: s.people,
      events: s.events,
      settings: s.settings,
      game: s.game,
      profile: s.profile,
      followUps: s.followUps,
      goals: s.goals,
      workplaces: s.workplaces,
      shifts: s.shifts,
      savingsGoals: s.savingsGoals,
      savingsTx: s.savingsTx,
      pet: s.pet,
      exams: s.exams,
      homework: s.homework,
      studySessions: s.studySessions,
    }),
    [s.entries, s.people, s.events, s.settings, s.game, s.profile, s.followUps, s.goals, s.workplaces, s.shifts, s.savingsGoals, s.savingsTx, s.pet, s.exams, s.homework, s.studySessions],
  );
}

/** Keeps the encrypted cloud copy up to date: 15 seconds after the last change, and when the app goes to the background. */
export function useCloudSync() {
  const { ready } = useStore();
  const data = useBackupData();
  const latest = useRef(data);
  useEffect(() => {
    latest.current = data;
  }, [data]);
  const dirty = useRef(false);

  const flush = async () => {
    if (!dirty.current) return;
    const s = await loadSession();
    if (!s?.key) return;
    dirty.current = false;
    try {
      await backupNow(latest.current);
    } catch {
      dirty.current = true; // try again next time
    }
  };

  useEffect(() => {
    if (!ready) return;
    dirty.current = true;
    const timer = setTimeout(flush, 15000);
    return () => clearTimeout(timer);
  }, [ready, data]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background' || st === 'inactive') flush();
    });
    return () => sub.remove();
  }, []);
}
