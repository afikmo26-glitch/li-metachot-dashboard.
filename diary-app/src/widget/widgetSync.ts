import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { t } from '../i18n';
import { computeStreak, dayKey } from '../lib/dates';
import { currentLove, isNight, petLine, treatsLeft } from '../lib/pet';
import { useStore } from '../lib/store';
import { PetWidget, WidgetSnapshot } from './PetWidget';

const KEY = 'diary.widget.v1';

export async function loadSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WidgetSnapshot) : null;
  } catch {
    return null;
  }
}

/** Saves what the widget shows and redraws it, whenever the pet or the diary changes (Android only). */
export function useWidgetSync() {
  const { ready, pet, entries, settings } = useStore();
  useEffect(() => {
    if (Platform.OS !== 'android' || !ready) return;
    const timer = setTimeout(async () => {
      const today = entries.filter((e) => dayKey(e.createdAt) === dayKey(new Date()));
      const love = currentLove(pet);
      const snap: WidgetSnapshot = {
        hatched: pet.hatched,
        name: pet.name || t('יומי'),
        species: pet.species,
        color: pet.wear.color,
        love,
        streak: computeStreak(new Set(entries.map((e) => dayKey(e.createdAt)))),
        line: pet.hatched ? petLine(pet, settings.userName, today.length > 0, love, new Date(), today[0]?.mood) : t('🥚 יש לך ביצה! בוא נבקע אותה ביחד'),
        wroteToday: today.length > 0,
        treats: treatsLeft(pet, entries),
        night: isNight(),
      };
      await AsyncStorage.setItem(KEY, JSON.stringify(snap)).catch(() => {});
      requestWidgetUpdate({ widgetName: 'Pet', renderWidget: () => React.createElement(PetWidget, { s: snap }) }).catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [ready, pet, entries, settings.userName]);
}
