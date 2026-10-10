# Renders Pinterest pins (1000x1500) from scripts/pins/pins.json into public/pins/*.jpg, and writes
# scripts/pins/pinterest-bulk.csv for Pinterest's bulk pin upload. Run: python3 scripts/pins/make-pins.py
import asyncio, json, os, csv, datetime, pathlib
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
PINS = json.load(open(ROOT / 'scripts/pins/pins.json'))
OUT = ROOT / 'public/pins'; OUT.mkdir(exist_ok=True)
FONT = ROOT / 'node_modules/@fontsource/andika/files'
MARK = (ROOT / 'public/favicon.svg').read_text()

CSS = f"""
@font-face {{ font-family: Andika; font-weight: 400; src: url('file://{FONT}/andika-latin-400-normal.woff2'); }}
@font-face {{ font-family: Andika; font-weight: 700; src: url('file://{FONT}/andika-latin-700-normal.woff2'); }}
* {{ box-sizing: border-box; margin: 0; }}
body {{ width: 1000px; height: 1500px; font-family: Andika, sans-serif; color: #1e2a44;
  background: radial-gradient(circle at 85% 8%, #fff4d6 0 160px, transparent 161px), #f6f8fb; position: relative; overflow: hidden; }}
.top {{ padding: 64px 70px 0; }}
.pill {{ display: inline-block; background: #f2c14e; box-shadow: inset 0 -3px 0 #d9a52f; border-radius: 999px; padding: 10px 24px; font-weight: 700; font-size: 26px; letter-spacing: .06em; }}
h1 {{ margin-top: 26px; font-size: 76px; line-height: 1.32; font-weight: 700; letter-spacing: -.01em; }}
h1 span {{ padding: 0 .06em; -webkit-box-decoration-break: clone; box-decoration-break: clone;
  background-image: linear-gradient(#5b86d9,#5b86d9), repeating-linear-gradient(90deg,#e46a72 0 10px,transparent 10px 18px), linear-gradient(#5b86d9,#5b86d9);
  background-size: 100% 3px, 100% 2.5px, 100% 3px; background-position: 0 .3em, 0 .56em, 0 1.06em; background-repeat: no-repeat; }}
.sub {{ margin-top: 14px; font-size: 36px; color: #5f6b82; }}
.stage {{ position: absolute; left: 70px; right: 70px; top: var(--top); bottom: 170px; display: flex; align-items: center; justify-content: center; }}
.card {{ background: #fff; border: 2px solid #dce3ee; border-radius: 18px; box-shadow: 0 30px 60px -30px rgba(30,42,68,.45); padding: 18px; }}
.single .card {{ height: 100%; aspect-ratio: 8.5/11; transform: rotate(-1.5deg); }}
.single img {{ width: 100%; height: 100%; object-fit: contain; display: block; }}
.grid {{ display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 26px; height: 100%; width: 100%; }}
.grid .card {{ padding: 12px; min-height: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; }}
.grid .card:nth-child(1) {{ transform: rotate(-2deg); }} .grid .card:nth-child(2) {{ transform: rotate(1.5deg); }}
.grid .card:nth-child(3) {{ transform: rotate(1deg); }} .grid .card:nth-child(4) {{ transform: rotate(-1.5deg); }}
.grid img {{ max-width: 100%; max-height: 100%; object-fit: contain; display: block; }}
.foot {{ position: absolute; left: 0; right: 0; bottom: 0; height: 132px; background: #1e2a44; color: #fff; display: flex; align-items: center; gap: 22px; padding: 0 70px; }}
.foot svg {{ width: 70px; height: 70px; }}
.foot b {{ font-size: 44px; }} .foot i {{ font-style: normal; margin-left: auto; font-size: 28px; color: #c9d2e3; }}
.rule {{ position: absolute; left: 0; right: 0; bottom: 132px; height: 18px;
  background: linear-gradient(#5b86d9,#5b86d9) 0 2px/100% 3px no-repeat, repeating-linear-gradient(90deg,#e46a72 0 10px,transparent 10px 17px) 0 8px/100% 2px no-repeat, linear-gradient(#5b86d9,#5b86d9) 0 14px/100% 3px no-repeat; }}
"""

def html(p):
    imgs = ''.join(f'<div class="card"><img src="file://{ROOT / i}"></div>' for i in p['images'])
    stage = f'<div class="stage single" style="--top:{p.get("_top", 470)}px">{imgs}</div>' if p['kind'] == 'single' else \
            f'<div class="stage" style="--top:{p.get("_top", 470)}px"><div class="grid">{imgs}</div></div>'
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<div class="top"><span class="pill">FREE PRINTABLE</span><h1><span>{p['head']}</span></h1><p class="sub">{p['sub']}</p></div>
{stage}<div class="rule"></div><div class="foot">{MARK}<b>tracelings.com</b><i>Print in seconds</i></div></body></html>"""

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--allow-file-access-from-files'])
        pg = await b.new_page(viewport={'width': 1000, 'height': 1500})
        for p in PINS:
            path = OUT / f"{p['id']}.html"
            # Measure the headline so the image starts below it.
            path.write_text(html(p)); await pg.goto(f'file://{path}'); await pg.evaluate('document.fonts.ready')
            bottom = await pg.evaluate("document.querySelector('.sub').getBoundingClientRect().bottom")
            p['_top'] = int(bottom + 44)
            path.write_text(html(p)); await pg.goto(f'file://{path}'); await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(150)
            await pg.screenshot(path=str(OUT / f"{p['id']}.jpg"), type='jpeg', quality=86)
            path.unlink()
        await b.close()

    # Pinterest bulk upload CSV. 3 pins a day at 9am, 1pm and 7pm Central (written in UTC), Thanksgiving first.
    start = datetime.date.fromisoformat(os.environ['PIN_START']) if os.environ.get('PIN_START') else datetime.date.today() + datetime.timedelta(days=2)
    slots = [14, 18, 0]  # UTC hours ~ 9am, 1pm, 7pm CDT (7pm lands on the next UTC day)
    rows = []
    for i, p in enumerate(PINS):
        day = start + datetime.timedelta(days=i // 3); h = slots[i % 3]
        when = datetime.datetime.combine(day + datetime.timedelta(days=1 if h == 0 else 0), datetime.time(h, 0))
        rows.append({'Title': p['title'][:100], 'Media URL': f"https://tracelings.com/pins/{p['id']}.jpg", 'Pinterest board': p['board'],
                     'Thumbnail': '', 'Description': p['desc'][:500], 'Link': p['link'], 'Publish date': when.strftime('%Y-%m-%dT%H:%M:%S'), 'Keywords': ''})
    with open(ROOT / 'scripts/pins/pinterest-bulk.csv', 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
    print(len(PINS), 'pins')

asyncio.run(main())
