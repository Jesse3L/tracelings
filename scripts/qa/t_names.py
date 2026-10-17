# Downloads a PDF from every tool that takes a name, for a set of hard names, and records the note the tool shows.
# Usage: QA_BASE=http://127.0.0.1:4401 QA_OUT=/some/dir python3 scripts/qa/t_names.py names
# Then rasterize: for f in $QA_OUT/pdfs/names-*.pdf; do pdftoppm -r 50 -f 1 -l 1 -png "$f" "${f%.pdf}"; done
from dl import *

HARD = json.loads(os.environ['QA_NAMES']) if os.environ.get('QA_NAMES') else ['José', "D'Andre", 'Mary-Kate', 'McKenzie', 'Maximiliana Christabel', '小明']
TOOLS = [
    ('name-tracing', '/name-tracing/', '#tracer-name', 'Download'),
    ('cursive-name', '/cursive-name-tracing/', '#cursive-text', 'Download'),
    ('cursive', '/cursive/', '#cursive-text', 'Download'),
    ('name-coloring', '/name-coloring-pages/', '#coloring-text', 'Download'),
    ('bubble', '/bubble-letters/', '#coloring-text', 'Download'),
    ('week-pack', '/homeschool/preschool/', '#pack-name', 'Download week'),
    ('math', '/math-worksheets/pre-k/', '#math-name', 'Download this worksheet'),
    ('word-family', '/word-families/at/', '#wf-name', 'Download this worksheet'),
    ('k-sampler', '/math-worksheets/kindergarten/', '#sampler-name', 'Download the free sampler'),
    ('word-tracing', '/word-tracing/', '#word-text', 'Download'),
]

def note_text(p, sel):
    # The red note under the box (role=status inside the same label), if any.
    loc = p.locator(f'label:has({sel}) [role=status], label:has({sel}) .text-\\[\\#b4232c\\]')
    return ' | '.join(sorted(set(x.inner_text() for x in loc.all()))) if loc.count() else ''

def names(t):
    for tag, url, sel, btn in TOOLS:
        t.go(url); p = t.page
        p.wait_for_selector(sel, timeout=20000)
        if tag == 'week-pack':
            p.wait_for_function("() => !document.body.innerText.includes('Loading the coloring page letters')", timeout=20000)
        if tag in ('cursive-name', 'cursive', 'name-coloring', 'bubble'):
            p.wait_for_selector('figure .sheet-frame svg', timeout=20000)
        first = True
        for i, nm in enumerate(HARD):
            p.fill(sel, nm); p.wait_for_timeout(250)
            shown = p.input_value(sel)
            # Word tracing has nothing to trace when no character is traceable: Download is disabled (with a note).
            if p.locator('button[type=submit]').filter(has_text=btn).first.is_disabled():
                results.append({'tag': f'names-{tag}-{i}', 'disabled': True}); print('OK', f'names-{tag}-{i}', 'download disabled (nothing traceable)', flush=True)
            else:
                path = t.dl(f'names-{tag}-{i}', sub(p, btn), expect_gate=first); first = False
            sub_labels = ''
            if tag == 'name-tracing':
                sub_labels = ' / '.join(x.inner_text().replace('\n', ' ') for x in p.locator('fieldset:has(legend:text("Letter style")) label').all())
            results.append({'tag': f'names-{tag}-{i}-ui', 'typed': nm, 'kept': shown, 'note': note_text(p, sel), 'styles': sub_labels})
            print('  ', tag, repr(nm), 'kept', repr(shown), 'note:', note_text(p, sel)[:90], sub_labels, flush=True)

run([names])
