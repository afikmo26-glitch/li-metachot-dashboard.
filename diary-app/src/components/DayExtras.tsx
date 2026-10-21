import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { t } from '../i18n';
import { pickPhoto } from '../lib/photos';
import { colors } from '../lib/theme';
import { Chip, GhostButton, Input, Row, T } from './ui';

/** The optional extras of a day: sleep, a workout, three good things, and a photo — only if the user wants. */

export type Extras = { sleep?: number; workout?: boolean; gratitude: string[]; photoUri?: string };
export const EMPTY_EXTRAS: Extras = { gratitude: ['', '', ''] };

const SLEEP = [4, 5, 6, 7, 8, 9, 10];

export default function DayExtras({ value, onChange, entryId }: { value: Extras; onChange: (v: Extras) => void; entryId: string }) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<Extras>) => onChange({ ...value, ...patch });
  const filled = value.sleep !== undefined || value.workout !== undefined || value.gratitude.some((g) => g.trim()) || value.photoUri;

  const photo = async (source: 'camera' | 'library') => {
    const uri = await pickPhoto(source, entryId);
    if (uri) set({ photoUri: uri });
  };

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} style={{ marginTop: 14 }}>
        <T bold style={{ color: colors.primaryHi }}>
          {filled ? t('✓ שינה, ספורט, דברים טובים ותמונה') : t('➕ שינה, ספורט, 3 דברים טובים ותמונה (לא חובה)')}
        </T>
      </Pressable>
    );
  }

  return (
    <View style={{ marginTop: 16 }}>
      <T bold style={{ marginBottom: 8 }}>
        {t('😴 כמה שעות ישנת?')}
      </T>
      <Row style={{ flexWrap: 'wrap' }}>
        {SLEEP.map((h) => (
          <Chip key={h} label={h === 10 ? '10+' : String(h)} active={value.sleep === h} onPress={() => set({ sleep: value.sleep === h ? undefined : h })} />
        ))}
      </Row>

      <T bold style={{ marginTop: 10, marginBottom: 8 }}>
        {t('🏃 התאמנת היום?')}
      </T>
      <Row>
        <Chip label={t('כן 💪')} active={value.workout === true} onPress={() => set({ workout: value.workout === true ? undefined : true })} />
        <Chip label={t('לא היום')} active={value.workout === false} onPress={() => set({ workout: value.workout === false ? undefined : false })} />
      </Row>

      <T bold style={{ marginTop: 10, marginBottom: 8 }}>
        {t('🙏 3 דברים טובים מהיום')}
      </T>
      {value.gratitude.map((g, i) => (
        <Input
          key={i}
          value={g}
          onChangeText={(v) => set({ gratitude: value.gratitude.map((x, j) => (j === i ? v : x)) })}
          placeholder={t('דבר טוב {n}…', { n: i + 1 })}
          style={{ marginBottom: 6 }}
        />
      ))}

      <T bold style={{ marginTop: 10, marginBottom: 8 }}>
        {t('📸 תמונה של היום (אם בא לך)')}
      </T>
      {value.photoUri ? (
        <View>
          <Image source={{ uri: value.photoUri }} style={{ width: 140, height: 186, borderRadius: 14, alignSelf: 'center' }} />
          <GhostButton title={t('הסר תמונה')} onPress={() => set({ photoUri: undefined })} style={{ marginTop: 8, borderWidth: 0 }} />
        </View>
      ) : (
        <Row style={{ gap: 10 }}>
          <GhostButton title={t('📷 צלם')} onPress={() => photo('camera')} style={{ flex: 1 }} />
          <GhostButton title={t('🖼️ מהגלריה')} onPress={() => photo('library')} style={{ flex: 1 }} />
        </Row>
      )}
    </View>
  );
}
