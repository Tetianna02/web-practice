CREATE SCHEMA IF NOT EXISTS shop;
REVOKE ALL ON SCHEMA shop FROM PUBLIC, anon, authenticated;

CREATE TABLE shop.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(80) NOT NULL CHECK (length(trim(name)) >= 2),
  last_name varchar(80) NOT NULL DEFAULT '',
  email varchar(254) NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  address varchar(300) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shop.categories (
  id varchar(80) PRIMARY KEY CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name varchar(120) NOT NULL UNIQUE CHECK (length(trim(name)) >= 2),
  description varchar(1000) NOT NULL DEFAULT '',
  icon varchar(40) NOT NULL DEFAULT 'gaming',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shop.products (
  id varchar(80) PRIMARY KEY CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category_id varchar(80) NOT NULL REFERENCES shop.categories(id) ON DELETE RESTRICT,
  name varchar(200) NOT NULL CHECK (length(trim(name)) >= 2),
  description varchar(5000) NOT NULL DEFAULT '',
  price_cents integer NOT NULL CHECK (price_cents BETWEEN 1 AND 100000000),
  old_price_cents integer CHECK (old_price_cents >= price_cents AND old_price_cents <= 100000000),
  stock integer NOT NULL DEFAULT 0 CHECK (stock BETWEEN 0 AND 1000000),
  image varchar(200) NOT NULL,
  image_alt varchar(300) NOT NULL,
  gallery text[] NOT NULL DEFAULT '{}',
  colors text[] NOT NULL DEFAULT '{}',
  sizes text[] NOT NULL DEFAULT '{}',
  rating numeric(2,1) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  reviews integer NOT NULL DEFAULT 0 CHECK (reviews >= 0),
  section text NOT NULL DEFAULT 'catalog' CHECK (section IN ('flash', 'best', 'catalog', 'details')),
  is_new boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON shop.products(category_id);
CREATE INDEX products_section_idx ON shop.products(section, sort_order) WHERE is_active;

CREATE TABLE shop.sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES shop.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON shop.sessions(user_id);
CREATE INDEX sessions_expiry_idx ON shop.sessions(expires_at);

CREATE TABLE shop.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES shop.users(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  request_hash char(64) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'completed', 'cancelled')),
  customer_name varchar(160) NOT NULL,
  email varchar(254) NOT NULL,
  phone varchar(20) NOT NULL,
  city varchar(120) NOT NULL,
  street varchar(300) NOT NULL,
  apartment varchar(120) NOT NULL DEFAULT '',
  company varchar(160) NOT NULL DEFAULT '',
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'bank')),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
  subtotal_cents bigint NOT NULL CHECK (subtotal_cents > 0),
  shipping_cents integer NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  total_cents bigint NOT NULL CHECK (total_cents = subtotal_cents + shipping_cents),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, request_id)
);
CREATE INDEX orders_user_idx ON shop.orders(user_id, created_at DESC);

CREATE TABLE shop.order_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES shop.orders(id) ON DELETE CASCADE,
  product_id varchar(80) REFERENCES shop.products(id) ON DELETE SET NULL,
  product_name varchar(200) NOT NULL,
  image varchar(200) NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents > 0),
  line_total_cents bigint NOT NULL CHECK (line_total_cents = quantity::bigint * unit_price_cents)
);
CREATE INDEX order_items_order_idx ON shop.order_items(order_id);
CREATE INDEX order_items_product_idx ON shop.order_items(product_id);

ALTER TABLE shop.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop.order_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA shop FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA shop FROM PUBLIC, anon, authenticated;
