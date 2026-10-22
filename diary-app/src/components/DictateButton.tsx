import { Ionicons } from '@expo/vector-icons';
import { SpeechModule as ExpoSpeechRecognitionModule, useSpeechEvent as useSpeechRecognitionEvent } from '../lib/speech';
import React, { useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { getLang, t } from '../i18n';
import { colors } from '../lib/theme';
import { tap } from './ui';

/** Speech-to-text: tap, talk, and the words are added to the text. Uses the phone's own recognizer. */

const LOCALES = { he: 'he-IL', en: 'en-US', ar: 'ar-SA' } as const;

export default function DictateButton({ onText, onInterim, size = 22 }: { onText: (text: string) => void; onInterim?: (text: string) => void; size?: number }) {
  const [listening, setListening] = useState(false);

  useSpeechRecognitionEvent('result', (e) => {
    if (!listening) return;
    const text = e.results[0]?.transcript ?? '';
    if (e.isFinal) {
      onInterim?.('');
      if (text.trim()) onText(text.trim());
    } else onInterim?.(text);
  });
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    onInterim?.('');
  });
  useSpeechRecognitionEvent('error', (e) => {
    setListening(false);
    onInterim?.('');
    if (e.error !== 'aborted' && e.error !== 'no-speech') Alert.alert(t('ההכתבה נעצרה'), t('אפשר לנסות שוב, או להשתמש במיקרופון של המקלדת'));
  });

  const toggle = async () => {
    tap();
    if (listening) {
      ExpoSpeechRecognitionModule?.stop();
      return;
    }
    try {
      if (!ExpoSpeechRecognitionModule || !ExpoSpeechRecognitionModule.isRecognitionAvailable()) throw new Error('unavailable');
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('צריך הרשאה למיקרופון'), t('אפשר לאשר בהגדרות הטלפון'));
        return;
      }
      ExpoSpeechRecognitionModule.start({ lang: LOCALES[getLang()], interimResults: true, continuous: true, addsPunctuation: true });
      setListening(true);
    } catch {
      Alert.alert(t('הכתבה לא זמינה כאן'), t('אפשר להשתמש במיקרופון של המקלדת'));
    }
  };

  return (
    <Pressable
      onPress={toggle}
      hitSlop={8}
      accessibilityLabel={listening ? t('עצור הכתבה') : t('הכתב בקול')}
      style={{
        width: size + 22,
        height: size + 22,
        borderRadius: (size + 22) / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: listening ? colors.red : colors.cardHi,
        borderWidth: 1,
        borderColor: listening ? colors.red : colors.border,
      }}
    >
      <Ionicons name={listening ? 'stop' : 'mic'} size={size} color={listening ? '#fff' : colors.primaryHi} />
    </Pressable>
  );
}
