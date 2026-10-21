# Screen recording on the branded background + subtitle images + mixed audio. Usage: compose.py bg.png list.txt caps.json audio.wav out.mp4
import json, subprocess, sys
bg, lst, capsf, audio, out = sys.argv[1:6]
caps = json.load(open(capsf))
args = ['ffmpeg', '-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-i', bg, '-f', 'concat', '-safe', '0', '-i', lst]
for c in caps: args += ['-i', c['file']]
args += ['-i', audio]
flt = '[1:v]fps=30,scale=720:1560,setsar=1[app];[0:v][app]overlay=180:260:shortest=1[v0]'
for i, c in enumerate(caps):
    flt += f";[v{i}][{i+2}:v]overlay=40:1590:enable='between(t,{c['a']},{c['b']})'[v{i+1}]"
flt += f';[v{len(caps)}]format=yuv420p[vout]'
args += ['-filter_complex', flt, '-map', '[vout]', '-map', f'{len(caps)+2}:a', '-c:v', 'libx264', '-crf', '21', '-preset', 'slow',
         '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out]
subprocess.run(args, check=True)
