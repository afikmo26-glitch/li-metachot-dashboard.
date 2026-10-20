import { gcm } from '@noble/ciphers/aes.js';
import { bytesToUtf8, utf8ToBytes } from '@noble/ciphers/utils.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Encryption at rest.
 * - Every diary value in AsyncStorage is sealed with AES-256-GCM.
 * - The data key is random and lives in the phone's secure hardware store
 *   (iOS Keychain / Android Keystore) via expo-secure-store.
 * - Passwords are stretched with PBKDF2-SHA256.
 */

const PREFIX = 'enc1:';
const DATA_KEY_NAME = 'diary_data_key_v1';
export const PBKDF2_ITERATIONS = 60_000;

export function randomBytes(n: number): Uint8Array {
  return Crypto.getRandomBytes(n);
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export const b64 = { encode: toBase64, decode: fromBase64 };

export function seal(key: Uint8Array, plaintext: string): string {
  const nonce = randomBytes(12);
  const ct = gcm(key, nonce).encrypt(utf8ToBytes(plaintext));
  const out = new Uint8Array(nonce.length + ct.length);
  out.set(nonce);
  out.set(ct, nonce.length);
  return PREFIX + toBase64(out);
}

/** Throws if the key is wrong or the data was tampered with. */
export function open(key: Uint8Array, sealed: string): string {
  const raw = fromBase64(sealed.slice(PREFIX.length));
  return bytesToUtf8(gcm(key, raw.subarray(0, 12)).decrypt(raw.subarray(12)));
}

export const isSealed = (v: string) => v.startsWith(PREFIX);

export async function deriveKey(password: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS): Promise<Uint8Array> {
  return pbkdf2Async(sha256, utf8ToBytes(password), salt, { c: iterations, dkLen: 32 });
}

let dataKey: Uint8Array | null | undefined;

/** The device data key, created on first use. Null on web (no secure storage there). */
export async function getDataKey(): Promise<Uint8Array | null> {
  if (dataKey !== undefined) return dataKey;
  if (Platform.OS === 'web') return (dataKey = null);
  try {
    let stored = await SecureStore.getItemAsync(DATA_KEY_NAME);
    if (!stored) {
      stored = toBase64(randomBytes(32));
      await SecureStore.setItemAsync(DATA_KEY_NAME, stored, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    }
    dataKey = fromBase64(stored);
  } catch {
    dataKey = null;
  }
  return dataKey;
}

export async function deleteDataKey() {
  dataKey = undefined;
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(DATA_KEY_NAME).catch(() => {});
}

/** Encrypts a value for storage when a data key is available. */
export async function encryptForStorage(value: string): Promise<string> {
  const key = await getDataKey();
  return key ? seal(key, value) : value;
}

/** Reads a stored value, transparently handling old unencrypted data. */
export async function decryptFromStorage(stored: string): Promise<string> {
  if (!isSealed(stored)) return stored;
  const key = await getDataKey();
  if (!key) throw new Error('missing data key');
  return open(key, stored);
}
