# Rasterizes page 1 (or the pages given) of each PDF matching a glob and tiles them into one contact sheet PNG with labels.
# Usage: python3 scripts/qa/contact.py '<dir>/names-name-tracing-*.pdf' out.png [dpi] [pages e.g. 1-3]
import sys, glob, os, subprocess, tempfile
from PIL import Image, ImageDraw

pat, out = sys.argv[1], sys.argv[2]
dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 45
first, last = (sys.argv[4].split('-') + [None])[:2] if len(sys.argv) > 4 else ('1', '1')
last = last or first
tiles = []
with tempfile.TemporaryDirectory() as tmp:
    for f in sorted(glob.glob(pat)):
        base = os.path.join(tmp, os.path.basename(f)[:-4])
        subprocess.run(['pdftoppm', '-r', str(dpi), '-f', first, '-l', last, '-png', f, base], check=True)
        for png in sorted(glob.glob(base + '*.png')):
            im = Image.open(png).convert('RGB'); im.load()
            tiles.append((os.path.basename(png)[:-4], im))
if not tiles: sys.exit('no pdfs')
w = max(t[1].width for t in tiles); h = max(t[1].height for t in tiles) + 16
cols = min(6, len(tiles)); rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (w + 8), rows * (h + 8)), '#ccd')
d = ImageDraw.Draw(sheet)
for i, (name, im) in enumerate(tiles):
    x, y = (i % cols) * (w + 8), (i // cols) * (h + 8)
    sheet.paste(im, (x, y + 16)); d.text((x + 2, y + 2), name[-40:], fill='black')
sheet.save(out); print(out, sheet.size)
