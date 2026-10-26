from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from urllib.error import HTTPError
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import xml.etree.ElementTree as ET

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[3]
TEMP = Path(json.loads((OUT / 'CHECKS.json').read_text(encoding='utf-8'))['validatorTemp'])


def html_check(label, file):
    try:
        request = Request('https://validator.w3.org/nu/?out=json', data=file.read_bytes(), headers={'Content-Type': 'text/html; charset=utf-8', 'User-Agent': 'Coursework-HTML-validation/1.0'})
        with urlopen(request, timeout=40) as response:
            result = json.loads(response.read())
        messages = [{k: m[k] for k in ('type', 'subType', 'message', 'firstLine', 'lastLine') if k in m} for m in result.get('messages', [])]
        return label, {'service': 'W3C Nu', 'checked': True, 'errors': sum(m['type'] == 'error' for m in messages), 'messages': messages}
    except Exception as error:
        return label, {'service': 'W3C Nu', 'checked': False, 'reason': str(error)}


def css_check():
    query = urlencode({'text': (ROOT / 'assets/css/product-question.css').read_text(encoding='utf-8'), 'profile': 'css3svg', 'usermedium': 'all', 'warning': '1', 'output': 'soap12'})
    try:
        request = Request('https://jigsaw.w3.org/css-validator/validator?' + query, headers={'User-Agent': 'Coursework-CSS-validation/1.0'})
        with urlopen(request, timeout=40) as response:
            xml = ET.fromstring(response.read())
        errors, warnings = [], []
        for item in xml.iter():
            kind = item.tag.split('}')[-1]
            if kind in ('error', 'warning'):
                (errors if kind == 'error' else warnings).append({e.tag.split('}')[-1]: ''.join(e.itertext()).strip() for e in item})
        assert any(e.tag.split('}')[-1] == 'validity' for e in xml.iter()), 'Missing validator result'
        return 'product-question.css', {'service': 'W3C Jigsaw', 'checked': True, 'errors': errors, 'warnings': warnings}
    except Exception as error:
        return 'product-question.css', {'service': 'W3C Jigsaw', 'checked': False, 'reason': str(error)}


report = {'date': '2026-10-26', 'results': {}}
with ThreadPoolExecutor(max_workers=4) as pool:
    futures = []
    for name in ('index', 'product', 'login', 'signup', '404', 'cart', 'checkout', 'account'):
        futures.append(pool.submit(html_check, name + '-source', ROOT / (name + '.html')))
        futures.append(pool.submit(html_check, name + '-dom', TEMP / (name + '-dom.html')))
    futures.append(pool.submit(html_check, 'product-errors-dom', TEMP / 'product-errors-dom.html'))
    futures.append(pool.submit(css_check))
    for future in as_completed(futures):
        key, result = future.result()
        report['results'][key] = result
        print(key + ': ' + ('errors=' + str(result['errors']) if result['checked'] else result['reason']), flush=True)
(OUT / 'VALIDATORS.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
