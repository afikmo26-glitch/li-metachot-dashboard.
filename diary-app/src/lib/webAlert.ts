import { Alert, Platform } from 'react-native';

/**
 * React Native Web leaves Alert.alert empty, so confirmations (end shift, delete…) silently did nothing in
 * the browser preview. On web, show them with the browser's own alert/confirm instead.
 */
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }
    const cancel = buttons.find((b) => b.style === 'cancel');
    const action = [...buttons].reverse().find((b) => b.style !== 'cancel');
    if (window.confirm(text)) action?.onPress?.();
    else cancel?.onPress?.();
  };
}
