import { AudioPlayer, createAudioPlayer } from 'expo-audio';

/** Short UI sounds. Players are created once and rewound on each play. */

const SOURCES = {
  tap: require('../../assets/sounds/tap.wav'),
  pop: require('../../assets/sounds/pop.wav'),
  success: require('../../assets/sounds/success.wav'),
  error: require('../../assets/sounds/error.wav'),
  whoosh: require('../../assets/sounds/whoosh.wav'),
  levelup: require('../../assets/sounds/levelup.wav'),
  intro: require('../../assets/sounds/intro.wav'),
};

export type SoundName = keyof typeof SOURCES;

let enabled = true;
const players: Partial<Record<SoundName, AudioPlayer>> = {};

export function setSoundsEnabled(on: boolean) {
  enabled = on;
}

export const soundsEnabled = () => enabled;

export function play(name: SoundName, volume = 0.5) {
  if (!enabled) return;
  try {
    let p = players[name];
    if (!p) {
      p = createAudioPlayer(SOURCES[name]);
      players[name] = p;
    }
    p.volume = volume;
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // sound is a nicety; never break the UI over it
  }
}
