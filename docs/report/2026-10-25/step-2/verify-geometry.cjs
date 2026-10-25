const fs = require('node:fs');
const path = require('node:path');
const actual = JSON.parse(fs.readFileSync(path.join(__dirname, 'after-metrics.json'), 'utf8'));
const expected = [];
function expect(name, selector, index, rectangle) {
  expected.push({ name, selector, index, rectangle });
}
expect('Верхня смуга', '.announcement-bar', 0, [0, 0, 1440, 48]);
expect('Поле пошуку', '.desktop-search', 0, [958, 88, 243, 38]);
expect('Меню категорій', '.category-sidebar', 0, [135, 182, 217, 344]);
expect('Банер Home', '.hero-banner', 0, [413, 182, 892, 344]);
expect('Маркер розпродажу', '.flash-section .section-marker', 0, [135, 666, 20, 40]);
for (let i = 0; i < 4; i++) {
  expect('Картка розпродажу ' + (i + 1), '#flash-products .product-card', i, [135 + i * 300, 809, 270, 350]);
}
expect('Медіа картки', '#flash-products .product-media', 0, [135, 809, 270, 250]);
expect('Кнопка розпродажу', '.flash-section .section-action-row .primary-button', 0, [603, 1219, 234, 56]);
expect('Маркер категорій', '.category-section .section-marker', 0, [135, 1415, 20, 40]);
expect('Сітка категорій', '.category-grid', 0, [135, 1583, 1170, 145]);
for (let i = 0; i < 6; i++) {
  expect('Плитка категорії ' + (i + 1), '.category-card', i, [135 + i * 200, 1583, 170, 145]);
  expect('Іконка категорії ' + (i + 1), '.category-card .icon', i, [192 + i * 200, 1608, 56, 56]);
}
expect('Маркер популярних', '.best-selling-section .section-marker', 0, [135, 1868, 20, 40]);
expect('Сітка популярних', '.best-selling-section .product-grid', 0, [135, 2036, 1170, 350]);
expect('JBL-банер', '.promo-banner', 0, [135, 2526, 1170, 500]);
expect('Заголовок JBL', '.promo-title', 0, [191, 2647, 443, 120]);
expect('Область фото JBL', '.promo-image-wrap', 0, [661, 2563, 600, 420]);
expect('Маркер каталогу', '.explore-section .section-marker', 0, [135, 3097, 20, 40]);
expect('Сітка каталогу', '#explore-grid', 0, [135, 3265, 1170, 732]);
for (let i = 0; i < 8; i++) {
  expect('Товар каталогу ' + (i + 1), '#explore-grid .product-card', i,
    [135 + (i % 4) * 300, i < 4 ? 3265 : 3647, 270, i < 4 ? 322 : 350]);
}
expect('Кнопка каталогу', '.explore-section .section-action-row .primary-button', 0, [603, 4057, 234, 56]);
expect('Маркер новинок', '.new-arrival-section .section-marker', 0, [135, 4253, 20, 40]);
expect('Сітка новинок', '.arrival-grid', 0, [135, 4421, 1170, 600]);
expect('Велика плитка новинок', '.arrival-card-large', 0, [135, 4421, 570, 600]);
expect('Широка плитка новинок', '.arrival-card-wide', 0, [735, 4421, 570, 284]);
expect('Мала плитка новинок 1', '.arrival-card-small', 0, [735, 4737, 270, 284]);
expect('Мала плитка новинок 2', '.arrival-card-small', 1, [1035, 4737, 270, 284]);
expect('Переваги', '.services-grid', 0, [249, 5161, 943, 161]);
expect('Футер', '.site-footer', 0, [0, 5462, 1440, 440]);
for (const [index, x] of [135, 439, 701, 911, 1107].entries()) {
  expect('Початок колонки футера ' + (index + 1), '.footer-column', index,
    [x, 5542, [217, 175, 123, 109, 198][index], null]);
}
const results = expected.map(item => {
  const box = actual.boxes[item.selector]?.[item.index];
  const values = box ? [box.x, box.y, box.width, box.height] : [];
  const deviations = item.rectangle.map((v, i) => v === null ? 0 : Math.abs(v - values[i]));
  return { ...item, actual: values, deviations, matchesWithin2px: !!box && deviations.every(v => v <= 2) };
});
const report = { date: '2026-10-25', viewport: 1440, tolerance: 2,
  source: 'design/png/home-desktop.png/E-Commerce HomePage.png + design/specs.md metadata',
  scope: 'Лише перелічені прямокутники. Не підтверджує точність текстів, ваг шрифтів, усіх фото або всіх пікселів PNG.',
  count: results.length, passed: results.filter(r => r.matchesWithin2px).length,
  maxDeviation: Math.max(...results.flatMap(r => r.deviations)),
  pageHeightMatches: actual.height === 5902, horizontalOverflow: actual.horizontalOverflow, results };
fs.writeFileSync(path.join(__dirname, 'geometry-checks.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ count: report.count, passed: report.passed, maxDeviation: report.maxDeviation,
  height: actual.height, failed: results.filter(r => !r.matchesWithin2px) }, null, 2));
if (report.count !== report.passed || !report.pageHeightMatches || report.horizontalOverflow) process.exitCode = 1;
