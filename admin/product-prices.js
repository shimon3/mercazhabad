export function discountFrom20(unit, bulk) {
  if (!Number.isFinite(unit) || !Number.isFinite(bulk) || unit <= 0 || bulk < 0 || bulk > unit) return null;
  return (unit - bulk) / unit;
}

export function priceFields(p) {
  const value = n => n == null ? '' : Number(n) / 100;
  const input = (label, name, amount) => '<div class="field"><label>' + label + '<input name="' + name + '" type="number" min="0" max="1000000" step="0.01" value="' + value(amount) + '"></label></div>';
  const old = input('מחיר רגיל לפני מבצע (₪, ריק = ללא מבצע)', 'old_price', p.old_price_agorot);
  if (p.category !== 'CarMagnets') return old;
  const t = p.quantityPrices;
  return old + '<fieldset class="quantity-price-fields"><legend>מחירי כמות — לכל דגם בנפרד</legend><div class="grid">' +
    input('מחיר ליחידה מ־10 (₪)', 'price_10', t?.price_10_agorot) +
    input('מחיר ליחידה מ־20 (₪)', 'price_20', t?.price_20_agorot) +
    '<div class="field"><label>הנחה מ־20 יח׳ (%)<input name="discount_20" type="number" min="0" max="100" step="0.1" placeholder="למשל 40"></label></div></div>' +
    '<small>לדוגמה: מחיר יחידה 20 ₪ והנחה של 40% נותנים 12 ₪ ליחידה מ־20 יח׳. אפשר להזין אחוז או מחיר. השאירו את שני מחירי הכמות ריקים ללא הנחת כמות.</small></fieldset>';
}

export function bindPriceFields(form) {
  const percent = form.elements.discount_20;
  if (!percent) return;
  const update = () => {
    const unit = form.elements.price.value, bulk = form.elements.price_20.value;
    const discount = unit === '' || bulk === '' ? null : discountFrom20(Number(unit), Number(bulk));
    percent.value = discount == null ? '' : String(Math.round(discount * 1000) / 10);
  };
  const applyDiscount = () => {
    const unit = form.elements.price.value, discount = percent.value;
    if (unit === '' || discount === '' || !Number.isFinite(Number(unit)) || Number(unit) < 0 || Number(discount) < 0 || Number(discount) > 100) return;
    form.elements.price_20.value = (Math.round(Number(unit) * (100 - Number(discount))) / 100).toFixed(2);
  };
  percent.addEventListener('input', applyDiscount);
  form.elements.price.addEventListener('input', () => percent.value === '' ? update() : applyDiscount());
  form.elements.price_20.addEventListener('input', update);
  update();
}

export function readPriceInputs(form, unit) {
  const amount = name => {
    const raw = form.elements[name]?.value.trim();
    if (!raw) return null;
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(raw)) throw Error('מחיר לא תקין: יש להזין עד שתי ספרות אחרי הנקודה');
    const n = Math.round(Number(raw) * 100);
    if (n > 100000000) throw Error('המחיר גבוה מדי');
    return n;
  };
  const old = amount('old_price'), ten = amount('price_10'), twenty = amount('price_20');
  if (old != null && (unit == null || old < unit)) throw Error('מחיר לפני מבצע חייב להיות גדול או שווה למחיר ליחידה');
  if ((ten == null) !== (twenty == null)) throw Error('יש להזין את שני מחירי הכמות או להשאיר את שניהם ריקים');
  if (ten != null && (unit == null || ten > unit || twenty > ten)) throw Error('מחיר הכמות חייב לרדת או להישאר זהה ככל שהכמות גדלה');
  return {old, ten, twenty};
}
