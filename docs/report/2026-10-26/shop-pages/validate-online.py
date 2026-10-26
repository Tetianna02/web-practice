from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from urllib.error import HTTPError
import json
import xml.etree.ElementTree as ET

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[3]
temp = Path(json.loads((OUT / 'final-checks.json').read_text(encoding='utf-8'))['validatorTemp'])


def nu(label, file):
    request = Request('https://validator.w3.org/nu/?out=json', data=file.read_bytes(), headers={'Content-Type': 'text/html; charset=utf-8', 'User-Agent': 'Coursework-HTML-validation/1.0'})
    try:
        with urlopen(request, timeout=45) as response:
            result = json.loads(response.read())
        messages = [{k: m[k] for k in ('type', 'subType', 'message', 'firstLine', 'lastLine') if k in m} for m in result.get('messages', [])]
        return label, {'service': 'W3C Nu', 'checked': True, 'errors': sum(m['type'] == 'error' for m in messages), 'messages': messages}
    except Exception as error:
        return label, {'service': 'W3C Nu', 'checked': False, 'reason': str(error)}


def jigsaw():
    data = urlencode({'text': (ROOT / 'assets/css/shop-pages.css').read_text(encoding='utf-8'), 'profile': 'css3', 'usermedium': 'all', 'warning': '1', 'output': 'soap12'}).encode()
    request = Request('https://jigsaw.w3.org/css-validator/validator', data=data, headers={'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8', 'User-Agent': 'Coursework-CSS-validation/1.0'})
    try:
        with urlopen(request, timeout=45) as response:
            result = ET.fromstring(response.read())
        errors, warnings = [], []
        for element in result.iter():
            kind = element.tag.split('}')[-1]
            if kind in ('error', 'warning'):
                record = {e.tag.split('}')[-1]: ''.join(e.itertext()).strip() for e in element}
                (errors if kind == 'error' else warnings).append(record)
        result = {'errors': errors, 'warnings': warnings}
        return 'shop-pages.css', {'service': 'W3C Jigsaw', 'checked': True, 'result': result}
    except Exception as error:
        return 'shop-pages.css', {'service': 'W3C Jigsaw', 'checked': False, 'reason': str(error)}


if __name__ == '__main__':
    report = {'date': '2026-10-26', 'results': {}}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = []
        for page in ('product', 'cart', 'checkout', 'account'):
            futures.append(pool.submit(nu, page + '-source', ROOT / (page + '.html')))
            futures.append(pool.submit(nu, page + '-dom', temp / (page + '-dom.html')))
        for page in ('checkout', 'account'):
            futures.append(pool.submit(nu, page + '-errors-dom', temp / (page + '-errors-dom.html')))
        futures.append(pool.submit(jigsaw))
        for future in as_completed(futures):
            key, value = future.result()
            report['results'][key] = value
            print(key + ': ' + ('checked, errors=' + str(value.get('errors', '?')) if value['checked'] else value['reason']), flush=True)
    (OUT / 'validators.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
