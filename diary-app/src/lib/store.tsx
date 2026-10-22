import AsyncStorage from '@react-native-async-storage/async-storage';
import { decryptFromStorage, encryptForStorage } from './crypto';
import { detectFollowUps } from './followups';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarEvent,
  DEFAULT_GAME_STATS,
  DEFAULT_SETTINGS,
  Entry,
  FollowUp,
  GameStats,
  Goal,
  ActiveShift,
  Shift,
  Workplace,
  SavingsGoal,
  SavingsTx,
  Person,
  Settings,
  EMPTY_PROFILE,
  UserProfile,
} from './types';
import { DEFAULT_PET, type PetState } from './pet';

const KEYS = {
  entries: 'diary.entries.v1',
  people: 'diary.people.v1',
  events: 'diary.events.v1',
  settings: 'diary.settings.v1',
  game: 'diary.game.v1',
  profile: 'diary.profile.v1',
  followUps: 'diary.followups.v1',
  goals: 'diary.goals.v1',
  workplaces: 'diary.workplaces.v1',
  shifts: 'diary.shifts.v1',
  activeShift: 'diary.activeshift.v1',
  savingsGoals: 'diary.savings.v1',
  savingsTx: 'diary.savingstx.v1',
  pet: 'diary.pet.v1',
};

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

type Store = {
  ready: boolean;
  entries: Entry[]; // newest first
  people: Person[];
  events: CalendarEvent[];
  settings: Settings;
  game: GameStats;
  profile: UserProfile;
  updateProfile: (patch: Partial<UserProfile>) => void;
  saveEntry: (e: Entry) => void;
  deleteEntry: (id: string) => void;
  addPerson: (name: string) => Person;
  updatePerson: (p: Person) => void;
  deletePerson: (id: string) => void;
  saveEvent: (e: CalendarEvent) => void;
  deleteEvent: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateGame: (patch: Partial<GameStats>) => void;
  followUps: FollowUp[];
  saveFollowUp: (f: FollowUp) => void;
  deleteFollowUp: (id: string) => void;
  goals: Goal[];
  saveGoal: (g: Goal) => void;
  deleteGoal: (id: string) => void;
  workplaces: Workplace[];
  saveWorkplace: (w: Workplace) => void;
  deleteWorkplace: (id: string) => void;
  shifts: Shift[];
  saveShift: (s: Shift) => void;
  deleteShift: (id: string) => void;
  activeShift: ActiveShift | null;
  setActiveShift: (a: ActiveShift | null) => void;
  savingsGoals: SavingsGoal[];
  saveSavingsGoal: (g: SavingsGoal) => void;
  deleteSavingsGoal: (id: string) => void;
  savingsTx: SavingsTx[];
  pet: PetState;
  updatePet: (patch: Partial<PetState> | ((p: PetState) => PetState)) => void;
  saveSavingsTx: (x: SavingsTx) => void;
  deleteSavingsTx: (id: string) => void;
  /** Replace everything at once (restoring a backup) */
  restoreAll: (data: BackupData) => void;
  /** Forget everything in memory (after the storage was wiped) */
  clearAll: () => void;
};

export type BackupData = {
  entries: Entry[];
  people: Person[];
  events: CalendarEvent[];
  settings: Settings;
  game: GameStats;
  profile: UserProfile;
  followUps: FollowUp[];
  goals: Goal[];
  workplaces?: Workplace[];
  shifts?: Shift[];
  savingsGoals?: SavingsGoal[];
  savingsTx?: SavingsTx[];
  pet?: PetState;
};

const Ctx = createContext<Store | null>(null);

/** State for a list of {id} records that persists itself on every change. */
function useList<T extends { id: string }>(key: string) {
  const [items, setItems] = useState<T[]>([]);
  const save = useCallback(
    (item: T) =>
      setItems((prev) => {
        const next = [...prev.filter((x) => x.id !== item.id), item];
        persist(key, next);
        return next;
      }),
    [key],
  );
  const remove = useCallback(
    (id: string) =>
      setItems((prev) => {
        const next = prev.filter((x) => x.id !== id);
        persist(key, next);
        return next;
      }),
    [key],
  );
  return [items, setItems, save, remove] as const;
}

async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(await decryptFromStorage(raw)) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Writes are encrypted (AES-GCM) with the device key; old plain values are re-encrypted on their next write. */
function persist(key: string, value: unknown) {
  encryptForStorage(JSON.stringify(value))
    .then((v) => AsyncStorage.setItem(key, v))
    .catch(() => {});
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [game, setGame] = useState<GameStats>(DEFAULT_GAME_STATS);
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [followUps, setFollowUps, saveFollowUp, deleteFollowUp] = useList<FollowUp>(KEYS.followUps);
  const [goals, setGoals, saveGoal, deleteGoal] = useList<Goal>(KEYS.goals);
  const [workplaces, setWorkplaces, saveWorkplace, deleteWorkplace] = useList<Workplace>(KEYS.workplaces);
  const [shifts, setShifts, saveShift, deleteShift] = useList<Shift>(KEYS.shifts);
  const [savingsGoals, setSavingsGoals, saveSavingsGoal, deleteSavingsGoal] = useList<SavingsGoal>(KEYS.savingsGoals);
  const [savingsTx, setSavingsTx, saveSavingsTx, deleteSavingsTx] = useList<SavingsTx>(KEYS.savingsTx);
  const [activeShift, setActive] = useState<ActiveShift | null>(null);
  const [pet, setPet] = useState<PetState>(DEFAULT_PET);
  const updatePet = useCallback((patch: Partial<PetState> | ((p: PetState) => PetState)) => {
    setPet((prev) => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      persist(KEYS.pet, next);
      return next;
    });
  }, []);
  const setActiveShift = useCallback((a: ActiveShift | null) => {
    setActive(a);
    persist(KEYS.activeShift, a);
  }, []);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const followUpsRef = useRef(followUps);
  followUpsRef.current = followUps;
  const peopleRef = useRef(people);
  peopleRef.current = people;

  useEffect(() => {
    (async () => {
      const [e, p, ev, s, g, pr, fu, go, wp, sh, as, sg, st, pt] = await Promise.all([
        load<Entry[]>(KEYS.entries, []),
        load<Person[]>(KEYS.people, []),
        load<CalendarEvent[]>(KEYS.events, []),
        load<Settings>(KEYS.settings, DEFAULT_SETTINGS),
        load<GameStats>(KEYS.game, DEFAULT_GAME_STATS),
        load<UserProfile>(KEYS.profile, EMPTY_PROFILE),
        load<FollowUp[]>(KEYS.followUps, []),
        load<Goal[]>(KEYS.goals, []),
        load<Workplace[]>(KEYS.workplaces, []),
        load<Shift[]>(KEYS.shifts, []),
        load<ActiveShift | null>(KEYS.activeShift, null),
        load<SavingsGoal[]>(KEYS.savingsGoals, []),
        load<SavingsTx[]>(KEYS.savingsTx, []),
        load<PetState>(KEYS.pet, DEFAULT_PET),
      ]);
      setPet({ ...DEFAULT_PET, ...pt });
      setSavingsGoals(sg);
      setSavingsTx(st);
      setWorkplaces(wp);
      setShifts(sh);
      setActive(as);
      setFollowUps(fu);
      setGoals(go);
      setEntries(e);
      setPeople(p);
      setEvents(ev);
      setSettings({ ...DEFAULT_SETTINGS, ...s });
      setGame({ ...DEFAULT_GAME_STATS, ...g });
      setProfile({ ...EMPTY_PROFILE, ...pr });
      setReady(true);
    })();
  }, []);

  const saveEntry = useCallback((entry: Entry) => {
    // A new entry may hold news worth asking about later ("Dana has an interview")
    if (!entriesRef.current.some((x) => x.id === entry.id)) {
      const found = detectFollowUps(entry, peopleRef.current, followUpsRef.current, newId);
      if (found.length) {
        setFollowUps((prev) => {
          const next = [...prev, ...found];
          persist(KEYS.followUps, next);
          return next;
        });
      }
    }
    setEntries((prev) => {
      const rest = prev.filter((x) => x.id !== entry.id);
      const next = [entry, ...rest].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      persist(KEYS.entries, next);
      return next;
    });
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((x) => x.id !== id);
      persist(KEYS.entries, next);
      return next;
    });
  }, []);

  const addPerson = useCallback((name: string) => {
    const clean = name.trim();
    const existing = peopleRef.current.find((p) => p.name === clean);
    if (existing) return existing;
    const person: Person = { id: newId(), name: clean, firstSeen: new Date().toISOString() };
    peopleRef.current = [...peopleRef.current, person];
    setPeople((prev) => {
      const next = [...prev.filter((p) => p.name !== clean), person];
      persist(KEYS.people, next);
      return next;
    });
    return person;
  }, []);

  const updatePerson = useCallback((person: Person) => {
    setPeople((prev) => {
      const next = prev.map((p) => (p.id === person.id ? person : p));
      persist(KEYS.people, next);
      return next;
    });
  }, []);

  const deletePerson = useCallback((id: string) => {
    setPeople((prev) => {
      const next = prev.filter((p) => p.id !== id);
      persist(KEYS.people, next);
      return next;
    });
    setEntries((prev) => {
      const next = prev.map((e) => ({
        ...e,
        people: e.people.filter((p) => p !== id),
        quotes: e.quotes.filter((q) => q.personId !== id),
      }));
      persist(KEYS.entries, next);
      return next;
    });
  }, []);

  const saveEvent = useCallback((ev: CalendarEvent) => {
    setEvents((prev) => {
      const next = [...prev.filter((x) => x.id !== ev.id), ev].sort((a, b) => a.date.localeCompare(b.date));
      persist(KEYS.events, next);
      return next;
    });
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => {
      const next = prev.filter((x) => x.id !== id);
      persist(KEYS.events, next);
      return next;
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persist(KEYS.settings, next);
      return next;
    });
  }, []);

  const updateGame = useCallback((patch: Partial<GameStats>) => {
    setGame((prev) => {
      const next = { ...prev, ...patch };
      persist(KEYS.game, next);
      return next;
    });
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      persist(KEYS.profile, next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setEntries([]);
    setPeople([]);
    peopleRef.current = [];
    setEvents([]);
    setSettings(DEFAULT_SETTINGS);
    setGame(DEFAULT_GAME_STATS);
    setProfile(EMPTY_PROFILE);
    setFollowUps([]);
    setGoals([]);
    setWorkplaces([]);
    setShifts([]);
    setActive(null);
    setSavingsGoals([]);
    setSavingsTx([]);
    setPet(DEFAULT_PET);
  }, [setFollowUps, setGoals, setWorkplaces, setShifts, setSavingsGoals, setSavingsTx]);

  const restoreAll = useCallback(
    (d: BackupData) => {
      const all: [string, unknown][] = [
        [KEYS.entries, d.entries], [KEYS.people, d.people], [KEYS.events, d.events], [KEYS.settings, d.settings],
        [KEYS.game, d.game], [KEYS.profile, d.profile], [KEYS.followUps, d.followUps], [KEYS.goals, d.goals],
        [KEYS.workplaces, d.workplaces ?? []], [KEYS.shifts, d.shifts ?? []],
        [KEYS.savingsGoals, d.savingsGoals ?? []], [KEYS.savingsTx, d.savingsTx ?? []], [KEYS.pet, d.pet ?? DEFAULT_PET],
      ];
      all.forEach(([k, v]) => persist(k, v));
      setEntries(d.entries);
      setPeople(d.people);
      peopleRef.current = d.people;
      setEvents(d.events);
      setSettings({ ...DEFAULT_SETTINGS, ...d.settings });
      setGame({ ...DEFAULT_GAME_STATS, ...d.game });
      setProfile({ ...EMPTY_PROFILE, ...d.profile });
      setFollowUps(d.followUps ?? []);
      setGoals(d.goals ?? []);
      setWorkplaces(d.workplaces ?? []);
      setShifts(d.shifts ?? []);
      setSavingsGoals(d.savingsGoals ?? []);
      setSavingsTx(d.savingsTx ?? []);
      setPet({ ...DEFAULT_PET, ...d.pet });
    },
    [setFollowUps, setGoals, setWorkplaces, setShifts, setSavingsGoals, setSavingsTx],
  );

  const value = useMemo<Store>(
    () => ({
      ready,
      entries,
      people,
      events,
      settings,
      game,
      profile,
      updateProfile,
      saveEntry,
      deleteEntry,
      addPerson,
      updatePerson,
      deletePerson,
      saveEvent,
      deleteEvent,
      updateSettings,
      updateGame,
      followUps,
      saveFollowUp,
      deleteFollowUp,
      goals,
      saveGoal,
      deleteGoal,
      workplaces,
      saveWorkplace,
      deleteWorkplace,
      shifts,
      saveShift,
      deleteShift,
      activeShift,
      setActiveShift,
      savingsGoals,
      saveSavingsGoal,
      deleteSavingsGoal,
      savingsTx,
      pet,
      updatePet,
      saveSavingsTx,
      deleteSavingsTx,
      restoreAll,
      clearAll,
    }),
    [ready, entries, people, events, settings, game, profile, updateProfile, saveEntry, deleteEntry, addPerson, updatePerson, deletePerson, saveEvent, deleteEvent, updateSettings, updateGame, followUps, saveFollowUp, deleteFollowUp, goals, saveGoal, deleteGoal, workplaces, saveWorkplace, deleteWorkplace, shifts, saveShift, deleteShift, activeShift, setActiveShift, savingsGoals, saveSavingsGoal, deleteSavingsGoal, savingsTx, saveSavingsTx, deleteSavingsTx, pet, updatePet, restoreAll, clearAll],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}

export function personName(people: Person[], id: string): string {
  return people.find((p) => p.id === id)?.name ?? '?';
}
