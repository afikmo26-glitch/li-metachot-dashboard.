import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLang, t } from '../i18n';
import { LEGAL_UPDATED, PRIVACY, TERMS } from '../legal/texts';
import { colors } from '../lib/theme';
import { Row, T } from './ui';

/** Privacy policy or terms of use, in Hebrew (or English for other languages). */
export default function LegalModal({ doc, onClose }: { doc: 'privacy' | 'terms' | null; onClose: () => void }) {
  const lang = getLang() === 'he' ? 'he' : 'en';
  const d = doc === 'terms' ? TERMS[lang] : PRIVACY[lang];
  return (
    <Modal visible={!!doc} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <T bold size={24}>
              {d.title}
            </T>
            <Pressable onPress={onClose} hitSlop={12}>
              <T bold style={{ color: colors.primaryHi }}>
                {t('סגור ✕')}
              </T>
            </Pressable>
          </Row>
          <T dim size={12} style={{ marginTop: 4 }}>
            {t('עודכן: {date}', { date: LEGAL_UPDATED })}
          </T>
          {d.sections.map((s) => (
            <View key={s.h} style={{ marginTop: 16 }}>
              <T bold size={17}>
                {s.h}
              </T>
              {s.p.map((p) => (
                <T key={p} size={15} style={{ marginTop: 6, lineHeight: 23, color: colors.textDim }}>
                  {p}
                </T>
              ))}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
