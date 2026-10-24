import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { reportCrash } from '../lib/cloud';
import { b64 } from '../lib/crypto';
import { MODELS3D, TEX3D } from './models';

/** The last step a model load reached, so a phone that stalls can tell us where. */
export const loadStep: { at: string } = { at: 'idle' };

const cache = new Map<string, Promise<{ gltf: GLTF; map: THREE.Texture }>>();

async function bytesOf(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  // on the phone read the downloaded file straight from storage
  const FS = await import('expo-file-system/legacy');
  const base64 = await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
  const u8 = b64.decode(base64);
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

async function load(id: string) {
  loadStep.at = `${id}:asset`;
  const [glbAsset, texAsset] = await Promise.all([Asset.fromModule(MODELS3D[id]).downloadAsync(), Asset.fromModule(TEX3D[id]).downloadAsync()]);
  loadStep.at = `${id}:read`;
  const data = await bytesOf(glbAsset.localUri ?? glbAsset.uri);
  loadStep.at = `${id}:parse`;
  const gltf = await new Promise<GLTF>((res, rej) => new GLTFLoader().parse(data, '', res, rej));
  loadStep.at = `${id}:texture`;
  let map: THREE.Texture;
  if (Platform.OS === 'web') {
    map = await new THREE.TextureLoader().loadAsync(texAsset.localUri ?? texAsset.uri);
  } else {
    // expo-gl uploads an image straight from a file when the texture points at it like this
    map = new THREE.Texture();
    map.image = { data: { localUri: texAsset.localUri ?? texAsset.uri }, width: 1024, height: 1024 };
    (map as unknown as { isDataTexture: boolean }).isDataTexture = true;
  }
  map.flipY = false; // glTF texture coordinates
  map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;
  loadStep.at = `${id}:ready`;
  return { gltf, map };
}

/** Loads (once) a fighter's model and its colours. */
export function loadModel(id: string) {
  let p = cache.get(id);
  if (!p) {
    p = load(id);
    p.catch((e) => {
      cache.delete(id);
      reportCrash(`3d-fail@${loadStep.at}: ${e?.message ?? e}`, e?.stack).catch(() => {});
    });
    cache.set(id, p);
  }
  return p;
}

const texCache = new Map<number, Promise<THREE.Texture>>();

/** A plain image asset as a texture, on the web or on a phone (expo-gl reads it from its file). */
export function loadTexture(mod: number, repeat = 1) {
  let p = texCache.get(mod);
  if (!p) {
    p = (async () => {
      const a = await Asset.fromModule(mod).downloadAsync();
      const uri = a.localUri ?? a.uri;
      let tex: THREE.Texture;
      if (Platform.OS === 'web') tex = await new THREE.TextureLoader().loadAsync(uri);
      else {
        tex = new THREE.Texture();
        tex.image = { data: { localUri: uri }, width: 512, height: 512 };
        (tex as unknown as { isDataTexture: boolean }).isDataTexture = true;
      }
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeat, repeat);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    })();
    texCache.set(mod, p);
  }
  return p;
}
