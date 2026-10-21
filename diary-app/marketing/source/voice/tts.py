# Hebrew voiceover clips. Usage: python3 tts.py script.json outdir
# script.json: [{"id": "s1", "say": "text to speak", "cap": ["caption chunk", ...]}]
#
# Voice provider, picked by whichever key is set (best first):
#   ELEVENLABS_API_KEY  [+ ELEVENLABS_VOICE_ID]   ElevenLabs v3 — most natural (Hebrew supported)
#   AZURE_SPEECH_KEY + AZURE_SPEECH_REGION [+ AZURE_VOICE]   Microsoft neural, e.g. he-IL-HilaNeural / he-IL-AvriNeural
#   GOOGLE_TTS_API_KEY [+ GOOGLE_VOICE]           Google Cloud, e.g. he-IL-Chirp3-HD-Aoede / he-IL-Wavenet-A
#   (none)                                        free Google Translate voice — clear but robotic
import json, os, subprocess, sys, urllib.parse, urllib.request, base64

items = json.load(open(sys.argv[1])); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
env = os.environ.get

def post(url, body, headers):
    req = urllib.request.Request(url, data=body, headers=headers, method='POST')
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

def synth(text, path):
    if env('ELEVENLABS_API_KEY'):
        voice = env('ELEVENLABS_VOICE_ID', 'JBFqnCBsd6RMkjVDRZzb')
        audio = post(f'https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128',
                     json.dumps({'text': text, 'model_id': env('ELEVENLABS_MODEL', 'eleven_v3'), 'language_code': 'he'}).encode(),
                     {'xi-api-key': env('ELEVENLABS_API_KEY'), 'content-type': 'application/json'})
        return open(path, 'wb').write(audio), 'elevenlabs'
    if env('AZURE_SPEECH_KEY'):
        voice = env('AZURE_VOICE', 'he-IL-HilaNeural')
        ssml = f"<speak version='1.0' xml:lang='he-IL'><voice name='{voice}'><prosody rate='+4%'>{text}</prosody></voice></speak>"
        audio = post(f"https://{env('AZURE_SPEECH_REGION', 'westeurope')}.tts.speech.microsoft.com/cognitiveservices/v1", ssml.encode(),
                     {'Ocp-Apim-Subscription-Key': env('AZURE_SPEECH_KEY'), 'Content-Type': 'application/ssml+xml',
                      'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3', 'User-Agent': 'diary-tts'})
        return open(path, 'wb').write(audio), 'azure'
    if env('GOOGLE_TTS_API_KEY'):
        voice = env('GOOGLE_VOICE', 'he-IL-Wavenet-A')
        res = json.loads(post(f"https://texttospeech.googleapis.com/v1/text:synthesize?key={env('GOOGLE_TTS_API_KEY')}",
                              json.dumps({'input': {'text': text}, 'voice': {'languageCode': 'he-IL', 'name': voice}, 'audioConfig': {'audioEncoding': 'MP3'}}).encode(),
                              {'content-type': 'application/json'}))
        return open(path, 'wb').write(base64.b64decode(res['audioContent'])), 'google-cloud'
    q = urllib.parse.urlencode({'ie': 'UTF-8', 'tl': 'iw', 'client': 'tw-ob', 'q': text})
    subprocess.run(['curl', '-sS', '-A', 'Mozilla/5.0', '-o', path, f'https://translate.google.com/translate_tts?{q}'], check=True)
    return None, 'google-translate'

for it in items:
    raw = f"{out}/{it['id']}-raw.mp3"; wav = f"{out}/{it['id']}.wav"
    _, provider = synth(it['say'], raw)
    # trim silence at both ends; the free voice also gets a small speed-up and warmth
    tweak = ',atempo=1.07,equalizer=f=200:t=q:w=1:g=2' if provider == 'google-translate' else ''
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af',
                    'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse' + tweak,
                    '-ar', '44100', '-ac', '2', wav], check=True)
    d = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav], capture_output=True, text=True).stdout)
    it['dur'] = round(d, 3)
    print(it['id'], it['dur'], provider)
json.dump(items, open(f'{out}/timing.json', 'w'), ensure_ascii=False, indent=1)
