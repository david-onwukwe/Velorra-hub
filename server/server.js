require("dotenv").config();
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { v4: uuid } = require("uuid");
const db = require("./db");
const { signToken, requireAdmin } = require("./auth");

const app = express();

// Gzip every response — makes product list / order payloads noticeably faster
// to download, especially on slow mobile connections.
app.use(compression());

const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
}));

// Generous body limit: product images and payment receipts are sent as base64 data URLs
app.use(express.json({ limit: "15mb" }));

/* -------------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------------- */

function rowToProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category_id,
    price: row.price,
    compareAt: row.compare_at,
    stock: row.stock,
    sku: row.sku,
    description: row.description,
    colors: JSON.parse(row.colors || "[]"),
    sizes: JSON.parse(row.sizes || "[]"),
    images: JSON.parse(row.images || "[]"),
    tags: JSON.parse(row.tags || "[]"),
    featured: !!row.featured,
    rating: row.rating,
    reviews: row.reviews,
    createdAt: row.created_at,
  };
}

// Formats a UTC epoch-ms timestamp as Nigerian time (Africa/Lagos, UTC+1, no DST)
function formatLagosTime(epochMs) {
  const date = new Date(epochMs);
  const formatter = new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
  return formatter.format(date) + " (WAT)";
}

function rowToOrder(row, items) {
  return {
    id: row.id,
    status: row.status,
    customer: {
      fullName: row.full_name,
      phone: row.phone,
      whatsapp: row.whatsapp,
      email: row.email,
    },
    address: row.address,
    city: row.city,
    state: row.state,
    country: row.country,
    amountPaid: row.amount_paid,
    proofOfPayment: row.proof_of_payment,
    createdAt: row.created_at,
    createdAtLagos: formatLagosTime(row.created_at),
    fulfilledAt: row.fulfilled_at,
    fulfilledAtLagos: row.fulfilled_at ? formatLagosTime(row.fulfilled_at) : null,
    items: items.map((it) => ({
      id: it.id,
      productId: it.product_id,
      name: it.product_name,
      image: it.image,
      price: it.price,
      color: it.color,
      size: it.size,
      quantity: it.quantity,
    })),
  };
}

/* -------------------------------------------------------------------------
   Public: cart persistence — saved per browser via a unique visitor ID, so a
   customer's cart survives page reloads until they delete an item themselves.
   ------------------------------------------------------------------------- */

app.get("/api/cart/:userId", (req, res) => {
  const row = db.prepare("SELECT items FROM carts WHERE user_id = ?").get(req.params.userId);
  res.json({ items: row ? JSON.parse(row.items) : [] });
});

app.put("/api/cart/:userId", (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  db.prepare(`
    INSERT INTO carts (user_id, items, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET items = excluded.items, updated_at = excluded.updated_at
  `).run(req.params.userId, JSON.stringify(items), Date.now());
  res.json({ ok: true });
});

/* -------------------------------------------------------------------------
   Public: categories
   ------------------------------------------------------------------------- */

app.get("/api/categories", (req, res) => {
  res.set("Cache-Control", "public, max-age=60"); // short cache: speeds up repeat loads, still picks up admin changes quickly
  const rows = db.prepare("SELECT * FROM categories ORDER BY name").all();
  res.json(rows);
});

/* -------------------------------------------------------------------------
   Public: products
   ------------------------------------------------------------------------- */

app.get("/api/products", (req, res) => {
  res.set("Cache-Control", "public, max-age=60");
  const rows = db.prepare("SELECT * FROM products ORDER BY created_at DESC").all();
  res.json(rows.map(rowToProduct));
});

app.get("/api/products/:id", (req, res) => {
  res.set("Cache-Control", "public, max-age=60");
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Product not found." });
  res.json(rowToProduct(row));
});

/* -------------------------------------------------------------------------
   Public: payment account (customer needs this to know where to pay)
   ------------------------------------------------------------------------- */

app.get("/api/payment-account", (req, res) => {
  const row = db.prepare("SELECT * FROM payment_account WHERE id = 1").get();
  res.json({
    accountNumber: row.account_number,
    accountName: row.account_name,
    bank: row.bank,
    contactPhone: row.contact_phone,
    contactWhatsapp: row.contact_whatsapp,
  });
});

/* -------------------------------------------------------------------------
   Public: place an order
   ------------------------------------------------------------------------- */

app.post("/api/orders", (req, res) => {
  const { fullName, phone, whatsapp, email, address, city, state, country, amountPaid, proofOfPayment, items } = req.body || {};

  const missing = [];
  if (!fullName || !String(fullName).trim()) missing.push("full name");
  if (!address || !String(address).trim()) missing.push("address");
  if (!city || !String(city).trim()) missing.push("city");
  if (!state || !String(state).trim()) missing.push("state");
  if (!country || !String(country).trim()) missing.push("country");
  if (amountPaid === undefined || amountPaid === null || isNaN(Number(amountPaid)) || Number(amountPaid) <= 0) missing.push("amount paid");
  if (!Array.isArray(items) || items.length === 0) missing.push("at least one product in the order");

  if (missing.length) {
    return res.status(400).json({ error: `Missing or invalid: ${missing.join(", ")}.` });
  }

  const orderId = uuid();
  const now = Date.now();

  const insertOrder = db.prepare(`
    INSERT INTO orders (id, status, full_name, phone, whatsapp, email, address, city, state, country, amount_paid, proof_of_payment, created_at)
    VALUES (@id, 'pending', @full_name, @phone, @whatsapp, @email, @address, @city, @state, @country, @amount_paid, @proof_of_payment, @created_at)
  `);
  const insertItem = db.prepare(`
    INSERT INTO order_items (id, order_id, product_id, product_name, image, price, color, size, quantity)
    VALUES (@id, @order_id, @product_id, @product_name, @image, @price, @color, @size, @quantity)
  `);

  const tx = db.transaction(() => {
    insertOrder.run({
      id: orderId,
      full_name: String(fullName).trim(),
      phone: phone ? String(phone).trim() : null,
      whatsapp: whatsapp ? String(whatsapp).trim() : null,
      email: email ? String(email).trim() : null,
      address: String(address).trim(),
      city: String(city).trim(),
      state: String(state).trim(),
      country: String(country).trim(),
      amount_paid: Number(amountPaid),
      proof_of_payment: proofOfPayment || null,
      created_at: now,
    });
    for (const it of items) {
      insertItem.run({
        id: uuid(),
        order_id: orderId,
        product_id: it.productId || null,
        product_name: it.name,
        image: it.image || null,
        price: Number(it.price) || 0,
        color: it.color || null,
        size: it.size || null,
        quantity: Number(it.quantity) || 1,
      });
      // Decrement stock, floor at 0
      if (it.productId) {
        db.prepare("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?").run(Number(it.quantity) || 1, it.productId);
      }
    }
  });
  tx();

  const orderRow = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  const itemRows = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(orderId);
  res.status(201).json(rowToOrder(orderRow, itemRows));
});

/* -------------------------------------------------------------------------
   Admin: auth
   ------------------------------------------------------------------------- */

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  const row = db.prepare("SELECT * FROM admin_users WHERE id = 1").get();
  if (!row || !username || !password || row.username !== username || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  const token = signToken({ role: "admin", username: row.username });
  res.json({ token, username: row.username });
});

app.put("/api/admin/account", requireAdmin, (req, res) => {
  const { username, currentPassword, newPassword } = req.body || {};
  const row = db.prepare("SELECT * FROM admin_users WHERE id = 1").get();
  if (!currentPassword || !bcrypt.compareSync(currentPassword, row.password_hash)) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }
  const nextUsername = username && username.trim() ? username.trim() : row.username;
  const nextHash = newPassword ? bcrypt.hashSync(newPassword, 10) : row.password_hash;
  db.prepare("UPDATE admin_users SET username = ?, password_hash = ? WHERE id = 1").run(nextUsername, nextHash);
  res.json({ username: nextUsername });
});

/* -------------------------------------------------------------------------
   Admin: payment account management
   ------------------------------------------------------------------------- */

app.put("/api/admin/payment-account", requireAdmin, (req, res) => {
  const { accountNumber, accountName, bank, contactPhone, contactWhatsapp } = req.body || {};
  db.prepare("UPDATE payment_account SET account_number = ?, account_name = ?, bank = ?, contact_phone = ?, contact_whatsapp = ? WHERE id = 1")
    .run(accountNumber || "", accountName || "", bank || "", contactPhone || "", contactWhatsapp || "");
  res.json({ accountNumber, accountName, bank, contactPhone, contactWhatsapp });
});

/* -------------------------------------------------------------------------
   Admin: categories
   ------------------------------------------------------------------------- */

app.post("/api/admin/categories", requireAdmin, (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "Category name is required." });
  const id = `cat-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
  try {
    db.prepare("INSERT INTO categories (id, name) VALUES (?, ?)").run(id, name.trim());
  } catch (e) {
    return res.status(400).json({ error: "A category with that name already exists." });
  }
  res.status(201).json({ id, name: name.trim() });
});

app.delete("/api/admin/categories/:id", requireAdmin, (req, res) => {
  const inUse = db.prepare("SELECT COUNT(*) AS n FROM products WHERE category_id = ?").get(req.params.id).n;
  if (inUse > 0) return res.status(400).json({ error: "This category has products assigned to it. Reassign or delete those products first." });
  db.prepare("DELETE FROM categories WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

/* -------------------------------------------------------------------------
   Admin: products
   ------------------------------------------------------------------------- */

app.post("/api/admin/products", requireAdmin, (req, res) => {
  const p = req.body || {};
  if (!p.name || !String(p.name).trim()) return res.status(400).json({ error: "Product name is required." });
  const id = p.id && String(p.id).trim() ? p.id : uuid();
  const now = Date.now();
  db.prepare(`
    INSERT INTO products (id, name, category_id, price, compare_at, stock, sku, description, colors, sizes, images, tags, featured, rating, reviews, created_at)
    VALUES (@id, @name, @category_id, @price, @compare_at, @stock, @sku, @description, @colors, @sizes, @images, @tags, @featured, @rating, @reviews, @created_at)
  `).run({
    id,
    name: String(p.name).trim(),
    category_id: p.category || null,
    price: Number(p.price) || 0,
    compare_at: p.compareAt ? Number(p.compareAt) : null,
    stock: Number(p.stock) || 0,
    sku: p.sku || "",
    description: p.description || "",
    colors: JSON.stringify(p.colors || []),
    sizes: JSON.stringify(p.sizes || []),
    images: JSON.stringify(p.images || []),
    tags: JSON.stringify(p.tags || []),
    featured: p.featured ? 1 : 0,
    rating: Number(p.rating) || 0,
    reviews: Number(p.reviews) || 0,
    created_at: now,
  });
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  res.status(201).json(rowToProduct(row));
});

app.put("/api/admin/products/:id", requireAdmin, (req, res) => {
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Product not found." });
  const p = req.body || {};
  db.prepare(`
    UPDATE products SET
      name = @name, category_id = @category_id, price = @price, compare_at = @compare_at,
      stock = @stock, sku = @sku, description = @description, colors = @colors, sizes = @sizes,
      images = @images, tags = @tags, featured = @featured, rating = @rating, reviews = @reviews
    WHERE id = @id
  `).run({
    id: req.params.id,
    name: String(p.name || existing.name).trim(),
    category_id: p.category || existing.category_id,
    price: p.price !== undefined ? Number(p.price) : existing.price,
    compare_at: p.compareAt !== undefined ? (p.compareAt === null ? null : Number(p.compareAt)) : existing.compare_at,
    stock: p.stock !== undefined ? Number(p.stock) : existing.stock,
    sku: p.sku !== undefined ? p.sku : existing.sku,
    description: p.description !== undefined ? p.description : existing.description,
    colors: JSON.stringify(p.colors !== undefined ? p.colors : JSON.parse(existing.colors)),
    sizes: JSON.stringify(p.sizes !== undefined ? p.sizes : JSON.parse(existing.sizes)),
    images: JSON.stringify(p.images !== undefined ? p.images : JSON.parse(existing.images)),
    tags: JSON.stringify(p.tags !== undefined ? p.tags : JSON.parse(existing.tags)),
    featured: p.featured !== undefined ? (p.featured ? 1 : 0) : existing.featured,
    rating: p.rating !== undefined ? Number(p.rating) : existing.rating,
    reviews: p.reviews !== undefined ? Number(p.reviews) : existing.reviews,
  });
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  res.json(rowToProduct(row));
});

app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
  db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

/* -------------------------------------------------------------------------
   Admin: orders
   ------------------------------------------------------------------------- */

app.get("/api/admin/orders", requireAdmin, (req, res) => {
  const status = req.query.status; // 'pending' | 'fulfilled' | undefined (all)
  const rows = status
    ? db.prepare("SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC").all(status)
    : db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
  const itemsStmt = db.prepare("SELECT * FROM order_items WHERE order_id = ?");
  res.json(rows.map((row) => rowToOrder(row, itemsStmt.all(row.id))));
});

app.put("/api/admin/orders/:id/fulfill", requireAdmin, (req, res) => {
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Order not found." });
  db.prepare("UPDATE orders SET status = 'fulfilled', fulfilled_at = ? WHERE id = ?").run(Date.now(), req.params.id);
  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(req.params.id);
  res.json(rowToOrder(updated, items));
});

app.put("/api/admin/orders/:id/unfulfill", requireAdmin, (req, res) => {
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Order not found." });
  db.prepare("UPDATE orders SET status = 'pending', fulfilled_at = NULL WHERE id = ?").run(req.params.id);
  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(req.params.id);
  res.json(rowToOrder(updated, items));
});

/* -------------------------------------------------------------------------
   SEO: sitemap.xml and robots.txt
   Generated dynamically from real product/category data so Google always
   sees an up-to-date list of pages, without needing a separate build step.
   Requires SITE_URL to be set in .env to the public storefront URL.
   ------------------------------------------------------------------------- */

app.get("/sitemap.xml", (req, res) => {
  const siteUrl = (process.env.SITE_URL || "").replace(/\/$/, "");
  if (!siteUrl) {
    return res.status(500).send("Set SITE_URL in the backend .env to your storefront's public URL to enable the sitemap.");
  }
  const products = db.prepare("SELECT id, created_at FROM products").all();
  const categories = db.prepare("SELECT id FROM categories").all();

  const urls = [
    { loc: `${siteUrl}/`, priority: "1.0" },
    ...categories.map((c) => ({ loc: `${siteUrl}/?category=${encodeURIComponent(c.id)}`, priority: "0.7" })),
    ...products.map((p) => ({ loc: `${siteUrl}/?product=${encodeURIComponent(p.id)}`, priority: "0.8", lastmod: new Date(p.created_at).toISOString() })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

  res.set("Content-Type", "application/xml");
  res.set("Cache-Control", "public, max-age=3600");
  res.send(xml);
});

app.get("/robots.txt", (req, res) => {
  const siteUrl = (process.env.SITE_URL || "").replace(/\/$/, "");
  res.set("Content-Type", "text/plain");
  res.send(`User-agent: *
Allow: /
${siteUrl ? `\nSitemap: ${siteUrl}/sitemap.xml` : ""}`);
});

/* -------------------------------------------------------------------------
   Health check
   ------------------------------------------------------------------------- */

app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

/* -------------------------------------------------------------------------
   Serve the built storefront + admin panel (client/public after `npm run
   build` in client/) from this same server, so the whole project runs as
   one deployable unit with a single command.

   Anything that isn't an /api, /sitemap.xml, or /robots.txt request falls
   through to the single-page app's index.html — this is required for a
   client-side router (or, here, simple in-app state) to work correctly on
   a hard refresh or direct link.
   ------------------------------------------------------------------------- */

const publicDir = path.join(__dirname, "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, {
    // Long cache for hashed build assets (JS/CSS filenames change on every
    // build), but never cache index.html itself so updates show up right away.
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache");
      } else {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }));

  app.get(/^(?!\/api|\/sitemap\.xml|\/robots\.txt).*/, (req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.status(200).send(
      "Velorra Hub backend is running, but no built frontend was found at server/public. " +
      "Run `npm install && npm run build` inside the client folder first."
    );
  });
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Velorra Hub backend listening on http://localhost:${PORT}`);
});
