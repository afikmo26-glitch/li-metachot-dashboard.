import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { b64, decryptFromStorage, deleteDataKey, deriveKey, encryptForStorage, randomBytes } from './crypto';
import { t } from '../i18n';

const KEY = 'diary.account.v1';

export type AuthProvider = 'local' | 'google' | 'apple';

export type Account = {
  displayName: string;
  username: string;
  provider: AuthProvider;
  passwordHash: string;
  salt: string;
  lockEnabled: boolean;
  /** Unlock with fingerprint / Face ID instead of typing the password */
  biometric?: boolean;
  /** Email or phone (+972…) that password-reset codes go to */
  recovery?: string;
  createdAt: string;
  /** 'pbkdf2' (current) or missing for accounts made before it (single SHA-256) */
  kdf?: 'pbkdf2';
};

export const USERNAME_RE = /^[a-zA-Z0-9_.]{3,20}$/;
export const MIN_PASSWORD = 6;

async function legacyHash(password: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
}

async function hash(password: string, salt: string) {
  return b64.encode(await deriveKey(password, b64.decode(salt)));
}

const newSalt = () => b64.encode(randomBytes(16));

async function verify(account: Account, password: string) {
  return account.kdf === 'pbkdf2'
    ? (await hash(password, account.salt)) === account.passwordHash
    : (await legacyHash(password, account.salt)) === account.passwordHash;
}

const AUTO_LOGIN = 'diary.autologin.v1';

export async function loadAccount(): Promise<Account | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const a = JSON.parse(await decryptFromStorage(raw)) as Account;
    // One time: accounts made when the lock was on by default now open straight in (it can be turned back on)
    if (a.lockEnabled && !(await AsyncStorage.getItem(AUTO_LOGIN)) && Platform.OS !== 'web') {
      a.lockEnabled = false;
      await saveAccount(a);
    }
    await AsyncStorage.setItem(AUTO_LOGIN, '1');
    return a;
  } catch {
    return null;
  }
}

export async function saveAccount(a: Account) {
  await AsyncStorage.setItem(KEY, await encryptForStorage(JSON.stringify(a)));
}

/** Returns an error message, or null when the details are valid. */
export function validateSignup(displayName: string, username: string, password: string, confirm: string): string | null {
  if (!displayName.trim()) return t('כתוב איך לקרוא לך');
  if (!USERNAME_RE.test(username.trim())) return t('שם משתמש: 3–20 תווים באנגלית, מספרים, נקודה או קו תחתון');
  if (password.length < MIN_PASSWORD) return t('הסיסמה צריכה לפחות {n} תווים', { n: MIN_PASSWORD });
  if (password !== confirm) return t('הסיסמאות לא תואמות');
  return null;
}

export async function createLocalAccount(displayName: string, username: string, password: string, recovery?: string): Promise<Account> {
  const salt = newSalt();
  const account: Account = {
    displayName: displayName.trim(),
    username: username.trim().toLowerCase(),
    provider: 'local',
    passwordHash: await hash(password, salt),
    salt,
    // the app opens straight in; the lock can be turned on in settings (secret places keep their own passwords)
    lockEnabled: false,
    createdAt: new Date().toISOString(),
    kdf: 'pbkdf2',
    ...(recovery ? { recovery } : {}),
  };
  await saveAccount(account);
  return account;
}

/**
 * Web preview only: a ready-made account from EXPO_PUBLIC_PREVIEW_ACCOUNT ("name:password", kept in .env.local),
 * so opening the preview goes straight to the login screen instead of sign-up. Never used on a phone.
 */
export async function ensurePreviewAccount(): Promise<Account | null> {
  const spec = process.env.EXPO_PUBLIC_PREVIEW_ACCOUNT;
  if (Platform.OS !== 'web' || !spec) return loadAccount();
  const existing = await loadAccount();
  if (existing) return existing;
  const at = spec.indexOf(':');
  const name = spec.slice(0, at);
  const salt = newSalt();
  const account: Account = {
    displayName: name,
    username: name.toLowerCase(),
    provider: 'local',
    passwordHash: await hash(spec.slice(at + 1), salt),
    salt,
    lockEnabled: true,
    createdAt: new Date().toISOString(),
    kdf: 'pbkdf2',
  };
  await saveAccount(account);
  return account;
}

/** Checks the password; returns the (possibly upgraded) account on success, null on failure. */
export async function checkLogin(account: Account, username: string, password: string): Promise<Account | null> {
  if (username.trim().toLowerCase() !== account.username) return null;
  if (!(await verify(account, password))) return null;
  if (account.kdf === 'pbkdf2') return account;
  // Upgrade accounts made with the old single SHA-256 hash
  const salt = newSalt();
  const upgraded: Account = { ...account, salt, passwordHash: await hash(password, salt), kdf: 'pbkdf2' };
  await saveAccount(upgraded);
  return upgraded;
}

export async function changePassword(account: Account, current: string, next: string): Promise<Account | string> {
  if (!(await verify(account, current))) return t('הסיסמה הנוכחית שגויה');
  if (next.length < MIN_PASSWORD) return t('הסיסמה החדשה צריכה לפחות {n} תווים', { n: MIN_PASSWORD });
  const salt = newSalt();
  const updated: Account = { ...account, salt, passwordHash: await hash(next, salt), kdf: 'pbkdf2' };
  await saveAccount(updated);
  return updated;
}

/** Sets a new password after the user proved who they are with a recovery code. */
export async function resetPassword(account: Account, next: string): Promise<Account | string> {
  if (next.length < MIN_PASSWORD) return t('הסיסמה החדשה צריכה לפחות {n} תווים', { n: MIN_PASSWORD });
  const salt = newSalt();
  const updated: Account = { ...account, salt, passwordHash: await hash(next, salt), kdf: 'pbkdf2' };
  await saveAccount(updated);
  return updated;
}

/** Wipes everything the app stored on this phone (used by "forgot password → start over"). */
export async function wipeAllData() {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('diary.'));
  await AsyncStorage.multiRemove(keys);
  await deleteDataKey();
}
