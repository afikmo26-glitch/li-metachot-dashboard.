import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/** Optional photo of the day: taken or picked only when the user asks, kept inside the app's own folder. */

export async function pickPhoto(source: 'camera' | 'library', id: string): Promise<string | null> {
  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [3, 4] };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets[0]) return null;
  const uri = res.assets[0].uri;
  if (Platform.OS === 'web') return uri;
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
