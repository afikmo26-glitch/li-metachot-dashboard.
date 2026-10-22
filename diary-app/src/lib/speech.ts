/**
 * The phone's speech-to-text, loaded only if this build has it (Expo Go, used for quick tests on an iPhone,
 * doesn't include it — there the dictation button simply says it isn't available).
 */
type SpeechLib = typeof import('expo-speech-recognition');

let lib: SpeechLib | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  lib = require('expo-speech-recognition') as SpeechLib;
} catch {
  lib = null;
}

export const SpeechModule = lib?.ExpoSpeechRecognitionModule ?? null;

/** Same as the library's hook; a no-op where the module is missing. */
export const useSpeechEvent: SpeechLib['useSpeechRecognitionEvent'] = lib ? lib.useSpeechRecognitionEvent : () => {};
