# The crystal-mine court floor: 17x25 units (x -8.5..8.5, z -12.5..12.5; image top = z -12.5).
import numpy as np, json, sys
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter, zoom
NX, NZ = 1392, 2048
HX, HZ, RC = 8.5, 12.5, 4.0
L = json.load(open(sys.argv[1])); out = sys.argv[2]
rng = np.random.default_rng(5)
ys, xs = np.mgrid[0:NZ, 0:NX].astype(np.float32)
X = xs / NX * 2 * HX - HX; Z = ys / NZ * 2 * HZ - HZ
S = NX / (2 * HX)  # pixels per unit
def noise(scale, octaves=4, seed=0):
    r = np.random.default_rng(seed); acc = np.zeros((NZ, NX), np.float32); amp = 1; tot = 0
    for o in range(octaves):
        n = max(2, int(NZ / scale * 2 ** o)); g = r.random((n, n)).astype(np.float32)
        acc += amp * zoom(g, NZ / n, order=3)[:NZ, :NX]; tot += amp; amp *= 0.5
    return acc / tot
col = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32)
def mix(a, b, t):
    t = np.clip(t, 0, 1)[..., None]
    if not isinstance(b, np.ndarray) or b.ndim == 1: b = np.broadcast_to(col(b) if isinstance(b, str) else b, a.shape)
    return a * (1 - t) + b * t
soft = lambda m, r: gaussian_filter(m.astype(np.float32), r)

# warm canyon sand
n1, n2, n3 = noise(260, 4, 1), noise(50, 3, 2), noise(12, 2, 3)
img = np.broadcast_to(col('#E8A46B'), (NZ, NX, 3)).copy()
img = mix(img, '#F2BC85', (n1 - 0.45) * 2.2)
img = mix(img, '#D58A55', np.clip((0.42 - n2) * 3, 0, 1) * 0.6)
img *= (0.94 + n3[..., None] * 0.12)

# wheel tracks swirling across the sand (pairs of soft dark lines)
tr = np.zeros((NZ, NX), np.float32)
for k in range(5):
    a, ph, f, x0 = rng.uniform(1.2, 3.0), rng.uniform(0, 6), rng.uniform(0.18, 0.32), rng.uniform(-5, 5)
    cx = x0 + a * np.sin(Z * f + ph)
    for off in (-0.28, 0.28):
        tr = np.maximum(tr, np.exp(-((X - cx - off) / 0.07) ** 2))
img = mix(img, '#B8713F', soft(tr, 1.2) * 0.35)

# the pit around the crystal mound, inside the rail loop
m = L['mound']; E = ((X / m['rx']) ** 2 + (Z / m['rz']) ** 2)
pit = soft(E < 1.0, 6)
img = mix(img, '#9C5A35', pit * 0.75)
img = mix(img, '#7A4126', soft(E < 0.55, 8) * 0.5)

# scattered flat stone slabs (voronoi cells, only some kept)
cell = 0.9; gx = int(2 * HZ / cell) + 3
jit = rng.random((gx, gx, 2)); keep = rng.random((gx, gx)) < 0.22
cx, cz = (X + HX) / cell, (Z + HZ) / cell; ix, iz = np.floor(cx).astype(int), np.floor(cz).astype(int)
f1 = np.full((NZ, NX), 9.0, np.float32); f2 = f1.copy(); kid = np.zeros((NZ, NX), bool); tone = np.zeros((NZ, NX), np.float32)
for dx in (-1, 0, 1):
    for dz in (-1, 0, 1):
        jx, jz = np.clip(ix + dx, 0, gx - 1), np.clip(iz + dz, 0, gx - 1)
        d = np.hypot(cx - (jx + 0.2 + jit[jx, jz, 0] * 0.6), cz - (jz + 0.2 + jit[jx, jz, 1] * 0.6))
        c = d < f1; f2 = np.where(c, f1, np.minimum(f2, d)); kid = np.where(c, keep[jx, jz], kid); tone = np.where(c, jit[jx, jz, 0], tone); f1 = np.where(c, d, f1)
slab = kid & ((f2 - f1) > 0.09) & (E > 1.15)
slabc = mix(np.broadcast_to(col('#C98458'), (NZ, NX, 3)).copy(), '#D99A6C', tone)
img = mix(img, slabc, soft(slab, 1.0))
img = mix(img, '#8E4F2C', soft(kid & ((f2 - f1) <= 0.09) & ((f2 - f1) > 0.04) & (E > 1.15), 0.8) * 0.6)

# team zones: rounded rectangles with a bright rim and a hex emblem
def rrect(cx, cz, w, d, r):
    qx = np.maximum(np.abs(X - cx) - (w / 2 - r), 0); qz = np.maximum(np.abs(Z - cz) - (d / 2 - r), 0)
    return np.hypot(qx, qz) - r
for t in L['zones']:
    sd = rrect(t['x'], t['z'], t['w'], t['d'], 0.5)
    img = mix(img, '#5A2E18', soft(sd < 0.12, 3) * 0.4)
    img = mix(img, t['c2'], soft(sd < 0, 1.2))
    img = mix(img, t['c1'], soft((sd < 0) & (sd > -0.18), 1.0) * 0.9)
    hx = np.abs(X - t['x']); hz = np.abs(Z - t['z'])
    hexd = np.maximum(hz * 0.866 + hx * 0.5, hx) - 0.62
    img = mix(img, t['c1'], soft(np.abs(hexd) < 0.07, 1) * 0.85)
    img = mix(img, t['c1'], soft(hexd < -0.25, 1) * 0.35)

# stone bases under the jump pads
for p in L['pads']:
    sd = rrect(p['x'], p['z'], 1.8, 1.8, 0.35)
    img = mix(img, '#A86B47', soft(sd < 0, 1.5)); img = mix(img, '#6E3F23', soft(np.abs(sd) < 0.05, 1) * 0.8)

# contact shadows (light from the left and behind)
sh = np.zeros((NZ, NX), np.float32)
for b in L['boxes']:
    dx = np.maximum(0, np.abs(X - b['x'] - 0.3) - b['w'] / 2); dz = np.maximum(0, np.abs(Z - b['z'] + 0.25) - b['d'] / 2)
    dd = np.hypot(dx, dz); sh = np.maximum(sh, np.exp(-dd * 4.5) * (0.55 if b['kind'] != 'bush' else 0.35) * (dd < 1.2))
img *= (1 - soft(sh, 3)[..., None] * 0.5)

# pebbles
im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)); dr = ImageDraw.Draw(im, 'RGBA')
for _ in range(800):
    px, py = rng.random() * NX, rng.random() * NZ
    x, z = px / S - HX, py / S - HZ
    if (x / m['rx']) ** 2 + (z / m['rz']) ** 2 < 1.1: continue
    r = 2 + rng.random() * 3; c = [(150, 92, 60), (196, 130, 88), (120, 72, 48), (230, 190, 150)][rng.integers(4)]
    dr.ellipse([px - r, py - r * 0.7, px + r, py + r * 0.7], fill=c + (220,))
a = np.asarray(im).astype(np.float32)
# shade toward the wall, darker outside it
qx = np.maximum(np.abs(X) - (HX - RC), 0); qz = np.maximum(np.abs(Z) - (HZ - RC), 0); wall = RC - np.hypot(qx, qz)
edge = np.minimum(np.minimum(HX - np.abs(X), HZ - np.abs(Z)), wall)
a *= (0.6 + 0.4 * np.clip(edge / 1.4, 0, 1))[..., None]
Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(out, quality=88); print('ok')
