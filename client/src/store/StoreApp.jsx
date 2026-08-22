import React, { useState, useEffect, useMemo, useCallback, createContext, useContext, useRef } from "react";
import { Search, ShoppingCart, Sun, Moon, Menu, X, ChevronLeft, ChevronRight, Plus, Minus, Trash2, Check, AlertTriangle, Star, ArrowLeft, ShieldCheck, Truck, Upload, Landmark, Copy, ImageOff, Lock } from "lucide-react";

/* =========================================================================
   Point this at your deployed backend. See velorra-hub-backend/README.md.
   ========================================================================= */
/* =========================================================================
   Since the backend now serves this app's built files directly, API calls
   use a relative path — no separate domain or CORS setup needed. If you ever
   split the frontend and backend across two different domains again, change
   this back to a full URL like "https://api.yourdomain.com/api".
   ========================================================================= */
const API_BASE = "/api";

// The public URL this storefront is served from — used for canonical links,
// Open Graph tags, and JSON-LD structured data. Set this once you deploy.
const SITE_URL = "https://your-storefront-domain.com";
const SITE_NAME = "Velorra Hub";
const SITE_DEFAULT_DESCRIPTION = "Shop accessories, clothing, electronics, appliances and devices at Velorra Hub — sourced, shipped, sorted, delivered to your door.";

/* =========================================================================
   API helpers
   ========================================================================= */

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Request failed.");
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Request failed.");
  return res.json();
}

async function apiPut(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Request failed.");
  return res.json();
}

/* =========================================================================
   SEO — keeps <title>, meta description, Open Graph tags, canonical link, and
   JSON-LD structured data in sync with whatever the person is currently
   looking at. This is what lets Google show the right title/snippet/rich
   result for each product or category, even though this is a single-page app.
   ========================================================================= */

function setMetaTag(attr, key, content) {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(url) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", url);
}

function setJsonLd(id, data) {
  let el = document.getElementById(id);
  if (!data) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

/**
 * Call with the page currently being shown. Handles: home, a category, a
 * search results page, or a single product. Product pages get full Product
 * JSON-LD (price, availability, rating) so eligible listings can show rich
 * results in Google — the biggest lever available without server rendering.
 */
function useDocumentSEO({ view, selectedProduct, activeCategory, categories, query }) {
  useEffect(() => {
    let title = `${SITE_NAME} — Accessories, Clothing, Electronics, Appliances & Devices`;
    let description = SITE_DEFAULT_DESCRIPTION;
    let canonicalUrl = `${SITE_URL}/`;
    let ogImage = null;
    let productLd = null;

    if (selectedProduct) {
      const cat = categories.find((c) => c.id === selectedProduct.category);
      title = `${selectedProduct.name} | ${SITE_NAME}`;
      description = (selectedProduct.description || SITE_DEFAULT_DESCRIPTION).slice(0, 160);
      canonicalUrl = `${SITE_URL}/?product=${encodeURIComponent(selectedProduct.id)}`;
      ogImage = selectedProduct.images?.[0] || null;
      productLd = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: selectedProduct.name,
        description: selectedProduct.description,
        image: selectedProduct.images || [],
        sku: selectedProduct.sku || undefined,
        category: cat?.name || undefined,
        brand: { "@type": "Brand", name: SITE_NAME },
        ...(selectedProduct.reviews > 0 ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: selectedProduct.rating,
            reviewCount: selectedProduct.reviews,
          },
        } : {}),
        offers: {
          "@type": "Offer",
          url: canonicalUrl,
          priceCurrency: "NGN",
          price: selectedProduct.price,
          availability: selectedProduct.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        },
      };
    } else if (activeCategory) {
      const cat = categories.find((c) => c.id === activeCategory);
      if (cat) {
        title = `${cat.name} | ${SITE_NAME}`;
        description = `Shop ${cat.name.toLowerCase()} at ${SITE_NAME} — quality products, fast processing, delivered to your door.`;
        canonicalUrl = `${SITE_URL}/?category=${encodeURIComponent(cat.id)}`;
      }
    } else if (query && query.trim()) {
      title = `Search results for "${query.trim()}" | ${SITE_NAME}`;
      description = `Products matching "${query.trim()}" at ${SITE_NAME}.`;
    }

    document.title = title;
    setMetaTag("name", "description", description);
    setMetaTag("property", "og:title", title);
    setMetaTag("property", "og:description", description);
    setMetaTag("property", "og:type", selectedProduct ? "product" : "website");
    setMetaTag("property", "og:url", canonicalUrl);
    setMetaTag("property", "og:site_name", SITE_NAME);
    if (ogImage) setMetaTag("property", "og:image", ogImage);
    setMetaTag("name", "twitter:card", ogImage ? "summary_large_image" : "summary");
    setMetaTag("name", "twitter:title", title);
    setMetaTag("name", "twitter:description", description);
    if (ogImage) setMetaTag("name", "twitter:image", ogImage);
    setCanonical(canonicalUrl);
    setJsonLd("product-jsonld", productLd);
  }, [view, selectedProduct, activeCategory, categories, query]);
}

/* =========================================================================
   Store Context
   ========================================================================= */

const StoreCtx = createContext(null);
const useStore = () => useContext(StoreCtx);

// A stable per-browser ID, created once and reused, so a customer's cart can
// be saved to the server and restored automatically on their next visit.
function getUserId() {
  let id = localStorage.getItem("velorra_user_id");
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `user-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem("velorra_user_id", id);
  }
  return id;
}

function StoreProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [paymentAccount, setPaymentAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [cart, setCart] = useState([]);
  const [theme, setTheme] = useState("light");
  const userId = useMemo(() => getUserId(), []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [p, c, pa, savedCart] = await Promise.all([
        apiGet("/products"),
        apiGet("/categories"),
        apiGet("/payment-account"),
        apiGet(`/cart/${userId}`).catch(() => ({ items: [] })),
      ]);
      setProducts(p);
      setCategories(c);
      setPaymentAccount(pa);
      setCart(savedCart.items || []);
    } catch (e) {
      setLoadError(e.message || "Couldn't reach the store server.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Save the cart to the server any time it changes, so it survives reloads
  // until the customer removes an item themselves.
  useEffect(() => {
    if (loading) return; // don't overwrite the saved cart with an empty one before it's loaded
    apiPut(`/cart/${userId}`, { items: cart }).catch(() => {});
  }, [cart, userId, loading]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const addToCart = useCallback((product, opts = {}) => {
    const { color = null, size = null, qty = 1 } = opts;
    setCart((prev) => {
      const key = `${product.id}__${color}__${size}`;
      const existing = prev.find((c) => c.key === key);
      if (existing) {
        return prev.map((c) => c.key === key ? { ...c, qty: Math.min(c.qty + qty, product.stock || 99) } : c);
      }
      return [...prev, { key, productId: product.id, name: product.name, price: product.price, image: product.images[0], color, size, qty, stock: product.stock, shippingFee: product.shippingFee || 0, freeShipping: !!product.freeShipping }];
    });
  }, []);

  const removeFromCart = useCallback((key) => setCart((prev) => prev.filter((c) => c.key !== key)), []);
  const updateCartQty = useCallback((key, qty) => {
    setCart((prev) => prev.map((c) => c.key === key ? { ...c, qty: Math.max(1, Math.min(qty, c.stock || 99)) } : c));
  }, []);
  const clearCart = useCallback(() => setCart([]), []);

  const placeOrder = useCallback(async (orderPayload) => {
    const result = await apiPost("/orders", orderPayload);
    clearCart();
    return result;
  }, [clearCart]);

  const value = {
    products, categories, paymentAccount, loading, loadError, reload: loadAll,
    cart, addToCart, removeFromCart, updateCartQty, clearCart, placeOrder,
    theme, setTheme,
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

/* =========================================================================
   Shared bits
   ========================================================================= */

function money(n) { return `₦${Number(n).toLocaleString("en-NG")}`; }

// Shipping fee stays flat per item for normal quantities, but scales up once
// someone orders in bulk (5 or more of the same item) — a single shipment
// no longer covers that fairly, so the fee multiplies by quantity instead.
function lineShippingFee(item) {
  if (item.freeShipping || !item.shippingFee) return 0;
  return item.qty >= 5 ? item.shippingFee * item.qty : item.shippingFee;
}

/**
 * Image with a lightweight blur-up placeholder and graceful fallback, tuned for
 * slow/unreliable connections: the layout never jumps (fixed aspect box), a soft
 * placeholder shows instantly while the real image streams in, native lazy-loading
 * means off-screen images aren't fetched at all until they're about to be seen, and
 * a broken/slow image degrades to a simple icon instead of leaving a blank gap.
 */
const LazyImage = React.memo(function LazyImage({ src, alt = "", className = "" }) {
  const [status, setStatus] = useState("loading"); // loading | loaded | error
  return (
    <span className={`lazy-img-wrap ${className}`}>
      {status !== "loaded" && (
        <span className={`lazy-img-placeholder ${status === "error" ? "lazy-img-error" : ""}`}>
          {status === "error" && <ImageOff size={18} strokeWidth={1.4} />}
        </span>
      )}
      {src && status !== "error" && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`lazy-img ${status === "loaded" ? "lazy-img-visible" : ""}`}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      )}
    </span>
  );
});

function StarRating({ value, count }) {
  const full = Math.round(value);
  return (
    <span className="stars" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={12} strokeWidth={0} fill={i <= full ? "var(--accent)" : "var(--border)"} />
      ))}
      {count != null && <span className="stars-count">({count})</span>}
    </span>
  );
}

function Badge({ children, tone = "default" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function FullScreenState({ icon, title, message, action }) {
  return (
    <div className="fullscreen-state">
      {icon}
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </div>
  );
}

/* =========================================================================
   Header / Nav
   ========================================================================= */

function Header({ query, setQuery, onCartClick, onMenuClick, cartCount, onLogoClick }) {
  const { theme, setTheme } = useStore();
  return (
    <header className="site-header">
      <div className="header-row">
        <button className="icon-btn only-mobile" onClick={onMenuClick} aria-label="Open categories"><Menu size={22} /></button>
        <button className="logo" onClick={onLogoClick} aria-label="Velorra Hub home"><span className="logo-mark">Velorra Hub</span></button>
        <div className="search-wrap only-desktop-flex">
          <Search size={17} className="search-icon" />
          <input className="search-input" type="text" placeholder="Search products, brands, categories…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search products" />
          {query && <button className="search-clear" onClick={() => setQuery("")} aria-label="Clear search"><X size={15} /></button>}
        </div>
        <div className="header-actions">
          <button className="icon-btn" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Toggle dark mode" title="Toggle dark mode">
            {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <button className="icon-btn cart-btn" onClick={onCartClick} aria-label="Open cart">
            <ShoppingCart size={20} />
            {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
          </button>
        </div>
      </div>
      <div className="header-search-row only-mobile-flex">
        <div className="search-wrap">
          <Search size={17} className="search-icon" />
          <input className="search-input" type="text" placeholder="Search products, brands, categories…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search products" />
          {query && <button className="search-clear" onClick={() => setQuery("")} aria-label="Clear search"><X size={15} /></button>}
        </div>
      </div>
    </header>
  );
}

function CategoryNav({ categories, activeCategory, setActiveCategory, onAdminClick, onCartClick, cartCount }) {
  return (
    <nav className="category-nav" aria-label="Categories">
      <div className="category-nav-row">
        <button className={`cat-pill ${activeCategory === null ? "active" : ""}`} onClick={() => setActiveCategory(null)}>All</button>
        {categories.map((c) => (
          <button key={c.id} className={`cat-pill ${activeCategory === c.id ? "active" : ""}`} onClick={() => setActiveCategory(c.id)}>{c.name}</button>
        ))}
        <button className="cat-pill nav-cart-pill" onClick={onCartClick} aria-label="Open cart">
          <ShoppingCart size={12} /> Cart{cartCount > 0 ? ` (${cartCount})` : ""}
        </button>
        <button className="cat-pill admin-entry-pill" onClick={onAdminClick} aria-label="Admin login">
          <Lock size={12} /> Admin
        </button>
      </div>
    </nav>
  );
}

function MobileDrawer({ open, onClose, categories, activeCategory, setActiveCategory, onAdminClick, onCartClick, cartCount }) {
  if (!open) return null;
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <span className="logo-mark">Velorra Hub</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        </div>
        <div className="drawer-list">
          <button className={`drawer-item ${activeCategory === null ? "active" : ""}`} onClick={() => { setActiveCategory(null); onClose(); }}>All products</button>
          {categories.map((c) => (
            <button key={c.id} className={`drawer-item ${activeCategory === c.id ? "active" : ""}`} onClick={() => { setActiveCategory(c.id); onClose(); }}>{c.name}</button>
          ))}
          <button className="drawer-item" onClick={() => { onClose(); onCartClick(); }}>
            <ShoppingCart size={15} style={{ marginRight: 8 }} /> Cart{cartCount > 0 ? ` (${cartCount})` : ""}
          </button>
        </div>
        <div className="drawer-foot">
          <button className="drawer-admin-link" onClick={() => { onClose(); onAdminClick(); }}>
            <Lock size={13} /> Admin login
          </button>
        </div>
      </div>
    </div>

  );
}

/* =========================================================================
   Lookbook strip
   ========================================================================= */

function LookbookStrip({ products, onSelect }) {
  const scRef = useRef(null);
  const featured = products.filter((p) => p.featured).slice(0, 10);
  if (featured.length === 0) return null;
  const scroll = (dir) => { if (scRef.current) scRef.current.scrollBy({ left: dir * 280, behavior: "smooth" }); };
  return (
    <section className="lookbook" aria-label="Featured looks">
      <div className="lookbook-head">
        <div>
          <span className="lookbook-eyebrow">The edit</span>
          <h2 className="lookbook-title">What's catching eyes right now</h2>
        </div>
        <div className="lookbook-controls only-desktop">
          <button className="icon-btn" onClick={() => scroll(-1)} aria-label="Scroll left"><ChevronLeft size={18} /></button>
          <button className="icon-btn" onClick={() => scroll(1)} aria-label="Scroll right"><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="lookbook-strip" ref={scRef}>
        {featured.map((p) => (
          <button key={p.id} className="lookbook-tile" onClick={() => onSelect(p)} aria-label={p.name}>
            <LazyImage src={p.images[0]} alt={p.name} className="lookbook-tile-img" />
            <span className="lookbook-tile-glow" />
          </button>
        ))}
      </div>
    </section>
  );
}

/* =========================================================================
   Product Card (horizontal, compact — 2.5+ fit per row) / Grid
   ========================================================================= */

const ProductCard = React.memo(function ProductCard({ product, onSelect, onAddToCart }) {
  const outOfStock = product.stock <= 0;
  const discount = product.compareAt ? Math.round((1 - product.price / product.compareAt) * 100) : 0;
  return (
    <div className="product-card">
      <button className="product-media" onClick={() => onSelect(product)} aria-label={product.name}>
        <LazyImage src={product.images[0]} alt={product.name} className="product-media-img" />
        {outOfStock && <span className="stock-overlay">Sold out</span>}
        {!outOfStock && discount > 0 && <Badge tone="sale">-{discount}%</Badge>}
        {!outOfStock && product.tags?.includes("new") && !discount && <Badge tone="new">New</Badge>}
      </button>
      <div className="product-body">
        <button className="product-name" onClick={() => onSelect(product)}>{product.name}</button>
        <StarRating value={product.rating} count={product.reviews} />
        <div className="product-price-row">
          <span className="price">{money(product.price)}</span>
          {product.compareAt && <span className="price-compare">{money(product.compareAt)}</span>}
        </div>
        {product.freeShipping && <span className="free-shipping-tag">Free shipping</span>}
        <button className="btn btn-add" disabled={outOfStock} onClick={() => onAddToCart(product)}>
          {outOfStock ? "Notify me" : "Add"}
        </button>
      </div>
    </div>
  );
});

function ProductGrid({ products, onSelect, onAddToCart, title }) {
  if (products.length === 0) {
    return (
      <div className="empty-state">
        <ImageOff size={36} strokeWidth={1.3} />
        <p>No products match your search.</p>
      </div>
    );
  }
  return (
    <section className="product-section">
      {title && <h1 className="section-title">{title}</h1>}
      <div className="product-grid">
        {products.map((p) => <ProductCard key={p.id} product={p} onSelect={onSelect} onAddToCart={onAddToCart} />)}
      </div>
    </section>
  );
}

/* =========================================================================
   Product Detail
   ========================================================================= */

function ProductDetail({ product, onBack, onAddToCart, categories }) {
  const [activeImg, setActiveImg] = useState(0);
  const [color, setColor] = useState(product.colors?.[0] || null);
  const [size, setSize] = useState(product.sizes?.[0] || null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const outOfStock = product.stock <= 0;
  const cat = categories.find((c) => c.id === product.category);

  useEffect(() => { setActiveImg(0); setColor(product.colors?.[0] || null); setSize(product.sizes?.[0] || null); setQty(1); setAdded(false); }, [product.id]);

  const handleAdd = () => {
    onAddToCart(product, { color, size, qty });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="pdp">
      <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back to results</button>
      <div className="pdp-grid">
        <div className="pdp-gallery">
          <div className="pdp-main-img">
            <LazyImage src={product.images[activeImg]} alt={product.name} className="pdp-main-img-inner" />
            {outOfStock && <span className="stock-overlay large">Sold out</span>}
          </div>
          {product.images.length > 1 && (
            <div className="pdp-thumbs">
              {product.images.map((im, i) => (
                <button key={i} className={`pdp-thumb ${i === activeImg ? "active" : ""}`} onClick={() => setActiveImg(i)}><LazyImage src={im} alt={`${product.name} — image ${i + 1}`} className="pdp-thumb-img" /></button>
              ))}
            </div>
          )}
        </div>
        <div className="pdp-info">
          {cat && <span className="pdp-eyebrow">{cat.name}</span>}
          <h1 className="pdp-title">{product.name}</h1>
          <StarRating value={product.rating} count={product.reviews} />
          <div className="pdp-price-row">
            <span className="price price-lg">{money(product.price)}</span>
            {product.compareAt && <span className="price-compare">{money(product.compareAt)}</span>}
            {product.compareAt && <Badge tone="sale">Save {money(product.compareAt - product.price)}</Badge>}
          </div>
          <p className="shipping-line">{product.freeShipping ? "Free shipping" : product.shippingFee > 0 ? `+ ${money(qty >= 5 ? product.shippingFee * qty : product.shippingFee)} shipping${qty >= 5 ? ` (${qty}× fee)` : ""}` : ""}</p>
          <p className="pdp-desc">{product.description}</p>

          {product.colors?.length > 0 && (
            <div className="option-group">
              <span className="option-label">Colour: <strong>{color}</strong></span>
              <div className="option-row">{product.colors.map((c) => <button key={c} className={`chip ${color === c ? "active" : ""}`} onClick={() => setColor(c)}>{c}</button>)}</div>
            </div>
          )}
          {product.sizes?.length > 0 && (
            <div className="option-group">
              <span className="option-label">Size: <strong>{size}</strong></span>
              <div className="option-row">{product.sizes.map((s) => <button key={s} className={`chip ${size === s ? "active" : ""}`} onClick={() => setSize(s)}>{s}</button>)}</div>
            </div>
          )}

          <div className="option-group">
            <span className="option-label">Quantity</span>
            <div className="qty-stepper">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity"><Minus size={14} /></button>
              <span>{qty}</span>
              <button onClick={() => setQty((q) => Math.min(product.stock || 99, q + 1))} aria-label="Increase quantity"><Plus size={14} /></button>
            </div>
            {!outOfStock && product.stock <= 5 && <span className="low-stock">Only {product.stock} left</span>}
          </div>

          <button className={`btn btn-primary btn-full ${added ? "btn-success" : ""}`} disabled={outOfStock} onClick={handleAdd}>
            {outOfStock ? "Out of stock" : added ? (<><Check size={16} /> Added to cart</>) : "Add to cart"}
          </button>

          <div className="pdp-trust">
            <div><Truck size={16} /> Ships after payment is confirmed</div>
            <div><ShieldCheck size={16} /> Your details stay private</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   Cart Drawer
   ========================================================================= */

function CartDrawer({ open, onClose, cart, updateCartQty, removeFromCart, onCheckout, onCheckoutItem }) {
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const totalShipping = cart.reduce((s, c) => s + lineShippingFee(c), 0);
  return (
    <div className={`cart-overlay ${open ? "open" : ""}`} onClick={onClose} aria-hidden={!open}>
      <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="cart-head">
          <h2>Your cart</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close cart"><X size={20} /></button>
        </div>
        {cart.length === 0 ? (
          <div className="empty-state"><ShoppingCart size={36} strokeWidth={1.3} /><p>Your cart is empty.</p></div>
        ) : (
          <>
            <div className="cart-items">
              {cart.map((item) => (
                <div className="cart-item" key={item.key}>
                  <LazyImage src={item.image} alt={item.name} className="cart-item-img" />
                  <div className="cart-item-info">
                    <span className="cart-item-name">{item.name}</span>
                    <span className="cart-item-variant">{[item.color, item.size].filter(Boolean).join(" / ")}</span>
                    <span className="price">{money(item.price * item.qty)}</span>
                    <span className="shipping-line">{item.freeShipping ? "Free shipping" : lineShippingFee(item) > 0 ? `+ ${money(lineShippingFee(item))} shipping${item.qty >= 5 ? ` (${item.qty}× fee)` : ""}` : ""}</span>
                    <div className="qty-stepper small">
                      <button onClick={() => updateCartQty(item.key, item.qty - 1)} aria-label="Decrease quantity"><Minus size={12} /></button>
                      <span>{item.qty}</span>
                      <button onClick={() => updateCartQty(item.key, item.qty + 1)} aria-label="Increase quantity"><Plus size={12} /></button>
                    </div>
                    <button className="btn btn-ghost small cart-item-checkout" onClick={() => onCheckoutItem(item)}>Checkout this item</button>
                  </div>
                  <button className="icon-btn cart-remove" onClick={() => removeFromCart(item.key)} aria-label="Remove item"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            <div className="cart-foot">
              {totalShipping > 0 && <div className="cart-shipping-row"><span>Shipping</span><span>{money(totalShipping)}</span></div>}
              <div className="cart-subtotal"><span>Total ({cart.reduce((s, c) => s + c.qty, 0)} items)</span><span className="price price-lg">{money(subtotal + totalShipping)}</span></div>
              <button className="btn btn-primary btn-full" onClick={onCheckout}>Checkout all items</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   Checkout — address + bank transfer + proof of payment
   ========================================================================= */

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Checkout({ cart, paymentAccount, onBack, onOrderPlaced, placeOrder }) {
  const [form, setForm] = useState({ fullName: "", phone: "", whatsapp: "", email: "", address: "", city: "", state: "", country: "" });
  const [amountPaid, setAmountPaid] = useState("");
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const totalShipping = cart.reduce((s, c) => s + lineShippingFee(c), 0);
  const grandTotal = subtotal + totalShipping;

  const requiredOk = form.fullName.trim() && form.address.trim() && form.city.trim() && form.state.trim() && form.country.trim();
  const amountOk = amountPaid !== "" && !isNaN(Number(amountPaid)) && Number(amountPaid) > 0;
  const canSubmit = requiredOk && amountOk && !submitting;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleReceipt = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    const dataUrl = await fileToDataUrl(file);
    setReceiptPreview(dataUrl);
  };

  const copyField = (label, value) => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 1500);
    }).catch(() => {});
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const order = await placeOrder({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        country: form.country.trim(),
        amountPaid: Number(amountPaid),
        proofOfPayment: receiptPreview || null,
        items: cart.map((c) => ({
          productId: c.productId, name: c.name, image: c.image, price: c.price, color: c.color, size: c.size, quantity: c.qty,
        })),
      });
      onOrderPlaced(order, form);
    } catch (e) {
      setError(e.message || "Something went wrong placing your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="checkout">
      <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back to cart</button>
      <form className="checkout-grid" onSubmit={submit}>
        <div className="checkout-form">
          <h1>Checkout</h1>

          <h2 className="checkout-subhead">Delivery details</h2>
          <label>Full name
            <input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Jordan Lee" required />
          </label>
          <div className="form-row">
            <label>Phone number <span className="label-hint">(optional)</span>
              <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+234…" />
            </label>
            <label>WhatsApp number <span className="label-hint">(optional)</span>
              <input type="tel" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+234…" />
            </label>
          </div>
          <label>Email <span className="label-hint">(optional)</span>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="jordan@email.com" />
          </label>
          <label>Address
            <input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="123 Market Street" required />
          </label>
          <div className="form-row">
            <label>City
              <input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Ikeja" required />
            </label>
            <label>State
              <input value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="Lagos" required />
            </label>
          </div>
          <label>Country
            <input value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="Nigeria" required />
          </label>

          <h2 className="checkout-subhead">Pay by bank transfer</h2>
          {paymentAccount ? (
            <div className="pay-account-card">
              <div className="pay-account-row">
                <div><span className="pay-label">Account number</span><span className="pay-value">{paymentAccount.accountNumber}</span></div>
                <button type="button" className="icon-btn" onClick={() => copyField("acct", paymentAccount.accountNumber)} aria-label="Copy account number">
                  {copiedField === "acct" ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <div className="pay-account-row"><div><span className="pay-label">Account name</span><span className="pay-value">{paymentAccount.accountName}</span></div></div>
              <div className="pay-account-row"><div><span className="pay-label">Bank</span><span className="pay-value">{paymentAccount.bank}</span></div></div>
              <p className="pay-note"><Landmark size={13} /> Transfer the order total below to this account, then fill in the amount you paid.</p>
              {(paymentAccount.contactPhone || paymentAccount.contactWhatsapp) && (
                <p className="pay-note">
                  Questions? Contact us
                  {paymentAccount.contactPhone ? ` by phone: ${paymentAccount.contactPhone}` : ""}
                  {paymentAccount.contactWhatsapp ? `${paymentAccount.contactPhone ? " or" : ""} WhatsApp: ${paymentAccount.contactWhatsapp}` : ""}
                </p>
              )}
            </div>
          ) : (
            <p className="pay-note">Payment details are unavailable right now — please try again shortly.</p>
          )}

          <label>Amount paid (NGN)
            <input type="number" min="0" step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder={grandTotal.toFixed(2)} required />
          </label>

          <label>Proof of payment <span className="label-hint">(optional — speeds up processing)</span>
            <div className="file-drop">
              <input type="file" accept="image/*,.pdf" onChange={handleReceipt} id="receipt-upload" />
              <label htmlFor="receipt-upload" className="file-drop-label">
                <Upload size={16} /> {receiptFile ? receiptFile.name : "Upload a screenshot or photo of your receipt"}
              </label>
            </div>
            {receiptPreview && receiptFile?.type.startsWith("image/") && (
              <img src={receiptPreview} alt="Proof of payment preview" className="receipt-preview" />
            )}
          </label>

          {error && <div className="checkout-error"><AlertTriangle size={15} /> {error}</div>}

          <button className="btn btn-primary btn-full" type="submit" disabled={!canSubmit}>
            {submitting ? "Placing order…" : "Place order"}
          </button>
        </div>

        <div className="checkout-summary">
          <h2>Order summary</h2>
          {cart.map((item) => (
            <div className="summary-line" key={item.key}><span>{item.name} × {item.qty}</span><span>{money(item.price * item.qty)}</span></div>
          ))}
          <div className="summary-line"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          <div className="summary-line"><span>Shipping</span><span>{totalShipping > 0 ? money(totalShipping) : "Free"}</span></div>
          <div className="summary-line total"><span>Total to pay</span><span>{money(grandTotal)}</span></div>
        </div>
      </form>
    </div>
  );
}

function OrderConfirmation({ order, form, onDone }) {
  return (
    <div className="checkout-success">
      <div className="success-icon"><Check size={32} /></div>
      <h1>Order received</h1>
      <p>Thanks, {form.fullName.split(" ")[0]}. We'll confirm your payment and get your order moving to {form.address}, {form.city}, {form.state}.</p>
      <p className="order-ref">Order reference: <code>{order.id.slice(0, 8).toUpperCase()}</code></p>
      <button className="btn btn-primary" onClick={onDone}>Continue shopping</button>
    </div>
  );
}

/* =========================================================================
   Footer
   ========================================================================= */

function Footer({ paymentAccount }) {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div>
          <span className="logo-mark footer-logo">Velorra Hub</span>
          <p className="footer-tag">Accessories, clothing, electronics, appliances and devices — sourced, shipped, sorted.</p>
        </div>
        <div><h3>Shop</h3><p>Accessories</p><p>Clothing</p><p>Electronics</p><p>Appliances</p><p>Devices</p></div>
        <div>
          <h3>Support</h3>
          <p>Track an order</p><p>Payment help</p><p>Contact us</p>
          {paymentAccount?.contactPhone && <p>Phone: {paymentAccount.contactPhone}</p>}
          {paymentAccount?.contactWhatsapp && <p>WhatsApp: {paymentAccount.contactWhatsapp}</p>}
        </div>
        <div><h3>Company</h3><p>About Velorra Hub</p><p>Careers</p><p>Terms</p><p>Privacy</p></div>
      </div>
      <div className="footer-bottom">© {new Date().getFullYear()} Velorra Hub. All rights reserved.</div>
    </footer>
  );
}

/* =========================================================================
   MAIN STORE APP
   ========================================================================= */

function StoreApp({ onGoAdmin }) {
  const { products, categories, paymentAccount, loading, loadError, reload, cart, addToCart, removeFromCart, updateCartQty, placeOrder } = useStore();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [view, setView] = useState("shop"); // shop | checkout | confirmed
  const [checkoutItem, setCheckoutItem] = useState(null); // single item checked out alone, or null for the whole cart
  const [lastOrder, setLastOrder] = useState(null);
  const [lastOrderForm, setLastOrderForm] = useState(null);

  // Debounce search input: filtering (and re-rendering the whole grid) only runs
  // once typing pauses, instead of on every keystroke — keeps low-end devices smooth.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const filtered = useMemo(() => {
    let list = products;
    if (activeCategory) list = list.filter((p) => p.category === activeCategory);
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || categories.find((c) => c.id === p.category)?.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, activeCategory, debouncedQuery, categories]);

  const cartCount = useMemo(() => cart.reduce((s, c) => s + c.qty, 0), [cart]);
  const handleSelect = useCallback((p) => { setSelectedProduct(p); window.scrollTo({ top: 0, behavior: "instant" }); }, []);

  useDocumentSEO({ view, selectedProduct, activeCategory, categories, query: debouncedQuery });

  if (loading) {
    return <FullScreenState icon={<ShoppingCart size={40} strokeWidth={1.2} />} title="Loading Velorra Hub…" message="Fetching the latest products." />;
  }
  if (loadError) {
    return (
      <FullScreenState
        icon={<AlertTriangle size={40} strokeWidth={1.2} />}
        title="Can't reach the store"
        message={`${loadError} Make sure the server is running.`}
        action={<button className="btn btn-primary" onClick={reload}>Try again</button>}
      />
    );
  }

  return (
    <div className="store-root">
      <Header
        query={query} setQuery={(v) => { setQuery(v); setSelectedProduct(null); setView("shop"); }}
        onCartClick={() => setCartOpen(true)} onMenuClick={() => setDrawerOpen(true)} cartCount={cartCount}
        onLogoClick={() => { setSelectedProduct(null); setActiveCategory(null); setQuery(""); setView("shop"); }}
      />
      <CategoryNav categories={categories} activeCategory={activeCategory} setActiveCategory={(c) => { setActiveCategory(c); setSelectedProduct(null); setView("shop"); }} onAdminClick={onGoAdmin} onCartClick={() => setCartOpen(true)} cartCount={cartCount} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} categories={categories} activeCategory={activeCategory} setActiveCategory={(c) => { setActiveCategory(c); setSelectedProduct(null); setView("shop"); }} onAdminClick={onGoAdmin} onCartClick={() => setCartOpen(true)} cartCount={cartCount} />

      <main className="site-main">
        {view === "confirmed" && lastOrder ? (
          <OrderConfirmation order={lastOrder} form={lastOrderForm} onDone={() => { setView("shop"); setLastOrder(null); }} />
        ) : view === "checkout" ? (
          <Checkout
            cart={checkoutItem ? [checkoutItem] : cart} paymentAccount={paymentAccount} onBack={() => setView("shop")} placeOrder={placeOrder}
            onOrderPlaced={(order, form) => { setLastOrder(order); setLastOrderForm(form); setCheckoutItem(null); setView("confirmed"); }}
          />
        ) : selectedProduct ? (
          <ProductDetail product={selectedProduct} onBack={() => setSelectedProduct(null)} onAddToCart={addToCart} categories={categories} />
        ) : (
          <>
            {!query && !activeCategory && <LookbookStrip products={products} onSelect={handleSelect} />}
            <ProductGrid products={filtered} onSelect={handleSelect} onAddToCart={addToCart} title={query ? `Results for "${query}"` : activeCategory ? categories.find((c) => c.id === activeCategory)?.name : "All products"} />
          </>
        )}
      </main>

      <Footer paymentAccount={paymentAccount} />

      <CartDrawer
        open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} updateCartQty={updateCartQty} removeFromCart={removeFromCart}
        onCheckout={() => { setCartOpen(false); setSelectedProduct(null); setCheckoutItem(null); setView("checkout"); }}
        onCheckoutItem={(item) => { setCartOpen(false); setSelectedProduct(null); setCheckoutItem(item); setView("checkout"); }}
      />
    </div>
  );
}

export default function VelorraStorefront({ onGoAdmin }) {
  return (
    <StoreProvider>
      <GlobalStyles />
      <StoreApp onGoAdmin={onGoAdmin} />
    </StoreProvider>
  );
}

/* =========================================================================
   GLOBAL STYLES
   ========================================================================= */

function GlobalStyles() {
  return (
    <style>{`
      :root {
        --bg: #FAF9F6; --bg-elevated: #FFFFFF; --ink: #17171A; --ink-soft: #5B5B62;
        --border: #E7E4DC; --accent: #B8862E; --accent-ink: #FFFFFF; --accent-soft: #F3E7CE;
        --danger: #C24444; --danger-soft: #F7E4E1; --ok: #3C7A5C; --ok-soft: #E1EEE6;
        --warn: #B8862E; --warn-soft: #F3E7CE;
        --radius-sm: 8px; --radius-md: 14px; --radius-lg: 20px;
        --shadow-sm: 0 1px 2px rgba(23,23,26,0.06); --shadow-md: 0 8px 24px rgba(23,23,26,0.08); --shadow-lg: 0 20px 50px rgba(23,23,26,0.16);
        color-scheme: light;
      }
      [data-theme="dark"] {
        --bg: #121214; --bg-elevated: #1B1B1E; --ink: #F3F2EE; --ink-soft: #A5A4A0;
        --border: #2B2B2F; --accent: #D9A94A; --accent-ink: #17171A; --accent-soft: #362D19;
        --danger: #E08585; --danger-soft: #3A2323; --ok: #7FC7A2; --ok-soft: #1F3128;
        --warn: #D9A94A; --warn-soft: #362D19;
        --shadow-sm: 0 1px 2px rgba(0,0,0,0.3); --shadow-md: 0 8px 24px rgba(0,0,0,0.4); --shadow-lg: 0 20px 50px rgba(0,0,0,0.55);
        color-scheme: dark;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; max-width: 100%; overflow-x: hidden; }
      body { background: var(--bg); color: var(--ink); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; transition: background 0.2s ease, color 0.2s ease; }
      button { font-family: inherit; cursor: pointer; }
      input, select, textarea { font-family: inherit; }
      img { max-width: 100%; display: block; }
      .store-root { min-height: 100vh; background: var(--bg); }
      ::selection { background: var(--accent-soft); }

      /* --- LazyImage: blur-up placeholder + graceful fallback for slow connections --- */
      .lazy-img-wrap { position: relative; display: block; width: 100%; height: 100%; overflow: hidden; background: var(--border); }
      .lazy-img-placeholder {
        position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
        background: linear-gradient(100deg, var(--border) 30%, var(--bg-elevated) 50%, var(--border) 70%);
        background-size: 200% 100%; animation: lazyShimmer 1.5s ease-in-out infinite; color: var(--ink-soft);
      }
      .lazy-img-placeholder.lazy-img-error { animation: none; background: var(--bg); }
      @keyframes lazyShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      .lazy-img { width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0.35s ease, transform 0.35s ease; display: block; }
      .lazy-img-visible { opacity: 1; }
      @media (prefers-reduced-motion: reduce) { .lazy-img-placeholder { animation: none; } .lazy-img { transition: none; } }


      .fullscreen-state { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; color: var(--ink-soft); padding: 24px; }
      .fullscreen-state h2 { color: var(--ink); margin: 6px 0 0; }
      .fullscreen-state p { max-width: 420px; line-height: 1.6; }

      .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: var(--radius-sm); border: 1px solid transparent; padding: 10px 16px; font-size: 14px; font-weight: 600; transition: transform 0.12s ease, background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease; white-space: nowrap; }
      .btn:active { transform: scale(0.97); }
      .btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .btn-primary { background: var(--ink); color: var(--bg); }
      [data-theme="dark"] .btn-primary { background: var(--accent); color: var(--accent-ink); }
      .btn-primary:hover:not(:disabled) { opacity: 0.88; }
      .btn-success { background: var(--ok) !important; color: #fff !important; }
      .btn-full { width: 100%; }
      .btn-add { width: 100%; background: var(--bg); border-color: var(--border); color: var(--ink); margin-top: 6px; padding: 7px 10px; font-size: 12.5px; }
      .btn-add:hover:not(:disabled) { background: var(--ink); color: var(--bg); border-color: var(--ink); }
      [data-theme="dark"] .btn-add:hover:not(:disabled) { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }

      .icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 50%; background: transparent; border: none; color: var(--ink); transition: background 0.15s ease; flex-shrink: 0; }
      .icon-btn:hover { background: var(--border); }

      .site-header { position: sticky; top: 0; z-index: 40; background: var(--bg-elevated); border-bottom: 1px solid var(--border); }
      .header-row { max-width: 1320px; margin: 0 auto; padding: 12px 20px; display: flex; align-items: center; gap: 14px; }
      .logo { background: none; border: none; padding: 4px 2px; }
      .logo-mark { font-weight: 800; font-size: 22px; letter-spacing: -0.03em; color: var(--ink); }
      .search-wrap { flex: 1; min-width: 0; position: relative; display: flex; align-items: center; background: var(--bg); border: 1.5px solid var(--border); border-radius: 999px; padding: 0 14px; max-width: 900px; transition: border-color 0.15s ease; }
      .header-search-row { padding: 0 20px 12px; }
      .search-wrap:focus-within { border-color: var(--accent); }
      .search-icon { color: var(--ink-soft); flex-shrink: 0; }
      .search-input { flex: 1; border: none; background: transparent; outline: none; padding: 10px 10px; font-size: 14.5px; color: var(--ink); min-width: 0; }
      .search-input::placeholder { color: var(--ink-soft); }
      .search-clear { background: none; border: none; color: var(--ink-soft); padding: 4px; display: flex; }
      .header-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
      .cart-btn { position: relative; }
      .cart-count { position: absolute; top: 2px; right: 2px; background: var(--accent); color: var(--accent-ink); font-size: 10.5px; font-weight: 700; border-radius: 999px; min-width: 17px; height: 17px; display: flex; align-items: center; justify-content: center; padding: 0 4px; line-height: 1; }
      .only-mobile { display: none; }
      .only-mobile-flex { display: none; }
      @media (max-width: 860px) { .only-mobile { display: inline-flex; } .only-desktop { display: none; } .only-desktop-flex { display: none; } .only-mobile-flex { display: flex; } }

      .category-nav { background: var(--bg-elevated); border-bottom: 1px solid var(--border); }
      .category-nav-row { max-width: 1320px; margin: 0 auto; padding: 0 20px 12px; display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
      .category-nav-row::-webkit-scrollbar { display: none; }
      @media (max-width: 860px) { .category-nav { display: none; } }
      .cat-pill { flex-shrink: 0; padding: 7px 15px; border-radius: 999px; border: 1px solid var(--border); background: transparent; color: var(--ink-soft); font-size: 13.5px; font-weight: 600; transition: all 0.15s ease; }
      .cat-pill:hover { border-color: var(--ink-soft); color: var(--ink); }
      .cat-pill.active { background: var(--ink); border-color: var(--ink); color: var(--bg); }
      [data-theme="dark"] .cat-pill.active { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
      .nav-cart-pill { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; }
      .admin-entry-pill { display: inline-flex; align-items: center; gap: 5px; color: var(--ink-soft); opacity: 0.75; }
      .admin-entry-pill:hover { opacity: 1; }

      .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 60; }
      .drawer { position: absolute; left: 0; top: 0; bottom: 0; width: 78%; max-width: 320px; background: var(--bg-elevated); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; }
      .drawer-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--border); }
      .drawer-list { padding: 8px; overflow-y: auto; flex: 1; }
      .drawer-item { display: block; width: 100%; text-align: left; padding: 13px 12px; border-radius: var(--radius-sm); background: none; border: none; color: var(--ink); font-size: 15px; font-weight: 500; }
      .drawer-item.active { background: var(--accent-soft); color: var(--accent); font-weight: 700; }
      .drawer-item:hover { background: var(--bg); }
      .drawer-foot { padding: 10px 12px; border-top: 1px solid var(--border); }
      .drawer-admin-link { display: flex; align-items: center; gap: 8px; width: 100%; padding: 12px; border-radius: var(--radius-sm); background: none; border: none; color: var(--ink-soft); font-size: 13.5px; font-weight: 600; }
      .drawer-admin-link:hover { background: var(--bg); color: var(--ink); }

      .site-main { max-width: 1320px; margin: 0 auto; padding: 24px 20px 60px; min-height: 60vh; }

      .lookbook { margin-bottom: 36px; }
      .lookbook-head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 16px; }
      .lookbook-eyebrow { display: block; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin-bottom: 4px; }
      .lookbook-title { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; margin: 0; }
      .lookbook-controls { display: flex; gap: 4px; }
      .lookbook-strip { display: flex; gap: 14px; overflow-x: auto; scroll-snap-type: x proximity; padding-bottom: 4px; scrollbar-width: none; }
      .lookbook-strip::-webkit-scrollbar { display: none; }
      .lookbook-tile { position: relative; flex-shrink: 0; width: 220px; height: 260px; border-radius: var(--radius-lg); overflow: hidden; border: none; padding: 0; scroll-snap-align: start; background: var(--border); transition: transform 0.25s cubic-bezier(.2,.8,.2,1); }
      .lookbook-tile:hover { transform: translateY(-4px); }
      .lookbook-tile img, .lookbook-tile-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease; }
      .lookbook-tile:hover img, .lookbook-tile:hover .lazy-img { transform: scale(1.06); }
      .lookbook-tile-glow { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.28) 100%); }
      @media (max-width: 640px) { .lookbook-tile { width: 150px; height: 190px; } }

      .section-title { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 16px; }

      /* --- Jumia-style vertical product cards: image on top, narrow columns --- */
      .product-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 10px;
      }
      @media (max-width: 480px) {
        .product-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      .product-card {
        background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 6px;
        overflow: hidden; display: flex; flex-direction: column; transition: box-shadow 0.2s ease, transform 0.2s ease;
      }
      .product-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
      .product-media { position: relative; display: block; border: none; padding: 0; background: var(--bg); width: 100%; aspect-ratio: 1 / 1; overflow: hidden; }
      .product-media img, .product-media-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.35s ease; }
      .product-media:hover img, .product-media:hover .lazy-img { transform: scale(1.05); }
      .stock-overlay { position: absolute; inset: 0; background: rgba(23,23,26,0.55); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 10.5px; letter-spacing: 0.02em; text-align: center; padding: 4px; }
      .stock-overlay.large { font-size: 16px; border-radius: var(--radius-lg); }
      .badge { position: absolute; top: 6px; left: 6px; padding: 3px 7px; border-radius: 999px; font-size: 9.5px; font-weight: 700; letter-spacing: 0.02em; }
      .badge-sale { background: var(--danger); color: #fff; }
      .badge-new { background: var(--ink); color: var(--bg); }
      .badge-ok { background: var(--ok-soft); color: var(--ok); }
      .badge-warn { background: var(--warn-soft); color: var(--warn); }
      .product-body { padding: 8px; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .product-name { text-align: left; background: none; border: none; padding: 0; font-size: 12px; font-weight: 500; color: var(--ink); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.6em; }
      .product-name:hover { color: var(--accent); }
      .stars { display: inline-flex; align-items: center; gap: 2px; }
      .stars-count { color: var(--ink-soft); font-size: 10.5px; margin-left: 2px; }
      .product-price-row { display: flex; align-items: baseline; gap: 6px; margin-top: 2px; flex-wrap: wrap; }
      .price { font-weight: 700; font-size: 13px; }
      .price-lg { font-size: 22px; }
      .price-compare { text-decoration: line-through; color: var(--ink-soft); font-size: 11px; }

      @media (max-width: 640px) {
        .product-body { padding: 6px; }
        .product-name { font-size: 11.5px; }
      }

      .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 70px 20px; color: var(--ink-soft); text-align: center; }

      .back-link { display: inline-flex; align-items: center; gap: 6px; background: none; border: none; color: var(--ink-soft); font-size: 13.5px; font-weight: 600; padding: 8px 0; margin-bottom: 10px; }
      .back-link:hover { color: var(--ink); }
      .pdp-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 44px; }
      @media (max-width: 860px) { .pdp-grid { grid-template-columns: 1fr; gap: 24px; } }
      .pdp-main-img { position: relative; border-radius: var(--radius-lg); overflow: hidden; background: var(--bg-elevated); border: 1px solid var(--border); aspect-ratio: 1/1; }
      .pdp-main-img img, .pdp-main-img-inner { width: 100%; height: 100%; object-fit: cover; }
      .pdp-thumbs { display: flex; gap: 8px; margin-top: 10px; }
      .pdp-thumb { width: 64px; height: 64px; border-radius: var(--radius-sm); overflow: hidden; border: 1.5px solid var(--border); padding: 0; background: none; }
      .pdp-thumb.active { border-color: var(--accent); }
      .pdp-thumb img, .pdp-thumb-img { width: 100%; height: 100%; object-fit: cover; }
      .pdp-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }
      .pdp-title { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; margin: 6px 0 8px; line-height: 1.2; }
      .pdp-price-row { display: flex; align-items: center; gap: 10px; margin: 14px 0; flex-wrap: wrap; }
      .pdp-desc { color: var(--ink-soft); line-height: 1.6; font-size: 14.5px; margin-bottom: 20px; }
      .option-group { margin-bottom: 18px; }
      .option-label { display: block; font-size: 13.5px; font-weight: 600; margin-bottom: 8px; color: var(--ink-soft); }
      .option-label strong { color: var(--ink); }
      .option-row { display: flex; gap: 8px; flex-wrap: wrap; }
      .chip { padding: 8px 14px; border-radius: var(--radius-sm); border: 1.5px solid var(--border); background: var(--bg-elevated); font-size: 13.5px; font-weight: 600; color: var(--ink); }
      .chip.active { border-color: var(--ink); background: var(--ink); color: var(--bg); }
      [data-theme="dark"] .chip.active { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
      .qty-stepper { display: inline-flex; align-items: center; border: 1.5px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
      .qty-stepper button { width: 36px; height: 36px; background: none; border: none; display: flex; align-items: center; justify-content: center; color: var(--ink); }
      .qty-stepper button:hover { background: var(--bg); }
      .qty-stepper span { min-width: 32px; text-align: center; font-weight: 700; font-size: 14px; }
      .qty-stepper.small button { width: 26px; height: 26px; }
      .qty-stepper.small span { min-width: 22px; font-size: 12.5px; }
      .low-stock { display: block; margin-top: 6px; color: var(--danger); font-size: 12.5px; font-weight: 600; }
      .pdp-trust { display: flex; flex-direction: column; gap: 8px; margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--border); }
      .pdp-trust div { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink-soft); }

      .cart-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0); pointer-events: none; z-index: 70; transition: background 0.2s ease; }
      .cart-overlay.open { background: rgba(0,0,0,0.4); pointer-events: auto; }
      .cart-drawer { position: absolute; right: 0; top: 0; bottom: 0; width: 420px; max-width: 92vw; background: var(--bg-elevated); display: flex; flex-direction: column; transform: translateX(100%); transition: transform 0.25s cubic-bezier(.2,.8,.2,1); box-shadow: var(--shadow-lg); }
      .cart-overlay.open .cart-drawer { transform: translateX(0); }
      .cart-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid var(--border); }
      .cart-head h2 { margin: 0; font-size: 18px; }
      .cart-items { flex: 1; overflow-y: auto; padding: 10px 16px; }
      .cart-item { display: flex; gap: 12px; padding: 12px 4px; border-bottom: 1px solid var(--border); }
      .cart-item img, .cart-item-img { width: 68px; height: 68px; object-fit: cover; border-radius: var(--radius-sm); flex-shrink: 0; background: var(--bg); }
      .cart-item-info { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .cart-item-name { font-size: 13.5px; font-weight: 600; }
      .cart-item-variant { font-size: 12px; color: var(--ink-soft); }
      .cart-remove { flex-shrink: 0; align-self: flex-start; color: var(--ink-soft); }
      .cart-item-checkout { margin-top: 4px; align-self: flex-start; padding: 5px 10px; font-size: 11.5px; }
      .cart-remove:hover { color: var(--danger); }
      .cart-foot { padding: 16px 20px 20px; border-top: 1px solid var(--border); }
      .cart-subtotal { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; font-weight: 600; }
      .cart-shipping-row { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--ink-soft); margin-bottom: 8px; }
      .shipping-line { font-size: 11.5px; color: var(--ink-soft); font-weight: 600; margin: 2px 0 0; }
      .shipping-line:empty { display: none; }
      .free-shipping-tag { display: inline-block; font-size: 10.5px; font-weight: 700; color: var(--ok); margin-top: 2px; }

      .checkout-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 40px; min-width: 0; }
      @media (max-width: 860px) { .checkout-grid { grid-template-columns: 1fr; } }
      .checkout-form { display: flex; flex-direction: column; gap: 14px; max-width: 480px; min-width: 0; }
      .checkout-form h1 { font-size: 24px; margin-bottom: 0; }
      .checkout-subhead { font-size: 15px; margin: 10px 0 -2px; padding-top: 12px; border-top: 1px solid var(--border); }
      .checkout-form label, .checkout-summary label { display: flex; flex-direction: column; gap: 6px; font-size: 13.5px; font-weight: 600; color: var(--ink-soft); }
      .checkout-form input { padding: 11px 13px; border-radius: var(--radius-sm); border: 1.5px solid var(--border); background: var(--bg-elevated); color: var(--ink); font-size: 14px; }
      .checkout-form input:focus { outline: none; border-color: var(--accent); }
      .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .checkout-summary { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 20px; height: fit-content; min-width: 0; }
      .checkout-summary h2 { margin-top: 0; font-size: 16px; }
      .summary-line { display: flex; justify-content: space-between; gap: 10px; font-size: 13.5px; padding: 6px 0; color: var(--ink-soft); min-width: 0; }
      .summary-line span { min-width: 0; overflow-wrap: break-word; }
      .summary-line.total { border-top: 1px solid var(--border); margin-top: 8px; padding-top: 12px; font-weight: 800; font-size: 16px; color: var(--ink); }
      .checkout-success { text-align: center; max-width: 440px; margin: 60px auto; display: flex; flex-direction: column; align-items: center; gap: 12px; }
      .success-icon { width: 56px; height: 56px; border-radius: 50%; background: var(--ok-soft); color: var(--ok); display: flex; align-items: center; justify-content: center; }
      .checkout-success h1 { margin: 0; }
      .checkout-success p { color: var(--ink-soft); line-height: 1.6; }
      .order-ref { font-size: 13px; }
      .order-ref code { background: var(--bg-elevated); border: 1px solid var(--border); padding: 3px 8px; border-radius: 6px; }

      .pay-account-card { background: var(--accent-soft); border: 1px solid var(--accent); border-radius: var(--radius-md); padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
      .pay-account-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 0; }
      .pay-label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft); font-weight: 700; }
      .pay-value { display: block; font-size: 15px; font-weight: 700; color: var(--ink); font-family: ui-monospace, "SF Mono", monospace; word-break: break-word; }
      .pay-note { display: flex; align-items: flex-start; gap: 6px; font-size: 12px; color: var(--ink-soft); margin: 4px 0 0; min-width: 0; }
      .pay-note > svg { flex-shrink: 0; margin-top: 2px; }
      .file-drop input[type="file"] { position: absolute; width: 1px; height: 1px; opacity: 0; }
      .file-drop-label { display: flex; align-items: center; gap: 8px; padding: 12px; border: 1.5px dashed var(--border); border-radius: var(--radius-sm); font-size: 13px; color: var(--ink-soft); cursor: pointer; font-weight: 600; }
      .file-drop-label:hover { border-color: var(--accent); color: var(--ink); }
      .receipt-preview { margin-top: 8px; max-width: 160px; border-radius: var(--radius-sm); border: 1px solid var(--border); }
      .checkout-error { display: flex; align-items: center; gap: 7px; background: var(--danger-soft); color: var(--danger); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; }

      .site-footer { border-top: 1px solid var(--border); margin-top: 40px; background: var(--bg-elevated); }
      .footer-grid { max-width: 1320px; margin: 0 auto; padding: 44px 20px 24px; display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 28px; }
      @media (max-width: 640px) { .footer-grid { grid-template-columns: 1fr 1fr; } }
      .footer-logo { display: block; margin-bottom: 10px; }
      .footer-tag { color: var(--ink-soft); font-size: 13px; line-height: 1.6; max-width: 260px; }
      .footer-grid h3 { font-size: 13px; margin-bottom: 10px; }
      .footer-grid p { font-size: 13px; color: var(--ink-soft); margin: 7px 0; }
      .footer-bottom { text-align: center; padding: 16px; font-size: 12px; color: var(--ink-soft); border-top: 1px solid var(--border); }
    `}</style>
  );
}
