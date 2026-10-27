const { createHash } = require('node:crypto');
const express = require('express');
const db = require('./db');
const v = require('./validation');
const { requireAuth, requireAdmin } = require('./auth');

const router = express.Router();
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

function order(row) {
  return {
    id: row.id, status: row.status, createdAt: row.created_at,
    customer: {
      name: row.customer_name, email: row.email, phone: row.phone, city: row.city,
      street: row.street, apartment: row.apartment, company: row.company,
    },
    paymentMethod: row.payment_method, paymentStatus: row.payment_status,
    subtotal: Number(row.subtotal_cents) / 100, shipping: row.shipping_cents / 100,
    total: Number(row.total_cents) / 100, currency: 'UAH',
  };
}

async function details(client, row) {
  const { rows } = await client.query('SELECT * FROM shop.order_items WHERE order_id = $1 ORDER BY id', [row.id]);
  return {
    ...order(row),
    items: rows.map((item) => ({
      productId: item.product_id, name: item.product_name, image: item.image,
      quantity: item.quantity, price: item.unit_price_cents / 100, total: Number(item.line_total_cents) / 100,
    })),
  };
}

function orderInput(body) {
  const input = v.body(body, ['requestId', 'items', 'customer', 'paymentMethod']);
  const requestId = v.uuid(input.requestId, 'requestId');
  const customer = v.body(input.customer, ['name', 'email', 'phone', 'city', 'street', 'apartment', 'company']);
  const phone = v.text(customer.phone, 'phone', 7, 20);
  if (!/^\+?[\d\s()-]+$/.test(phone) || phone.replace(/\D/g, '').length < 7) {
    v.fail('phone', 'Введіть коректний номер телефону, щонайменше 7 цифр.');
  }
  const normalized = {
    requestId,
    customer: {
      name: v.text(customer.name, 'name', 2, 160), email: v.email(customer.email), phone,
      city: v.text(customer.city, 'city', 2, 120), street: v.text(customer.street, 'street', 3, 300),
      apartment: v.text(customer.apartment ?? '', 'apartment', 0, 120),
      company: v.text(customer.company ?? '', 'company', 0, 160),
    },
    paymentMethod: v.choice(input.paymentMethod, 'paymentMethod', ['cash', 'bank']),
    items: v.array(input.items, 'items', 100, (item) => {
      v.body(item, ['productId', 'quantity']);
      return { productId: v.slug(item.productId, 'productId'), quantity: v.integer(item.quantity, 'quantity', 1, 99) };
    }).sort((a, b) => a.productId.localeCompare(b.productId)),
  };
  if (!normalized.items.length) v.fail('items', 'Кошик порожній.');
  if (new Set(normalized.items.map((item) => item.productId)).size !== normalized.items.length) {
    v.fail('items', 'Товар не повинен повторюватися; змініть його кількість.');
  }
  return normalized;
}

router.post('/orders', requireAuth, async (req, res) => {
  const input = orderInput(req.body);
  const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const result = await db.transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [req.user.id, input.requestId]);
    const existing = await client.query('SELECT * FROM shop.orders WHERE user_id = $1 AND request_id = $2', [req.user.id, input.requestId]);
    if (existing.rows.length) {
      if (existing.rows[0].request_hash !== hash) throw new v.HttpError(409, 'Цей requestId вже використано для іншого замовлення.');
      return { created: false, data: await details(client, existing.rows[0]) };
    }
    const ids = input.items.map((item) => item.productId);
    const { rows: products } = await client.query(`SELECT * FROM shop.products
      WHERE id = ANY($1::varchar[]) AND is_active ORDER BY id FOR UPDATE`, [ids]);
    const byId = new Map(products.map((product) => [product.id, product]));
    let subtotal = 0;
    for (const item of input.items) {
      const product = byId.get(item.productId);
      if (!product) throw new v.HttpError(409, 'Один із товарів більше недоступний. Оновіть кошик.');
      if (product.stock < item.quantity) throw new v.HttpError(409, `Недостатній залишок товару «${product.name}».`);
      subtotal += product.price_cents * item.quantity;
    }
    const customer = input.customer;
    const { rows } = await client.query(`INSERT INTO shop.orders(user_id, request_id, request_hash,
      customer_name, email, phone, city, street, apartment, company, payment_method, subtotal_cents, total_cents)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING *`, [
      req.user.id, input.requestId, hash, customer.name, customer.email, customer.phone,
      customer.city, customer.street, customer.apartment, customer.company, input.paymentMethod, subtotal,
    ]);
    for (const item of input.items) {
      const product = byId.get(item.productId);
      await client.query(`INSERT INTO shop.order_items(order_id, product_id, product_name, image,
        quantity, unit_price_cents, line_total_cents) VALUES($1,$2,$3,$4,$5,$6,$7)`, [
        rows[0].id, product.id, product.name, product.image, item.quantity,
        product.price_cents, product.price_cents * item.quantity,
      ]);
      await client.query('UPDATE shop.products SET stock = stock - $1, updated_at = now() WHERE id = $2', [item.quantity, product.id]);
    }
    return { created: true, data: await details(client, rows[0]) };
  });
  res.status(result.created ? 201 : 200).json({
    data: result.data,
    message: 'Замовлення збережено. Онлайн-оплата не проводилася.',
  });
});

async function list(req, res, all = false) {
  const pagination = v.pagination(req.query);
  const where = all ? '' : ' WHERE user_id = $1';
  const values = all ? [] : [req.user.id];
  const { rows: count } = await db.query(`SELECT count(*) FROM shop.orders${where}`, values);
  const { rows } = await db.query(`SELECT * FROM shop.orders${where} ORDER BY created_at DESC, id
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, pagination.limit, pagination.offset]);
  res.json(v.pageResult(rows.map(order), count[0].count, pagination));
}

router.get('/orders', requireAuth, (req, res) => list(req, res));
router.get('/admin/orders', requireAuth, requireAdmin, (req, res) => list(req, res, true));

router.get('/orders/:id', requireAuth, async (req, res) => {
  const { rows } = await db.query(`SELECT * FROM shop.orders WHERE id = $1
    AND (user_id = $2 OR $3::boolean)`, [v.uuid(req.params.id), req.user.id, req.user.role === 'ADMIN']);
  if (!rows.length) throw new v.HttpError(404, 'Замовлення не знайдено.');
  res.json({ data: await details(db, rows[0]) });
});

router.patch('/admin/orders/:id/status', requireAuth, requireAdmin, async (req, res) => {
  v.body(req.body, ['status']);
  const status = v.choice(req.body.status, 'status', ['processing', 'shipped', 'completed', 'cancelled']);
  const id = v.uuid(req.params.id);
  const data = await db.transaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM shop.orders WHERE id = $1 FOR UPDATE', [id]);
    if (!rows.length) throw new v.HttpError(404, 'Замовлення не знайдено.');
    const transitions = { pending: ['processing', 'cancelled'], processing: ['shipped', 'cancelled'], shipped: ['completed'], completed: [], cancelled: [] };
    if (rows[0].status === status) return details(client, rows[0]);
    if (!transitions[rows[0].status].includes(status)) throw new v.HttpError(409, 'Недопустимий перехід статусу замовлення.');
    if (status === 'cancelled') {
      const { rows: items } = await client.query(`SELECT product_id, quantity FROM shop.order_items
        WHERE order_id = $1 AND product_id IS NOT NULL ORDER BY product_id`, [id]);
      for (const item of items) {
        await client.query('UPDATE shop.products SET stock = stock + $1, updated_at = now() WHERE id = $2', [item.quantity, item.product_id]);
      }
    }
    const updated = await client.query('UPDATE shop.orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING *', [status, id]);
    return details(client, updated.rows[0]);
  });
  res.json({ data });
});

module.exports = { router, orderInput };
