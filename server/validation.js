const fs = require('node:fs');
const path = require('node:path');

class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

function fail(field, message) {
  throw new HttpError(400, 'Перевірте введені дані.', { [field]: message });
}

function body(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'Очікується JSON-об’єкт.');
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(key, 'Непідтримуване поле.');
  }
  return value;
}

function text(value, field, min = 0, max = 200) {
  if (typeof value !== 'string') fail(field, 'Введіть текст.');
  const result = value.trim();
  if (result.length < min || result.length > max) fail(field, `Довжина має бути від ${min} до ${max} символів.`);
  return result;
}

function email(value) {
  const result = text(value, 'email', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(result)) fail('email', 'Введіть коректну електронну пошту.');
  return result;
}

function password(value, field = 'password') {
  if (typeof value !== 'string' || value.length < 8 || Buffer.byteLength(value, 'utf8') > 72) {
    fail(field, 'Пароль: щонайменше 8 символів і не більше 72 байтів UTF-8.');
  }
  return value;
}

function slug(value, field = 'id') {
  const result = text(value, field, 1, 80);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(result)) fail(field, 'Використовуйте малі латинські літери, цифри та дефіси.');
  return result;
}

function uuid(value, field = 'id') {
  if (typeof value !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(value)) {
    fail(field, 'Некоректний ідентифікатор UUID.');
  }
  return value;
}

function integer(value, field, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) fail(field, `Очікується ціле число від ${min} до ${max}.`);
  return value;
}

function money(value, field, nullable = false) {
  if (nullable && value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.01 || value > 1000000
      || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) {
    fail(field, 'Введіть суму від 0,01 до 1 000 000 грн, не більше двох знаків після коми.');
  }
  return Math.round(value * 100);
}

function choice(value, field, allowed) {
  if (!allowed.includes(value)) fail(field, `Дозволені значення: ${allowed.join(', ')}.`);
  return value;
}

function boolean(value, field) {
  if (typeof value !== 'boolean') fail(field, 'Очікується true або false.');
  return value;
}

const imagesFolder = path.resolve(__dirname, '../assets/images/optimized');
function image(value, field = 'image') {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][\w.-]*\.(webp|png|jpe?g|svg)$/.test(value)
      || !fs.readdirSync(imagesFolder).includes(value)) fail(field, 'Оберіть наявне зображення з assets/images/optimized.');
  return value;
}

function array(value, field, max, check) {
  if (!Array.isArray(value) || value.length > max) fail(field, `Очікується масив, максимум ${max} елементів.`);
  return value.map((item, index) => check(item, `${field}.${index}`));
}

function pagination(query) {
  for (const key of ['page', 'limit']) {
    if (query[key] !== undefined && (typeof query[key] !== 'string' || !/^\d+$/.test(query[key]))) {
      fail(key, 'Очікується додатне ціле число.');
    }
  }
  const page = integer(Number(query.page || 1), 'page', 1, 100000);
  const limit = integer(Number(query.limit || 20), 'limit', 1, 100);
  return { page, limit, offset: (page - 1) * limit };
}

function pageResult(data, total, { page, limit }) {
  return { data, pagination: { page, limit, total: Number(total), totalPages: Math.ceil(Number(total) / limit) } };
}

module.exports = { HttpError, fail, body, text, email, password, slug, uuid, integer, money, choice, boolean, image, array, pagination, pageResult };
