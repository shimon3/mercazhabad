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
const badgeLabels = {'':'כל המדבקות',country:'סמלי מדינות',idf:'סמלי יחידות צה״ל'};
const badgeFor = id => /^sc\/(?!11$)/.test(id) ? 'country' : /^z\/(?!15$)/.test(id) ? 'idf' : id === 'z/15' ? 'police' : '';

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

function photo(product, lazy = false) {
  if (!product.image_key) return element('span', 'אין תמונה');
  const image = element('img');
  image.src = product.image_key;
  image.alt = product.name_he;
  if (lazy) image.loading = 'lazy';
  return image;
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

function priceLabel(product) {
  const choices = options(product);
  if (!choices.length) return element('p', product.stock_tracking_enabled ? 'אזל מהמלאי' : 'מחיר בבירור', 'price');
  const prefix = choices.length > 1 ? 'החל מ־' : '';
  const line = element('p', prefix + format(choices[0].price), 'price');
  if (!prefix && product.old_price_agorot > choices[0].price) line.append(element('del', format(product.old_price_agorot)));
  return line;
}

function renderCategories() {
  const categories = [['', 'כל המוצרים'], ...Object.entries(labels)];
  byId('categories').replaceChildren(...categories.map(([key, label]) => {
    const count = key ? products.filter(product => product.category === key).length : products.length;
    const control = button('', () => {
      category = key;
      badge = '';
      byId('catalog-title').textContent = label;
      for (const child of byId('categories').children) child.setAttribute('aria-pressed', child === control);
      renderProducts();
    });
    control.append(element('span', label), element('span', String(count)));
    control.setAttribute('aria-pressed', key === category);
    return control;
  }));
}

function renderProducts() {
  const filters = byId('badge-filters');
  filters.hidden = category !== 'PhoneStickers';
  for (const control of filters.children) control.setAttribute('aria-pressed', control.dataset.badge === badge);
  const terms = normalize(byId('search').value).trim().split(/\s+/);
  const items = products.filter(product => {
    const fields = normalize([product.name_he, product.name_fr, product.id, labels[product.category], badgeLabels[badgeFor(product.id)], badgeFor(product.id) === 'police' ? 'סמל משטרה' : ''].join(' '));
    return (!category || product.category === category) && (!badge || badgeFor(product.id) === badge) && terms.every(term => fields.includes(term));
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
  const info = element('div', '', 'item-info');
  const title = element('h3');
  title.append(button(product.name_he, () => details(product)));
  info.append(element('bdi', product.id, 'sku'), title, priceLabel(product));
  node.append(image, info);
  const choices = options(product);
  if (choices.length > 1) node.append(button('בחירת מארז ←', () => details(product), 'add'));
  if (choices.length === 1) node.append(button('הוספה לסל +', () => add(choices[0].key), 'add'));
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
  body.append(photo(product), element('bdi', product.id, 'sku'), priceLabel(product));
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
  byId('count').textContent = Object.values(cart).reduce((total, amount) => total + amount, 0);
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
    line.append(element('strong', [choice.product.name_he, choice.label].filter(Boolean).join(' · ')));
    line.append(element('p', format(choice.price * count)));
    const quantity = element('div', '', 'quantity');
    const change = (label, value, description) => {
      const control = button(label, () => {
        updateCart(key, value);
        showCart();
        const replacement = [...byId('dialog-body').querySelectorAll('button')].find(node => node.dataset.key === key && node.getAttribute('aria-label') === description);
        (replacement || byId('close')).focus();
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
  if (!Object.keys(cart).length) body.append(element('p', 'הסל עדיין ריק.'));
  body.append(element('p', 'סה״כ ' + format(total), 'cart-total'));
  const checkout = button('המשך להזמנה', () => {
    const lines = Object.entries(cart).map(([key, quantity]) => ({key, quantity}));
    if (lines.length > 30 || lines.some(line => line.quantity > 100)) {
      message.textContent = 'אפשר להזמין עד 30 סוגי פריטים ועד 100 יחידות מכל סוג.';
      return;
    }
    try { sessionStorage.setItem('merkaz_pending_cart', JSON.stringify(lines)); }
    catch { message.textContent = 'לא ניתן להעביר את הסל. נסו שוב.'; return; }
    location.href = '/account/?checkout=1';
  }, 'ink-link checkout');
  checkout.disabled = !Object.keys(cart).length;
  const message = element('p', '', 'cart-note');
  message.setAttribute('role', 'status');
  body.append(checkout, message, element('p', 'אין חיוב בכרטיס בשלב זה.', 'cart-note'));
  openDialog('סל קניות', body);
}

byId('close').addEventListener('click', () => dialog.close());
byId('basket').addEventListener('click', showCart);
byId('feature').addEventListener('click', () => details(products.find(product => product.id === 's/3-temple')));
byId('search').addEventListener('input', renderProducts);
byId('sort').addEventListener('change', renderProducts);

for (const [key, label] of Object.entries(badgeLabels)) {
  const control = button(label, () => { badge = key; renderProducts(); });
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
  const response = await fetch(SUPABASE_URL + '/rest/v1/mercaz_products?select=id,category,name_he,name_fr,description,price_agorot,old_price_agorot,image_key,active,stock,stock_tracking_enabled&active=eq.true&order=created_at.asc', {
    headers: {apikey: SUPABASE_PUBLISHABLE_KEY},
  });
  if (!response.ok) throw new Error('Catalog fetch failed');
  products = await response.json();
  const keys = new Set(products.flatMap(product => options(product).map(choice => choice.key)));
  cart = Object.fromEntries(Object.entries(initialCart).filter(([key, count]) => keys.has(key) && Number.isSafeInteger(count) && count > 0 && count <= 100));
  renderCategories();
  renderProducts();
  updateCount();
} catch {
  byId('result-count').textContent = 'לא ניתן לטעון את הקטלוג.';
}
