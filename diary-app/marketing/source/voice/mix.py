# Mixes voice clips at their start times over the music bed, ducking the music under the voice.
# Usage: python3 mix.py timing.json clipsdir music.wav out.wav seconds
import json, subprocess, sys
spec = json.load(open(sys.argv[1])); clips = sys.argv[2]; music = sys.argv[3]; out = sys.argv[4]; secs = sys.argv[5]
segs = spec['segments'] if isinstance(spec, dict) else spec
args = ['ffmpeg', '-y', '-loglevel', 'error', '-i', music]
for s in segs: args += ['-i', f"{clips}/{s['id']}.wav"]
parts = [f"[{i+1}:a]adelay={int(s['start']*1000)}|{int(s['start']*1000)},volume=1.6[v{i}]" for i, s in enumerate(segs)]
vo = ''.join(f'[v{i}]' for i in range(len(segs)))
flt = ';'.join(parts) + f";{vo}amix=inputs={len(segs)}:normalize=0,apad[voice];[voice]asplit[vk][vm];" \
      f"[0:a]volume=0.55[m];[m][vk]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[duck];" \
      f"[duck][vm]amix=inputs=2:normalize=0,alimiter=limit=0.95,atrim=0:{secs}[out]"
subprocess.run(args + ['-filter_complex', flt, '-map', '[out]', '-ar', '44100', out], check=True)
