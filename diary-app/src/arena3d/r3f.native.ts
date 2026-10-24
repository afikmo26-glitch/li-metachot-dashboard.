// react-three-fiber for iOS / Android (expo-gl); see r3f.ts.
import * as FS from 'expo-file-system/legacy';
import { Image } from 'react-native';
import * as THREE from 'three';

export { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber/native';

/*
 * Textures packed inside a .glb reach three.js as blob: URLs. r3f's native loader reads those blobs as text,
 * which breaks binary images on recent React Native, so the model fails to load. Remember every blob as it's
 * turned into a URL, and load those URLs ourselves: blob -> base64 file in the cache -> expo-gl texture.
 */
const blobs = new Map<string, Blob>();
const createObjectURL = URL.createObjectURL.bind(URL);
URL.createObjectURL = (b: Blob) => {
  const u = createObjectURL(b);
  if (typeof u === 'string' && u.startsWith('blob:')) blobs.set(u, b);
  return u;
};

const dataUrlOf = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(b);
  });

const sizeOf = (uri: string) => new Promise<{ width: number; height: number }>((res, rej) => Image.getSize(uri, (width, height) => res({ width, height }), rej));

const r3fLoad = THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load = function load(url, onLoad, onProgress, onError) {
  const blob = typeof url === 'string' ? blobs.get(url) : undefined;
  if (!blob) return r3fLoad.call(this, url, onLoad, onProgress, onError);
  blobs.delete(url);
  const texture = new THREE.Texture();
  (async () => {
    const dataUrl = await dataUrlOf(blob);
    const [head, base64] = dataUrl.split(';base64,');
    const ext = (head.split('/')[1] || 'png').replace('jpeg', 'jpg');
    const uri = `${FS.cacheDirectory}glbtex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await FS.writeAsStringAsync(uri, base64, { encoding: FS.EncodingType.Base64 });
    const { width, height } = await sizeOf(uri);
    // the shape expo-gl's texImage2D understands
    texture.image = { data: { localUri: uri }, width, height };
    texture.flipY = true;
    texture.needsUpdate = true;
    (texture as unknown as { isDataTexture: boolean }).isDataTexture = true;
    onLoad?.(texture);
  })().catch((e) => onError?.(e));
  return texture;
};
