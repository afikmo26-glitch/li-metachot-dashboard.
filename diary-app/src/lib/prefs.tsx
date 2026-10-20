import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { isRTL, Lang, setLang } from '../i18n';
import { setSoundsEnabled } from './sound';
import { applyDirection, applyTheme, ThemeName } from './theme';

/**
 * Display preferences (language, theme, sounds), loaded before the first render.
 * Changing them rewrites the theme/direction singletons and bumps `version`,
 * which the app uses as a key to redraw every screen. Not sensitive, so stored plain.
 */

const KEY = 'diary.prefs.v1';

export type Prefs = { lang: Lang; theme: ThemeName; sounds: boolean };
export const DEFAULT_PREFS: Prefs = { lang: 'he', theme: 'night', sounds: true };

function apply(p: Prefs) {
  setLang(p.lang);
  applyDirection(isRTL());
  applyTheme(p.theme);
  setSoundsEnabled(p.sounds);
}

type Ctx = {
  prefs: Prefs;
  version: number;
  /** `fromSettings` reopens the settings screen after the redraw */
  setPrefs: (patch: Partial<Prefs>, fromSettings?: boolean) => void;
  /** True once after a change made from the settings screen, so it can reopen after the redraw */
  takeReopenSettings: () => boolean;
};

const PrefsCtx = createContext<Ctx | null>(null);

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setState] = useState<Prefs | null>(null);
  const [version, setVersion] = useState(0);
  const reopen = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => (raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS))
      .catch(() => DEFAULT_PREFS)
      .then((p: Prefs) => {
        apply(p);
        setState(p);
      });
  }, []);

  const setPrefs = useCallback((patch: Partial<Prefs>, fromSettings = false) => {
    setState((prev) => {
      const next = { ...(prev ?? DEFAULT_PREFS), ...patch };
      apply(next);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    reopen.current = fromSettings;
    setVersion((v) => v + 1);
  }, []);

  const takeReopenSettings = useCallback(() => {
    const r = reopen.current;
    reopen.current = false;
    return r;
  }, []);

  if (!prefs) return null;
  return <PrefsCtx.Provider value={{ prefs, version, setPrefs, takeReopenSettings }}>{children}</PrefsCtx.Provider>;
}

export function usePrefs(): Ctx {
  const c = useContext(PrefsCtx);
  if (!c) throw new Error('usePrefs must be used inside PrefsProvider');
  return c;
}
