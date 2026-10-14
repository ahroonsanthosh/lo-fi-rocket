"""Prepare the viewer's photographic assets from Poly Haven (CC0) downloads (plan 3d-0002).

Run from a scratch directory that holds `raw/` with the downloaded files listed in
`assets/ASSETS.md`; writes `out/`. Needs Python 3 with numpy and Pillow. Not part of the build.
"""
import shutil
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from hdr import read_hdr, write_hdr  # noqa: E402

SKY = 'kloofendal_48d_partly_cloudy_puresky'

hdr = read_hdr(f'raw/{SKY}_1k.hdr')
h, w, _ = hdr.shape
lum = hdr @ np.array([0.2126, 0.7152, 0.0722])
ys, xs = np.nonzero(lum > 0.5 * lum.max())
cy, cx = ys.mean() + 0.5, xs.mean() + 0.5
print('sun: u =', cx / w, 'elevation =', 90 - cy / h * 180, 'deg')
small = hdr.reshape(128, h // 128, 256, w // 256, 3).mean(axis=(1, 3))
write_hdr('out/sky_light.hdr', small)

im = Image.open(f'raw/{SKY}.jpg')  # Poly Haven's tonemapped 8K JPG
W, H = im.size
crop = im.crop((0, 0, W, int(H * 0.53)))  # zenith to 3 % below the horizon
crop = crop.resize((4096, int(4096 * crop.size[1] / W)), Image.LANCZOS)
crop.save('out/sky.jpg', quality=84, optimize=True, progressive=True)

for src, dst, size, q in [
    ('aerial_grass_rock_diff_2k.jpg', 'field_diffuse.jpg', 2048, 78),
    ('aerial_grass_rock_nor_gl_1k.jpg', 'field_normal.jpg', 1024, 85),
    ('leafy_grass_diff_1k.jpg', 'grass_diffuse.jpg', 1024, 80),
    ('leafy_grass_nor_gl_1k.jpg', 'grass_normal.jpg', 1024, 85),
    ('rocky_terrain_02_diff_1k.jpg', 'hills_diffuse.jpg', 1024, 80),
    ('rocky_terrain_02_nor_gl_1k.jpg', 'hills_normal.jpg', 1024, 85),
]:
    t = Image.open(f'raw/{src}').convert('RGB')
    if t.size[0] != size:
        t = t.resize((size, size), Image.LANCZOS)
    t.save(f'out/{dst}', quality=q, optimize=True, progressive=True)
