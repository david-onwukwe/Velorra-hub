const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "velorra-hub.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  price REAL NOT NULL,
  compare_at REAL,
  stock INTEGER NOT NULL DEFAULT 0,
  sku TEXT,
  description TEXT,
  colors TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  sizes TEXT NOT NULL DEFAULT '[]',    -- JSON array of strings
  images TEXT NOT NULL DEFAULT '[]',   -- JSON array of image URLs (data URLs allowed)
  tags TEXT NOT NULL DEFAULT '[]',     -- JSON array
  featured INTEGER NOT NULL DEFAULT 0,
  rating REAL NOT NULL DEFAULT 0,
  reviews INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',   -- 'pending' | 'fulfilled'
  full_name TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL,
  amount_paid REAL NOT NULL,
  proof_of_payment TEXT,     -- data URL of uploaded receipt image, optional
  created_at INTEGER NOT NULL,   -- epoch ms, always stored UTC; formatted to Africa/Lagos on read
  fulfilled_at INTEGER
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT,
  product_name TEXT NOT NULL,
  image TEXT,
  price REAL NOT NULL,
  color TEXT,
  size TEXT,
  quantity INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS carts (
  user_id TEXT PRIMARY KEY,
  items TEXT NOT NULL DEFAULT '[]',   -- JSON array of cart line items
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_account (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  account_number TEXT NOT NULL DEFAULT '',
  account_name TEXT NOT NULL DEFAULT '',
  bank TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  contact_whatsapp TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL
);
`);

// Migration: add whatsapp column to orders if it doesn't exist yet (for databases
// created before this field was added)
const orderColumns = db.prepare("PRAGMA table_info(orders)").all().map((c) => c.name);
if (!orderColumns.includes("whatsapp")) {
  db.exec("ALTER TABLE orders ADD COLUMN whatsapp TEXT");
}

// Migration: add contact_phone/contact_whatsapp columns if missing (for
// databases created before these fields were added)
const paymentColumns = db.prepare("PRAGMA table_info(payment_account)").all().map((c) => c.name);
if (!paymentColumns.includes("contact_phone")) {
  db.exec("ALTER TABLE payment_account ADD COLUMN contact_phone TEXT NOT NULL DEFAULT ''");
}
if (!paymentColumns.includes("contact_whatsapp")) {
  db.exec("ALTER TABLE payment_account ADD COLUMN contact_whatsapp TEXT NOT NULL DEFAULT ''");
}

// Seed payment account row if missing — starts blank, fill in from the admin panel
const paymentRow = db.prepare("SELECT * FROM payment_account WHERE id = 1").get();
if (!paymentRow) {
  db.prepare(
    "INSERT INTO payment_account (id, account_number, account_name, bank, contact_phone, contact_whatsapp) VALUES (1, ?, ?, ?, ?, ?)"
  ).run("", "", "", "", "");
}

// Seed admin user if missing
const adminRow = db.prepare("SELECT * FROM admin_users WHERE id = 1").get();
if (!adminRow) {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "velorra2026";
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    "INSERT INTO admin_users (id, username, password_hash) VALUES (1, ?, ?)"
  ).run(username, hash);
  console.log(`Seeded admin user "${username}" — set ADMIN_USERNAME/ADMIN_PASSWORD in .env before first run to customize.`);
}

// No demo categories or products are seeded — the storefront starts completely
// empty. Add your first category and product from the admin panel.

module.exports = db;
