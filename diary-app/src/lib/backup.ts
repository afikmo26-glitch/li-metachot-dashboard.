import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { t } from '../i18n';
import { b64, deriveKey, open, randomBytes, seal } from './crypto';
import type { BackupData } from './store';

/**
 * Encrypted backup file: everything in the diary, locked with a backup password (PBKDF2 + AES-256-GCM).
 * The user saves it wherever they like (Drive, email, WhatsApp to themselves) and can restore it on a new phone.
 * Photos and voice recordings stay on the phone and are not part of the file.
 */

type BackupFile = { app: 'my-diary'; v: 1; salt: string; data: string; createdAt: string };

export const MIN_BACKUP_PASSWORD = 6;

export async function exportBackup(data: BackupData, password: string): Promise<void> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  const file: BackupFile = { app: 'my-diary', v: 1, salt: b64.encode(salt), data: seal(key, JSON.stringify(data)), createdAt: new Date().toISOString() };
  const json = JSON.stringify(file);
  const name = `my-diary-backup-${new Date().toISOString().slice(0, 10)}.json`;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const out = new File(Paths.cache, name);
  if (out.exists) out.delete();
  out.create();
  out.write(json);
  await Sharing.shareAsync(out.uri, { mimeType: 'application/json', dialogTitle: t('שמירת הגיבוי') });
}

/** Lets the user pick a backup file; resolves to its data, or throws a message to show. */
export async function importBackup(password: string): Promise<BackupData | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets[0]) return null;
  const asset = res.assets[0];
  const text = Platform.OS === 'web' && asset.file ? await asset.file.text() : await new File(asset.uri).text();
  let file: BackupFile;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error(t('זה לא קובץ גיבוי של היומן'));
  }
  if (file.app !== 'my-diary' || !file.data || !file.salt) throw new Error(t('זה לא קובץ גיבוי של היומן'));
  const key = await deriveKey(password, b64.decode(file.salt));
  let data: BackupData;
  try {
    data = JSON.parse(open(key, file.data));
  } catch {
    throw new Error(t('סיסמת הגיבוי שגויה'));
  }
  if (!Array.isArray(data.entries) || !Array.isArray(data.people)) throw new Error(t('קובץ הגיבוי פגום'));
  return data;
}
