import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';
import { t } from '../i18n';

/** Optional photo of the day: taken or picked only when the user asks, kept inside the app's own folder. */

/**
 * In the browser: a file input (on a phone `capture` opens the camera), shrunk to a JPEG data: URI so it is
 * kept with the entry — a blob: link would be gone after a reload.
 */
function pickPhotoWeb(source: 'camera' | 'library'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') input.setAttribute('capture', 'environment');
    input.style.display = 'none';
    input.onchange = () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return resolve(null);
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, 900 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    };
    document.body.appendChild(input);
    input.click();
  });
}

export async function pickPhoto(source: 'camera' | 'library', id: string): Promise<string | null> {
  if (Platform.OS === 'web') return pickPhotoWeb(source);
  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      source === 'camera' ? t('אין גישה למצלמה') : t('אין גישה לתמונות'),
      source === 'camera' ? t('אפשר לאשר גישה למצלמה בהגדרות הטלפון') : t('אפשר לאשר גישה לתמונות בהגדרות הטלפון'),
    );
    return null;
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [3, 4] };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets[0]) return null;
  const uri = res.assets[0].uri;
  try {
    const dir = new Directory(Paths.document, 'photos');
    dir.create({ idempotent: true, intermediates: true });
    const dest = new File(dir, `${id}.jpg`);
    if (dest.exists) dest.delete();
    new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}

export function deletePhoto(uri?: string) {
  if (!uri || Platform.OS === 'web') return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // already gone
  }
}

/** A data: URI for embedding in the PDF year book. */
export async function photoDataUri(uri: string): Promise<string | null> {
  if (Platform.OS === 'web' || uri.startsWith('data:')) return uri;
  try {
    return `data:image/jpeg;base64,${await new File(uri).base64()}`;
  } catch {
    return null;
  }
}
