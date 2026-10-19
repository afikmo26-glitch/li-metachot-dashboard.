import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

/** Moves a finished recording from the temp cache into the app's permanent documents folder. */
export async function persistRecording(tempUri: string, entryId: string): Promise<string> {
  if (Platform.OS === 'web') return tempUri;
  try {
    const dir = new Directory(Paths.document, 'recordings');
    dir.create({ idempotent: true, intermediates: true });
    const ext = tempUri.split('.').pop()?.split('?')[0] || 'm4a';
    const dest = new File(dir, `${entryId}.${ext}`);
    if (dest.exists) dest.delete();
    await new File(tempUri).move(dest);
    return dest.uri;
  } catch {
    return tempUri;
  }
}

export function deleteRecording(uri?: string) {
  if (!uri || Platform.OS === 'web') return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // already gone
  }
}
