import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Alert, Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import { formatDuration } from '../lib/dates';
import { colors, gradients } from '../lib/theme';
import { T, tap } from './ui';
import { getLang, t } from '../i18n';

type Props = {
  /** Called when a recording finishes, with the temp file uri, its duration, when it started and (in a browser) what was heard */
  onRecorded: (uri: string, durationMs: number, startedAt: Date, transcript?: string) => void;
  hasRecording: boolean;
};

type WebRecognition = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void };
const LOCALES = { he: 'he-IL', en: 'en-US', ar: 'ar-SA' } as const;

/** In a browser the AI can't hear the file itself, so the browser's own speech-to-text listens along while recording. */
function startWebListening(onText: (text: string) => void): WebRecognition | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => WebRecognition; webkitSpeechRecognition?: new () => WebRecognition };
  const Rec = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Rec) return null;
  try {
    const rec = new Rec();
    rec.lang = LOCALES[getLang()];
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => onText(Array.from(e.results).filter((r) => r.isFinal).map((r) => r[0].transcript).join(' '));
    rec.onerror = () => {};
    rec.start();
    return rec;
  } catch {
    return null;
  }
}

export default function Recorder({ onRecorded, hasRecording }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const startedAt = useRef<Date | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;
  const listener = useRef<WebRecognition | null>(null);
  const heard = useRef('');

  useEffect(() => {
    if (!state.isRecording) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [state.isRecording, pulse]);

  const noMic = () =>
    Platform.OS === 'web'
      ? Alert.alert(t('אין גישה למיקרופון'), t('הדפדפן כאן לא נותן גישה למיקרופון. באפליקציה בטלפון ההקלטה עובדת. בינתיים אפשר לכתוב בתיבה למטה 🙂'))
      : Alert.alert(t('אין גישה למיקרופון'), t('אפשר גישה למיקרופון בהגדרות הטלפון כדי להקליט את היום שלך.'));

  const start = async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) return noMic();
      tap('medium');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      startedAt.current = new Date();
      recorder.record();
      heard.current = '';
      listener.current = startWebListening((text) => (heard.current = text));
    } catch {
      noMic();
    }
  };

  const stop = async () => {
    tap('heavy');
    const duration = state.durationMillis;
    listener.current?.stop();
    listener.current = null;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {
      // the file is usually there even if the audio mode didn't switch back
    }
    if (recorder.uri) onRecorded(recorder.uri, duration, startedAt.current ?? new Date(), heard.current.trim() || undefined);
  };

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <View style={{ alignItems: 'center', paddingVertical: 8 }}>
      <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}>
        {state.isRecording && (
          <Animated.View
            style={{
              position: 'absolute',
              width: 130,
              height: 130,
              borderRadius: 65,
              backgroundColor: colors.pink,
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            }}
          />
        )}
        <Pressable onPress={state.isRecording ? stop : start} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.94 : 1 }] })}>
          <LinearGradient
            colors={state.isRecording ? gradients.record : gradients.primary}
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: colors.pink,
              shadowOpacity: 0.6,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <Text style={{ fontSize: 37 }}>{state.isRecording ? '⏹️' : '🎙️'}</Text>
          </LinearGradient>
        </Pressable>
      </View>
      <T bold size={state.isRecording ? 26 : 16} style={{ textAlign: 'center', marginTop: 4, fontVariant: ['tabular-nums'] }}>
        {state.isRecording
          ? formatDuration(state.durationMillis)
          : hasRecording
            ? t('✅ ההקלטה נשמרה — אפשר להקליט מחדש')
            : t('לחץ והקלט איך היה היום שלך')}
      </T>
      {state.isRecording && (
        <T dim size={13} style={{ textAlign: 'center', marginTop: 4 }}>
          {t('● מקליט… לחץ שוב לסיום')}
        </T>
      )}
    </View>
  );
}
