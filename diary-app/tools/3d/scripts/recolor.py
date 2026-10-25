# recolor.py REPO_DIARY_APP : makes the colour-swap skins of "הסים שלך". Each skin is its fighter's own model with
# the hues of its texture (assets/sim3d/<base>.jpg) and its picture (assets/sim/chars/<base>.webp) turned the
# same way, so the 3D fighter and its card match. Only coloured pixels turn: whites, blacks and greys (eyes,
# outlines, teeth) stay as they are. A skin whose picture already exists keeps it. Needs numpy and Pillow.
import sys, os
import numpy as np
from PIL import Image

# id: (base fighter, hue turn in degrees, saturation factor, brightness factor)
SKINS = {
    'dragon_ice': ('dragon', 200, 0.9, 1.15),
    'fox_shadow': ('fox', 255, 1.0, 0.85),
    'shark_lava': ('shark', 175, 1.25, 1.0),
    'frog_toxic': ('frog', 190, 1.2, 1.05),
    'raven_gold': ('raven', 135, 1.15, 1.25),
    'eagle_storm': ('eagle', 165, 1.1, 0.95),
    'penguin_ember': ('penguin', 175, 1.15, 1.0),
}

root = sys.argv[1]


def turn(rgb, deg, sat, val):
    """Hue-rotate the coloured pixels of an RGB float array (0..1), fading the effect out toward grey."""
    mx = rgb.max(-1)
    mn = rgb.min(-1)
    d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    h = np.zeros_like(mx)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    nz = d > 1e-6
    hr = ((g - b) / np.maximum(d, 1e-6)) % 6
    hg = (b - r) / np.maximum(d, 1e-6) + 2
    hb = (r - g) / np.maximum(d, 1e-6) + 4
    h = np.where(nz & (mx == r), hr, np.where(nz & (mx == g), hg, np.where(nz, hb, 0))) / 6
    # how much of the turn each pixel gets: none for greys, all for clearly coloured ones
    w = np.clip((s - 0.12) / 0.2, 0, 1)
    h2 = (h + w * deg / 360) % 1
    s2 = np.clip(s * (1 + w * (sat - 1)), 0, 1)
    v2 = np.clip(mx * (1 + w * (val - 1)), 0, 1)
    i = np.floor(h2 * 6).astype(int) % 6
    f = h2 * 6 - np.floor(h2 * 6)
    p = v2 * (1 - s2)
    q = v2 * (1 - f * s2)
    t = v2 * (1 - (1 - f) * s2)
    out = np.stack([
        np.choose(i, [v2, q, p, p, t, v2]),
        np.choose(i, [t, v2, v2, q, p, p]),
        np.choose(i, [p, p, t, v2, v2, q]),
    ], -1)
    return out


for sid, (base, deg, sat, val) in SKINS.items():
    tex = Image.open(os.path.join(root, 'assets', 'sim3d', base + '.jpg')).convert('RGB')
    a = np.asarray(tex).astype(np.float32) / 255
    Image.fromarray((turn(a, deg, sat, val) * 255).astype(np.uint8)).save(os.path.join(root, 'assets', 'sim3d', sid + '.jpg'), quality=88)
    art = os.path.join(root, 'assets', 'sim', 'chars', sid + '.webp')
    if not os.path.exists(art):
        im = Image.open(os.path.join(root, 'assets', 'sim', 'chars', base + '.webp')).convert('RGBA')
        b = np.asarray(im).astype(np.float32) / 255
        rgb = turn(b[..., :3], deg, sat, val)
        Image.fromarray((np.concatenate([rgb, b[..., 3:]], -1) * 255).astype(np.uint8), 'RGBA').save(art, quality=90)
    print(sid, 'from', base)
