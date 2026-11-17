const endpoint = 'https://bdalhyqpruefdbyirykp.supabase.co/rest/v1/mercaz_storefront_appearance?id=eq.1';
const apikey = 'sb_publishable_K6ciGUejNpRfLeIEc598Iw_L3VoMJYM';

const fontLabels = {original:'ברירת מחדל', sans:'Noto Sans Hebrew', serif:'Noto Serif Hebrew', rashi:'Noto Rashi Hebrew'};
const fontFamilies = {sans:'"Noto Sans Hebrew CMS", Arial, sans-serif', serif:'"Noto Serif Hebrew CMS", David, serif', rashi:'"Noto Rashi Hebrew CMS", David, serif'};

const menuFields = [
  ['menuOrder', 'סדר קישורים', 'select', 'account', {account:'חשבון ואז קטלוג', catalog:'קטלוג ואז חשבון'}],
  ['hideCatalog', 'הסתרת קישור הקטלוג בתפריט', 'checkbox', false],
  ['hideAccount', 'הסתרת קישור החשבון בתפריט', 'checkbox', false],
];
const homeStyle = [
  ['paper', 'רקע העמוד', 'color', '#ffffff', '--paper'],
  ['ink', 'צבע הטקסט', 'color', '#0f1b4d', '--ink'],
  ['accent', 'צבע הדגשה', 'color', '#ffd21f', '--gold'],
  ['buttonBackground', 'רקע כפתורים ראשיים', 'color', '#ffd21f', '--cms-button-bg'],
  ['buttonText', 'טקסט כפתורים ראשיים', 'color', '#0f1b4d', '--cms-button-text'],
  ['textSize', 'גודל הטקסט הכללי (%)', 'number', 100, '--cms-text-size', 85, 125, '%'],
  ['buttonSize', 'גודל טקסט בכפתורים (פיקסלים)', 'number', 16, '--cms-button-size', 12, 22, 'px'],
  ['buttonRadius', 'עיגול פינות כפתורים (פיקסלים)', 'number', 0, '--cms-button-radius', 0, 32, 'px'],
];

export const pages = {
  home: {path:'/', label:'דף הבית'},
  account: {path:'/account/', label:'האזור האישי'},
  privacy: {path:'/privacy/', label:'מדיניות פרטיות'},
};

export const elements = {
  home: [
    ['brand', 'שם החנות בסרגל העליון', 'מרכז חב״ד משיח', 300],
    ['eyebrow', 'שם החנות באזור הפתיחה', 'מרכז חב״ד משיח', 600],
    ['title', 'כותרת ראשית', 'מוצרי דגל המשיח.', 200],
    ['subtitle', 'טקסט פתיחה', 'מפרסם את הגאולה בעזרת מוצרי דגל המשיח.', 200],
    ['catalogButton', 'כפתור הקטלוג', 'גלו את הקטלוג'],
    ['modelsButton', 'כותרת דגמי דגליה ודגלית', 'דגמי דגליה ודגלית'],
    ['basketButton', 'כפתור סל הקניות', 'סל קניות'],
    ['menuCatalog', 'קישור לקטלוג', 'לקטלוג ↓'],
    ['menuAccount', 'קישור לחשבון', 'החשבון שלי'],
    ['categoriesTitle', 'כותרת הקטגוריות', 'קנו לפי קטגוריה'],
    ['dealsTitle', 'כותרת המבצעים', '🔥 המבצעים הכי שווים'],
    ['heroesTitle', 'כותרת גיבורי אל משיח', '✨ גיבורי אל משיח'],
    ['helpTitle', 'כותרת העזרה', 'לא בטוחים מה לבחור?'],
  ],
  account: [
    ['accountBrand', 'כותרת הסרגל', 'מרכז חב״ד משיח · האזור האישי'],
    ['accountLogin', 'כותרת הכניסה', 'כניסה / הרשמה'],
    ['accountIntro', 'טקסט מתחת לכותרת', 'התחברו כדי לשלוח הזמנה ולעקוב אחר מצבה.'],
    ['accountTitle', 'כותרת החשבון לאחר כניסה', 'החשבון שלי'],
    ['accountOrders', 'כותרת ההזמנות', 'ההזמנות שלי'],
  ],
  privacy: [
    ['privacyBack', 'קישור חזרה לחנות', '← חזרה לחנות מרכז חב״ד משיח'],
    ['privacyTitle', 'כותרת העמוד', 'מדיניות פרטיות · Privacy Policy'],
  ],
};

const alignments = {original:'ברירת מחדל', right:'ימין', center:'מרכז', left:'שמאל'};
const positions = {original:'ברירת מחדל', before:'לפני שאר הטקסטים', after:'אחרי שאר הטקסטים'};
const heroElements = new Set(['eyebrow', 'title', 'subtitle']);

export const elementFields = Object.fromEntries(Object.values(elements).flat().map(([key, , label, max = 200]) => [key, [
  [key, 'טקסט', 'text', label],
  [key + 'Size', 'גודל (%)', 'number', 100, null, 60, max, 'scale'],
  [key + 'Font', 'גופן', 'select', 'original', fontLabels],
  [key + 'Color', 'צבע הטקסט', 'color', null],
  ...(key === 'eyebrow' ? [[key + 'Background', 'צבע רקע התגית', 'color', '#0f1b4d']] : []),
  [key + 'Weight', 'משקל', 'select', 'original', {original:'ברירת מחדל', normal:'רגיל', bold:'מודגש'}],
  [key + 'Underline', 'קו תחתון', 'checkbox', false],
  ...(heroElements.has(key) ? [
    [key + 'Align', 'יישור', 'select', 'original', alignments],
    [key + 'Position', 'מיקום באזור הפתיחה', 'select', 'original', positions],
  ] : []),
]]));

export const pageFields = {
  home: [...homeStyle, ...menuFields,
    ['heroLayout', 'מיקום הסרטון באזור הפתיחה', 'select', 'original', {original:'ברירת מחדל', opposite:'החלפת צד עם הטקסט'}]],
  account: [
    ['accountBackground', 'רקע העמוד', 'color', null, '--cms-account-bg'],
    ['accountInk', 'צבע הטקסט בעמוד', 'color', null, '--cms-account-ink'],
  ],
  privacy: [
    ['privacyBackground', 'רקע העמוד', 'color', null, '--cms-privacy-bg'],
    ['privacyInk', 'צבע הטקסט בעמוד', 'color', null, '--cms-privacy-ink'],
  ],
};
const fieldsByKey = Object.fromEntries([...Object.values(pageFields).flat(), ...Object.values(elementFields).flat()]
  .map(field => [field[0], field]));

export function sanitizeAppearance(raw) {
  const settings = {};
  for (const [key, , type, , choices, min, max] of Object.values(fieldsByKey)) {
    const value = raw?.[key];
    if (type === 'text' && typeof value === 'string' && value.trim() && value.length <= 120) settings[key] = value.trim();
    if (type === 'color' && typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)) settings[key] = value;
    if (type === 'number' && Number.isInteger(value) && value >= min && value <= max) settings[key] = value;
    if (type === 'select' && Object.hasOwn(choices, value)) settings[key] = value;
    if (type === 'checkbox' && typeof value === 'boolean') settings[key] = value;
  }
  return settings;
}

export function applyAppearance(root, raw, page = 'home') {
  const settings = sanitizeAppearance(raw);
  for (const [key, , type, , property, , , unit] of pageFields[page]) {
    if (!property || (type !== 'color' && type !== 'number')) continue;
    const value = settings[key];
    if (value === undefined) root.style.removeProperty(property);
    else root.style.setProperty(property, value + (unit || ''));
  }
  root.toggleAttribute('data-cms-button-size', settings.buttonSize !== undefined);
  root.toggleAttribute('data-cms-button-radius', settings.buttonRadius !== undefined);
  root.toggleAttribute('data-cms-button-colors', settings.buttonBackground !== undefined || settings.buttonText !== undefined);
  root.toggleAttribute('data-cms-large-brand', settings.brandSize > 150);
  root.toggleAttribute('data-cms-menu', settings.menuCatalog !== undefined || settings.menuOrder !== undefined);
  root.toggleAttribute('data-cms-hero-opposite', settings.heroLayout === 'opposite');
  for (const node of root.querySelectorAll('[data-appearance-text]')) {
    const key = node.dataset.appearanceText;
    if (!Object.hasOwn(elementFields, key)) continue;
    node.textContent = settings[key] ?? elementFields[key][0][3];
    const size = settings[key + 'Size'];
    if (size === undefined) node.style.removeProperty('--cms-element-scale');
    else node.style.setProperty('--cms-element-scale', String(size / 100));
    node.style.color = settings[key + 'Color'] || '';
    if (key === 'eyebrow') node.style.backgroundColor = settings.eyebrowBackground || '';
    const align = settings[key + 'Align'];
    if (align && align !== 'original') node.dataset.cmsAlign = align;
    else delete node.dataset.cmsAlign;
    const position = settings[key + 'Position'];
    node.style.order = position === 'before' ? '-1' : position === 'after' ? '1' : '';
    const weight = settings[key + 'Weight'];
    node.style.fontFamily = fontFamilies[settings[key + 'Font']] || '';
    node.style.fontWeight = weight === 'normal' || weight === 'bold' ? weight : '';
    node.style.textDecorationLine = settings[key + 'Underline'] ? 'underline' : '';
  }
  const account = root.querySelector('[data-appearance-link="account"]');
  const catalog = root.querySelector('[data-appearance-link="catalog"]');
  if (!account || !catalog) return;
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
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    if (error?.code === '23514') throw new Error('העיצוב חורג מנפח האחסון. קצרו את הטקסטים או אפסו הגדרות שאינן דרושות.');
    throw new Error('הפרסום נכשל. יש לבדוק את החיבור ואת הרשאת הניהול.');
  }
  const [row] = await response.json();
  if (!row) throw new Error('העיצוב השתנה בחלון אחר או שההרשאה פגה. טענו מחדש את הגרסה שפורסמה.');
  return row;
}
