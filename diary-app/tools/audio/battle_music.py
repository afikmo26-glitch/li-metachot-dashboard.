# battle_music.py OUTDIR : synthesizes the arena's music as two WAVs:
#   battle_start.wav - a 4 s opening sting: a timpani roll and cymbal swell building to one big hit with a brass chord
#   battle_loop.wav  - a 16 s loop at 120 bpm in D minor: taiko on the beats, a staccato string riff, brass chords
#                      (Dm Bb F C, twice), all through a short hall reverb. It loops seamlessly.
# Needs numpy and scipy. The app ships them as .m4a (see tools/audio/to_m4a.py).
import sys, os
import numpy as np
from scipy.signal import butter, lfilter, fftconvolve
from scipy.io import wavfile

SR = 44100
rng = np.random.default_rng(7)
out = sys.argv[1]


def t_of(sec):
    return np.arange(int(sec * SR)) / SR


def saw(f, t, harmonics=18):
    y = np.zeros_like(t)
    for k in range(1, harmonics + 1):
        if f * k > SR / 2.2:
            break
        y += np.sin(2 * np.pi * f * k * t) / k
    return y


def lowpass(x, fc, order=2):
    b, a = butter(order, fc / (SR / 2), 'low')
    return lfilter(b, a, x)


def highpass(x, fc, order=2):
    b, a = butter(order, fc / (SR / 2), 'high')
    return lfilter(b, a, x)


def env(n, attack, release, sustain_until=None):
    """Attack to 1, hold until sustain_until (s), then decay exponentially with time constant `release`."""
    t = np.arange(n) / SR
    hold = sustain_until if sustain_until is not None else attack
    e = np.where(t < attack, t / max(attack, 1e-4), np.exp(-(t - hold).clip(0) / release))
    return e


def note(f):
    return 440.0 * 2 ** ((f - 69) / 12)


def place(buf, sound, at):
    i = int(at * SR)
    j = min(len(buf), i + len(sound))
    if i < len(buf):
        buf[i:j] += sound[: j - i]


def taiko(gain=1.0, low=1.0):
    t = t_of(0.9)
    f = 48 * low + 90 * np.exp(-t * 28)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6)
    skin = lowpass(rng.standard_normal(len(t)), 900) * np.exp(-t * 40) * 0.6
    return (body + skin) * gain


def timpani(midi, gain=1.0):
    t = t_of(1.2)
    f = note(midi)
    y = (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.5 * t) + 0.3 * np.sin(2 * np.pi * f * 1.98 * t)) * np.exp(-t * 3.5)
    y += lowpass(rng.standard_normal(len(t)), 400) * np.exp(-t * 30) * 0.4
    return y * gain


def cymbal_swell(sec):
    t = t_of(sec)
    n = highpass(rng.standard_normal(len(t)), 5000)
    return n * (t / sec) ** 3


def string_stab(midi, dur=0.2, gain=1.0):
    t = t_of(dur + 0.25)
    f = note(midi)
    y = saw(f, t) + 0.6 * saw(f * 1.003, t)
    y = lowpass(y, 1600)
    return y * env(len(t), 0.006, 0.09, dur * 0.4) * gain


def brass(midis, dur, gain=1.0, attack=0.12):
    t = t_of(dur + 0.6)
    y = np.zeros_like(t)
    for m in midis:
        f = note(m)
        for d in (0.997, 1.0, 1.004):
            y += saw(f * d, t, 12)
    # brighter as it swells
    y = lowpass(y, 1400) * 0.7 + lowpass(y, 3200) * 0.3 * np.minimum(1, t / max(attack * 3, 0.01))
    return y * env(len(t), attack, 0.35, dur) * gain / len(midis)


def reverb(x, sec=1.8, mix=0.22):
    t = t_of(sec)
    ir = rng.standard_normal(len(t)) * np.exp(-t * 3.2)
    ir = lowpass(ir, 5000)
    wet = fftconvolve(x, ir)[: len(x)]
    wet *= np.max(np.abs(x)) / (np.max(np.abs(wet)) + 1e-9)
    return x * (1 - mix) + wet * mix


def finish(x, path):
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.89
    stereo = np.stack([x, np.roll(x, 220) * 0.97], axis=1)  # a touch of width
    wavfile.write(path, SR, (stereo * 32767).astype(np.int16))
    print(path, f'{len(x) / SR:.1f}s')


os.makedirs(out, exist_ok=True)

# --- the opening sting
sting = np.zeros(int(4.2 * SR))
hits = np.arange(0, 2.75, 0.045)
for i, at in enumerate(hits):
    place(sting, timpani(38, 0.08 + 0.9 * (i / len(hits)) ** 2), at)  # D2 roll, crescendo
place(sting, cymbal_swell(2.8) * 0.35, 0.0)
for at, g in ((2.8, 1.6), (2.8, 1.0)):
    place(sting, taiko(g, 0.8), at)
place(sting, brass([50, 53, 57, 62, 65], 1.2, 2.2, attack=0.02), 2.8)  # D minor, wide
place(sting, string_stab(38, 0.5, 1.2), 2.8)
finish(reverb(sting, 2.2, 0.28), os.path.join(out, 'battle_start.wav'))

# --- the loop
BAR = 2.0
STEP = 0.25
loop = np.zeros(int(16 * SR))
roots = [38, 34, 41, 36] * 2          # D, Bb, F, C (low octave)
chords = {38: [50, 53, 57], 34: [46, 50, 53], 41: [53, 57, 60], 36: [48, 52, 55]}
riff = [0, 0, 12, 0, 10, 0, 7, 0]
for b, r in enumerate(roots):
    t0 = b * BAR
    for k, s in enumerate(riff):
        place(loop, string_stab(r + 12 + s, 0.16, 0.55 if k % 2 else 0.8), t0 + k * STEP)
    place(loop, brass(chords[r], BAR * 0.9, 0.9), t0)
    for beat in (0, 1.0):
        place(loop, taiko(1.0), t0 + beat)
    place(loop, taiko(0.45, 1.4), t0 + 0.5)
    place(loop, taiko(0.45, 1.4), t0 + 1.5)
    if b % 4 == 3:  # a fill into the next phrase
        for k in range(4):
            place(loop, taiko(0.5 + k * 0.15, 1.6 - k * 0.15), t0 + 1.5 + k * 0.125)
# wrap the tails round so the loop is seamless
tail = int(1.0 * SR)
padded = np.concatenate([loop, np.zeros(tail)])
wet = reverb(padded, 1.6, 0.2)
body = wet[: len(loop)].copy()
body[:tail] += wet[len(loop):]
finish(body, os.path.join(out, 'battle_loop.wav'))
