import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const KEY = 'diary.account.v1';

export type AuthProvider = 'local' | 'google' | 'apple';

export type Account = {
  displayName: string;
  username: string;
  provider: AuthProvider;
  passwordHash: string;
  salt: string;
  lockEnabled: boolean;
  createdAt: string;
};

export const USERNAME_RE = /^[a-zA-Z0-9_.]{3,20}$/;
export const MIN_PASSWORD = 6;

async function hash(password: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
}

export async function loadAccount(): Promise<Account | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Account) : null;
  } catch {
    return null;
  }
}

export async function saveAccount(a: Account) {
  await AsyncStorage.setItem(KEY, JSON.stringify(a));
}

/** Returns an error message, or null when the details are valid. */
export function validateSignup(displayName: string, username: string, password: string, confirm: string): string | null {
  if (!displayName.trim()) return 'כתוב איך לקרוא לך';
  if (!USERNAME_RE.test(username.trim())) return 'שם משתמש: 3–20 תווים באנגלית, מספרים, נקודה או קו תחתון';
  if (password.length < MIN_PASSWORD) return `הסיסמה צריכה לפחות ${MIN_PASSWORD} תווים`;
  if (password !== confirm) return 'הסיסמאות לא תואמות';
  return null;
}

export async function createLocalAccount(displayName: string, username: string, password: string): Promise<Account> {
  const salt = Crypto.randomUUID();
  const account: Account = {
    displayName: displayName.trim(),
    username: username.trim().toLowerCase(),
    provider: 'local',
    passwordHash: await hash(password, salt),
    salt,
    lockEnabled: true,
    createdAt: new Date().toISOString(),
  };
  await saveAccount(account);
  return account;
}

export async function checkLogin(account: Account, username: string, password: string): Promise<boolean> {
  if (username.trim().toLowerCase() !== account.username) return false;
  return (await hash(password, account.salt)) === account.passwordHash;
}

export async function changePassword(account: Account, current: string, next: string): Promise<Account | string> {
  if ((await hash(current, account.salt)) !== account.passwordHash) return 'הסיסמה הנוכחית שגויה';
  if (next.length < MIN_PASSWORD) return `הסיסמה החדשה צריכה לפחות ${MIN_PASSWORD} תווים`;
  const salt = Crypto.randomUUID();
  const updated = { ...account, salt, passwordHash: await hash(next, salt) };
  await saveAccount(updated);
  return updated;
}

/** Wipes everything the app stored on this phone (used by "forgot password → start over"). */
export async function wipeAllData() {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('diary.'));
  await AsyncStorage.multiRemove(keys);
}
