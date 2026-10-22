import { AudioPlayer, createAudioPlayer } from 'expo-audio';

/** Quiet background music (soft piano and rain) that loops while the app is open, when the user turns it on. */

let player: AudioPlayer | null = null;

export function setMusic(on: boolean) {
  try {
    if (on) {
      if (!player) {
        player = createAudioPlayer(require('../../assets/music/calm.m4a'));
        player.loop = true;
        player.volume = 0.3;
      }
      player.play();
    } else player?.pause();
  } catch {
    // music is a nicety; never break the UI over it
  }
}
