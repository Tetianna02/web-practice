"""Build only a selected new shop page; existing pages are read-only inputs."""
from pathlib import Path
import html
import re

ROOT = Path(__file__).resolve().parents[1]


def icon(name):
    return '<svg class="icon" aria-hidden="true"><use href="assets/images/icons/sprite.svg#icon-' + name + '"></use></svg>'


def write_page(name, title, description, content, script):
    if name not in {'product', 'cart', 'checkout', 'account'}:
        raise ValueError('Only new shop pages may be generated')
    source = (ROOT / 'index.html').read_text(encoding='utf-8')
    shell = source.split('<body>', 1)[1].split('  <main ', 1)[0]
    shell = shell.replace('class="skip-link" href="/web-practice/#main-content"', 'class="skip-link" href="#main-content"')
    shell = shell.replace('desktop-navigation home-navigation', 'desktop-navigation shop-navigation')
    shell = shell.replace('href="/web-practice/#top"', 'href="/web-practice/"').replace(' is-current', '').replace(' aria-current="page"', '')
    start = shell.index('        <button class="icon-button cart-button"')
    end = shell.index('        <button class="menu-toggle"', start)
    shell = shell[:start] + '''        <a class="icon-button cart-button shop-cart-link" href="/web-practice/cart.html" aria-label="Кошик">
          ''' + icon('cart') + '''<span class="shop-cart-badge" data-cart-badge hidden></span>
        </a>
        <button class="icon-button shop-profile-toggle" type="button" aria-label="Меню акаунта" aria-expanded="false" aria-controls="shop-account-menu">
          <img src="assets/images/icons/icon-user.svg" width="32" height="32" alt="">
        </button>
        <div class="shop-account-menu" id="shop-account-menu" hidden>
          <a href="/web-practice/account.html"><img src="assets/images/icons/icon-user.svg" width="24" height="24" alt="">Мій профіль</a>
          <a href="/web-practice/account.html#orders"><img src="assets/images/icons/icon-orders.svg" width="24" height="24" alt="">Мої замовлення</a>
          <button type="button" data-coming-soon><img src="assets/images/icons/icon-logout.svg" width="24" height="24" alt="">Вийти з акаунта</button>
        </div>
''' + shell[end:]
    announcement = re.search(r'      <p>Літній розпродаж:.*?</p>\s*<a[^>]+>Переглянути пропозиції</a>', shell, re.S).group()
    shell = shell.replace(announcement, '      <div class="shop-announcement-message">\n' + announcement + '\n      </div>')
    shell = shell.replace('      <li><a href="/web-practice/#explore-products">Товари</a></li>',
                          '      <li><a href="/web-practice/#explore-products">Товари</a></li>\n      <li><a href="/web-practice/cart.html">Кошик</a></li>\n      <li><a href="/web-practice/account.html">Мій акаунт</a></li>')
    footer = re.search(r'  <footer\b.*?</footer>', source, re.S).group()
    footer = footer.replace('<button type="button" data-coming-soon>Мій акаунт</button>', '<a href="/web-practice/account.html">Мій акаунт</a>')
    footer = footer.replace('<button type="button" data-coming-soon>Кошик</button>', '<a href="/web-practice/cart.html">Кошик</a>')
    document = '''<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>''' + html.escape(title) + '''</title>
  <meta name="description" content="''' + html.escape(description, quote=True) + '''">
  <link rel="icon" type="image/png" href="assets/images/favicon.png">
  <link rel="stylesheet" href="assets/css/_variables.css">
  <link rel="stylesheet" href="assets/css/style.css">
  <link rel="stylesheet" href="assets/css/shop-pages.css">
  <script src="assets/js/site.js" defer></script>
  <script src="assets/js/shop.js" defer></script>
  <script src="assets/js/''' + script + '''" defer></script>
</head>
<body class="shop-page ''' + name + '''-page">
''' + shell + '''  <main id="main-content" class="shop-main">
''' + content + '''
  </main>
''' + footer + '''
  <div class="toast-region" aria-live="polite" aria-atomic="true"></div>
</body>
</html>
'''
    (ROOT / (name + '.html')).write_text(document, encoding='utf-8', newline='\r\n')
