import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import Modal, { CloseButton } from './AppModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { dayKey, formatShortDate } from '../lib/dates';
import { pickPhoto } from '../lib/photos';
import { newId, useStore } from '../lib/store';
import { colors, MOODS } from '../lib/theme';
import { Empty, GhostButton, GradientButton, notify, Row, T } from './ui';
import { gradients } from '../lib/theme';

/** All photos of the day in a grid, and a "watch the change" slideshow from the first to the latest. */
export default function PhotoTimeline({ visible, onClose, onOpenEntry }: { visible: boolean; onClose: () => void; onOpenEntry: (id: string) => void }) {
  const { entries, saveEntry } = useStore();
  const photos = useMemo(() => entries.filter((e) => e.photoUri).reverse(), [entries]);
  const [playing, setPlaying] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!playing) return;
    if (i >= photos.length - 1) {
      const done = setTimeout(() => setPlaying(false), 1500);
      return () => clearTimeout(done);
    }
    const next = setTimeout(() => setI(i + 1), 700);
    return () => clearTimeout(next);
  }, [playing, i, photos.length]);

  /** Today's photo goes on today's entry (if it has none yet), otherwise it becomes an entry of its own. */
  const takeToday = async (source: 'camera' | 'library') => {
    const today = entries.find((e) => dayKey(e.createdAt) === dayKey(new Date()) && !e.photoUri);
    const id = today?.id ?? newId();
    const uri = await pickPhoto(source, id);
    if (!uri) return;
    saveEntry(today ? { ...today, photoUri: uri } : { id, createdAt: new Date().toISOString(), text: '', mood: 3, people: [], quotes: [], photoUri: uri });
    notify('success');
  };

  const play = () => {
    setI(0);
    setPlaying(true);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        {playing && photos[i] ? (
          <Pressable style={{ flex: 1, backgroundColor: '#000' }} onPress={() => setPlaying(false)}>
            <Image source={{ uri: photos[i].photoUri }} style={{ flex: 1 }} resizeMode="contain" />
            <View style={{ position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#000a', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>
                {formatShortDate(photos[i].createdAt)} {MOODS[photos[i].mood - 1]}
              </Text>
            </View>
          </Pressable>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <T bold size={26}>
                {t('📸 התמונות שלי')}
              </T>
              <CloseButton onPress={onClose} />
            </Row>
            <Row style={{ gap: 10, marginTop: 14 }}>
              <GradientButton title={t('📷 צלם עכשיו')} colors={gradients.primary} onPress={() => takeToday('camera')} style={{ flex: 1 }} />
              <GhostButton title={t('🖼️ מהגלריה')} onPress={() => takeToday('library')} style={{ flex: 1 }} />
            </Row>
            {photos.length === 0 ? (
              <Empty emoji="📷" title={t('עוד אין תמונות')} text={t('כשתרצה, אפשר לצרף תמונה לרשומה של היום. ככה רואים איך דברים משתנים לאורך זמן.')} />
            ) : (
              <>
                {photos.length >= 2 && <GradientButton title={t('▶️ צפה בשינוי לאורך הזמן')} colors={gradients.primary} onPress={play} style={{ marginTop: 14 }} />}
                <Row style={{ flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                  {photos.map((e) => (
                    <Pressable
                      key={e.id}
                      onPress={() => {
                        onClose();
                        onOpenEntry(e.id);
                      }}
                      style={{ width: '31.5%' }}
                    >
                      <Image source={{ uri: e.photoUri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12, backgroundColor: colors.card }} />
                      <T dim size={11} style={{ textAlign: 'center', marginTop: 2 }}>
                        {formatShortDate(e.createdAt)}
                      </T>
                    </Pressable>
                  ))}
                </Row>
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
