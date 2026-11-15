const express = require('express');
const db = require('./db');
const v = require('./validation');
const { requireAuth, requireAdmin } = require('./auth');

const router = express.Router();
const admin = [requireAuth, requireAdmin];
const sections = ['flash', 'best', 'catalog', 'details'];
const icons = ['phone', 'computer', 'smartwatch', 'camera', 'headphones', 'gaming'];

function product(row) {
  return {
    id: row.id, name: row.name, category: row.category_id, categoryName: row.category_name,
    description: row.description, price: row.price_cents / 100,
    oldPrice: row.old_price_cents === null ? null : row.old_price_cents / 100,
    discount: row.old_price_cents ? Math.round((1 - row.price_cents / row.old_price_cents) * 100) : 0,
    stock: row.stock, image: row.image, alt: row.image_alt, gallery: row.gallery,
    colors: row.colors, sizes: row.sizes, rating: Number(row.rating), reviews: row.reviews,
    section: row.section, isNew: row.is_new, isActive: row.is_active, sortOrder: row.sort_order,
  };
}

const productSelect = 'SELECT p.*, c.name AS category_name FROM shop.products p JOIN shop.categories c ON c.id = p.category_id';

async function listProducts(req, res, includeInactive = false) {
  const pagination = v.pagination(req.query);
  const clauses = includeInactive ? [] : ['p.is_active'];
  const values = [];
  function filter(expression, value) {
    values.push(value);
    clauses.push(expression.replace('?', `$${values.length}`));
  }
  if (req.query.q !== undefined) {
    const search = v.text(req.query.q, 'q', 0, 120).replace(/[\\%_]/g, '\\$&');
    filter('p.name ILIKE ?', `%${search}%`);
  }
  if (req.query.category !== undefined) filter('p.category_id = ?', v.slug(req.query.category, 'category'));
  if (req.query.section !== undefined) filter('p.section = ?', v.choice(req.query.section, 'section', sections));
  const sorts = {
    default: 'p.sort_order ASC, p.id ASC', price_asc: 'p.price_cents ASC, p.id ASC',
    price_desc: 'p.price_cents DESC, p.id ASC', name: 'p.name ASC, p.id ASC',
    newest: 'p.created_at DESC, p.id ASC', rating: 'p.rating DESC, p.id ASC',
  };
  const sort = req.query.sort === undefined ? 'default' : v.choice(req.query.sort, 'sort', Object.keys(sorts));
  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  const count = await db.query(`SELECT count(*) FROM shop.products p${where}`, values);
  const { rows } = await db.query(`${productSelect}${where} ORDER BY ${sorts[sort]}
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, pagination.limit, pagination.offset]);
  res.json(v.pageResult(rows.map(product), count.rows[0].count, pagination));
}

router.get('/products', (req, res) => listProducts(req, res));
router.get('/admin/products', ...admin, (req, res) => listProducts(req, res, true));

async function getProduct(id, includeInactive = false) {
  const { rows } = await db.query(`${productSelect} WHERE p.id = $1${includeInactive ? '' : ' AND p.is_active'}`, [v.slug(id)]);
  if (!rows.length) throw new v.HttpError(404, 'Товар не знайдено.');
  return rows[0];
}

router.get('/products/:id', async (req, res) => res.json({ data: product(await getProduct(req.params.id)) }));
router.get('/admin/products/:id', ...admin, async (req, res) => res.json({ data: product(await getProduct(req.params.id, true)) }));

function productChanges(input, partial = false) {
  const rules = {
    ...(partial ? {} : { id: ['id', (value) => v.slug(value)] }),
    name: ['name', (value) => v.text(value, 'name', 2, 200)],
    category: ['category_id', (value) => v.slug(value, 'category')],
    description: ['description', (value) => v.text(value, 'description', 0, 5000)],
    price: ['price_cents', (value) => v.money(value, 'price')],
    oldPrice: ['old_price_cents', (value) => v.money(value, 'oldPrice', true)],
    stock: ['stock', (value) => v.integer(value, 'stock', 0, 1000000)],
    image: ['image', (value) => v.image(value)],
    alt: ['image_alt', (value) => v.text(value, 'alt', 1, 300)],
    gallery: ['gallery', (value) => v.array(value, 'gallery', 10, v.image)],
    colors: ['colors', (value) => v.array(value, 'colors', 10, (color, field) => {
      if (typeof color !== 'string' || !/^#[a-f\d]{6}$/i.test(color)) v.fail(field, 'Очікується колір #RRGGBB.');
      return color;
    })],
    sizes: ['sizes', (value) => v.array(value, 'sizes', 20, (size, field) => v.text(size, field, 1, 20))],
    rating: ['rating', (value) => {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 5 || !Number.isInteger(value * 10)) {
        v.fail('rating', 'Оцінка від 0 до 5, максимум один знак після коми.');
      }
      return value;
    }],
    reviews: ['reviews', (value) => v.integer(value, 'reviews', 0, 1000000)],
    section: ['section', (value) => v.choice(value, 'section', sections)],
    isNew: ['is_new', (value) => v.boolean(value, 'isNew')],
    isActive: ['is_active', (value) => v.boolean(value, 'isActive')],
    sortOrder: ['sort_order', (value) => v.integer(value, 'sortOrder', 0, 1000000)],
  };
  v.body(input, Object.keys(rules));
  if (!partial) {
    for (const key of ['id', 'name', 'category', 'price', 'stock', 'image', 'alt']) {
      if (input[key] === undefined) v.fail(key, 'Обов’язкове поле.');
    }
  }
  const changes = {};
  for (const [key, value] of Object.entries(input)) changes[rules[key][0]] = rules[key][1](value);
  if (!Object.keys(changes).length) throw new v.HttpError(400, 'Немає змін для збереження.');
  return changes;
}

async function insert(table, changes) {
  const entries = Object.entries(changes);
  const { rows } = await db.query(`INSERT INTO shop.${table}(${entries.map(([key]) => key).join(',')})
    VALUES(${entries.map((_, index) => `$${index + 1}`).join(',')}) RETURNING id`, entries.map(([, value]) => value));
  return rows[0].id;
}

async function update(table, id, changes) {
  const entries = Object.entries(changes);
  const { rowCount } = await db.query(`UPDATE shop.${table} SET
    ${entries.map(([key], index) => `${key} = $${index + 1}`).join(',')}, updated_at = now()
    WHERE id = $${entries.length + 1}`, [...entries.map(([, value]) => value), id]);
  if (!rowCount) throw new v.HttpError(404, 'Запис не знайдено.');
}

router.post('/admin/products', ...admin, async (req, res) => {
  const id = await insert('products', productChanges(req.body));
  res.status(201).json({ data: product(await getProduct(id, true)) });
});

router.patch('/admin/products/:id', ...admin, async (req, res) => {
  const id = v.slug(req.params.id);
  await update('products', id, productChanges(req.body, true));
  res.json({ data: product(await getProduct(id, true)) });
});

router.delete('/admin/products/:id', ...admin, async (req, res) => {
  const { rowCount } = await db.query('DELETE FROM shop.products WHERE id = $1', [v.slug(req.params.id)]);
  if (!rowCount) throw new v.HttpError(404, 'Товар не знайдено.');
  res.status(204).end();
});

router.get('/categories', async (req, res) => {
  const { rows } = await db.query(`SELECT c.id, c.name, c.description, c.icon, c.sort_order AS "sortOrder",
    count(p.id)::int AS "productCount" FROM shop.categories c
    LEFT JOIN shop.products p ON p.category_id = c.id AND p.is_active
    GROUP BY c.id ORDER BY c.sort_order, c.id`);
  res.json({ data: rows });
});

async function getCategory(id) {
  const { rows } = await db.query(`SELECT id, name, description, icon, sort_order AS "sortOrder"
    FROM shop.categories WHERE id = $1`, [v.slug(id)]);
  if (!rows.length) throw new v.HttpError(404, 'Категорію не знайдено.');
  return rows[0];
}

router.get('/categories/:id', async (req, res) => res.json({ data: await getCategory(req.params.id) }));

function categoryChanges(input, partial = false) {
  v.body(input, partial ? ['name', 'description', 'icon', 'sortOrder'] : ['id', 'name', 'description', 'icon', 'sortOrder']);
  const changes = {};
  if (!partial || input.name !== undefined) changes.name = v.text(input.name, 'name', 2, 120);
  if (!partial) changes.id = v.slug(input.id);
  if (input.description !== undefined) changes.description = v.text(input.description, 'description', 0, 1000);
  if (input.icon !== undefined) changes.icon = v.choice(input.icon, 'icon', icons);
  if (input.sortOrder !== undefined) changes.sort_order = v.integer(input.sortOrder, 'sortOrder', 0, 1000000);
  if (!Object.keys(changes).length) throw new v.HttpError(400, 'Немає змін для збереження.');
  return changes;
}

router.post('/admin/categories', ...admin, async (req, res) => {
  const id = await insert('categories', categoryChanges(req.body));
  res.status(201).json({ data: await getCategory(id) });
});

router.patch('/admin/categories/:id', ...admin, async (req, res) => {
  const id = v.slug(req.params.id);
  await update('categories', id, categoryChanges(req.body, true));
  res.json({ data: await getCategory(id) });
});

router.delete('/admin/categories/:id', ...admin, async (req, res) => {
  const { rowCount } = await db.query('DELETE FROM shop.categories WHERE id = $1', [v.slug(req.params.id)]);
  if (!rowCount) throw new v.HttpError(404, 'Категорію не знайдено.');
  res.status(204).end();
});

module.exports = { router, product, productChanges, categoryChanges };
