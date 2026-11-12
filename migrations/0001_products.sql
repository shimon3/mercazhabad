-- D1 schema: additive, no destructive operation.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY NOT NULL,
  category TEXT NOT NULL,
  name_he TEXT NOT NULL,
  name_fr TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  price_agorot INTEGER CHECK(price_agorot IS NULL OR price_agorot>=0),
  old_price_agorot INTEGER CHECK(old_price_agorot IS NULL OR old_price_agorot>=0),
  image_key TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  variant_label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE TABLE IF NOT EXISTS product_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  operation TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
