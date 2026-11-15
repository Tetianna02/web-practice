const db = require('../db');
const { categories, products } = require('../data/catalog');

async function seed() {
  await db.transaction(async (client) => {
    for (const [index, category] of categories.entries()) {
      await client.query(`INSERT INTO shop.categories(id, name, icon, sort_order)
        VALUES($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [category.id, category.name, category.icon, index]);
    }
    for (const product of products) {
      await client.query(`INSERT INTO shop.products(
        id, category_id, name, description, price_cents, old_price_cents, stock,
        image, image_alt, gallery, colors, sizes, rating, reviews, section, is_new, sort_order
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        ON CONFLICT DO NOTHING`, [
        product.id, product.category, product.name, product.description || '',
        Math.round(product.price * 100), product.oldPrice ? Math.round(product.oldPrice * 100) : null,
        product.stock, product.image, product.alt, product.gallery || [], product.colors || [],
        product.sizes || [], product.rating || 0, product.reviews || 0,
        product.section, product.isNew || false, product.sortOrder,
      ]);
    }
  });
  console.log('Початкові категорії та товари додано; наявні записи не перезаписано.');
}

if (require.main === module) {
  seed().catch((error) => {
    console.error(`Початкові дані не додано (${error.code || 'CONFIG_OR_CONNECTION'}). Спершу виконайте db:migrate.`);
    process.exitCode = 1;
  }).finally(db.close);
}

module.exports = seed;
