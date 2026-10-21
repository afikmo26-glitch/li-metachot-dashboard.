import subprocess, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1080, 1920, 30
UP = sys.argv[1]
OUT = sys.argv[2]
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
GOLD = (232, 176, 75)
DARK = (18, 20, 24)

def font(p, s): return ImageFont.truetype(p, s)

def text_c(d, y, s, f, fill=(255, 255, 255), alpha=255, shadow=True):
    kw = dict(direction="rtl", language="he") if any("֐" <= c <= "׿" for c in s) else {}
    w = d.textlength(s, font=f, **kw)
    x = (W - w) / 2
    if shadow:
        d.text((x + 3, y + 3), s, font=f, fill=(0, 0, 0, int(alpha * .6)), **kw)
    d.text((x, y), s, font=f, fill=fill + (alpha,), **kw)

def ease(t): return t * t * (3 - 2 * t)
def clamp(t): return max(0., min(1., t))

scenes = [
    ("imported_gate_0_1767967442.jpg", "עמידות מלאה לחלודה", "ולמזג אוויר"),
    ("imported_gate_2_1767967442.jpg", "עיצובים מודרניים", "בהתאמה אישית"),
    ("imported_gate_1_1767967442.jpg", "ללא תחזוקה", "וללא צביעה מחדש"),
    ("imported_gate_4_1767967442.jpg", "התקנה מהירה", "וגימור מושלם"),
    ("imported_gate_3_1767967442.jpg", "ניסיון של 60 שנה", "דור שלישי של בעלי מקצוע"),
]
imgs = []
for f, *_ in scenes:
    im = Image.open(f"{UP}/{f}").convert("RGB")
    s = max(W / im.width, H / im.height) * 1.15
    imgs.append(im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS))

grad = Image.new("RGBA", (W, H))
gd = ImageDraw.Draw(grad)
for y in range(H):
    a = int(220 * clamp((y - H * .55) / (H * .45)) ** 1.3)
    gd.line([(0, y), (W, y)], fill=(0, 0, 0, a))

INTRO, SCENE, XF, OUTRO = 3.0, 3.6, 0.6, 4.5
TOTAL = INTRO + len(scenes) * SCENE + OUTRO
N = int(TOTAL * FPS)

def bg_dark():
    return Image.new("RGB", (W, H), DARK)

def intro(t):
    # blurred first photo behind the logo
    im = kb(0, t / INTRO * .3).filter(ImageFilter.GaussianBlur(18))
    im = Image.blend(im, bg_dark(), .55).convert("RGBA")
    o = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(o)
    a1 = int(255 * ease(clamp(t / .8)))
    a2 = int(255 * ease(clamp((t - .6) / .8)))
    lw = int(500 * ease(clamp((t - .3) / .9)))
    text_c(d, 730, "לי מתכות", font(BOLD, 170), alpha=a1)
    d.rectangle([(W - lw) // 2, 935, (W + lw) // 2, 945], fill=GOLD + (a1,))
    text_c(d, 990, "גדרות ושערים מאלומיניום", font(BOLD, 70), fill=GOLD, alpha=a2)
    text_c(d, 1090, "איכות פוגשת עיצוב", font(REG, 58), alpha=a2)
    return Image.alpha_composite(im, o).convert("RGB")

def kb(i, p):
    im = imgs[i]
    z = 1 + .12 * p if i % 2 == 0 else 1.12 - .12 * p
    cw, ch = W * 1.15 / z, H * 1.15 / z
    cx = (im.width - cw) * (.5 + (p - .5) * .6 * (1 if i % 2 else -1))
    cy = (im.height - ch) / 2
    return im.crop((int(cx), int(cy), int(cx + cw), int(cy + ch))).resize((W, H), Image.BILINEAR)

def scene(i, t):
    base = kb(i, t / SCENE).convert("RGBA")
    base = Image.alpha_composite(base, grad)
    d = ImageDraw.Draw(base)
    _, l1, l2 = scenes[i]
    a1 = int(255 * ease(clamp((t - .3) / .5)))
    a2 = int(255 * ease(clamp((t - .6) / .5)))
    dy = int(40 * (1 - ease(clamp((t - .3) / .5))))
    d.rectangle([W // 2 - 60, 1480 + dy, W // 2 + 60, 1488 + dy], fill=GOLD + (a1,))
    text_c(d, 1520 + dy, l1, font(BOLD, 92), alpha=a1)
    text_c(d, 1640 + dy, l2, font(REG, 62), fill=GOLD, alpha=a2)
    # small persistent brand tag
    text_c(d, 110, "לי מתכות", font(BOLD, 52), alpha=200)
    return base.convert("RGB")

def outro(t):
    im = kb(len(scenes) - 1, 1).filter(ImageFilter.GaussianBlur(20))
    im = Image.blend(im, bg_dark(), .6).convert("RGBA")
    o = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(o)
    a = lambda s: int(255 * ease(clamp((t - s) / .6)))
    text_c(d, 620, "לתיאום פגישת ייעוץ ומדידה", font(BOLD, 72), alpha=a(.1))
    pulse = 1 + .03 * __import__("math").sin(t * 5) if t > 1.2 else 1
    bw, bh = int(900 * pulse), int(190 * pulse)
    d.rounded_rectangle([(W - bw) // 2, 800 - (bh - 190) // 2, (W + bw) // 2, 800 + 190 + (bh - 190) // 2],
                        radius=95, fill=GOLD + (a(.5),))
    text_c(d, 845, "054-568-7588", font(BOLD, 96), fill=DARK, alpha=a(.5), shadow=False)
    text_c(d, 1080, "שירות בצפון ובכל הארץ", font(REG, 64), alpha=a(.9))
    text_c(d, 1300, "לי מתכות", font(BOLD, 120), alpha=a(1.3))
    text_c(d, 1450, "איכות פוגשת עיצוב", font(REG, 58), fill=GOLD, alpha=a(1.5))
    fade = clamp((OUTRO - t) / .6)
    return Image.blend(bg_dark(), Image.alpha_composite(im, o).convert("RGB"), fade)

def frame(n):
    t = n / FPS
    if t < INTRO:
        img = intro(t)
        if t > INTRO - XF:
            img = Image.blend(img, scene(0, 0), (t - (INTRO - XF)) / XF)
        return img
    t -= INTRO
    i = int(t // SCENE)
    if i < len(scenes):
        lt = t - i * SCENE
        img = scene(i, lt)
        if lt > SCENE - XF:
            nxt = scene(i + 1, 0) if i + 1 < len(scenes) else outro(0)
            img = Image.blend(img, nxt, (lt - (SCENE - XF)) / XF)
        return img
    return outro(t - len(scenes) * SCENE)

ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                       "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                       "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                       "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
                       "-c:a", "aac", "-shortest", "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)
for n in range(N):
    ff.stdin.write(frame(n).tobytes())
ff.stdin.close(); ff.wait()
print("done", N, "frames", TOTAL, "s")
