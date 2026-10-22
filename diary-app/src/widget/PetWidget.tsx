import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { Species } from '../lib/pet';
import { petSvgString } from './petSvg';

/** What the widget shows; saved by the app whenever the pet or the diary changes (no diary content). */
export type WidgetSnapshot = {
  hatched: boolean;
  name: string;
  species: Species;
  color?: string;
  love: number;
  streak: number;
  line: string;
  wroteToday: boolean;
  treats: number;
  night: boolean;
};

/** The home-screen widget: the pet, what it says, its love bar and the writing streak. Tapping opens the app. */
export function PetWidget({ s }: { s: WidgetSnapshot | null }) {
  if (!s || !s.hatched) {
    return (
      <FlexWidget clickAction="OPEN_APP" style={{ height: 'match_parent', width: 'match_parent', backgroundColor: '#1E1846', borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
        <TextWidget text="🥚" style={{ fontSize: 40 }} />
        <TextWidget text={s ? s.line : 'היומן שלי'} style={{ fontSize: 14, color: '#E9E3FF', marginTop: 4 }} />
      </FlexWidget>
    );
  }
  const mood = s.night ? 'asleep' : s.love > 70 || s.wroteToday ? 'happy' : 'awake';
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: '#1E1846', borderRadius: 24, flexDirection: 'row', alignItems: 'center', padding: 10 }}
    >
      <SvgWidget svg={petSvgString(s.species, s.color, mood)} style={{ height: 96, width: 96 }} />
      <FlexWidget style={{ flex: 1, flexDirection: 'column', marginLeft: 8 }}>
        <TextWidget text={s.name} style={{ fontSize: 18, color: '#FFFFFF', fontWeight: 'bold' }} />
        <TextWidget text={s.line} maxLines={2} style={{ fontSize: 13, color: '#D9D2FF', marginTop: 2 }} />
        <FlexWidget style={{ flexDirection: 'row', marginTop: 6, height: 8, width: 140, backgroundColor: '#3A3270', borderRadius: 4 }}>
          <FlexWidget style={{ height: 8, width: Math.max(4, Math.round((140 * s.love) / 100)), backgroundColor: '#FF6FA8', borderRadius: 4 }} />
        </FlexWidget>
        <TextWidget text={`💗 ${s.love}%   🔥 ${s.streak}   🍪 ${s.treats}`} style={{ fontSize: 12, color: '#E9E3FF', marginTop: 4 }} />
      </FlexWidget>
    </FlexWidget>
  );
}
