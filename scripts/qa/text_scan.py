# Scans the visible text of every built page for typos the eye misses: ",,", "..", doubled spaces, a space before
# punctuation, en/em dashes, a sentence that ends in ": ." and FAQ schema answers that differ from the visible answer.
# Usage: python3 scripts/qa/text_scan.py dist/client
import sys, re, json, glob, os, html as H
from bs4 import BeautifulSoup, NavigableString, Comment

root = sys.argv[1] if len(sys.argv) > 1 else 'dist/client'
BLOCK = {'p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'header', 'footer', 'nav', 'main', 'td', 'th', 'tr',
         'table', 'ul', 'ol', 'details', 'summary', 'label', 'button', 'br', 'figure', 'figcaption', 'dt', 'dd', 'option', 'select', 'form',
         'aside', 'blockquote', 'hr', 'img', 'input', 'textarea', 'fieldset', 'legend'}
PATTERNS = [(r',,', 'double comma'), (r'(?<![.\w])\.\.(?!\.)|\w\.\.(?=\s|$)', 'double period'), (r'\S  +\S', 'double space'),
            (r'\w\s+[,.;:!?](?!\d)', 'space before punctuation'), (r'[–—]', 'en/em dash'), (r':\s*\.', 'empty list'),
            (r'\b(\w{3,}) \1\b', 'repeated word')]
norm = lambda t: re.sub(r'\s+', ' ', t.replace('⁠', '')).strip()
found = []
for f in sorted(glob.glob(os.path.join(root, '**/index.html'), recursive=True)):
    url = '/' + os.path.relpath(os.path.dirname(f), root).replace('.', '').strip('/') + '/'
    url = url.replace('//', '/')
    s = BeautifulSoup(open(f, encoding='utf-8').read(), 'lxml')
    schemas = [json.loads(x.string) for x in s.find_all('script', type='application/ld+json') if x.string]
    for x in s(['script', 'style', 'noscript', 'template', 'svg', 'head']): x.decompose()
    out = []
    def walk(n):
        for c in n.children:
            if isinstance(c, Comment): continue
            if isinstance(c, NavigableString): out.append(str(c))
            else:
                b = c.name in BLOCK
                if b: out.append('\n')
                walk(c)
                if b: out.append('\n')
    walk(s.body)
    text = ''.join(out)
    for line in text.split('\n'):
        l = re.sub(r'[ \t\r\f\v]+', lambda m: m.group(0) if m.group(0) == '  ' else ' ', line.replace('⁠', '')).strip()
        l1 = re.sub(r'[ \t]+', ' ', l)
        for pat, name in PATTERNS:
            src = l if name == 'double space' else l1
            for m in re.finditer(pat, src):
                found.append((name, url, src[max(0, m.start() - 50):m.end() + 50]))
    # FAQ answers in the schema must appear word for word in the visible text.
    vis = norm(text)
    flat = []
    for sc in schemas:
        flat += sc if isinstance(sc, list) else [sc]
    for sc in flat:
        if sc.get('@type') != 'FAQPage': continue
        for q in sc['mainEntity']:
            a = norm(H.unescape(q['acceptedAnswer']['text']))
            if a not in vis: found.append(('faq answer not visible', url, a[:90]))
            if norm(q['name']) not in vis: found.append(('faq question not visible', url, q['name'][:90]))
for f in found: print(' | '.join(f))
print(len(found), 'findings')
