import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops

folder = Path(__file__).resolve().parent
repo = folder.parents[3]
names = ['promo-banner-jbl', 'slider-iphone', 'featured-ps5', 'featured-women-collection', 'featured-speakers', 'featured-perfume-gucci']
results = []
for name in names:
    source = repo / 'assets/images' / (name + '.png')
    target = repo / 'assets/images/optimized' / (name + '-lossless.webp')
    original = Image.open(source).convert('RGBA')
    original.save(target, 'WEBP', lossless=True, exact=True, method=6)
    decoded = Image.open(target).convert('RGBA')
    # Compare each channel, including transparent pixels, not only an alpha bbox.
    extrema = ImageChops.difference(original, decoded).getextrema()
    identical = all(high == 0 for low, high in extrema)
    results.append({'source': source.relative_to(repo).as_posix(), 'target': target.relative_to(repo).as_posix(),
        'width': original.width, 'height': original.height, 'sourceBytes': source.stat().st_size,
        'webpBytes': target.stat().st_size, 'savingPercent': round((1-target.stat().st_size/source.stat().st_size)*100, 2),
        'rgbaPixelIdentical': identical, 'maxChannelDifference': max(high for low, high in extrema),
        'originalSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'format': 'WebP lossless, exact=True'})
    print(json.dumps(results[-1]))
    if not identical:
        raise RuntimeError('Decoded RGBA differs: ' + name)
(folder / 'quality' / 'images.json').parent.mkdir(parents=True, exist_ok=True)
(folder / 'quality' / 'images.json').write_text(json.dumps(results, indent=2) + '\n', encoding='utf-8')
