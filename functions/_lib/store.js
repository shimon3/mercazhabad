// Shared helpers for public, read-only server-rendered pages (product pages, sitemap).
// Uses only the publishable key: RLS decides what anonymous visitors may read.
export const BASE = 'https://bdalhyqpruefdbyirykp.supabase.co';
export const PUBLIC_KEY = 'sb_publishable_K6ciGUejNpRfLeIEc598Iw_L3VoMJYM';
export const STORE_NAME = 'מרכז חב״ד משיח';
export const PHONE_INTL = '972533770073';

export const CATEGORY_LABELS = {
  PhoneStickers: 'מדבקות לפלאפון', CarMagnets: 'מגנטים לרכב', Pins: 'סיכות משיח',
  Kippas: 'כיפות משיח', Caps: 'כובעי משיח', Keychains: 'מחזיקי מפתחות',
  Flags: 'דגלי משיח', SoldierPatches: 'פאצ׳ים לחיילים', General: 'מוצרי משיח כללי',
};

const PRODUCT_FIELDS = 'id,sku,category,subcategory,name_he,description,price_agorot,old_price_agorot,image_key,stock,stock_tracking_enabled,created_at';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
}

// Same slug rule as the storefront script: SKU when present, otherwise the id with "/" → "--".
export function productSlug(product) {
  return /^MH-[0-9]{6,}$/.test(product.sku || '') ? product.sku : String(product.id).replace(/\//g, '--');
}

async function rest(path) {
  const response = await fetch(BASE + '/rest/v1/' + path, {
    headers: {apikey: PUBLIC_KEY, Accept: 'application/json'},
    cf: {cacheTtl: 300, cacheEverything: true},
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw Error('Catalogue unavailable');
  return response.json();
}

export async function listProducts() {
  return rest('mercaz_products?select=' + PRODUCT_FIELDS + '&active=eq.true&order=created_at.asc');
}

export async function findProduct(slug) {
  if (typeof slug !== 'string' || slug.length > 80 || !/^[A-Za-z0-9_.\-]+$/.test(slug)) return null;
  const filter = /^MH-[0-9]{6,}$/.test(slug)
    ? 'sku=eq.' + encodeURIComponent(slug)
    : 'id=eq.' + encodeURIComponent(slug.replace(/--/g, '/'));
  const rows = await rest('mercaz_products?select=' + PRODUCT_FIELDS + '&active=eq.true&' + filter + '&limit=1');
  const product = rows?.[0] || null;
  if (product?.category === 'CarMagnets') {
    const response = await fetch(BASE + '/rest/v1/mercaz_quantity_prices?select=price_10_agorot,price_20_agorot&product_id=eq.' + encodeURIComponent(product.id), {
      headers: {apikey: PUBLIC_KEY, Accept:'application/json'}, signal:AbortSignal.timeout(8000),
      cf: {cacheTtl:60,cacheEverything:true},
    });
    if (response.ok) product.quantityPrices = (await response.json())?.[0] || null;
    else if (response.status !== 404) throw Error('Quantity prices unavailable');
  }
  return product;
}

// Approved reviews only (RLS also enforces this). Missing table → no reviews, never an error page.
export async function approvedReviews(productId) {
  try {
    return await rest('mercaz_reviews?select=display_name,rating,body,created_at&status=eq.approved&product_id=eq.' +
      encodeURIComponent(productId) + '&order=created_at.desc&limit=50');
  } catch { return []; }
}

// Mirrors options() in catalogue-editorial.js so server pages show the same prices.
export function priceInfo(product) {
  const inquiry = String(product.id).startsWith('degaliya/');
  if (!inquiry && product.category === 'PhoneStickers' && !String(product.id).startsWith('mix-')) {
    return {low: 1500, high: 3000, label: 'מארז 4 ב־₪15 · מארז 10 ב־₪30'};
  }
  if (product.price_agorot == null) return null;
  return {low: product.price_agorot, high: product.price_agorot, label: null};
}

export function isOutOfStock(product) {
  return product.stock_tracking_enabled === true && Number(product.stock) <= 0;
}

export function imageUrl(product, origin) {
  if (!product.image_key) return null;
  try {
    const url = new URL(product.image_key, origin + '/');
    return url.protocol === 'https:' && [origin, BASE].includes(url.origin) ? url.href : null;
  } catch { return null; }
}

export function shekel(agorot) {
  return new Intl.NumberFormat('he-IL', {style: 'currency', currency: 'ILS', maximumFractionDigits: 2, minimumFractionDigits: 0}).format(agorot / 100);
}

// Optional presentation video (column added by sql/product-videos.sql). Never breaks the page.
export async function productVideo(productId) {
  try {
    const rows = await rest('mercaz_products?select=video_key&id=eq.' + encodeURIComponent(productId) + '&limit=1');
    const value = rows?.[0]?.video_key;
    if (typeof value !== 'string') return null;
    if (value.startsWith(BASE + '/storage/v1/object/public/mercaz-product-videos/') && /^[A-Za-z0-9._\/:-]+$/.test(value)) return value;
    if (/^\/assets-v8\/[A-Za-z0-9._\/-]+\.(mp4|webm)$/.test(value)) return value;
  } catch {}
  return null;
}
