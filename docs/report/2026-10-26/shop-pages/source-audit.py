from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
from PIL import Image
import hashlib
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.links = []
        self.ids = set()
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.add(attrs['id'])
        for key in ('src', 'href'):
            if attrs.get(key):
                self.links.append(attrs[key])


def resolve_case(url, current):
    parts = urlsplit(url)
    if parts.scheme or parts.netloc:
        return None
    value = unquote(parts.path)
    if value.startswith('/web-practice/'):
        target = ROOT / value[len('/web-practice/'):]
    elif value.startswith('/'):
        raise AssertionError('Wrong project base: ' + url)
    elif not value:
        target = current
    else:
        target = current.parent / value
    if target.is_dir():
        target /= 'index.html'
    assert target.exists(), str(target)
    for parent in [target, *target.parents]:
        if parent == ROOT:
            break
        assert parent.name in [p.name for p in parent.parent.iterdir()], 'Case mismatch: ' + str(parent)
    if parts.fragment:
        if target.suffix == '.html':
            assert parts.fragment in Page(target.read_text(encoding='utf-8')).ids, url
        elif target.suffix == '.svg':
            ids = {e.get('id') for e in ET.parse(target).iter()}
            assert parts.fragment in ids, url
    return target


baseline = json.loads((OUT / 'protected-files.json').read_text(encoding='utf-8'))
changed = [f for f, h in baseline.items() if not (ROOT / f).is_file() or hashlib.sha256((ROOT / f).read_bytes()).hexdigest() != h]
assert not changed, changed
pages = {}
for name in ('product', 'cart', 'checkout', 'account'):
    file = ROOT / (name + '.html')
    page = Page(file.read_text(encoding='utf-8'))
    paths = {str(p.relative_to(ROOT)) for link in page.links if (p := resolve_case(link, file))}
    pages[name] = {'localPaths': len(paths), 'caseSensitivePaths': True, 'anchorsAndSpriteIds': True}
css = ROOT / 'assets/css/shop-pages.css'
selectors = [line.strip().split('{')[0] for line in css.read_text(encoding='utf-8').splitlines() if '{' in line and not line.strip().startswith('@')]
assert all(s.startswith('.shop-page') for s in selectors), selectors
images = []
for source in sorted((ROOT / 'assets/images').glob('gamepad-*.png')):
    dest = ROOT / 'assets/images/optimized' / (source.stem + '.webp')
    a, b = Image.open(source).convert('RGBA'), Image.open(dest).convert('RGBA')
    equal = a.size == b.size and a.tobytes() == b.tobytes()
    assert equal, source.name
    images.append({'source': source.name, 'losslessRGBAEqual': equal, 'beforeBytes': source.stat().st_size, 'afterBytes': dest.stat().st_size})
report = {'date': '2026-10-26', 'protectedTrackedFiles': len(baseline), 'protectedChanges': changed, 'pages': pages, 'newCSSScoped': True, 'losslessImages': images, 'passed': True}
(OUT / 'source-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'protectedUnchanged': len(baseline), 'pages': len(pages), 'passed': True}))
