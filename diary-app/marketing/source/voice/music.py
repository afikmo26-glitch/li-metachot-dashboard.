# Gentle, warm music bed (pads + plucked arpeggio), generated so there are no licensing questions.
# Usage: python3 music.py seconds out.wav
import numpy as np, sys, wave
secs = float(sys.argv[1]); out = sys.argv[2]; sr = 44100
n = int(secs * sr); t = np.arange(n) / sr
bpm = 92; beat = 60 / bpm; bar = beat * 4
note = lambda m: 440 * 2 ** ((m - 69) / 12)
prog = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]  # C, Am, F, G
pad = np.zeros(n); arp = np.zeros(n); bass = np.zeros(n)
for b in range(int(secs / bar) + 1):
    chord = prog[b % 4]; s0 = int(b * bar * sr); s1 = min(n, int((b + 1) * bar * sr) + int(0.6 * sr))
    if s0 >= n: break
    tt = np.arange(s1 - s0) / sr; env = np.minimum(1, tt / 0.8) * np.minimum(1, (s1 - s0) / sr - tt) ** 0.5
    for m in chord:
        f = note(m); pad[s0:s1] += env * (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * 2 * f * tt + 0.3)) * 0.18
    fb = note(chord[0] - 24); bass[s0:s1] += env * np.sin(2 * np.pi * fb * tt) * 0.22
    for k in range(8):  # eighth-note arpeggio
        m = (chord + [chord[0] + 12])[[0, 1, 2, 3, 2, 1, 2, 3][k]] + 12
        a0 = s0 + int(k * beat / 2 * sr); a1 = min(n, a0 + int(0.9 * sr))
        if a0 >= n: break
        ta = np.arange(a1 - a0) / sr; f = note(m)
        arp[a0:a1] += np.exp(-ta * 5) * (np.sin(2 * np.pi * f * ta) + 0.3 * np.sin(2 * np.pi * 2 * f * ta)) * 0.12
mix = pad + arp + bass
fade = np.minimum(1, t / 1.5) * np.minimum(1, (secs - t) / 2.5)
mix *= fade; mix /= np.max(np.abs(mix)) * 1.25
# simple stereo width: arp slightly delayed on the right
right = mix.copy(); d = int(0.012 * sr); right[d:] = 0.85 * mix[d:] + 0.15 * mix[:-d]
data = (np.stack([mix, right], 1) * 32767).astype(np.int16)
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); w.writeframes(data.tobytes())
