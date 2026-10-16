# Crops each 3x3 icon sheet into 9 icons by connected components, saves crisp B/W PNGs (square, padded).
import sys, os, json
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
src, dst = sys.argv[1], sys.argv[2]
NAMES = json.load(open(sys.argv[3]))
for theme, names in NAMES.items():
    im = Image.open(os.path.join(src, theme + '.png')).convert('L')
    a = np.array(im)
    ink = a < 140
    lab, n = ndimage.label(ndimage.binary_dilation(ink, iterations=6))
    H, W = a.shape
    boxes = {}
    for sl in ndimage.find_objects(lab):
        if sl is None: continue
        ys, xs = sl
        if (ys.stop-ys.start)*(xs.stop-xs.start) < 400: continue
        cy, cx = (ys.start+ys.stop)/2, (xs.start+xs.stop)/2
        cell = int(cy // (H/3))*3 + int(cx // (W/3))
        b = boxes.get(cell, [ys.start, xs.start, ys.stop, xs.stop])
        boxes[cell] = [min(b[0], ys.start), min(b[1], xs.start), max(b[2], ys.stop), max(b[3], xs.stop)]
    os.makedirs(os.path.join(dst, theme), exist_ok=True)
    for cell, name in enumerate(names):
        if name is None or cell not in boxes: continue
        y0, x0, y1, x1 = boxes[cell]
        crop = im.crop((x0, y0, x1, y1))
        side = int(max(crop.width, crop.height) * 1.08)
        sq = Image.new('L', (side, side), 255)
        sq.paste(crop, ((side - crop.width)//2, (side - crop.height)//2))
        sq = sq.resize((600, 600), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.5))
        bw = sq.point(lambda v: 255 if v > 150 else 0).convert('1')
        bw.save(os.path.join(dst, theme, name + '.png'), optimize=True)
        print(theme, name, x1-x0, y1-y0)
