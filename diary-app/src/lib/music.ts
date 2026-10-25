import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import { soundsEnabled } from './sound';

/**
 * Quiet background music (soft piano and rain) that loops while the app is open, when the user turns it on; and the
 * fight music of "הסים שלך" (tools/audio/battle_music.py): a dramatic sting when a fight starts, then a drum-and-brass
 * loop until it ends. The calm music steps aside for the fight and comes back after.
 */

let player: AudioPlayer | null = null;
let calmOn = false;
let sting: AudioPlayer | null = null;
let loop: AudioPlayer | null = null;
let loopTimer: ReturnType<typeof setTimeout> | null = null;

export function setMusic(on: boolean) {
  calmOn = on;
  try {
    if (on) {
      if (!player) {
        player = createAudioPlayer(require('../../assets/music/calm.m4a'));
        player.loop = true;
        player.volume = 0.3;
      }
      if (!loop?.playing) player.play();
    } else player?.pause();
  } catch {
    // music is a nicety; never break the UI over it
  }
}

/** Starts the fight music: the sting now, the loop as it ends. */
export function startBattleMusic(volume = 0.55) {
  if (!soundsEnabled()) return;
  try {
    stopBattleMusic(false);
    player?.pause();
    if (!sting) sting = createAudioPlayer(require('../../assets/music/battle_start.mp3'));
    if (!loop) {
      loop = createAudioPlayer(require('../../assets/music/battle_loop.mp3'));
      loop.loop = true;
    }
    sting.volume = volume;
    sting.seekTo(0).catch(() => {});
    sting.play();
    const l = loop;
    // the loop comes in under the sting's big hit
    loopTimer = setTimeout(() => {
      l.volume = volume * 0.7;
      l.seekTo(0).catch(() => {});
      l.play();
    }, 2900);
  } catch {
    // music is a nicety; never break the UI over it
  }
}

/** Stops the fight music, and brings the calm music back if it was on. */
export function stopBattleMusic(resumeCalm = true) {
  try {
    if (loopTimer) clearTimeout(loopTimer);
    loopTimer = null;
    loop?.pause();
    if (resumeCalm && calmOn) player?.play();
  } catch {
    // music is a nicety; never break the UI over it
  }
}
