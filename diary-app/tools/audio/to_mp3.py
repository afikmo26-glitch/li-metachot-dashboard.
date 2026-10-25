# to_mp3.py IN.wav OUT.mp3 : run headless in Blender (blender -b --python to_mp3.py -- IN OUT), which bundles
# ffmpeg, to turn a WAV into the .mp3 the app ships.
import bpy, sys

src, out = sys.argv[sys.argv.index("--") + 1:][:2]
sc = bpy.context.scene
sc.render.fps = 30
sc.sequence_editor_create()
strip = sc.sequence_editor.strips.new_sound("s", src, 1, 1)
sc.frame_start, sc.frame_end = 1, strip.frame_final_end - 1
bpy.ops.sound.mixdown(filepath=out, container="MP3", codec="MP3", bitrate=160, format="S16", mixrate=44100)
print("MP3", out)
