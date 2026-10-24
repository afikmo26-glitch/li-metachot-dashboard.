import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { t } from '../i18n';
import { rankOf } from './data';
import { stageInWorld, worldOfStage } from './progress';
import { CHAR_ART, WORLD_ART } from './simArt';
import { useArena } from './state';
import { Float, GL, GT, ItemIcon, OUTLINE, Pulse } from './ui';

/**
 * The way into "הסים שלך" from the diary: a holographic trading card with your fighter standing on a pile of
 * gold coins, its level, rank and stage, and a big yellow button.
 */
export default function ArenaCard({ onOpen, style }: { onOpen: () => void; style?: object }) {
  const { s } = useArena();
  const f = s.fighter;
  const rank = rankOf(s.trophies);
  const w = worldOfStage(s.stage);
  const art = CHAR_ART[(f?.skin ?? f?.species) || 'dragon_gold'] ?? CHAR_ART.dragon;
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={t('הסים שלך')} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.97 : 1 }] }, style]}>
      <View style={{ height: 170, borderRadius: 26, borderWidth: 3, borderColor: '#FDE68A', overflow: 'visible' }}>
        <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: 23, overflow: 'hidden' }}>
          <Image source={WORLD_ART.card_holo} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </View>
        <View style={{ position: 'absolute', right: 16, top: 16, left: '46%' }}>
          <GT size={24} color="#1F1033" style={{ textAlign: 'right', textShadowColor: 'rgba(255,255,255,0.7)', textShadowOffset: { width: 0, height: 2 } }}>
            {t('🔥 הסים שלך')}
          </GT>
          {f ? (
            <>
              <GL size={13} color="#3B0764" style={{ textAlign: 'right', marginTop: 2 }}>{`${f.name} · ${t('רמה')} ${f.level} · ${rank.label}`}</GL>
              <GL size={12} color="#4C1D95" style={{ textAlign: 'right', marginTop: 1 }}>{`${w.name} · ${t('שלב')} ${stageInWorld(s.stage)}`}</GL>
            </>
          ) : (
            <GL size={13} color="#3B0764" style={{ textAlign: 'right', marginTop: 2 }}>
              {t('בחר לוחם, אסוף סקינים והילחם בשחקנים מכל ישראל')}
            </GL>
          )}
          <Pulse style={{ alignSelf: 'flex-end', marginTop: 10 }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: '#FDE047', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 3, borderColor: OUTLINE, borderBottomWidth: 6 }}>
              <ItemIcon icon="it_flame_sword" size={22} />
              <GT size={16} color="#3B1505" style={{ textShadowColor: 'transparent' }}>
                {f ? t('לקרב!') : t('בוא נתחיל!')}
              </GT>
            </View>
          </Pulse>
        </View>
        {/* the fighter stands on the coins and breaks out of the card's top edge */}
        <View pointerEvents="none" style={{ position: 'absolute', left: -6, bottom: 6, width: 190, height: 220 }}>
          <Float amount={5}>
            <Image source={art} style={{ width: 190, height: 220 }} resizeMode="contain" />
          </Float>
        </View>
        {f && (
          <View style={{ position: 'absolute', bottom: 8, left: 150 }}>
            <ItemIcon icon={rank.icon} size={34} />
          </View>
        )}
      </View>
    </Pressable>
  );
}
