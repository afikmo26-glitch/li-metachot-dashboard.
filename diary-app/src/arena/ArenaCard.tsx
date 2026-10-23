import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, View } from 'react-native';
import { t } from '../i18n';
import { rankOf } from './data';
import Sprite from './Sprite';
import { useArena } from './state';
import { GL, GT, ItemIcon, Pulse } from './ui';
import { stageInWorld, worldOfStage } from './progress';

/** The way into "הסים שלך" from the diary: your fighter bouncing, your level and rank, one big button. */
export default function ArenaCard({ onOpen, style }: { onOpen: () => void; style?: object }) {
  const { s } = useArena();
  const f = s.fighter;
  const rank = rankOf(s.trophies);
  const w = worldOfStage(s.stage);
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={t('הסים שלך')} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.97 : 1 }] }, style]}>
      <LinearGradient colors={['#F59E0B', '#DC2626', '#7C3AED']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={{ borderRadius: 24, padding: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.45)', overflow: 'hidden', minHeight: 128 }}>
        <View style={{ flex: 1 }}>
          <GT size={22} style={{ textAlign: 'right' }}>
            {t('🔥 הסים שלך')}
          </GT>
          {f ? (
            <>
              <GL size={13} color="#FEF3C7" style={{ textAlign: 'right', marginTop: 2 }}>{`${f.name} · ${t('רמה')} ${f.level} · ${rank.label}`}</GL>
              <GL size={12} color="#FDE68A" style={{ textAlign: 'right', marginTop: 2 }}>{`${w.name} · ${t('שלב')} ${stageInWorld(s.stage)}${s.chests.length ? ` · ${s.chests.length} ${t('תיבות מחכות')}` : ''}`}</GL>
            </>
          ) : (
            <GL size={13} color="#FEF3C7" style={{ textAlign: 'right', marginTop: 2 }}>
              {t('בחר לוחם, אסוף סקינים והילחם בשחקנים מכל ישראל')}
            </GL>
          )}
          <Pulse style={{ alignSelf: 'flex-end', marginTop: 8 }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: '#FDE047', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7, borderBottomWidth: 4, borderColor: '#B45309' }}>
              <ItemIcon icon="Sword_Golden" size={22} />
              <GT size={15} color="#7C2D12" style={{ textShadowColor: 'transparent' }}>
                {f ? t('לקרב!') : t('בוא נתחיל!')}
              </GT>
            </View>
          </Pulse>
        </View>
        <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
          <Sprite char={f?.species ?? 'dragon'} skin={f?.skin} anim={f ? 'idle' : 'win'} size={130} fps={12} />
          {f && <View style={{ position: 'absolute', bottom: 2, right: 0 }}>
            <ItemIcon icon={rank.icon} size={34} />
          </View>}
        </View>
      </LinearGradient>
    </Pressable>
  );
}
