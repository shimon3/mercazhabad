const endpoint = 'https://bdalhyqpruefdbyirykp.supabase.co/rest/v1/mercaz_storefront_appearance?id=eq.1';
const apikey = 'sb_publishable_K6ciGUejNpRfLeIEc598Iw_L3VoMJYM';

export const sections = [
  ['טקסטים ותפריט', [
    ['title', 'כותרת ראשית', 'text', 'מוצרי דגל המשיח.'],
    ['subtitle', 'טקסט פתיחה', 'text', 'מפרסם את הגאולה בעזרת מוצרי דגל המשיח.'],
    ['catalogButton', 'כפתור הקטלוג', 'text', 'גלו את הקטלוג'],
    ['modelsButton', 'כפתור דגמי דגליה ודגלית', 'text', 'דגמי דגליה ודגלית'],
    ['basketButton', 'כפתור סל הקניות', 'text', 'סל קניות'],
    ['menuCatalog', 'שם קישור הקטלוג בתפריט', 'text', 'לקטלוג ↓'],
    ['menuAccount', 'שם קישור החשבון בתפריט', 'text', 'החשבון שלי'],
    ['menuOrder', 'סדר קישורים', 'select', 'account', {account:'חשבון ואז קטלוג', catalog:'קטלוג ואז חשבון'}],
    ['hideCatalog', 'הסתרת קישור הקטלוג בתפריט', 'checkbox', false],
    ['hideAccount', 'הסתרת קישור החשבון בתפריט', 'checkbox', false],
  ]],
  ['צבעים, גדלים וכפתורים', [
    ['paper', 'רקע העמוד', 'color', '#f4f0e4', '--paper'],
    ['ink', 'צבע הטקסט', 'color', '#202218', '--ink'],
    ['accent', 'צבע הדגשה ורקע הפתיחה', 'color', '#edc54d', '--gold'],
    ['buttonBackground', 'רקע כפתורים ראשיים', 'color', '#202218', '--cms-button-bg'],
    ['buttonText', 'טקסט כפתורים ראשיים', 'color', '#f4f0e4', '--cms-button-text'],
    ['textSize', 'גודל הטקסט הכללי (%)', 'number', 100, '--cms-text-size', 85, 125, '%'],
    ['brandSize', 'גודל שם החנות בראש העמוד (%)', 'number', 100, '--cms-brand-scale', 60, 150, 'scale'],
    ['titleSize', 'גודל הכותרת הראשית (%)', 'number', 100, '--cms-title-scale', 65, 115, 'scale'],
    ['buttonSize', 'גודל טקסט בכפתורים (פיקסלים)', 'number', 16, '--cms-button-size', 12, 22, 'px'],
    ['buttonRadius', 'עיגול פינות כפתורים (פיקסלים)', 'number', 0, '--cms-button-radius', 0, 32, 'px'],
  ]],
];

export function sanitizeAppearance(raw) {
  const settings = {};
  for (const [, fields] of sections) {
    for (const [key, , type, , choices, min, max] of fields) {
      const value = raw?.[key];
      if (type === 'text' && typeof value === 'string' && value.trim() && value.length <= 120) settings[key] = value.trim();
      if (type === 'color' && typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)) settings[key] = value;
      if (type === 'number' && Number.isInteger(value) && value >= min && value <= max) settings[key] = value;
      if (type === 'select' && Object.hasOwn(choices, value)) settings[key] = value;
      if (type === 'checkbox' && typeof value === 'boolean') settings[key] = value;
    }
  }
  return settings;
}

export function applyAppearance(root, raw) {
  const settings = sanitizeAppearance(raw);
  for (const [, fields] of sections) {
    for (const [key, , type, , property, , , unit] of fields) {
      if (type !== 'color' && type !== 'number') continue;
      const value = settings[key];
      if (value === undefined) root.style.removeProperty(property);
      else root.style.setProperty(property, unit === 'scale' ? String(value / 100) : value + (unit || ''));
    }
  }
  root.toggleAttribute('data-cms-button-size', settings.buttonSize !== undefined);
  root.toggleAttribute('data-cms-button-radius', settings.buttonRadius !== undefined);
  root.toggleAttribute('data-cms-button-colors', settings.buttonBackground !== undefined || settings.buttonText !== undefined);
  root.toggleAttribute('data-cms-menu', settings.menuCatalog !== undefined || settings.menuOrder !== undefined);
  for (const node of root.querySelectorAll('[data-appearance-text]')) {
    const key = node.dataset.appearanceText;
    if (settings[key] !== undefined) node.textContent = settings[key];
  }
  const account = root.querySelector('[data-appearance-link="account"]');
  const catalog = root.querySelector('[data-appearance-link="catalog"]');
  account.hidden = settings.hideAccount === true;
  catalog.hidden = settings.hideCatalog === true;
  if (settings.menuOrder === 'catalog') account.before(catalog);
  else catalog.before(account);
}

export async function readAppearance(signal) {
  const response = await fetch(endpoint + '&select=settings,revision', {headers:{apikey}, cache:'no-store', signal});
  if (!response.ok) throw new Error('טעינת עיצוב האתר נכשלה.');
  const [row] = await response.json();
  if (!row) throw new Error('הגדרות העיצוב אינן זמינות.');
  return row;
}

export async function publishAppearance(settings, revision, token) {
  const response = await fetch(endpoint + '&revision=eq.' + revision, {
    method: 'PATCH',
    headers: {apikey, Authorization:'Bearer ' + token, 'Content-Type':'application/json', Prefer:'return=representation'},
    body: JSON.stringify({settings:sanitizeAppearance(settings), revision:revision + 1}),
  });
  if (!response.ok) throw new Error('הפרסום נכשל. יש לבדוק את החיבור ואת הרשאת הניהול.');
  const [row] = await response.json();
  if (!row) throw new Error('העיצוב השתנה בחלון אחר או שההרשאה פגה. טענו מחדש את הגרסה שפורסמה.');
  return row;
}
