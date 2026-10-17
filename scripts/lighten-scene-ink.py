# Finds solid black areas in the scene pictures (thicker than a drawn line) and hollows them out, keeping a bold
# outline, so a page prints with less ink and the area can be colored in. Lines, eyes and small dots stay as drawn.
# Usage: python3 -I scripts/lighten-scene-ink.py [--write] [theme/id ...]   (no ids: scan every scene)
import sys, os, glob
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'program', 'scenes')
R = 14            # a black area that survives erosion by this radius is "solid" (drawn lines are about 8 to 12 px)
MIN_AREA = 9000   # eroded area in px before it counts (pupils and eyes stay black; doorways, holes and shadows go)
KEEP = 9          # outline width kept around a hollowed area

def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r

def lighten(path, write):
    im = Image.open(path).convert('L')
    a = np.asarray(im)
    black = a < 128
    core = ndimage.binary_erosion(black, structure=disk(R))
    lab, n = ndimage.label(core)
    if not n:
        return 0
    sizes = ndimage.sum(core, lab, range(1, n + 1))
    big = np.isin(lab, np.where(sizes >= MIN_AREA)[0] + 1)
    if not big.any():
        return 0
    # The solid region is the core grown back to the shape; clear it except a KEEP-wide rim.
    region = ndimage.binary_dilation(big, structure=disk(R)) & black
    inner = ndimage.binary_erosion(region, structure=disk(KEEP))
    if write:
        out = a.copy()
        out[inner] = 255
        img = Image.fromarray(out).point(lambda v: 255 if v > 128 else 0).convert('1')
        img.save(path, optimize=True)
        th = img.convert('L').resize((480, 360), Image.LANCZOS)
        th.save(path.replace('.png', '-thumb.webp'), 'WEBP', quality=80)
    return int(inner.sum())

write = '--write' in sys.argv
ids = [x for x in sys.argv[1:] if not x.startswith('--')]
files = [os.path.join(ROOT, i + '.png') for i in ids] if ids else sorted(p for p in glob.glob(os.path.join(ROOT, '*', '*.png')))
for f in files:
    n = lighten(f, write)
    if n:
        print(f'{os.path.relpath(f, ROOT)}: {n} px of solid black {"cleared" if write else "found"}')
