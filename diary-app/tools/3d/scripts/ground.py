# Paints the "זירת הכאוס" floor: one 2048px image over the whole 24x24 arena (x,z in -12..12; image top = z -12).
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter, zoom
import json, sys
NZ = 2048
NX = 1392
HX = 8.5
HZ = 12.5
H = HZ
N = NZ
rng = np.random.default_rng(7)
L = json.load(open(sys.argv[1]))  # layout: boxes, pads
out = sys.argv[2]

ys, xs = np.mgrid[0:NZ, 0:NX].astype(np.float32)
X = xs / NX * 2 * HX - HX
Z = ys / NZ * 2 * HZ - HZ

def noise(scale, octaves=4, seed=0):
    r = np.random.default_rng(seed)
    acc = np.zeros((NZ, NX), np.float32); amp = 1.0; tot = 0
    for o in range(octaves):
        n = max(2, int(N / scale * 2 ** o))
        g = r.random((n, n)).astype(np.float32)
        acc += amp * zoom(g, N / n, order=3)[:NZ, :NX]; tot += amp; amp *= 0.5
    return acc / tot

def mix(a, b, t):
    t = np.clip(t, 0, 1)[..., None]
    return a * (1 - t) + b * t

col = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32)

# 1. lush painted grass
n1 = noise(300, 4, 1); n2 = noise(60, 3, 2); n3 = noise(18, 2, 3)
img = mix(np.broadcast_to(col('#3E9B3A'), (NZ, NX, 3)), np.broadcast_to(col('#7BC94A'), (NZ, NX, 3)), (n1 - 0.3) * 1.8)
img = mix(img, np.broadcast_to(col('#2F7F33'), (NZ, NX, 3)), np.clip((0.45 - n2) * 3, 0, 1) * 0.55)
img = img * (0.92 + n3[..., None] * 0.16)
# mowed stripes, like a well kept arena
img *= (1 + 0.035 * np.sign(np.sin(X * np.pi / 2.0)))[..., None]

def soft(mask, r):
    return gaussian_filter(mask.astype(np.float32), r)

# 2. paths: a cross of flagstones and a round plaza in the middle, edges wobbling a little
wob = (noise(40, 2, 9) - 0.5) * 0.35
path = (np.abs(X + wob) < 1.15) | (np.abs(Z + wob) < 1.05)
R = np.sqrt(X ** 2 + Z ** 2)
plaza = R < 3.5 + wob
pads = np.zeros((NZ, NX), bool)
for p in L['pads']:
    pads |= np.sqrt((X - p['x']) ** 2 + (Z - p['z']) ** 2) < p['r'] + 0.55 + wob
stone_mask = path | plaza | pads

# flagstones: jittered-grid voronoi, F2-F1 gives the grout
def voronoi(cell, seed):
    r = np.random.default_rng(seed)
    gx = int(np.ceil(2 * H / cell)) + 2
    jit = r.random((gx, gx, 2)).astype(np.float32)
    cx = (X + H) / cell; cz = (Z + H) / cell
    ix = np.floor(cx).astype(int); iz = np.floor(cz).astype(int)
    f1 = np.full((NZ, NX), 9.0, np.float32); f2 = np.full((NZ, NX), 9.0, np.float32); idv = np.zeros((NZ, NX), np.int32)
    for dx in (-1, 0, 1):
        for dz in (-1, 0, 1):
            jx = np.clip(ix + dx, 0, gx - 1); jz = np.clip(iz + dz, 0, gx - 1)
            sx = jx + 0.15 + jit[jx, jz, 0] * 0.7; sz = jz + 0.15 + jit[jx, jz, 1] * 0.7
            d = np.sqrt((cx - sx) ** 2 + (cz - sz) ** 2)
            closer = d < f1
            f2 = np.where(closer, f1, np.minimum(f2, d)); idv = np.where(closer, jx * 1000 + jz, idv); f1 = np.where(closer, d, f1)
    return f1, f2, idv

f1, f2, idv = voronoi(0.85, 11)
tone = (np.sin(idv * 12.9898) * 43758.5453) % 1.0
stone = mix(np.broadcast_to(col('#C9B48E'), (NZ, NX, 3)), np.broadcast_to(col('#E6D6B0'), (NZ, NX, 3)), tone)
stone = mix(stone, np.broadcast_to(col('#9FA58F'), (NZ, NX, 3)), np.clip((noise(80, 3, 21) - 0.55) * 3, 0, 1) * 0.6)  # moss
grout = np.clip(1 - (f2 - f1) / 0.07, 0, 1)
bevel = np.clip((f2 - f1) / 0.25, 0, 1)
stone = stone * (0.82 + 0.18 * bevel[..., None])
stone = mix(stone, np.broadcast_to(col('#6E6046'), (NZ, NX, 3)), grout)
stone *= (0.93 + noise(10, 2, 31)[..., None] * 0.14)
sm = soft(stone_mask, 2.5)
# dark rim where stone meets grass
rim = np.clip(soft(stone_mask, 9) - sm, 0, 1) * 0 + np.clip(sm * (1 - sm) * 4, 0, 1)
img = mix(img, stone, sm)
img = mix(img, np.broadcast_to(col('#4A3B24'), (NZ, NX, 3)), rim * 0.45)

# 3. the plaza: rings of dressed stone and a turquoise-and-gold inlay
ring_mid = (R > 2.15) & (R < 2.55)
ring_in = R < 1.55
ang = np.arctan2(Z, X)
inlay = mix(np.broadcast_to(col('#1FA7A0'), (NZ, NX, 3)), np.broadcast_to(col('#38D3C4'), (NZ, NX, 3)), (np.sin(ang * 16) > 0).astype(np.float32) * 0.6)
img = mix(img, inlay, soft(ring_mid, 1.5))
gold_edge = (np.abs(R - 2.15) < 0.05) | (np.abs(R - 2.55) < 0.05) | (np.abs(R - 3.35) < 0.06)
img = mix(img, np.broadcast_to(col('#F2C94C'), (NZ, NX, 3)), soft(gold_edge, 1.2))
centre = mix(np.broadcast_to(col('#D8C49B'), (NZ, NX, 3)), np.broadcast_to(col('#BBA57A'), (NZ, NX, 3)), (np.sin(ang * 8) > 0).astype(np.float32))
img = mix(img, centre, soft(ring_in, 1.5))

# 4. spawn pads: glowing team circles with rune ticks
for p in L['pads']:
    d = np.sqrt((X - p['x']) ** 2 + (Z - p['z']) ** 2); a = np.arctan2(Z - p['z'], X - p['x'])
    c1, c2 = col(p['c1']), col(p['c2'])
    disc = soft(d < p['r'], 1.5)
    img = mix(img, mix(np.broadcast_to(c1, (NZ, NX, 3)), np.broadcast_to(c2, (NZ, NX, 3)), d / p['r']), disc * 0.85)
    img = mix(img, np.broadcast_to(col('#FFFFFF'), (NZ, NX, 3)), soft((np.abs(d - p['r'] * 0.72) < 0.04) & (np.sin(a * 12) > -0.3), 1) * 0.8)
    img = mix(img, np.broadcast_to(col('#F2C94C'), (NZ, NX, 3)), soft(np.abs(d - p['r']) < 0.07, 1.2))
    glow = np.exp(-np.maximum(0, d - p['r']) * 3.0) * (d > p['r'])
    img = mix(img, np.broadcast_to(c2, (NZ, NX, 3)), glow * 0.35)

# 5. dirt scuffs around the cover and soft contact shadows (light comes from the left and behind)
sh = np.zeros((NZ, NX), np.float32); dirt = np.zeros((NZ, NX), np.float32)
for b in L['boxes']:
    dx = np.maximum(0, np.abs(X - b['x'] - 0.35) - b['w'] / 2); dz = np.maximum(0, np.abs(Z - b['z'] + 0.25) - b['d'] / 2)
    dd = np.sqrt(dx ** 2 + dz ** 2)
    sh = np.maximum(sh, np.exp(-dd * (4.5 if b['kind'] != 'bush' else 5.5)) * (0.6 if b['kind'] != 'bush' else 0.4) * (dd < 1.2))
    ex = np.maximum(0, np.abs(X - b['x']) - b['w'] / 2); ez = np.maximum(0, np.abs(Z - b['z']) - b['d'] / 2)
    if b['kind'] in ('rock', 'crate', 'wall', 'statue'):
        dirt = np.maximum(dirt, np.clip(1 - np.sqrt(ex ** 2 + ez ** 2) / 0.6, 0, 1) * (noise(12, 2, 41) > 0.45))
img = mix(img, np.broadcast_to(col('#8A6A43'), (NZ, NX, 3)), soft(dirt, 2) * 0.45 * (1 - sm))
sh = soft(sh, 3)
img *= (1 - sh[..., None] * 0.55)

# 6. grass tufts and little flowers on the green
im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
dr = ImageDraw.Draw(im, 'RGBA')
mask_full = soft(stone_mask, 4)
def free(px, py):
    return mask_full[int(py), int(px)] < 0.05 and sh[int(py), int(px)] < 0.2
for _ in range(6000):
    px, py = rng.random() * NX, rng.random() * NZ
    if not free(px, py): continue
    h = 6 + rng.random() * 10; shade = int(rng.random() * 50)
    for k in (-1, 0, 1):
        dr.line([(px + k * 3, py), (px + k * 5 + rng.normal() * 2, py - h)], fill=(40 + shade // 2, 120 + shade, 40, 200), width=2)
for _ in range(560):
    px, py = rng.random() * NX, rng.random() * NZ
    if not free(px, py): continue
    c = [(255, 255, 255), (255, 214, 79), (255, 140, 180), (180, 140, 255)][rng.integers(4)]
    r = 3 + rng.random() * 2
    for k in range(5):
        a = k / 5 * 6.283
        dr.ellipse([px + np.cos(a) * r - 2.5, py + np.sin(a) * r - 2.5, px + np.cos(a) * r + 2.5, py + np.sin(a) * r + 2.5], fill=c + (235,))
    dr.ellipse([px - 2, py - 2, px + 2, py + 2], fill=(255, 200, 40, 255))

# 7. darker toward the walls
a = np.asarray(im).astype(np.float32)
edge = np.minimum(HX - np.abs(X), HZ - np.abs(Z))
a *= (0.62 + 0.38 * np.clip(edge / 1.6, 0, 1))[..., None]
Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(out, quality=88)
print('ok', out)
