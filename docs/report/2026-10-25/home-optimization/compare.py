import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFont

folder = Path(__file__).resolve().parent
repo = folder.parents[3]
results = []
for width in [1440, 360, 768, 1024]:
    before = json.loads((folder / 'before' / f'geometry-{width}.json').read_text(encoding='utf-8'))
    after = json.loads((folder / 'after' / f'geometry-{width}.json').read_text(encoding='utf-8'))
    differences = []
    for b, a in zip(before['elements'], after['elements']):
        changes = {k: round(a[k] - b[k], 5) for k in ['x', 'y', 'width', 'height'] if abs(a[k] - b[k]) > 0.01}
        if changes:
            differences.append({'tag': b['tag'], 'id': b['id'], 'class': b['class'], 'text': b['text'], 'delta': changes})
    styles = [{'tag': b['tag'], 'class': b['class']} for b, a in zip(before['elements'], after['elements']) if any(a[k] != b[k] for k in ['color', 'background', 'font'])]
    original = Image.open(folder / 'before' / f'home-{width}.png').convert('RGB')
    updated = Image.open(folder / 'after' / f'home-{width}.png').convert('RGB')
    pixel_summary = {'sameSize': original.size == updated.size}
    if original.size == updated.size:
        diff = ImageChops.difference(original, updated)
        pixels = diff.get_flattened_data() if hasattr(diff, 'get_flattened_data') else diff.getdata()
        changed = sum(1 for p in pixels if p != (0, 0, 0))
        pixel_summary.update({'changedPixels': changed, 'totalPixels': original.width * original.height, 'changedPercent': round(changed / (original.width * original.height) * 100, 6), 'bbox': diff.getbbox(), 'maxChannelDifference': max(v[1] for v in diff.getextrema())})
        if width == 1440:
            diff.point(lambda v: min(255, v * 8)).save(folder / 'quality' / 'desktop-pixel-diff-x8.png')
    results.append({'width': width, 'beforeCount': len(before['elements']), 'afterCount': len(after['elements']), 'documentBefore': before['document'], 'documentAfter': after['document'], 'geometryChanges': differences, 'colorOrFontChanges': styles, 'screenshot': pixel_summary})
(folder / 'geometry-comparison.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(results, ensure_ascii=False, indent=2))

font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 18)
small = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 14)
images = json.loads((folder / 'quality' / 'images.json').read_text())
sheet = Image.new('RGB', (1040, len(images) * 330), '#ededed')
draw = ImageDraw.Draw(sheet)
for i, entry in enumerate(images):
    for column, key, label in [(0, 'source', 'PNG BEFORE'), (1, 'target', 'WebP AFTER (lossless)')]:
        x, y = column * 520, i * 330
        draw.text((x + 12, y + 6), label, font=font, fill='black')
        draw.text((x + 12, y + 30), f"{Path(entry[key]).name} | {entry['sourceBytes' if column == 0 else 'webpBytes']:,} bytes", font=small, fill='black')
        area = Image.new('RGBA', (496, 270), '#000000' if 'jbl' in entry['source'] or 'ps5' in entry['source'] else '#f5f5f5')
        product = Image.open(repo / entry[key]).convert('RGBA')
        product.thumbnail((480, 254), Image.Resampling.LANCZOS)
        area.alpha_composite(product, ((496 - product.width)//2, (270 - product.height)//2))
        sheet.paste(area.convert('RGB'), (x + 12, y + 54))
sheet.save(folder / 'quality' / 'png-webp-before-after.png')
