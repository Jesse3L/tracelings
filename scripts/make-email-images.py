# Email-sized images under public/email/ (PNG, since some mail apps still can't show WebP).
# Run: python3 scripts/make-email-images.py   (needs Pillow). Each file stays well under 150 KB.
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'email'
OUT.mkdir(parents=True, exist_ok=True)

# Picture-book scenes shown in the "week 1 for a kid who loves dinosaurs" emails. 2x the 260px display width.
SCENES = ['find-egg', 'solve-egg-home']
for s in SCENES:
    im = Image.open(ROOT / 'public' / 'program' / 'scenes' / 'dinosaurs' / f'{s}.png').convert('L')
    im = im.resize((520, 390), Image.LANCZOS)
    # A few gray levels keep the line art smooth while the file stays small.
    im = im.quantize(colors=16)
    path = OUT / f'dinosaurs-{s}.png'
    im.save(path, optimize=True)
    print(path.name, path.stat().st_size)

logo = Image.open(ROOT / 'public' / 'logo.png').convert('RGBA').resize((96, 96), Image.LANCZOS)
path = OUT / 'logo-96.png'
logo.save(path, optimize=True)
print(path.name, path.stat().st_size)
