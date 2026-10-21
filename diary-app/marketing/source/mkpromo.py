# Builds promo-he.html: scenes and subtitles timed to the voiceover clips in timing.json.
import json, sys, html
timing = json.load(open(sys.argv[1])); out = sys.argv[2]
LEAD, GAP = 0.9, 0.55        # silence before the first line, pause between lines
t = LEAD; segs = []
for it in timing:
    segs.append({**it, 'start': round(t, 3)}); t += it['dur'] + GAP
END = round(t + 1.6, 2)

SCENES = {
  'p1': ('logo', None, None, None),
  'p2': ('phone', 'כל ערב, יומי שואל<br><em>"איך היה היום?"</em> 🌙', 'shots/chat.png', '🎙️ בלי להקליד'),
  'p3': ('phone', 'זוכר את <em>כל האנשים</em><br>שחשובים לך 💞', 'shots/people.png', '👨‍👩‍👧 משפחה · 🫶 חברים'),
  'p4': ('phone', 'הופך זיכרונות<br>ל<em>משחק</em> 🎮', 'shots/game-q.png', '⭐ <bdi dir="ltr">+10 XP</bdi>'),
  'p5': ('phone', '<em>החודש שלך</em><br>בסיכום מרגש ✨', 'shots/recap.png', '🏆 האנשים של החודש'),
  'p6': ('phone', 'מוצפן ופרטי<br><em>רק אצלך</em> 🔒', 'shots/archive.png', '🔒 AES-256'),
  'p7': ('end', None, None, None),
}

scenes_html = []; caps_html = []
for i, s in enumerate(segs):
    kind, head, img, badge = SCENES[s['id']]
    start = 0 if i == 0 else s['start'] - 0.35
    nxt = segs[i + 1]['start'] - 0.35 if i + 1 < len(segs) else None
    cls = 'scene last' if nxt is None else 'scene'
    style = f'--in:{start}s;' + (f' --out:{nxt - 0.45}s' if nxt else '')
    if kind == 'logo':
        body = f'''<div class="center-col"><div class="logo-wrap"><div class="ring"></div><img class="logo" src="logo.png" style="--d:{start+0.15}s"></div>
<h1 class="up" style="--d:{start+0.7}s">היומן שלי</h1><p class="tag up" style="--d:{start+1.2}s">החבר שמקשיב לך כל ערב</p></div>'''
    elif kind == 'end':
        body = f'''<div id="confetti" data-at="{start+0.2}"></div><div class="center-col"><img class="logo" src="logo.png" style="--d:{start+0.1}s; width:300px; height:300px; border-radius:72px">
<h1 class="up" style="--d:{start+0.5}s">היומן שלי</h1>
<div class="pills"><div class="pill up" style="--d:{start+0.9}s">🎙️ מספרים במקום לכתוב</div><div class="pill up" style="--d:{start+1.1}s">💞 זוכר את האנשים שלך</div><div class="pill up" style="--d:{start+1.3}s">🔒 פרטי ומוצפן</div></div>
<div class="cta" style="--d:{start+1.6}s">בקרוב ב־<bdi>Google Play</bdi> וב־<bdi>App Store</bdi></div></div>'''
    else:
        body = f'''<div class="headline">{head}</div><div class="phone" style="--in:{start}s"><img src="{img}" style="--in:{start}s"></div>
<div class="badge" style="--d:{start+1.4}s">{badge}</div>'''
    scenes_html.append(f'<section class="{cls}" style="{style}">{body}</section>')
    # subtitles: split the line's time between its chunks by length
    chunks = s['cap']; total = sum(len(c) for c in chunks); ct = s['start']
    for c in chunks:
        d = s['dur'] * len(c) / total
        caps_html.append(f'<div class="cap" style="--a:{ct:.2f}s; --b:{ct + d + (GAP if c == chunks[-1] else 0) - 0.05:.2f}s">{c}</div>')
        ct += d

tpl = open(sys.argv[3]).read()
page = tpl.replace('<!--SCENES-->', '\n'.join(scenes_html)).replace('<!--CAPS-->', '\n'.join(caps_html))
open(out, 'w').write(page)
json.dump({'segments': segs, 'end': END}, open(out + '.json', 'w'), ensure_ascii=False)
print('end', END)
