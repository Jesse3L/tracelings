# Turns raw AI coloring images into crisp black-and-white PNGs for the site.
# Usage: python3 scripts/process_coloring.py /home/claude/coloring-raw public/coloring
import sys, os
from PIL import Image, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
for coll in sorted(os.listdir(src)):
    cdir = os.path.join(src, coll)
    if coll.startswith('_') or not os.path.isdir(cdir):
        continue
    os.makedirs(os.path.join(dst, coll), exist_ok=True)
    for f in sorted(os.listdir(cdir)):
        if not f.endswith('.png'):
            continue
        im = Image.open(os.path.join(cdir, f)).convert('L')
        # Upscale 2x with smoothing, then threshold: smoother edges for printing at full page.
        big = im.resize((im.width * 2, im.height * 2), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.6))
        bw = big.point(lambda v: 255 if v > 150 else 0).convert('1')
        bw.save(os.path.join(dst, coll, f), optimize=True)
        # Small preview for listings (grayscale keeps lines smooth when shrunk).
        thumb = im.resize((440, int(440 * im.height / im.width)), Image.LANCZOS)
        thumb.save(os.path.join(dst, coll, f.replace('.png', '-thumb.webp')), 'WEBP', quality=80)
        print('ok', coll, f)
