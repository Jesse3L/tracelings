# Renders Pinterest pins (1000x1500) from scripts/pins/pins.json into public/pins/*.jpg, and writes a
# Pinterest bulk upload CSV for one batch. Batches and their upload status live in scripts/pins/batches.json;
# the table in scripts/pins/README.md is rebuilt from it every run.
#
#   PIN_BATCH=<batch> PIN_START=YYYY-MM-DD python3 scripts/pins/make-pins.py   render the batch, write its CSV
#   PIN_SKIP_RENDER=1 ...                                                        write the CSV only, keep the jpgs
#   python3 scripts/pins/make-pins.py --status                                   list batches, flag stale CSVs
#   python3 scripts/pins/make-pins.py --uploaded <batch>                         mark a batch as uploaded
#   python3 scripts/pins/make-pins.py                                            render every pin, write no CSV
#
# The script refuses to write a CSV whose first pin time is already past (Pinterest's bulk upload only
# schedules future dates) and refuses to rewrite a batch marked uploaded, so pins are never scheduled twice.
import asyncio, json, os, csv, datetime, pathlib, sys
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parents[2]
PINS = json.load(open(ROOT / 'scripts/pins/pins.json'))
BATCH = os.environ.get('PIN_BATCH')
OUT = ROOT / 'public/pins'
PINDIR = ROOT / 'scripts/pins'
BATCHES_FILE = PINDIR / 'batches.json'
README = PINDIR / 'README.md'
CENTRAL = ZoneInfo('America/Chicago')
SLOTS = [9, 13, 19]  # 3 pins a day at 9am, 1pm and 7pm Central, written to the CSV in UTC
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
  background-size: 100% 3px, 100% 2.5px, 100% 3px; background-position: 0 calc(.48em - 1.5px), 0 calc(.72em - 1px), 0 calc(1.22em + 1.5px); background-repeat: no-repeat; }}
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

async def render(pins):
    from playwright.async_api import async_playwright
    OUT.mkdir(exist_ok=True)
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--allow-file-access-from-files'])
        pg = await b.new_page(viewport={'width': 1000, 'height': 1500})
        for p in pins:
            path = OUT / f"{p['id']}.html"
            # Measure the headline so the image starts below it.
            path.write_text(html(p)); await pg.goto(f'file://{path}'); await pg.evaluate('document.fonts.ready')
            bottom = await pg.evaluate("document.querySelector('.sub').getBoundingClientRect().bottom")
            p['_top'] = int(bottom + 44)
            path.write_text(html(p)); await pg.goto(f'file://{path}'); await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(150)
            await pg.screenshot(path=str(OUT / f"{p['id']}.jpg"), type='jpeg', quality=86)
            path.unlink()
        await b.close()



def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)

def schedule(n, start):
    """n publish times from start (a date), 3 a day in Central time, returned as naive UTC datetimes."""
    out = []
    for i in range(n):
        local = datetime.datetime.combine(start + datetime.timedelta(days=i // 3), datetime.time(SLOTS[i % 3]), CENTRAL)
        out.append(local.astimezone(datetime.timezone.utc).replace(tzinfo=None))
    return out

def load_batches():
    return json.loads(BATCHES_FILE.read_text())

def csv_times(name):
    path = PINDIR / name
    if not path.exists():
        return []
    return [datetime.datetime.fromisoformat(r['Publish date']) for r in csv.DictReader(open(path)) if r.get('Publish date')]

def status_word(b, now):
    times = csv_times(b['csv'])
    if b.get('uploaded') is True:
        return 'uploaded'
    if not times:
        return 'no CSV'
    if times[0] <= now:
        return 'stale: first pin time has passed, rerun with a later PIN_START before uploading'
    return 'ready to upload'

def save_batches(batches):
    BATCHES_FILE.write_text(json.dumps(batches, indent=2) + '\n')
    now = utc_now().replace(tzinfo=None)
    up = {True: 'yes', False: 'no', None: 'not confirmed'}
    rows = ['| Batch | Pins | CSV | First pin (UTC) | Last pin (UTC) | Uploaded | Status |', '|---|---|---|---|---|---|---|']
    for b in batches:
        t = csv_times(b['csv'])
        first = t[0].strftime('%Y-%m-%d %H:%M') if t else ''
        last = t[-1].strftime('%Y-%m-%d %H:%M') if t else ''
        rows.append(f"| {b['batch']} | {len(b['pins'])} | `{b['csv']}` | {first} | {last} | {up[b.get('uploaded')]} | {status_word(b, now)} |")
    text = README.read_text()
    a, z = '<!-- batches:start -->', '<!-- batches:end -->'
    README.write_text(text[:text.index(a) + len(a)] + '\n' + '\n'.join(rows) + '\n' + text[text.index(z):])

def fail(msg):
    print('make-pins: ' + msg, file=sys.stderr); sys.exit(1)

def main():
    batches = load_batches()
    by_name = {b['batch']: b for b in batches}
    now = utc_now().replace(tzinfo=None)

    if '--status' in sys.argv:
        for b in batches:
            print(f"{b['batch']:<20} {len(b['pins']):>3} pins  {b['csv']:<40} {status_word(b, now)}")
        save_batches(batches)
        return
    if '--uploaded' in sys.argv:
        name = sys.argv[sys.argv.index('--uploaded') + 1]
        if name not in by_name: fail(f'no batch named {name} in batches.json')
        by_name[name]['uploaded'] = True; save_batches(batches); print(name, 'marked uploaded'); return

    if not BATCH:
        asyncio.run(render(PINS))
        print(len(PINS), 'pins rendered, no CSV written (set PIN_BATCH to write one)')
        return

    pins = [p for p in PINS if p.get('batch') == BATCH]
    if not pins: fail(f'no pins in batch {BATCH}')
    b = by_name.get(BATCH)
    if b and b.get('uploaded') is True:
        fail(f'batch {BATCH} is marked uploaded in batches.json; rewriting its CSV would schedule the pins twice')
    for p in pins:
        if len(p['title']) > 100: fail(f"{p['id']}: title is over Pinterest's 100 characters")
        if len(p['desc']) > 500: fail(f"{p['id']}: description is over Pinterest's 500 characters")
    start = datetime.date.fromisoformat(os.environ['PIN_START']) if os.environ.get('PIN_START') else datetime.date.today() + datetime.timedelta(days=2)
    times = schedule(len(pins), start)
    if times[0] <= now + datetime.timedelta(hours=1):
        fail(f'the first pin would publish at {times[0]:%Y-%m-%d %H:%M} UTC, which is past or within the hour; '
             'Pinterest only schedules future dates. Pick a later PIN_START.')

    if os.environ.get('PIN_SKIP_RENDER') != '1':
        asyncio.run(render(pins))
    missing = [p['id'] for p in pins if not (OUT / f"{p['id']}.jpg").exists()]
    if missing: fail('missing pin images: ' + ', '.join(missing))

    rows = [{'Title': p['title'], 'Media URL': f"https://tracelings.com/pins/{p['id']}.jpg", 'Pinterest board': p['board'],
             'Thumbnail': '', 'Description': p['desc'], 'Link': p['link'], 'Publish date': t.strftime('%Y-%m-%dT%H:%M:%S'), 'Keywords': ''}
            for p, t in zip(pins, times)]
    name = f'pinterest-bulk-{BATCH}.csv'
    with open(PINDIR / name, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
    # A new batch starts as not uploaded. A rewritten batch keeps its status: "not confirmed" (null)
    # stays that way, because an older CSV of it may already be on Pinterest.
    entry = {'batch': BATCH, 'csv': name, 'pins': [p['id'] for p in pins], 'uploaded': b.get('uploaded', False) if b else False}
    if b: b.update(entry)
    else: batches.append(entry)
    save_batches(batches)
    print(f'{len(pins)} pins, {name}: {times[0]:%Y-%m-%d %H:%M} to {times[-1]:%Y-%m-%d %H:%M} UTC')

main()
