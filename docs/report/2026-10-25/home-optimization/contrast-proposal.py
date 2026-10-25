import json
import html
from pathlib import Path

folder = Path(__file__).resolve().parent
def luminance(color):
    values = [int(color[i:i+2], 16)/255 for i in (1, 3, 5)]
    values = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in values]
    return sum(v*w for v, w in zip(values, (.2126, .7152, .0722)))
def ratio(fg, bg):
    a, b = sorted([luminance(fg), luminance(bg)], reverse=True)
    return round((a+.05)/(b+.05), 2)

groups = [
    ('Підписи секцій', '«Сьогодні», «Категорії», «Цього місяця», «Наш асортимент», «Рекомендоване»; той самий червоний підпис модалки', 'Сьогодні · Наш асортимент', '#db4444', '#ffffff', '#d13e3e', '#ffffff'),
    ('Поточні ціни — усі 18 карток', '.product-price-current у розпродажі, популярних товарах і каталозі', '1 199 ₴ · 21 999 ₴', '#db4444', '#ffffff', '#d13e3e', '#ffffff'),
    ('Бейджі знижок — 6 карток', '−40%, −35%, −30%, −25% (двічі), −12%', '−40%', '#ffffff', '#db4444', '#ffffff', '#d13e3e'),
    ('Червоні кнопки', '«Усі товари» у двох секціях, «Переглянути», кнопка відправлення у модалці', 'Усі товари · Переглянути', '#ffffff', '#db4444', '#ffffff', '#d13e3e'),
    ('Hover червоних кнопок — додаткова перевірка', 'Наведення мишею: нинішній світлий --color-red-hover робить білий текст ще менш контрастним', 'Переглянути — наведення', '#ffffff', '#e07575', '#ffffff', '#b52f2f'),
    ('Зелені кнопка JBL та бейджі «Новинка»', 'На широкому desktop текст білий. Пропонується лише чорний текст; яскраво-зелений фон залишається', 'Купити · Новинка', '#ffffff', '#00ff66', '#000000', '#00ff66'),
    ('Копірайт у футері', '«© Exclusive. Усі права захищені.»; змінюється тільки сірий текст', '© Exclusive. Усі права захищені.', '#333333', '#000000', '#808080', '#000000'),
]
rows=[]
records=[]
for title, scope, text, oldfg, oldbg, newfg, newbg in groups:
    before, after = ratio(oldfg, oldbg), ratio(newfg, newbg)
    records.append({'element': title, 'scope': scope, 'before': {'foreground': oldfg, 'background': oldbg, 'ratio': before}, 'proposedAfter': {'foreground': newfg, 'background': newbg, 'ratio': after}, 'applied': False})
    rows.append(f'<article><h2>{html.escape(title)}</h2><p>{html.escape(scope)}</p><div class="pair"><div><strong>ДО · {before}:1</strong><div class="sample" style="color:{oldfg};background:{oldbg}">{html.escape(text)}</div><code>{oldfg} / {oldbg}</code></div><div><strong>ПРОПОЗИЦІЯ · {after}:1</strong><div class="sample" style="color:{newfg};background:{newbg}">{html.escape(text)}</div><code>{newfg} / {newbg}</code></div></div></article>')
source=[]
for mode in ['mobile', 'desktop']:
    report=json.loads((folder/'lighthouse'/f'before-{mode}.report.json').read_text())
    source.extend({'mode': mode, **item['node']} for item in report['audits']['color-contrast']['details']['items'])
(folder/'contrast-proposal.json').write_text(json.dumps({'applied':False,'groups':records,'rawLighthouseFindings':source}, ensure_ascii=False, indent=2), encoding='utf-8')
document='''<!DOCTYPE html><html lang="uk"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Пропозиція контрасту — не застосовано</title><style>
@font-face{font-family:Inter;src:url('../../../../assets/fonts/inter-cyrillic.woff2')}*{box-sizing:border-box}body{margin:0;padding:24px;background:#eef0f3;color:#171717;font-family:Inter,Arial,sans-serif}h1{font-size:25px;margin:0 0 8px}header p{margin:0 0 18px}article{background:white;padding:16px 20px;margin:12px 0;border:1px solid #d8dbe0;border-radius:8px}h2{font-size:17px;margin:0 0 5px}p{font-size:13px;margin:0 0 10px;line-height:1.5}.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px}strong{display:block;font-size:12px;margin-bottom:5px}.sample{padding:10px 14px;font-size:14px;font-weight:500;min-height:40px;border:1px solid #ddd}code{font:12px monospace}</style><header><h1>Контраст: пропозиція до підтвердження</h1><p>На Home ці зміни НЕ застосовані. «Після» тут — лише зразок. Шрифти, розміри та геометрію не пропонуємо змінювати.</p></header>'''+''.join(rows)+'</html>'
(folder/'contrast-proposal.html').write_text(document, encoding='utf-8')
for r in records: print(r['element'], r['before']['ratio'], '->', r['proposedAfter']['ratio'])
