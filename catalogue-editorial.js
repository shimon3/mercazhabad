const SUPABASE_URL='https://bdalhyqpruefdbyirykp.supabase.co';const SUPABASE_PUBLISHABLE_KEY='sb_publishable_K6ciGUejNpRfLeIEc598Iw_L3VoMJYM';
const byId = id => document.getElementById(id);
const labels = {
  PhoneStickers: 'מדבקות לפלאפון', CarMagnets: 'מגנטים לרכב',
  Pins: 'סיכות משיח', Kippas: 'כיפות משיח', Caps: 'כובעי משיח',
  Keychains: 'מחזיקי מפתחות', Flags: 'דגלי משיח', SoldierPatches: 'פאצ׳ים לחיילים', General: 'מוצרי משיח כללי',
};
const normalize = value => String(value ?? '').toLowerCase().normalize('NFKC').replace(/["׳״']/g, '');
const money = new Intl.NumberFormat('he-IL', {style: 'currency', currency: 'ILS', maximumFractionDigits: 2, minimumFractionDigits: 0});
const format = cents => money.format(cents / 100);
const dialog = byId('dialog');
let products = [];
let category = '';
let badge = '';
const badgeLabels = {'':'כל המדבקות',heroes:'גיבורי אל משיח',country:'סמלי מדינות',idf:'סמלי יחידות צה״ל'};
const badgeFor = product => product.subcategory === 'HeroesOfMessiah' ? 'heroes' : /^sc\/(?!11$)/.test(product.id) ? 'country' : /^z\/(?!15$)/.test(product.id) ? 'idf' : product.id === 'z/15' ? 'police' : '';

let cart = {};
let initialCart = {};
try { initialCart = JSON.parse(localStorage.getItem('mercaz-basket-v1')) || {}; } catch {}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text, action, className) {
  const node = element('button', text, className);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}

function missingPhoto(product) {
  const fallback = element('span', '', 'photo-placeholder');
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 64 64');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('width', '50');
  icon.setAttribute('height', '50');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '2.5');
  for (const d of ['M9 12h46v40H9z','m12 25 8-9 9 10 7-6 10 12','M45 22h.1']) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    icon.append(path);
  }
  fallback.append(icon, element('span', 'תמונה בקרוב'));
  fallback.title = product.name_he;
  return fallback;
}
function photo(product, lazy = false) {
  const fallback = missingPhoto(product);
  if (!product.image_key) return fallback;
  // Permit existing relative catalogue paths, root paths and trusted HTTPS images.
  // Never allow javascript:, data:, protocol-relative URLs or unrelated remote hosts.
  let url;
  try { url = new URL(product.image_key, location.origin); }
  catch { return fallback; }
  if (url.protocol !== 'https:' || ![location.origin,'https://bdalhyqpruefdbyirykp.supabase.co'].includes(url.origin)) return fallback;
  const image = element('img');
  image.src = url.href;
  image.alt = product.name_he;
  if (lazy) image.loading = 'lazy';
  image.addEventListener('error', () => image.replaceWith(fallback), {once:true});
  return image;
}
function whatsappContact(product) {
  const text = 'שלום, אשמח לקבל מידע על המוצר '+product.name_he+' (מק"ט: '+(product.sku||product.id)+').';
  const link = element('a', 'שאלה על המוצר ב־WhatsApp', 'whatsapp-product');
  link.href = 'https://wa.me/972533770073?text=' + encodeURIComponent(text);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.setAttribute('aria-label', 'פנייה ב־WhatsApp לגבי '+product.name_he);
  return link;
}

function options(product) {
  const tracked = product.stock_tracking_enabled === true;
  if (product.category === 'PhoneStickers' && !product.id.startsWith('mix-')) {
    return [
      {key: product.id + '::4', label: 'מארז 4 יח׳', price: 1500, units: 4},
      {key: product.id + '::10', label: 'מארז 10 יח׳', price: 3000, units: 10},
    ].filter(choice => !tracked || product.stock >= choice.units);
  }
  return product.price_agorot == null || (tracked && product.stock < 1)
    ? [] : [{key: product.id, label: '', price: product.price_agorot, units: 1}];
}

function stockState(product) {
  if (!product.stock_tracking_enabled) return 'untracked';
  if (product.stock <= 0) return 'out';
  if (product.category === 'PhoneStickers' && !product.id.startsWith('mix-') && product.stock < 4) return 'insufficient';
  return 'available';
}

function stockSymbol() {
  // Inline vector icon is drawn locally; no external image or tracking request.
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '19');
  svg.setAttribute('height', '19');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const lines = ['M3 7 12 2l9 5v10l-9 5-9-5V7Z','m3 7 9 5 9-5','M12 12v10','m7 2 4 4','m4 0 7-7'];
  for (const d of lines) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}
function unavailableLabel(product) {
  return stockState(product) === 'out' ? 'אזל מהמלאי' : 'אין מספיק מלאי למארז';
}
function stockBadge(product) {
  if (!['out','insufficient'].includes(stockState(product))) return null;
  const badge = element('span', '', 'out-of-stock-badge');
  badge.append(stockSymbol(), document.createTextNode(unavailableLabel(product)));
  return badge;
}
function soldOutButton(product) {
  const control = button('', () => {}, 'add sold-out-action');
  control.append(stockSymbol(), document.createTextNode(unavailableLabel(product)));
  control.disabled = true;
  control.setAttribute('aria-label', unavailableLabel(product) + ' — לא ניתן להזמין');
  return control;
}

function priceLabel(product) {
  const choices = options(product);
  if (!choices.length) return element('p', ['out','insufficient'].includes(stockState(product)) ? unavailableLabel(product) : 'מחיר בבירור', 'price');
  const prefix = choices.length > 1 ? 'החל מ־' : '';
  const line = element('p', prefix + format(choices[0].price), 'price');
  if (!prefix && product.old_price_agorot > choices[0].price) line.append(element('del', format(product.old_price_agorot)));
  return line;
}

function renderCategories() {
  const categories = [['', 'כל המוצרים'], ...Object.entries(labels)];
  byId('categories').replaceChildren(...categories.flatMap(([key, label]) => {
    const count = key ? products.filter(product => product.category === key).length : products.length;
    const control = button('', () => {
      category = key;
      badge = '';
      byId('catalog-title').textContent = label;
      for (const child of byId('categories').children) child.setAttribute('aria-pressed', child === control);
      renderProducts();
    });
    control.append(element('span', label), element('span', String(count)));
    control.setAttribute('aria-pressed', key === category && !(key === 'PhoneStickers' && badge === 'heroes'));
    if (key !== 'PhoneStickers') return [control];
    const subCount = products.filter(product => product.category === 'PhoneStickers' && product.subcategory === 'HeroesOfMessiah').length;
    const child = button('', () => {
      category = 'PhoneStickers'; badge = 'heroes';
      byId('catalog-title').textContent = 'גיבורי אל משיח';
      renderCategories(); renderProducts();
    }, 'subcategory');
    child.append(element('span', 'גיבורי אל משיח'), element('span', String(subCount)));
    child.setAttribute('aria-pressed', category === 'PhoneStickers' && badge === 'heroes');
    return [control, child];
  }));
}

function renderProducts() {
  const filters = byId('badge-filters');
  filters.hidden = category !== 'PhoneStickers';
  for (const control of filters.children) control.setAttribute('aria-pressed', control.dataset.badge === badge);
  const terms = normalize(byId('search').value).trim().split(/\s+/);
  const items = products.filter(product => {
    const fields = normalize([product.name_he, product.name_fr, product.id, product.sku, labels[product.category], product.subcategory === 'HeroesOfMessiah' ? 'גיבורי אל משיח' : '', badgeLabels[badgeFor(product)], badgeFor(product) === 'police' ? 'סמל משטרה' : ''].join(' '));
    return (!category || product.category === category) && (!badge || badgeFor(product) === badge) && terms.every(term => fields.includes(term));
  });
  const sort = byId('sort').value;
  if (sort !== 'catalog') items.sort((a, b) => {
    const aPrice = options(a)[0]?.price;
    const bPrice = options(b)[0]?.price;
    if (aPrice == null) return bPrice == null ? 0 : 1;
    if (bPrice == null) return -1;
    return sort === 'low' ? aPrice - bPrice : bPrice - aPrice;
  });
  byId('result-count').textContent = items.length + ' מוצרים';
  byId('products').replaceChildren(...(items.length ? items.map(card) : [element('p', 'לא נמצאו מוצרים התואמים לחיפוש.', 'empty')]));
}

function card(product) {
  const node = element('article', '', 'item');
  const image = button('', () => details(product), 'photo');
  image.setAttribute('aria-label', product.name_he);
  image.append(photo(product, true));
  const badge = stockBadge(product);
  if (badge) image.append(badge);
  if (badge) node.classList.add('is-sold-out');
  const info = element('div', '', 'item-info');
  const title = element('h3');
  title.append(button(product.name_he, () => details(product)));
  info.append(element('bdi', 'מק״ט '+(product.sku||product.id), 'sku'), title, priceLabel(product));
  node.append(image, info);
  const choices = options(product);
  if (choices.length > 1) node.append(button('בחירת מארז ←', () => details(product), 'add'));
  if (choices.length === 1) node.append(button('הוספה לסל +', () => add(choices[0].key), 'add'));
  if (!choices.length && badge) node.append(soldOutButton(product));
  node.append(whatsappContact(product));
  return node;
}

function openDialog(title, body) {
  const heading = element('h2', title);
  heading.id = 'dialog-title';
  dialog.setAttribute('aria-labelledby', heading.id);
  byId('dialog-body').replaceChildren(heading, body);
  if (!dialog.open) dialog.showModal();
}

function details(product) {
  if (!product) return;
  const body = element('div', '', 'detail');
  body.append(photo(product), element('bdi', 'מק״ט '+(product.sku||product.id), 'sku'), priceLabel(product));
  const detailBadge = stockBadge(product);
  if (detailBadge) body.append(detailBadge);
  if (product.description && product.description !== product.name_he) {
    const desc = element('p', product.description);
    desc.dir = 'auto';
    body.append(desc);
  }
  const actions = element('div', '', 'dialog-actions');
  for (const choice of options(product)) {
    const label = choice.label ? choice.label + ' · ' + format(choice.price) : 'הוספה לסל +';
    actions.append(button(label, () => { add(choice.key); dialog.close(); }));
  }
  if (!actions.children.length && detailBadge) actions.append(soldOutButton(product));
  actions.append(whatsappContact(product));
  body.append(actions);
  openDialog(product.name_he, body);
}

function add(key) {
  updateCart(key, (cart[key] || 0) + 1);
  byId('announcement').textContent = 'נוסף לסל. פריטים בסל ' + byId('count').textContent;
}

function updateCart(key, amount) {
  if (amount > 0) cart[key] = Math.min(100, amount);
  else delete cart[key];
  try { localStorage.setItem('mercaz-basket-v1', JSON.stringify(cart)); } catch {}
  updateCount();
}

function updateCount() {
  const choices = new Map(products.flatMap(product => options(product).map(choice => [choice.key, choice])));
  let count = 0;
  let total = 0;
  for (const [key, quantity] of Object.entries(cart)) {
    if (!choices.has(key)) continue;
    count += quantity;
    total += choices.get(key).price * quantity;
  }
  byId('count').textContent = count;
  byId('floating-cart-count').textContent = count;
  byId('floating-cart-total').textContent = format(total);
  const floating = byId('floating-cart');
  floating.hidden = count === 0;
  floating.setAttribute('aria-label', 'פתיחת סל הקניות, ' + count + ' פריטים, ' + format(total));
  document.body.classList.toggle('has-floating-cart', count > 0);
}

function showCart() {
  const body = element('div');
  const choices = new Map(products.flatMap(product => options(product).map(choice => [choice.key, {...choice, product}])));
  let total = 0;
  for (const [key, count] of Object.entries(cart)) {
    const choice = choices.get(key);
    if (!choice) continue;
    total += choice.price * count;
    const line = element('div', '', 'cart-line');
    const thumb = element('span', '', 'cart-thumb');
    thumb.append(photo(choice.product, true));
    const details = element('div', '', 'cart-line-details');
    details.append(element('strong', [choice.product.name_he, choice.label].filter(Boolean).join(' · ')));
    details.append(element('p', format(choice.price * count), 'cart-line-price'));
    line.append(thumb, details);
    const quantity = element('div', '', 'quantity');
    const change = (label, value, description) => {
      const control = button(label, () => {
        updateCart(key, value);
        showCart();
        const replacement = [...byId('cart-dialog-body').querySelectorAll('button')].find(node => node.dataset.key === key && node.getAttribute('aria-label') === description);
        (replacement || byId('close-cart')).focus();
      });
      control.setAttribute('aria-label', description);
      control.dataset.key = key;
      return control;
    };
    quantity.append(change('−', count - 1, 'הפחתת כמות'), element('span', String(count)),
      change('+', count + 1, 'הגדלת כמות'), change('הסרה', 0, 'הסרה מהסל'));
    line.append(quantity);
    body.append(line);
  }
  if (![...Object.keys(cart)].some(key => choices.has(key))) body.append(element('p', 'אין מוצרים זמינים בסל.', 'cart-empty'));

  const checkout = button('המשך להזמנה', () => {
    const lines = Object.entries(cart).filter(([key]) => choices.has(key)).map(([key, quantity]) => ({key, quantity}));
    if (!lines.length) { message.textContent = 'הפריטים שבסל אינם זמינים כרגע להזמנה.'; return; }
    if (lines.length > 30 || lines.some(line => line.quantity > 100)) {
      message.textContent = 'אפשר להזמין עד 30 סוגי פריטים ועד 100 יחידות מכל סוג.';
      return;
    }
    try { sessionStorage.setItem('merkaz_pending_cart', JSON.stringify(lines)); }
    catch { message.textContent = 'לא ניתן להעביר את הסל. נסו שוב.'; return; }
    location.href = '/account/?checkout=1';
  }, 'ink-link checkout');
  checkout.disabled = ![...Object.keys(cart)].some(key => choices.has(key));
  const message = element('p', '', 'cart-note');
  message.setAttribute('role', 'status');
  const summary = element('div', '', 'cart-drawer-footer');
  const summaryRow = element('div', '', 'cart-subtotal');
  summaryRow.append(element('span', 'סך הכל'), element('strong', format(total)));
  summary.append(summaryRow, checkout, message, element('p', 'אין חיוב בכרטיס בשלב זה.', 'cart-note'));
  byId('cart-dialog-body').replaceChildren(body, summary);
  byId('drawer-count').textContent = '(' + Object.entries(cart).filter(([key]) => choices.has(key)).reduce((sum, [,qty]) => sum + qty, 0) + ')';
  if (!byId('cart-dialog').open) byId('cart-dialog').showModal();
}

byId('close').addEventListener('click', () => dialog.close());
byId('basket').addEventListener('click', showCart);
byId('floating-cart').addEventListener('click', showCart);
byId('close-cart').addEventListener('click', () => byId('cart-dialog').close());
byId('cart-dialog').addEventListener('click', event => {
  if (event.target === byId('cart-dialog')) byId('cart-dialog').close();
});
byId('feature').addEventListener('click', () => details(products.find(product => product.id === 's/3-temple')));
byId('search').addEventListener('input', renderProducts);
byId('sort').addEventListener('change', renderProducts);

for (const [key, label] of Object.entries(badgeLabels)) {
  const control = button(label, () => { badge = key; byId('catalog-title').textContent = key === 'heroes' ? 'גיבורי אל משיח' : labels.PhoneStickers; renderCategories(); renderProducts(); });
  control.dataset.badge = key;
  byId('badge-filters').append(control);
}
byId('reset').addEventListener('click', () => {
  category = '';
  badge = '';
  byId('search').value = '';
  byId('sort').value = 'catalog';
  byId('catalog-title').textContent = 'כל המוצרים';
  renderCategories();
  renderProducts();
});

try {
  const response = await fetch(SUPABASE_URL + '/rest/v1/mercaz_products?select=id,sku,category,subcategory,name_he,name_fr,description,price_agorot,old_price_agorot,image_key,active,stock,stock_tracking_enabled&active=eq.true&order=created_at.asc', {
    headers: {apikey: SUPABASE_PUBLISHABLE_KEY},
  });
  if (!response.ok) throw new Error('Catalog fetch failed');
  products = await response.json();
  const keys = new Set(products.flatMap(product => options(product).map(choice => choice.key)));
  cart = Object.fromEntries(Object.entries(initialCart).filter(([key, count]) => keys.has(key) && Number.isSafeInteger(count) && count > 0 && count <= 100));
  renderCategories();
  const skuFromQr = new URLSearchParams(location.search).get('sku');
  if (skuFromQr && /^MH-[0-9]{6,}$/.test(skuFromQr)) {
    const match = products.find(product => product.sku === skuFromQr);
    if (match) {
      byId('search').value = skuFromQr;
      renderProducts();
      details(match);
    } else {
      renderProducts();
      byId('announcement').textContent = 'לא נמצא מוצר עם המק״ט המבוקש.';
    }
  } else {
    renderProducts();
  }
  updateCount();
} catch {
  byId('result-count').textContent = 'לא ניתן לטעון את הקטלוג. בדקו את החיבור ונסו לרענן.';
  byId('categories').replaceChildren(element('p', 'הקטגוריות אינן זמינות כעת.', 'empty'));
  byId('products').replaceChildren(element('p', 'אירעה שגיאה בטעינת המוצרים. נסו שוב מאוחר יותר.', 'empty'));
}
