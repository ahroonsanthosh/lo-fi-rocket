"""Radiance .hdr (RGBE, new-style RLE) read/write with numpy, for asset preparation only."""
import numpy as np

def read_hdr(path):
    with open(path, 'rb') as f:
        data = f.read()
    # Header ends with an empty line, then the resolution line.
    head_end = data.index(b'\n\n') + 2
    nl = data.index(b'\n', head_end)
    res = data[head_end:nl].decode().split()
    h, w = int(res[1]), int(res[3])
    pos = nl + 1
    out = np.zeros((h, w, 4), dtype=np.uint8)
    for y in range(h):
        if data[pos] == 2 and data[pos + 1] == 2:
            pos += 4
            for c in range(4):
                x = 0
                while x < w:
                    n = data[pos]; pos += 1
                    if n > 128:
                        n -= 128
                        out[y, x:x + n, c] = data[pos]; pos += 1
                    else:
                        out[y, x:x + n, c] = np.frombuffer(data[pos:pos + n], dtype=np.uint8); pos += n
                    x += n
        else:
            out[y] = np.frombuffer(data[pos:pos + 4 * w], dtype=np.uint8).reshape(w, 4); pos += 4 * w
    e = out[..., 3].astype(np.int32)
    scale = np.where(e > 0, np.ldexp(1.0, e - 136), 0.0)
    return out[..., :3].astype(np.float64) * scale[..., None]

def write_hdr(path, rgb):
    h, w, _ = rgb.shape
    m = rgb.max(axis=2)
    mant, ex = np.frexp(m)
    valid = m > 1e-32
    scale = np.where(valid, mant * 256.0 / np.where(valid, m, 1), 0)
    rgbe = np.zeros((h, w, 4), dtype=np.uint8)
    rgbe[..., :3] = np.clip(rgb * scale[..., None], 0, 255).astype(np.uint8)
    rgbe[..., 3] = np.where(valid, ex + 128, 0).astype(np.uint8)
    with open(path, 'wb') as f:
        f.write(b'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n')
        f.write(f'-Y {h} +X {w}\n'.encode())
        f.write(rgbe.tobytes())  # flat (uncompressed) scanlines
