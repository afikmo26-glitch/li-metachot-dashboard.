import AsyncStorage from '@react-native-async-storage/async-storage';
import { decryptFromStorage, encryptForStorage } from './crypto';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarEvent,
  DEFAULT_GAME_STATS,
  DEFAULT_SETTINGS,
  Entry,
  GameStats,
  Person,
  Settings,
} from './types';

const KEYS = {
  entries: 'diary.entries.v1',
  people: 'diary.people.v1',
  events: 'diary.events.v1',
  settings: 'diary.settings.v1',
  game: 'diary.game.v1',
};

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

type Store = {
  ready: boolean;
  entries: Entry[]; // newest first
  people: Person[];
  events: CalendarEvent[];
  settings: Settings;
  game: GameStats;
  saveEntry: (e: Entry) => void;
  deleteEntry: (id: string) => void;
  addPerson: (name: string) => Person;
  updatePerson: (p: Person) => void;
  deletePerson: (id: string) => void;
  saveEvent: (e: CalendarEvent) => void;
  deleteEvent: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateGame: (patch: Partial<GameStats>) => void;
  /** Forget everything in memory (after the storage was wiped) */
  clearAll: () => void;
};

const Ctx = createContext<Store | null>(null);

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
  const peopleRef = useRef(people);
  peopleRef.current = people;

  useEffect(() => {
    (async () => {
      const [e, p, ev, s, g] = await Promise.all([
        load<Entry[]>(KEYS.entries, []),
        load<Person[]>(KEYS.people, []),
        load<CalendarEvent[]>(KEYS.events, []),
        load<Settings>(KEYS.settings, DEFAULT_SETTINGS),
        load<GameStats>(KEYS.game, DEFAULT_GAME_STATS),
      ]);
      setEntries(e);
      setPeople(p);
      setEvents(ev);
      setSettings({ ...DEFAULT_SETTINGS, ...s });
      setGame({ ...DEFAULT_GAME_STATS, ...g });
      setReady(true);
    })();
  }, []);

  const saveEntry = useCallback((entry: Entry) => {
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

  const clearAll = useCallback(() => {
    setEntries([]);
    setPeople([]);
    peopleRef.current = [];
    setEvents([]);
    setSettings(DEFAULT_SETTINGS);
    setGame(DEFAULT_GAME_STATS);
  }, []);

  const value = useMemo<Store>(
    () => ({
      ready,
      entries,
      people,
      events,
      settings,
      game,
      saveEntry,
      deleteEntry,
      addPerson,
      updatePerson,
      deletePerson,
      saveEvent,
      deleteEvent,
      updateSettings,
      updateGame,
      clearAll,
    }),
    [ready, entries, people, events, settings, game, saveEntry, deleteEntry, addPerson, updatePerson, deletePerson, saveEvent, deleteEvent, updateSettings, updateGame, clearAll],
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
