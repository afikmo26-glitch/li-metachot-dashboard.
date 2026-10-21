# Hebrew voiceover clips from Google TTS. Usage: python3 tts.py script.json outdir
# script.json: [{"id": "s1", "say": "text to speak", "cap": "caption text (optional)"}]
import json, subprocess, sys, os, urllib.parse
items = json.load(open(sys.argv[1])); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
for it in items:
    raw = f"{out}/{it['id']}-raw.mp3"; wav = f"{out}/{it['id']}.wav"
    q = urllib.parse.urlencode({'ie': 'UTF-8', 'tl': 'iw', 'client': 'tw-ob', 'q': it['say']})
    subprocess.run(['curl', '-sS', '-A', 'Mozilla/5.0', '-o', raw, f'https://translate.google.com/translate_tts?{q}'], check=True)
    # slightly faster and warmer; trim silence at both ends
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af',
                    'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,atempo=1.07,equalizer=f=200:t=q:w=1:g=2',
                    '-ar', '44100', '-ac', '2', wav], check=True)
    d = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav], capture_output=True, text=True).stdout)
    it['dur'] = round(d, 3)
    print(it['id'], it['dur'])
json.dump(items, open(f'{out}/timing.json', 'w'), ensure_ascii=False, indent=1)
