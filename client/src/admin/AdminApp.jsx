import React, { useState, useEffect, useMemo, useCallback, createContext, useContext } from "react";
import { Search, Plus, Minus, Trash2, LogOut, Package, Tag, LayoutGrid, Settings, Lock, User, Check, AlertTriangle, ArrowLeft, Upload, Image as ImageIcon, Save, Edit3, X, Landmark, Clock, MapPin, Banknote, CheckCircle2, History, ExternalLink } from "lucide-react";

/* =========================================================================
   Point this at your deployed backend. See velorra-hub-backend/README.md.
   This file is entirely separate from the storefront — it is never shipped
   to customers and has no link from the public site.
   ========================================================================= */
/* =========================================================================
   Since the backend now serves this app's built files directly, API calls
   use a relative path — no separate domain or CORS setup needed.
   ========================================================================= */
const API_BASE = "/api";

/* =========================================================================
   API helpers
   ========================================================================= */

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiRequest(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

/* =========================================================================
   Admin Context
   ========================================================================= */

const AdminCtx = createContext(null);
const useAdmin = () => useContext(AdminCtx);

function AdminProvider({ children }) {
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState(null);
  const [authError, setAuthError] = useState(null);

  const login = useCallback(async (u, p) => {
    setAuthError(null);
    try {
      const data = await apiRequest("/admin/login", { method: "POST", body: { username: u, password: p } });
      setToken(data.token);
      setUsername(data.username);
      return true;
    } catch (e) {
      setAuthError(e.message);
      return false;
    }
  }, []);

  const logout = useCallback(() => { setToken(null); setUsername(null); }, []);

  const call = useCallback((path, opts = {}) => apiRequest(path, { ...opts, token }), [token]);

  const value = { token, username, authError, login, logout, call, authed: !!token };
  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>;
}

/* =========================================================================
   Shared bits
   ========================================================================= */

function money(n) { return `₦${Number(n).toLocaleString("en-NG")}`; }

function Badge({ children, tone = "default" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/* =========================================================================
   Login screen
   ========================================================================= */

function AdminLogin({ onExit }) {
  const { login, authError } = useAdmin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await login(username, password);
    setSubmitting(false);
  };

  return (
    <div className="admin-login-root">
      <form className="admin-login-card" onSubmit={submit}>
        <span className="logo-mark">Velorra Hub</span>
        <h1>Admin panel</h1>
        <p className="admin-login-sub">Sign in to manage products, categories, payment details and orders.</p>
        {authError && <div className="admin-error"><AlertTriangle size={15} /> {authError}</div>}
        <label>Username
          <div className="input-icon-wrap"><User size={15} /><input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="admin" /></div>
        </label>
        <label>Password
          <div className="input-icon-wrap"><Lock size={15} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" /></div>
        </label>
        <button className="btn btn-primary btn-full" type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</button>
        <button type="button" className="admin-back-link" onClick={onExit}><ArrowLeft size={14} /> Back to store</button>
        <p className="admin-hint">This panel talks to the same server the storefront runs on.</p>
      </form>
      <p className="admin-warning">Warning ⚠️: This section is meant for only admins not regular users</p>
    </div>
  );
}

/* =========================================================================
   Shell / nav
   ========================================================================= */

function AdminShell({ children, section, setSection, onLogout, onExit, pendingCount }) {
  const sections = [
    { id: "orders", label: "Pending orders", icon: Package, count: pendingCount },
    { id: "history", label: "Order history", icon: History },
    { id: "products", label: "Products", icon: Tag },
    { id: "categories", label: "Categories", icon: LayoutGrid },
    { id: "payment", label: "Payment account", icon: Landmark },
    { id: "settings", label: "Account", icon: Settings },
  ];
  return (
    <div className="admin-root-topnav">
      <header className="admin-topnav">
        <div className="admin-topnav-row">
          <span className="logo-mark">Velorra Hub<span className="admin-tag"> Admin</span></span>
          <nav className="admin-topnav-links">
            {sections.map((s) => (
              <button key={s.id} className={`admin-nav-item ${section === s.id ? "active" : ""}`} onClick={() => setSection(s.id)}>
                <s.icon size={16} /> {s.label}
                {!!s.count && <span className="nav-count">{s.count}</span>}
              </button>
            ))}
            <button className="admin-nav-item" onClick={onExit}><ArrowLeft size={16} /> Back to store</button>
            <button className="admin-nav-item danger" onClick={onLogout}><LogOut size={16} /> Log out</button>
          </nav>
        </div>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}

/* =========================================================================
   Orders — pending + history, formatted exactly as requested
   ========================================================================= */

function OrderCard({ order, onFulfill, onUnfulfill, showUnfulfill }) {
  return (
    <div className="order-card">
      <div className="order-card-head">
        <div>
          <span className="order-id">Order #{order.id.slice(0, 8).toUpperCase()}</span>
          <span className="order-time"><Clock size={12} /> {order.createdAtLagos}</span>
        </div>
        {order.status === "pending" ? (
          <button className="btn btn-primary small" onClick={() => onFulfill(order.id)}><CheckCircle2 size={14} /> Mark fulfilled</button>
        ) : (
          <div className="order-fulfilled-tag">
            <Badge tone="ok">Fulfilled {order.fulfilledAtLagos}</Badge>
            {showUnfulfill && <button className="btn btn-ghost small" onClick={() => onUnfulfill(order.id)}>Move back to pending</button>}
          </div>
        )}
      </div>

      <div className="order-items">
        {order.items.map((item) => (
          <div className="order-item" key={item.id}>
            {item.image ? <img src={item.image} alt="" /> : <div className="order-item-noimg"><ImageIcon size={16} /></div>}
            <div className="order-item-info">
              <span className="order-item-name">{item.name}</span>
              <div className="order-item-meta">
                <span>{money(item.price)}</span>
                {item.color && <span>· {item.color}</span>}
                {item.size && <span>· {item.size}</span>}
                <span>· Qty {item.quantity}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="order-details-grid">
        <div>
          <span className="order-detail-label"><MapPin size={12} /> Delivery address</span>
          <span className="order-detail-value">{order.customer.fullName}</span>
          <span className="order-detail-value">{order.address}, {order.city}, {order.state}, {order.country}</span>
          {order.customer.phone && <span className="order-detail-value">{order.customer.phone}</span>}
          {order.customer.email && <span className="order-detail-value">{order.customer.email}</span>}
        </div>
        <div>
          <span className="order-detail-label"><Banknote size={12} /> Amount paid</span>
          <span className="order-amount">{money(order.amountPaid)}</span>
          {order.proofOfPayment ? (
            <a className="receipt-link" href={order.proofOfPayment} target="_blank" rel="noreferrer">
              <ExternalLink size={12} /> View proof of payment
            </a>
          ) : (
            <span className="order-detail-value muted">No receipt uploaded</span>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminOrders({ pendingOrders, loading, error, onFulfill, reload }) {
  return (
    <div>
      <div className="admin-page-head">
        <h1>Pending orders</h1>
        <button className="btn btn-ghost small" onClick={reload}>Refresh</button>
      </div>
      {error && <div className="admin-error" style={{ marginBottom: 16 }}><AlertTriangle size={15} /> {error}</div>}
      {loading ? (
        <p className="admin-note">Loading orders…</p>
      ) : pendingOrders.length === 0 ? (
        <div className="admin-empty"><Package size={30} strokeWidth={1.3} /><p>No pending orders right now.</p></div>
      ) : (
        <div className="order-list">
          {pendingOrders.map((o) => <OrderCard key={o.id} order={o} onFulfill={onFulfill} />)}
        </div>
      )}
    </div>
  );
}

function AdminHistory({ fulfilledOrders, loading, error, onUnfulfill, reload }) {
  return (
    <div>
      <div className="admin-page-head">
        <h1>Order history</h1>
        <button className="btn btn-ghost small" onClick={reload}>Refresh</button>
      </div>
      {error && <div className="admin-error" style={{ marginBottom: 16 }}><AlertTriangle size={15} /> {error}</div>}
      {loading ? (
        <p className="admin-note">Loading orders…</p>
      ) : fulfilledOrders.length === 0 ? (
        <div className="admin-empty"><History size={30} strokeWidth={1.3} /><p>No fulfilled orders yet.</p></div>
      ) : (
        <div className="order-list">
          {fulfilledOrders.map((o) => <OrderCard key={o.id} order={o} showUnfulfill onUnfulfill={onUnfulfill} />)}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   Products management
   ========================================================================= */

function emptyProduct(categories) {
  return { id: null, name: "", category: categories[0]?.id || "", price: 0, compareAt: null, stock: 0, sku: "", colors: [], sizes: [], images: [], description: "", featured: false, tags: [], rating: 0, reviews: 0, shippingFee: 0, freeShipping: false };
}

function ProductForm({ product, categories, onSave, onCancel, onDelete }) {
  const [form, setForm] = useState(product);
  const [colorInput, setColorInput] = useState("");
  const [sizeInput, setSizeInput] = useState("");
  const [imageInput, setImageInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const addTag = (tag) => (v) => set("tags", v ? Array.from(new Set([...(form.tags || []), tag])) : (form.tags || []).filter((t) => t !== tag));

  // Converts a photo picked from the phone's gallery/camera into a compressed
  // data URL so it can be stored and displayed like any other image — no
  // separate image hosting service needed. Resizing/compressing here (rather
  // than storing the original multi-megabyte phone photo) keeps uploads
  // reliable on slow connections and keeps the storefront fast for shoppers.
  const compressImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1600;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingImage(true);
    Promise.allSettled(files.map(compressImage)).then((results) => {
      const newImages = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
      if (newImages.length) {
        setForm((f) => ({ ...f, images: [...(f.images || []), ...newImages] }));
      }
      setUploadingImage(false);
    });
    e.target.value = ""; // allow choosing the same file again later
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...form, price: Number(form.price) || 0, compareAt: form.compareAt ? Number(form.compareAt) : null, stock: Number(form.stock) || 0 });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="admin-panel-card" onSubmit={submit}>
      <div className="admin-form-head">
        <h2>{product.id ? "Edit product" : "New product"}</h2>
        {product.id && <button type="button" className="btn btn-danger-ghost" onClick={() => onDelete(form.id)}><Trash2 size={14} /> Delete</button>}
      </div>
      {error && <div className="admin-error" style={{ marginBottom: 14 }}><AlertTriangle size={15} /> {error}</div>}

      <div className="admin-form-grid">
        <label className="span-2">Product name<input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Aria Wireless Headphones" required /></label>
        <label>Category
          <select value={form.category} onChange={(e) => set("category", e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>SKU<input value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="VH-000" /></label>
        <label>Price (USD)<input type="number" min="0" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} required /></label>
        <label>Compare-at price <span className="label-hint">(optional)</span><input type="number" min="0" step="0.01" value={form.compareAt ?? ""} onChange={(e) => set("compareAt", e.target.value === "" ? null : e.target.value)} /></label>
        <label>Stock quantity<input type="number" min="0" step="1" value={form.stock} onChange={(e) => set("stock", e.target.value)} required /></label>
        <label className="checkbox-label"><input type="checkbox" checked={form.featured} onChange={(e) => set("featured", e.target.checked)} /> Feature in lookbook strip</label>
        <label className="checkbox-label"><input type="checkbox" checked={form.freeShipping} onChange={(e) => set("freeShipping", e.target.checked)} /> Free shipping for this product</label>
        {!form.freeShipping && (
          <label>Shipping fee <span className="label-hint">(added at checkout)</span><input type="number" min="0" step="0.01" value={form.shippingFee} onChange={(e) => set("shippingFee", e.target.value)} /></label>
        )}
        <label className="span-2">Description<textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe the product…" /></label>

        <div className="span-2 tag-toggle-row">
          <span className="option-label">Tags</span>
          <label className="checkbox-label inline"><input type="checkbox" checked={form.tags?.includes("new")} onChange={(e) => addTag("new")(e.target.checked)} /> New</label>
          <label className="checkbox-label inline"><input type="checkbox" checked={form.tags?.includes("bestseller")} onChange={(e) => addTag("bestseller")(e.target.checked)} /> Bestseller</label>
        </div>

        <div className="span-2">
          <span className="option-label">Colours <span className="label-hint">(if applicable)</span></span>
          <div className="tag-input-row">
            <input value={colorInput} onChange={(e) => setColorInput(e.target.value)} placeholder="e.g. Black" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (colorInput.trim()) { set("colors", [...(form.colors || []), colorInput.trim()]); setColorInput(""); } } }} />
            <button type="button" className="btn btn-ghost" onClick={() => { if (colorInput.trim()) { set("colors", [...(form.colors || []), colorInput.trim()]); setColorInput(""); } }}>Add</button>
          </div>
          <div className="chip-list">{(form.colors || []).map((c, i) => <span className="chip removable" key={i}>{c} <button type="button" onClick={() => set("colors", form.colors.filter((_, idx) => idx !== i))}><X size={12} /></button></span>)}</div>
        </div>

        <div className="span-2">
          <span className="option-label">Sizes <span className="label-hint">(if applicable)</span></span>
          <div className="tag-input-row">
            <input value={sizeInput} onChange={(e) => setSizeInput(e.target.value)} placeholder="e.g. M" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (sizeInput.trim()) { set("sizes", [...(form.sizes || []), sizeInput.trim()]); setSizeInput(""); } } }} />
            <button type="button" className="btn btn-ghost" onClick={() => { if (sizeInput.trim()) { set("sizes", [...(form.sizes || []), sizeInput.trim()]); setSizeInput(""); } }}>Add</button>
          </div>
          <div className="chip-list">{(form.sizes || []).map((s, i) => <span className="chip removable" key={i}>{s} <button type="button" onClick={() => set("sizes", form.sizes.filter((_, idx) => idx !== i))}><X size={12} /></button></span>)}</div>
        </div>

        <div className="span-2">
          <span className="option-label">Product photos</span>

          <div className="file-drop">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              id="product-image-upload"
            />
            <label htmlFor="product-image-upload" className="file-drop-label">
              <Upload size={16} /> {uploadingImage ? "Adding photo…" : "Upload photos from your phone (gallery or camera)"}
            </label>
          </div>

          <div className="option-divider"><span>or add an image already online</span></div>

          <div className="tag-input-row">
            <input value={imageInput} onChange={(e) => setImageInput(e.target.value)} placeholder="https://…" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (imageInput.trim()) { set("images", [...(form.images || []), imageInput.trim()]); setImageInput(""); } } }} />
            <button type="button" className="btn btn-ghost" onClick={() => { if (imageInput.trim()) { set("images", [...(form.images || []), imageInput.trim()]); setImageInput(""); } }}>Add link</button>
          </div>

          <div className="image-thumb-row">
            {(form.images || []).length === 0 && <div className="image-thumb-empty"><ImageIcon size={18} /></div>}
            {(form.images || []).map((im, i) => <div className="image-thumb" key={i}><img src={im} alt="" /><button type="button" onClick={() => set("images", form.images.filter((_, idx) => idx !== i))}><X size={12} /></button></div>)}
          </div>
        </div>
      </div>

      <div className="admin-form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}><Save size={14} /> {saving ? "Saving…" : "Save product"}</button>
      </div>
    </form>
  );
}

function AdminProducts({ products, categories, loading, error, onCreate, onUpdate, onDelete, reload }) {
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  const filtered = useMemo(() => {
    let list = products;
    if (catFilter !== "all") list = list.filter((p) => p.category === catFilter);
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q)); }
    return list;
  }, [products, search, catFilter]);

  const handleSave = async (product) => {
    if (product.id) await onUpdate(product);
    else await onCreate(product);
    setEditing(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this product? This can't be undone.")) return;
    await onDelete(id);
    setEditing(null);
  };

  const handleQuickDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    await onDelete(id);
  };

  if (editing) return <ProductForm product={editing} categories={categories} onSave={handleSave} onCancel={() => setEditing(null)} onDelete={handleDelete} />;

  return (
    <div>
      <div className="admin-page-head">
        <h1>Products</h1>
        <button className="btn btn-primary" onClick={() => setEditing(emptyProduct(categories))}><Plus size={15} /> New product</button>
      </div>
      {error && <div className="admin-error" style={{ marginBottom: 16 }}><AlertTriangle size={15} /> {error}</div>}
      <div className="admin-toolbar">
        <div className="input-icon-wrap flex1"><Search size={15} /><input placeholder="Search by name or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th></th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th colSpan={2}></th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="admin-table-empty">Loading…</td></tr>
            ) : filtered.map((p) => {
              const cat = categories.find((c) => c.id === p.category);
              return (
                <tr key={p.id}>
                  <td><img className="table-thumb" src={p.images[0] || ""} alt="" /></td>
                  <td><div className="table-product-name">{p.name}</div><div className="table-sku">{p.sku}</div></td>
                  <td>{cat?.name || "—"}</td>
                  <td className="mono">{money(p.price)}</td>
                  <td className="mono">{p.stock}</td>
                  <td>{p.stock <= 0 ? <Badge tone="sale">Out of stock</Badge> : p.stock <= 5 ? <Badge tone="warn">Low stock</Badge> : <Badge tone="ok">In stock</Badge>}</td>
                  <td><button className="btn btn-ghost small" onClick={() => setEditing(p)}><Edit3 size={13} /> Edit</button></td>
                  <td><button className="btn btn-danger-ghost small" onClick={() => handleQuickDelete(p.id, p.name)}><Trash2 size={13} /> Delete</button></td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && <tr><td colSpan={8} className="admin-table-empty">No products found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================================
   Categories management
   ========================================================================= */

function AdminCategories({ categories, products, loading, onCreate, onDelete }) {
  const [name, setName] = useState("");
  const [error, setError] = useState(null);

  const addCategory = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try { await onCreate(name.trim()); setName(""); } catch (e) { setError(e.message); }
  };

  const removeCategory = async (id) => {
    const inUse = products.some((p) => p.category === id);
    if (inUse) { window.alert("This category has products assigned to it. Reassign or delete those products first."); return; }
    if (!window.confirm("Delete this category?")) return;
    try { await onDelete(id); } catch (e) { window.alert(e.message); }
  };

  return (
    <div>
      <div className="admin-page-head"><h1>Categories</h1></div>
      <form className="admin-panel-card inline-form" onSubmit={addCategory}>
        <label className="flex1">New category name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Home & Garden" /></label>
        <button className="btn btn-primary" type="submit"><Plus size={15} /> Add category</button>
      </form>
      {error && <div className="admin-error" style={{ marginBottom: 16 }}><AlertTriangle size={15} /> {error}</div>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Category</th><th>Products</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={3} className="admin-table-empty">Loading…</td></tr> : categories.map((c) => (
              <tr key={c.id}><td>{c.name}</td><td className="mono">{products.filter((p) => p.category === c.id).length}</td><td><button className="btn btn-danger-ghost small" onClick={() => removeCategory(c.id)}><Trash2 size={13} /> Delete</button></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================================
   Payment account management
   ========================================================================= */

function AdminPaymentAccount({ paymentAccount, loading, onSave }) {
  const [form, setForm] = useState({ accountNumber: "", accountName: "", bank: "", contactPhone: "", contactWhatsapp: "" });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (paymentAccount) setForm(paymentAccount); }, [paymentAccount]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await onSave(form);
      setMsg({ type: "ok", text: "Details updated. Customers will see this on checkout." });
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="admin-page-head"><h1>Payment account</h1></div>
      <p className="admin-note" style={{ marginBottom: 18 }}>These are the bank details and contact numbers shown to customers at checkout.</p>
      <form className="admin-panel-card" onSubmit={submit} style={{ maxWidth: 460 }}>
        {msg && <div className={msg.type === "error" ? "admin-error" : "admin-success"} style={{ marginBottom: 14 }}>{msg.type === "error" ? <AlertTriangle size={15} /> : <Check size={15} />} {msg.text}</div>}
        {loading ? <p className="admin-note">Loading…</p> : (
          <>
            <label>Account number<input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} placeholder="0123456789" /></label>
            <label>Account name<input value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} placeholder="Velorra Hub Trading Ltd" /></label>
            <label>Bank<input value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} placeholder="First Bank of Nigeria" /></label>
            <label>Contact phone number <span className="label-hint">(for customers to reach you)</span><input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder="+234…" /></label>
            <label>Contact WhatsApp number<input value={form.contactWhatsapp} onChange={(e) => setForm({ ...form, contactWhatsapp: e.target.value })} placeholder="+234…" /></label>
            <button className="btn btn-primary btn-full" type="submit" disabled={saving}><Save size={14} /> {saving ? "Saving…" : "Save details"}</button>
          </>
        )}
      </form>
    </div>
  );
}

/* =========================================================================
   Account settings
   ========================================================================= */

function AdminSettings({ username, onSave }) {
  const [form, setForm] = useState({ username: username || "", currentPassword: "", newPassword: "", confirmPassword: "" });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (form.newPassword && form.newPassword !== form.confirmPassword) { setMsg({ type: "error", text: "New passwords do not match." }); return; }
    setSaving(true);
    try {
      await onSave({ username: form.username, currentPassword: form.currentPassword, newPassword: form.newPassword || undefined });
      setForm((f) => ({ ...f, currentPassword: "", newPassword: "", confirmPassword: "" }));
      setMsg({ type: "ok", text: "Account details updated." });
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="admin-page-head"><h1>Account</h1></div>
      <form className="admin-panel-card" onSubmit={submit} style={{ maxWidth: 460 }}>
        <h2 style={{ marginTop: 0 }}>Login details</h2>
        {msg && <div className={msg.type === "error" ? "admin-error" : "admin-success"}>{msg.type === "error" ? <AlertTriangle size={15} /> : <Check size={15} />} {msg.text}</div>}
        <label>Username<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
        <label>Current password<input type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} required /></label>
        <label>New password <span className="label-hint">(leave blank to keep current)</span><input type="password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></label>
        <label>Confirm new password<input type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} /></label>
        <button className="btn btn-primary btn-full" type="submit" disabled={saving}><Save size={14} /> {saving ? "Saving…" : "Save changes"}</button>
      </form>
    </div>
  );
}

/* =========================================================================
   Root admin app
   ========================================================================= */

function AdminDashboard({ onExit }) {
  const { username, logout, call } = useAdmin();
  const [section, setSection] = useState("orders");

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState(null);

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);

  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [paymentAccount, setPaymentAccount] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError(null);
    try { setOrders(await call("/admin/orders")); } catch (e) { setOrdersError(e.message); } finally { setOrdersLoading(false); }
  }, [call]);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError(null);
    try { setProducts(await call("/products")); } catch (e) { setProductsError(e.message); } finally { setProductsLoading(false); }
  }, [call]);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try { setCategories(await call("/categories")); } finally { setCategoriesLoading(false); }
  }, [call]);

  const loadPaymentAccount = useCallback(async () => {
    setPaymentLoading(true);
    try { setPaymentAccount(await call("/payment-account")); } finally { setPaymentLoading(false); }
  }, [call]);

  useEffect(() => { loadOrders(); loadProducts(); loadCategories(); loadPaymentAccount(); }, [loadOrders, loadProducts, loadCategories, loadPaymentAccount]);

  const pendingOrders = useMemo(() => orders.filter((o) => o.status === "pending"), [orders]);
  const fulfilledOrders = useMemo(() => orders.filter((o) => o.status === "fulfilled"), [orders]);

  const handleFulfill = async (id) => {
    await call(`/admin/orders/${id}/fulfill`, { method: "PUT" });
    loadOrders();
  };
  const handleUnfulfill = async (id) => {
    await call(`/admin/orders/${id}/unfulfill`, { method: "PUT" });
    loadOrders();
  };

  const handleCreateProduct = async (p) => { await call("/admin/products", { method: "POST", body: p }); await loadProducts(); };
  const handleUpdateProduct = async (p) => { await call(`/admin/products/${p.id}`, { method: "PUT", body: p }); await loadProducts(); };
  const handleDeleteProduct = async (id) => { await call(`/admin/products/${id}`, { method: "DELETE" }); await loadProducts(); };

  const handleCreateCategory = async (name) => { await call("/admin/categories", { method: "POST", body: { name } }); await loadCategories(); };
  const handleDeleteCategory = async (id) => { await call(`/admin/categories/${id}`, { method: "DELETE" }); await loadCategories(); };

  const handleSavePaymentAccount = async (form) => { await call("/admin/payment-account", { method: "PUT", body: form }); await loadPaymentAccount(); };
  const handleSaveAccount = async (form) => { await call("/admin/account", { method: "PUT", body: form }); };

  return (
    <AdminShell section={section} setSection={setSection} onLogout={logout} onExit={onExit} pendingCount={pendingOrders.length}>
      {section === "orders" && <AdminOrders pendingOrders={pendingOrders} loading={ordersLoading} error={ordersError} onFulfill={handleFulfill} reload={loadOrders} />}
      {section === "history" && <AdminHistory fulfilledOrders={fulfilledOrders} loading={ordersLoading} error={ordersError} onUnfulfill={handleUnfulfill} reload={loadOrders} />}
      {section === "products" && <AdminProducts products={products} categories={categories} loading={productsLoading} error={productsError} onCreate={handleCreateProduct} onUpdate={handleUpdateProduct} onDelete={handleDeleteProduct} reload={loadProducts} />}
      {section === "categories" && <AdminCategories categories={categories} products={products} loading={categoriesLoading} onCreate={handleCreateCategory} onDelete={handleDeleteCategory} />}
      {section === "payment" && <AdminPaymentAccount paymentAccount={paymentAccount} loading={paymentLoading} onSave={handleSavePaymentAccount} />}
      {section === "settings" && <AdminSettings username={username} onSave={handleSaveAccount} />}
    </AdminShell>
  );
}

export default function VelorraAdmin({ onExit }) {
  return (
    <AdminProvider>
      <GlobalStyles />
      <AdminGate onExit={onExit} />
    </AdminProvider>
  );
}

function AdminGate({ onExit }) {
  const { authed } = useAdmin();
  return authed ? <AdminDashboard onExit={onExit} /> : <AdminLogin onExit={onExit} />;
}

/* =========================================================================
   GLOBAL STYLES — deliberately utilitarian, distinct from the storefront
   ========================================================================= */

function GlobalStyles() {
  return (
    <style>{`
      :root {
        --bg: #F5F5F3; --bg-elevated: #FFFFFF; --ink: #17171A; --ink-soft: #5B5B62;
        --border: #E2E1DC; --accent: #B8862E; --accent-ink: #FFFFFF; --accent-soft: #F3E7CE;
        --danger: #C24444; --danger-soft: #F7E4E1; --ok: #3C7A5C; --ok-soft: #E1EEE6; --warn: #B8862E; --warn-soft: #F3E7CE;
        --radius-sm: 8px; --radius-md: 14px; --radius-lg: 20px;
        --shadow-sm: 0 1px 2px rgba(23,23,26,0.06); --shadow-md: 0 8px 24px rgba(23,23,26,0.08); --shadow-lg: 0 20px 50px rgba(23,23,26,0.16);
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body { background: var(--bg); color: var(--ink); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
      button { font-family: inherit; cursor: pointer; }
      input, select, textarea { font-family: inherit; }
      img { max-width: 100%; display: block; }
      .admin-root-topnav { min-height: 100vh; }
      .admin-topnav { background: var(--bg-elevated); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 20; }
      .admin-topnav-row { display: flex; align-items: center; gap: 20px; padding: 12px 24px; flex-wrap: wrap; }
      .admin-tag { font-size: 11px; font-weight: 700; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.05em; }
      .admin-topnav-links { display: flex; align-items: center; gap: 2px; flex-wrap: wrap; }
      .admin-nav-item { display: flex; align-items: center; gap: 6px; text-align: left; padding: 8px 12px; border-radius: var(--radius-sm); background: none; border: none; color: var(--ink-soft); font-size: 13px; font-weight: 600; white-space: nowrap; }
      .admin-nav-item:hover { background: var(--bg); color: var(--ink); }
      .admin-nav-item.active { background: var(--accent-soft); color: var(--accent); }
      .admin-nav-item.danger:hover { background: var(--danger-soft); color: var(--danger); }
      .nav-count { background: var(--accent); color: #fff; font-size: 10.5px; font-weight: 700; border-radius: 999px; min-width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; padding: 0 5px; }
      .admin-main { padding: 30px 36px; max-width: 1200px; }
      @media (max-width: 780px) { .admin-main { padding: 20px; } }
      .logo-mark { font-weight: 800; font-size: 20px; letter-spacing: -0.03em; }

      .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: var(--radius-sm); border: 1px solid transparent; padding: 10px 16px; font-size: 14px; font-weight: 600; transition: transform 0.12s ease, background 0.15s ease, opacity 0.15s ease; white-space: nowrap; }
      .btn:active { transform: scale(0.97); }
      .btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .btn-primary { background: var(--ink); color: #fff; }
      .btn-primary:hover:not(:disabled) { opacity: 0.88; }
      .btn-ghost { background: transparent; border-color: var(--border); color: var(--ink); }
      .btn-ghost:hover { background: var(--bg); }
      .btn-danger-ghost { background: transparent; border-color: var(--danger-soft); color: var(--danger); }
      .btn-danger-ghost:hover { background: var(--danger-soft); }
      .btn-full { width: 100%; }
      .btn.small { padding: 6px 10px; font-size: 12.5px; }

      .icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 8px; background: transparent; border: none; color: var(--ink); }
      .icon-btn:hover { background: var(--border); }

      .badge { padding: 4px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.02em; display: inline-block; }
      .badge-sale { background: var(--danger); color: #fff; }
      .badge-ok { background: var(--ok-soft); color: var(--ok); }
      .badge-warn { background: var(--warn-soft); color: var(--warn); }

      /* Login */
      .admin-login-root { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; gap: 16px; }
      .admin-login-card { width: 100%; max-width: 380px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 32px 28px; display: flex; flex-direction: column; gap: 14px; box-shadow: var(--shadow-md); }
      .admin-login-card h1 { font-size: 20px; margin: 4px 0 0; }
      .admin-login-sub { color: var(--ink-soft); font-size: 13.5px; margin: 0 0 6px; }
      .admin-login-card label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: var(--ink-soft); }
      .input-icon-wrap { display: flex; align-items: center; gap: 8px; border: 1.5px solid var(--border); border-radius: var(--radius-sm); padding: 0 12px; background: var(--bg); color: var(--ink-soft); }
      .input-icon-wrap:focus-within { border-color: var(--accent); }
      .input-icon-wrap input { flex: 1; border: none; background: none; padding: 10px 0; font-size: 14px; color: var(--ink); outline: none; }
      .admin-hint { text-align: center; font-size: 11.5px; color: var(--ink-soft); margin: 0; line-height: 1.5; }
      .admin-back-link { display: flex; align-items: center; justify-content: center; gap: 6px; background: none; border: none; color: var(--ink-soft); font-size: 13px; font-weight: 600; padding: 4px; }
      .admin-back-link:hover { color: var(--ink); }
      .admin-warning { text-align: center; font-size: 13px; font-weight: 700; color: var(--danger); margin: 14px 0 0; max-width: 380px; }
      .admin-hint code { background: var(--bg); padding: 1px 5px; border-radius: 4px; }
      .admin-error { display: flex; align-items: center; gap: 7px; background: var(--danger-soft); color: var(--danger); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; }
      .admin-success { display: flex; align-items: center; gap: 7px; background: var(--ok-soft); color: var(--ok); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; }

      /* Shell */


      .admin-page-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
      .admin-page-head h1 { font-size: 22px; margin: 0; }
      .admin-note { color: var(--ink-soft); font-size: 12.5px; line-height: 1.6; }
      .admin-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 50px 20px; color: var(--ink-soft); text-align: center; }

      .admin-toolbar { display: flex; gap: 10px; margin-bottom: 16px; }
      .admin-toolbar select { border: 1.5px solid var(--border); border-radius: var(--radius-sm); padding: 0 12px; background: var(--bg-elevated); color: var(--ink); font-size: 13.5px; }
      .flex1 { flex: 1; }

      .admin-table-wrap { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; overflow-x: auto; }
      .admin-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
      .admin-table th { text-align: left; padding: 12px 14px; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink-soft); border-bottom: 1px solid var(--border); font-weight: 700; }
      .admin-table td { padding: 10px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; }
      .admin-table tr:last-child td { border-bottom: none; }
      .table-thumb { width: 40px; height: 40px; object-fit: cover; border-radius: 6px; background: var(--bg); }
      .table-product-name { font-weight: 600; }
      .table-sku { font-size: 11.5px; color: var(--ink-soft); font-family: ui-monospace, monospace; }
      .mono { font-family: ui-monospace, "SF Mono", monospace; }
      .admin-table-empty { text-align: center; color: var(--ink-soft); padding: 30px; }

      .admin-panel-card { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 24px; }
      .admin-form-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
      .admin-form-head h2 { margin: 0; font-size: 18px; }
      .admin-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 18px; }
      @media (max-width: 640px) { .admin-form-grid { grid-template-columns: 1fr; } }
      .admin-form-grid label, .admin-panel-card > label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: var(--ink-soft); }
      .admin-form-grid input, .admin-form-grid select, .admin-form-grid textarea, .admin-panel-card input, .admin-panel-card select, .admin-panel-card textarea { padding: 10px 12px; border-radius: var(--radius-sm); border: 1.5px solid var(--border); background: var(--bg); color: var(--ink); font-size: 14px; resize: vertical; }
      .admin-form-grid input:focus, .admin-form-grid select:focus, .admin-form-grid textarea:focus { outline: none; border-color: var(--accent); }
      .span-2 { grid-column: span 2; }
      @media (max-width: 640px) { .span-2 { grid-column: span 1; } }
      .label-hint { font-weight: 400; color: var(--ink-soft); text-transform: none; letter-spacing: 0; font-size: 12px; }
      .checkbox-label { flex-direction: row !important; align-items: center; gap: 8px !important; font-weight: 600; color: var(--ink) !important; }
      .checkbox-label.inline { margin-right: 16px; }
      .checkbox-label input { width: 16px; height: 16px; }
      .tag-toggle-row { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
      .tag-input-row { display: flex; gap: 8px; margin-bottom: 8px; }
      .tag-input-row input { flex: 1; }
      .chip-list { display: flex; flex-wrap: wrap; gap: 6px; }
      .chip.removable { display: inline-flex; align-items: center; gap: 6px; padding: 5px 8px 5px 12px; border-radius: var(--radius-sm); border: 1.5px solid var(--border); background: var(--bg); font-size: 13px; font-weight: 600; }
      .chip.removable button { background: none; border: none; color: var(--ink-soft); display: flex; }
      .image-thumb-row { display: flex; gap: 10px; flex-wrap: wrap; }
      .image-thumb { position: relative; width: 64px; height: 64px; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border); }
      .image-thumb img { width: 100%; height: 100%; object-fit: cover; }
      .image-thumb button { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.6); border: none; color: #fff; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; }
      .image-thumb-empty { width: 64px; height: 64px; border-radius: var(--radius-sm); border: 1.5px dashed var(--border); display: flex; align-items: center; justify-content: center; color: var(--ink-soft); }
      .file-drop { margin-bottom: 10px; }
      .file-drop input[type="file"] { position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden; }
      .file-drop-label { display: flex; align-items: center; gap: 8px; padding: 12px; border: 1.5px dashed var(--border); border-radius: var(--radius-sm); font-size: 13px; color: var(--ink-soft); cursor: pointer; font-weight: 600; }
      .file-drop-label:hover { border-color: var(--accent); color: var(--ink); }
      .option-divider { display: flex; align-items: center; gap: 10px; margin: 12px 0; font-size: 11.5px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.03em; }
      .option-divider::before, .option-divider::after { content: ""; flex: 1; height: 1px; background: var(--border); }
      .admin-form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--border); }
      .inline-form { display: flex; align-items: flex-end; gap: 12px; margin-bottom: 20px; }

      /* Orders */
      .order-list { display: flex; flex-direction: column; gap: 16px; }
      .order-card { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 18px 20px; }
      .order-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid var(--border); flex-wrap: wrap; gap: 10px; }
      .order-id { display: block; font-weight: 700; font-size: 14px; }
      .order-time { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--ink-soft); margin-top: 2px; }
      .order-fulfilled-tag { display: flex; align-items: center; gap: 10px; }
      .order-items { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
      .order-item { display: flex; align-items: center; gap: 12px; }
      .order-item img { width: 48px; height: 48px; object-fit: cover; border-radius: 8px; background: var(--bg); flex-shrink: 0; }
      .order-item-noimg { width: 48px; height: 48px; border-radius: 8px; background: var(--bg); display: flex; align-items: center; justify-content: center; color: var(--ink-soft); flex-shrink: 0; }
      .order-item-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .order-item-name { font-size: 13.5px; font-weight: 600; }
      .order-item-meta { display: flex; gap: 6px; font-size: 12px; color: var(--ink-soft); flex-wrap: wrap; }
      .order-details-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 20px; padding-top: 14px; border-top: 1px solid var(--border); }
      @media (max-width: 560px) { .order-details-grid { grid-template-columns: 1fr; } }
      .order-detail-label { display: flex; align-items: center; gap: 5px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink-soft); font-weight: 700; margin-bottom: 6px; }
      .order-detail-value { display: block; font-size: 13px; line-height: 1.5; }
      .order-detail-value.muted { color: var(--ink-soft); }
      .order-amount { display: block; font-size: 20px; font-weight: 800; margin-bottom: 6px; }
      .receipt-link { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 600; color: var(--accent); text-decoration: none; }
      .receipt-link:hover { text-decoration: underline; }
    `}</style>
  );
}
