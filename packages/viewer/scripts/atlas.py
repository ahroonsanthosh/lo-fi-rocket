"""Build the tree billboard atlas from the offline renders (colour + view-space normal)."""
import json
import numpy as np
from PIL import Image, ImageFilter

CELL_W, CELL_H, COLS = 256, 512, 8
atlas_c = np.zeros((CELL_H, CELL_W * COLS, 4), np.float64)
atlas_n = np.zeros((CELL_H, CELL_W * COLS, 3), np.float64)
meta = []

def load(n):
    c = np.array(Image.open(n + '_colour.png').convert('RGBA')).astype(np.float64) / 255
    nm = np.array(Image.open(n + '_normal.png').convert('RGBA')).astype(np.float64) / 255
    return c, nm, json.load(open(n + '.json'))

def blur(x, r):
    return np.array(Image.fromarray((x.clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float64) / 255

def dilate(rgb, a):
    """Fill transparent pixels with nearby opaque colour (normalised blur) so mipmaps keep edge colours."""
    out = rgb.copy()
    known = (a > 0.5).astype(np.float64)
    for r in (1, 2, 4, 8, 16, 32):
        den = blur(known, r)
        fill = np.stack([blur(out[..., k] * known, r) for k in range(3)], -1) / np.maximum(den[..., None], 1e-3)
        mask = (known < 0.5) & (den > 0.02)
        out[mask] = fill[mask]
        known = np.maximum(known, mask.astype(np.float64))
    return out

def place(slot, c, nm, x0, x1, mpp, species):
    sub = c[:, x0:x1, 3]
    rows = np.nonzero(sub.sum(axis=1) > 0)[0]
    y0, y1 = rows[0], rows[-1] + 1
    cc, nn = c[y0:y1, x0:x1], nm[y0:y1, x0:x1]
    h_px, w_px = cc.shape[:2]
    scale = min(CELL_W / w_px, CELL_H / h_px)
    tw, th = max(1, round(w_px * scale)), max(1, round(h_px * scale))
    ci = Image.fromarray((cc * 255).astype(np.uint8), 'RGBA').resize((tw, th), Image.LANCZOS)
    ni = Image.fromarray((nn[..., :3] * 255).astype(np.uint8), 'RGB').resize((tw, th), Image.LANCZOS)
    ox = slot * CELL_W + (CELL_W - tw) // 2
    oy = CELL_H - th  # trunk base at the cell's bottom edge
    atlas_c[oy:oy + th, ox:ox + tw] = np.array(ci).astype(np.float64) / 255
    atlas_n[oy:oy + th, ox:ox + tw] = np.array(ni).astype(np.float64) / 255
    meta.append({'species': species,
                 'u0': ox / (CELL_W * COLS), 'u1': (ox + tw) / (CELL_W * COLS),
                 'v0': 0.0, 'v1': th / CELL_H,
                 'width': round(w_px * mpp, 3), 'height': round(h_px * mpp, 3)})

c, nm, j = load('fir_0')
for i, (x0, x1) in enumerate([(14, 361), (367, 664), (675, 1010)]):
    place(i, c, nm, x0, x1, j['metresPerPixel'], 'conifer')
slot = 3
for n in ['island_0', 'island_1', 'small_0', 'small_1', 'small_2']:
    c, nm, j = load(n)
    cols = np.nonzero(c[..., 3].sum(axis=0) > 0)[0]
    place(slot, c, nm, cols[0], cols[-1] + 1, j['metresPerPixel'], 'broadleaf')
    slot += 1

a = atlas_c[..., 3]
rgb = dilate(atlas_c[..., :3], a)
nrm = dilate(atlas_n, a)
Image.fromarray((np.dstack([rgb, a]).clip(0, 1) * 255).astype(np.uint8), 'RGBA').save('../../out/trees_colour.webp', quality=88, method=6)
Image.fromarray((nrm.clip(0, 1) * 255).astype(np.uint8), 'RGB').save('../../out/trees_normal.webp', quality=90, method=6)
json.dump({'cellWidth': CELL_W, 'cellHeight': CELL_H, 'variants': meta}, open('../../out/trees.json', 'w'), indent=1)
for m in meta: print(m)
prev = Image.new('RGBA', (CELL_W * COLS, CELL_H * 2), (120, 160, 200, 255))
prev.alpha_composite(Image.open('../../out/trees_colour.webp'), (0, 0))
prev.paste(Image.open('../../out/trees_normal.webp'), (0, CELL_H))
prev.convert('RGB').resize((CELL_W * COLS // 2, CELL_H)).save('atlas_preview.png')
