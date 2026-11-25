// Server-rendered, indexable product page: /p/<sku or id>.
// Read-only: buying still happens in the storefront cart (link opens the product there).
import {CATEGORY_LABELS, PHONE_INTL, STORE_NAME, approvedReviews, escapeHtml as e, findProduct,
  imageUrl, isOutOfStock, priceInfo, productSlug, productVideo, shekel} from '../_lib/store.js';

// _headers does not apply to Functions responses, so the page sets its own security headers.
const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300',
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'none'; style-src 'self'; img-src 'self' data: https://bdalhyqpruefdbyirykp.supabase.co; font-src 'self' data:; media-src 'self' https://bdalhyqpruefdbyirykp.supabase.co; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};

function stars(rating) {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

// JSON inside <script type="application/ld+json"> must not be able to close the tag.
const jsonLd = data => JSON.stringify(data).replace(/</g, '\\u003c');

function notFound(origin) {
  return new Response(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>המוצר לא נמצא | ${STORE_NAME}</title><link rel="stylesheet" href="/product-page.css?v=1"></head><body><main class="pp"><h1>המוצר לא נמצא</h1><p>ייתכן שהמוצר הוסר מהקטלוג.</p><a class="pp-btn" href="${e(origin)}/#catalog">לכל המוצרים ←</a></main></body></html>`, {status: 404, headers: HEADERS});
}

export async function onRequestGet({params, request}) {
  const origin = new URL(request.url).origin;
  let product;
  try { product = await findProduct(params.slug); }
  catch { return new Response('הקטלוג אינו זמין כרגע. נסו שוב בעוד רגע.', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '60'}}); }
  if (!product) return notFound(origin);

  const slug = productSlug(product);
  const canonical = origin + '/p/' + slug;
  if (params.slug !== slug) return Response.redirect(canonical, 301);

  const [reviews, video] = await Promise.all([approvedReviews(product.id), productVideo(product.id)]);
  const price = priceInfo(product);
  const out = isOutOfStock(product);
  const image = imageUrl(product, origin);
  const category = CATEGORY_LABELS[product.category] || 'מוצרי משיח';
  const description = product.description && product.description !== product.name_he
    ? product.description : `${product.name_he} — ${category} מבית ${STORE_NAME}.`;
  const metaDescription = description.slice(0, 155);
  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  const shopLink = origin + '/?product=' + encodeURIComponent(product.id) + '#catalog';
  const whatsapp = 'https://wa.me/' + PHONE_INTL + '?text=' + encodeURIComponent('שלום, אשמח לקבל מידע על המוצר ' + product.name_he + (product.sku ? ' (מק"ט: ' + product.sku + ')' : '') + '.');

  const data = {
    '@context': 'https://schema.org', '@type': 'Product', name: product.name_he, description,
    sku: product.sku || product.id, category, brand: {'@type': 'Brand', name: STORE_NAME}, url: canonical,
  };
  if (image) data.image = [image];
  if (price) {
    const availability = 'https://schema.org/' + (out ? 'OutOfStock' : 'InStock');
    data.offers = price.low === price.high
      ? {'@type': 'Offer', price: (price.low / 100).toFixed(2), priceCurrency: 'ILS', availability, url: canonical}
      : {'@type': 'AggregateOffer', lowPrice: (price.low / 100).toFixed(2), highPrice: (price.high / 100).toFixed(2), priceCurrency: 'ILS', offerCount: 2, availability, url: canonical};
  }
  if (reviews.length) {
    data.aggregateRating = {'@type': 'AggregateRating', ratingValue: average.toFixed(1), reviewCount: reviews.length};
    data.review = reviews.slice(0, 10).map(r => ({'@type': 'Review', author: {'@type': 'Person', name: r.display_name},
      datePublished: String(r.created_at).slice(0, 10), reviewBody: r.body, reviewRating: {'@type': 'Rating', ratingValue: r.rating, bestRating: 5}}));
  }
  const breadcrumb = {'@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    {'@type': 'ListItem', position: 1, name: STORE_NAME, item: origin + '/'},
    {'@type': 'ListItem', position: 2, name: category, item: origin + '/?category=' + encodeURIComponent(product.category) + '#catalog'},
    {'@type': 'ListItem', position: 3, name: product.name_he, item: canonical},
  ]};

  let priceHtml = '<p class="pp-price is-ask">מחיר בבירור ב־WhatsApp</p>';
  if (price) priceHtml = price.label
    ? `<p class="pp-price">${e(price.label)}</p>`
    : `<p class="pp-price">${e(shekel(price.low))}${product.old_price_agorot > price.low ? ` <del>${e(shekel(product.old_price_agorot))}</del>` : ''}</p>`;
  if (price && product.quantityPrices) {
    const ten = Math.min(price.low,product.quantityPrices.price_10_agorot), twenty = Math.min(price.low,product.quantityPrices.price_20_agorot);
    priceHtml += `<p>10–19 יח׳: ${e(shekel(ten))} ליחידה. 20 יח׳ ומעלה: ${e(shekel(twenty))} ליחידה. המחיר לכל דגם בנפרד.</p>`;
  }

  const reviewsHtml = reviews.length
    ? `<section class="pp-reviews" aria-labelledby="reviews-title"><h2 id="reviews-title">חוות דעת של לקוחות <span class="pp-stars" aria-label="דירוג ${average.toFixed(1)} מתוך 5">${stars(average)}</span> <small>(${reviews.length})</small></h2><ul>${reviews.map(r => `<li><p class="pp-stars" aria-label="${r.rating} מתוך 5">${stars(r.rating)}</p><p>${e(r.body)}</p><p class="pp-muted">${e(r.display_name)} · ${e(new Date(r.created_at).toLocaleDateString('he-IL'))}</p></li>`).join('')}</ul></section>`
    : `<section class="pp-reviews"><p class="pp-muted">עדיין אין חוות דעת על המוצר. קניתם? <a href="${e(shopLink)}">כתבו חוות דעת</a>.</p></section>`;

  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(product.name_he)} | ${e(category)} | ${STORE_NAME}</title>
<meta name="description" content="${e(metaDescription)}">
<link rel="canonical" href="${e(canonical)}">
<meta property="og:type" content="product"><meta property="og:title" content="${e(product.name_he)}">
<meta property="og:description" content="${e(metaDescription)}"><meta property="og:url" content="${e(canonical)}">
${image ? `<meta property="og:image" content="${e(image)}">` : ''}
<meta name="theme-color" content="#ffd21f">
<link rel="stylesheet" href="/appearance-fonts.css?v=2">
<link rel="stylesheet" href="/product-page.css?v=1">
<script type="application/ld+json">${jsonLd(data)}</script>
<script type="application/ld+json">${jsonLd(breadcrumb)}</script>
</head>
<body>
<header class="pp-head"><a href="/" class="pp-brand">👑 ${STORE_NAME}</a><nav><a href="/#catalog">לקטלוג</a><a href="/about/">אודות</a></nav></header>
<main class="pp">
<nav class="pp-crumbs" aria-label="פירורי לחם"><a href="/">דף הבית</a> › <a href="/?category=${e(encodeURIComponent(product.category))}#catalog">${e(category)}</a> › <span>${e(product.name_he)}</span></nav>
<article class="pp-product">
<div class="pp-media"><div class="pp-photo">${image ? `<img src="${e(image)}" alt="${e(product.name_he)}" width="640" height="640">` : '<span class="pp-muted">תמונה בקרוב</span>'}</div>
${video ? `<figure class="pp-video"><figcaption>🎬 סרטון המוצר</figcaption><video src="${e(video)}" controls playsinline muted loop preload="metadata"></video></figure>` : ''}</div>
<div class="pp-info">
<p class="pp-cat">${e(category)}</p>
<h1>${e(product.name_he)}</h1>
${reviews.length ? `<p class="pp-rating"><span class="pp-stars">${stars(average)}</span> ${average.toFixed(1)} · ${reviews.length} חוות דעת</p>` : ''}
${priceHtml}
${out ? '<p class="pp-out">אזל מהמלאי</p>' : ''}
<p>${e(description)}</p>
${product.sku ? `<p class="pp-muted">מק״ט <bdi>${e(product.sku)}</bdi></p>` : ''}
<div class="pp-actions">
${price && !out ? `<a class="pp-btn" href="${e(shopLink)}">להזמנה באתר ←</a>` : ''}
<a class="pp-btn pp-wa" href="${e(whatsapp)}" target="_blank" rel="noopener noreferrer">שאלה ב־WhatsApp</a>
</div>
<ul class="pp-trust"><li>💬 מענה אישי ב־WhatsApp ובטלפון</li><li>🛒 אין חיוב בכרטיס בשלב הסל</li><li>📦 הזמנות לקהילות ולמבצעים — דברו איתנו</li></ul>
</div>
</article>
${reviewsHtml}
</main>
<footer class="pp-foot"><a href="/">${STORE_NAME}</a> · <a href="tel:+${PHONE_INTL}" dir="ltr">053-377-0073</a> · <a href="/about/">אודות</a> · <a href="/privacy/">מדיניות פרטיות</a></footer>
</body>
</html>`;
  return new Response(html, {headers: HEADERS});
}
