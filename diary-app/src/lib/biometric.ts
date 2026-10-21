import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { t } from '../i18n';

/** Fingerprint / Face ID as a faster way past the password lock. The password stays as the fallback. */

export async function biometricAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function biometricUnlock(): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: t('פתיחת היומן'),
      cancelLabel: t('ביטול'),
      fallbackLabel: t('סיסמה'),
    });
    return res.success;
  } catch {
    return false;
  }
}

/** "Face ID" on phones that unlock with the face, "fingerprint" otherwise (already translated). */
export async function biometricLabel(): Promise<string> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return Platform.OS === 'ios' ? 'Face ID' : t('זיהוי פנים');
  } catch {
    // fall through to fingerprint
  }
  return t('טביעת אצבע');
}
