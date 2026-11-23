const endpoint = 'https://bdalhyqpruefdbyirykp.supabase.co/rest/v1/mercaz_storefront_appearance?id=eq.1';
const apikey = 'sb_publishable_K6ciGUejNpRfLeIEc598Iw_L3VoMJYM';
const storageOrigin = 'https://bdalhyqpruefdbyirykp.supabase.co';
const storagePrefix = storageOrigin + '/storage/v1/object/public/';

const fontLabels = {original:'ברירת מחדל', sans:'Noto Sans Hebrew', serif:'Noto Serif Hebrew', rashi:'Noto Rashi Hebrew'};
const fontFamilies = {sans:'"Noto Sans Hebrew CMS", Arial, sans-serif', serif:'"Noto Serif Hebrew CMS", David, serif', rashi:'"Noto Rashi Hebrew CMS", David, serif'};
const fontWeights = {original:'ברירת מחדל', light:'דק (300)', normal:'רגיל (400)', bold:'מודגש (700)'};
const cssFontWeights = {light:'300', normal:'400', bold:'700'};
const alignments = {original:'ברירת מחדל', right:'ימין', center:'מרכז', left:'שמאל'};
const positions = {original:'ברירת מחדל', before:'לפני שאר הטקסטים', after:'אחרי שאר הטקסטים'};
const heroElements = new Set(['eyebrow', 'title', 'subtitle']);
const TEXT_MAX = 300;
const LONG_MAX = 4000;

export const pages = {
  home: {path:'/', label:'דף הבית'},
  account: {path:'/account/', label:'האזור האישי'},
  privacy: {path:'/privacy/', label:'מדיניות פרטיות'},
};

// ---------------------------------------------------------------------------
// Content schema. Each page lists groups of editable elements:
//   [key, label, options]
// kinds: text (default) · long (multi-line paragraph) · image · media (hero video)
//        section (show/hide a block) · group (texts used by scripts, no single node)
// Text defaults come from the page HTML itself unless `def` is given.
// ---------------------------------------------------------------------------
const homeElements = [
  ['סרגל מבצע עליון', [
    ['announce', 'פס המבצע (הצגה/הסתרה)', {kind:'section', background:true}],
    ['announcePromo', 'טקסט המבצע', {hide:true}],
    ['announceAsk', 'טקסט "שאלות?"', {hide:true}],
    ['announceWhatsapp', 'קישור WhatsApp בפס', {hide:true}],
    ['announceOr', 'המילה "או"', {hide:true}],
  ]],
  ['תפריט עליון', [
    ['brand', 'שם החנות בסרגל העליון', {def:'מרכז חב״ד משיח', max:300}],
    ['searchPlaceholder', 'טקסט בתיבת החיפוש', {kind:'placeholder'}],
    ['menuAccount', 'קישור לחשבון', {def:'החשבון שלי'}],
    ['menuCatalog', 'קישור לקטלוג', {def:'לקטלוג ↓'}],
    ['basketButton', 'כפתור סל הקניות', {def:'סל קניות'}],
  ]],
  ['אזור הפתיחה', [
    ['eyebrow', 'שם החנות באזור הפתיחה', {def:'מרכז חב״ד משיח', max:600}],
    ['title', 'כותרת ראשית', {def:'מוצרי דגל המשיח.', max:200, min:10}],
    ['subtitle', 'טקסט פתיחה', {def:'מפרסם את הגאולה בעזרת מוצרי דגל המשיח.'}],
    ['catalogButton', 'כפתור הקטלוג', {def:'גלו את הקטלוג', link:true}],
    ['dealsButton', 'כפתור המבצעים', {link:true, hide:true}],
    ['heroMedia', 'סרטון / תמונה ראשית', {kind:'media'}],
  ]],
  ['כרטיס קולקציה (דגליה)', [
    ['promoHeroes', 'הכרטיס כולו', {kind:'section', link:true, background:true}],
    ['promoHeroesSmall', 'תגית קטנה', {hide:true}],
    ['modelsButton', 'כותרת הכרטיס', {def:'דגמי דגליה ודגלית'}],
    ['promoHeroesNote', 'שורת הסבר', {hide:true}],
    ['promoHeroesImage1', 'תמונה 1', {kind:'image'}],
    ['promoHeroesImage2', 'תמונה 2', {kind:'image'}],
  ]],
  ['כרטיס מבצע מדבקות', [
    ['promoStickers', 'הכרטיס כולו', {kind:'section', link:true, background:true}],
    ['promoStickersSmall', 'תגית קטנה', {hide:true}],
    ['promoStickersTitle', 'כותרת הכרטיס'],
    ['promoStickersNote', 'שורת הסבר', {hide:true}],
    ['promoStickersImage1', 'תמונה 1', {kind:'image'}],
    ['promoStickersImage2', 'תמונה 2', {kind:'image'}],
  ]],
  ['יתרונות (4 קוביות)', [
    ['perks', 'שורת היתרונות כולה', {kind:'section', background:true}],
    ...[1, 2, 3, 4].flatMap(n => [
      ['perk' + n, 'יתרון ' + n + ' (הצגה/הסתרה)', {kind:'section'}],
      ['perk' + n + 'Icon', 'יתרון ' + n + ' · אייקון (אימוג׳י)', {typo:false}],
      ['perk' + n + 'Title', 'יתרון ' + n + ' · כותרת'],
      ['perk' + n + 'Text', 'יתרון ' + n + ' · טקסט'],
    ]),
  ]],
  ['קטגוריות ומדפים', [
    ['categoriesShelf', 'מדף הקטגוריות (הצגה/הסתרה)', {kind:'section'}],
    ['categoriesTitle', 'כותרת הקטגוריות', {def:'קנו לפי קטגוריה'}],
    ['categoryNames', 'שמות הקטגוריות והמסננים', {kind:'group', fields:[
      ['catAll', 'כל המוצרים', 'כל המוצרים'],
      ['catPhoneStickers', 'מדבקות לפלאפון', 'מדבקות לפלאפון'],
      ['catCarMagnets', 'מגנטים לרכב', 'מגנטים לרכב'],
      ['catPins', 'סיכות', 'סיכות משיח'],
      ['catKippas', 'כיפות', 'כיפות משיח'],
      ['catCaps', 'כובעים', 'כובעי משיח'],
      ['catKeychains', 'מחזיקי מפתחות', 'מחזיקי מפתחות'],
      ['catFlags', 'דגלים', 'דגלי משיח'],
      ['catSoldierPatches', 'פאצ׳ים', 'פאצ׳ים לחיילים'],
      ['catGeneral', 'כללי', 'מוצרי משיח כללי'],
      ['badgeAll', 'מסנן: כל המדבקות', 'כל המדבקות'],
      ['badgeHeroes', 'מסנן: גיבורי אל משיח', 'גיבורי אל משיח'],
      ['badgeCountry', 'מסנן: סמלי מדינות', 'סמלי מדינות'],
      ['badgeIdf', 'מסנן: סמלי יחידות', 'סמלי יחידות צה״ל'],
    ]}],
    // Each category tile is independently selectable in the visual editor.
    ['catAll', 'קטגוריה: כל המוצרים · שם', {typo:false}],
    ['catAllImage', 'קטגוריה: כל המוצרים · תמונה', {kind:'image'}],
    ['catAllCard', 'קטגוריה: כל המוצרים · הצגה/הסתרה', {kind:'section'}],
    ['catPhoneStickers', 'קטגוריה: מדבקות לפלאפון · שם', {typo:false}],
    ['catPhoneStickersImage', 'קטגוריה: מדבקות לפלאפון · תמונה', {kind:'image'}],
    ['catPhoneStickersCard', 'קטגוריה: מדבקות לפלאפון · הצגה/הסתרה', {kind:'section'}],
    ['catCarMagnets', 'קטגוריה: מגנטים לרכב · שם', {typo:false}],
    ['catCarMagnetsImage', 'קטגוריה: מגנטים לרכב · תמונה', {kind:'image'}],
    ['catCarMagnetsCard', 'קטגוריה: מגנטים לרכב · הצגה/הסתרה', {kind:'section'}],
    ['catPins', 'קטגוריה: סיכות משיח · שם', {typo:false}],
    ['catPinsImage', 'קטגוריה: סיכות משיח · תמונה', {kind:'image'}],
    ['catPinsCard', 'קטגוריה: סיכות משיח · הצגה/הסתרה', {kind:'section'}],
    ['catKippas', 'קטגוריה: כיפות משיח · שם', {typo:false}],
    ['catKippasImage', 'קטגוריה: כיפות משיח · תמונה', {kind:'image'}],
    ['catKippasCard', 'קטגוריה: כיפות משיח · הצגה/הסתרה', {kind:'section'}],
    ['catCaps', 'קטגוריה: כובעי משיח · שם', {typo:false}],
    ['catCapsImage', 'קטגוריה: כובעי משיח · תמונה', {kind:'image'}],
    ['catCapsCard', 'קטגוריה: כובעי משיח · הצגה/הסתרה', {kind:'section'}],
    ['catKeychains', 'קטגוריה: מחזיקי מפתחות · שם', {typo:false}],
    ['catKeychainsImage', 'קטגוריה: מחזיקי מפתחות · תמונה', {kind:'image'}],
    ['catKeychainsCard', 'קטגוריה: מחזיקי מפתחות · הצגה/הסתרה', {kind:'section'}],
    ['catFlags', 'קטגוריה: דגלי משיח · שם', {typo:false}],
    ['catFlagsImage', 'קטגוריה: דגלי משיח · תמונה', {kind:'image'}],
    ['catFlagsCard', 'קטגוריה: דגלי משיח · הצגה/הסתרה', {kind:'section'}],
    ['catSoldierPatches', 'קטגוריה: פאצ׳ים לחיילים · שם', {typo:false}],
    ['catSoldierPatchesImage', 'קטגוריה: פאצ׳ים לחיילים · תמונה', {kind:'image'}],
    ['catSoldierPatchesCard', 'קטגוריה: פאצ׳ים לחיילים · הצגה/הסתרה', {kind:'section'}],
    ['catGeneral', 'קטגוריה: מוצרי משיח כללי · שם', {typo:false}],
    ['catGeneralImage', 'קטגוריה: מוצרי משיח כללי · תמונה', {kind:'image'}],
    ['catGeneralCard', 'קטגוריה: מוצרי משיח כללי · הצגה/הסתרה', {kind:'section'}],
    ['badgeHeroes', 'קטגוריה: גיבורי אל משיח · שם', {typo:false}],
    ['catHeroesImage', 'קטגוריה: גיבורי אל משיח · תמונה', {kind:'image'}],
    ['catHeroesCard', 'קטגוריה: גיבורי אל משיח · הצגה/הסתרה', {kind:'section'}],
    ['deals', 'מדף המבצעים (הצגה/הסתרה)', {kind:'section'}],
    ['dealsTitle', 'כותרת המבצעים', {def:'🔥 המבצעים הכי שווים'}],
    ['dealsLink', 'קישור "לכל המוצרים"', {link:true}],
    ['heroes', 'מדף גיבורי אל משיח (הצגה/הסתרה)', {kind:'section'}],
    ['heroesTitle', 'כותרת גיבורי אל משיח', {def:'✨ גיבורי אל משיח'}],
    ['heroesLink', 'קישור "לכל הדגמים"', {link:true}],
  ]],
  ['קטלוג וכרטיסי מוצר', [
    ['catalogTexts', 'טקסטים בקטלוג', {kind:'group', fields:[
      ['catalogAllTitle', 'כותרת הקטלוג (כל המוצרים)', 'כל המוצרים'],
      ['uiProductsCount', 'המילה אחרי מספר המוצרים', 'מוצרים'],
      ['uiNoResults', 'אין תוצאות לחיפוש', 'לא נמצאו מוצרים התואמים לחיפוש.'],
      ['uiAddToCart', 'כפתור הוספה לסל', 'הוספה לסל'],
      ['uiAdded', 'אחרי הוספה לסל', 'נוסף ✓'],
      ['uiToast', 'הודעה קופצת אחרי הוספה', '✓ המוצר נוסף לסל'],
      ['uiAskWhatsapp', 'כפתור שאלה ב־WhatsApp', 'שאלה ב־WhatsApp'],
      ['uiWhatsappMessage', 'תחילת הודעת WhatsApp על מוצר', 'שלום, אשמח לקבל מידע על המוצר'],
      ['uiPriceAsk', 'מוצר ללא מחיר', 'מחיר בבירור'],
      ['uiFrom', 'קידומת "החל מ־"', 'החל מ־'],
      ['uiSaveBadge', 'תגית הנחה (לפני האחוז)', 'חסכו'],
      ['uiSaveLine', 'שורת חיסכון (לפני הסכום)', 'חוסכים'],
      ['uiNewBadge', 'תגית "חדש"', 'חדש'],
      ['uiOutOfStock', 'אזל מהמלאי', 'אזל מהמלאי'],
      ['uiNoPhoto', 'מוצר ללא תמונה', 'תמונה בקרוב'],
      ['uiPack4', 'שם מארז 4 מדבקות', 'מארז 4 יח׳'],
      ['uiPack10', 'שם מארז 10 מדבקות', 'מארז 10 יח׳'],
    ]}],
    ['sortLabel', 'המילה "מיון"'],
    ['sortRecommended', 'מיון: מומלצים'],
    ['sortLow', 'מיון: מהנמוך לגבוה'],
    ['sortHigh', 'מיון: מהגבוה לנמוך'],
    ['resetButton', 'כפתור איפוס'],
  ]],
  ['סל הקניות', [
    ['cartTexts', 'טקסטים בסל', {kind:'group', fields:[
      ['uiCheckout', 'כפתור המשך להזמנה', 'המשך להזמנה'],
      ['uiTotal', 'סך הכל', 'סך הכל'],
      ['uiCartNote', 'הערה בתחתית הסל', 'אין חיוב בכרטיס בשלב זה.'],
      ['uiCartEmpty', 'סל ריק', 'אין מוצרים זמינים בסל.'],
      ['uiRemove', 'כפתור הסרה', 'הסרה'],
    ]}],
    ['cartOverline', 'תגית מעל כותרת הסל'],
    ['cartTitle', 'כותרת הסל'],
    ['floatingCartLabel', 'כפתור סל צף · טקסט'],
    ['floatingCartGo', 'כפתור סל צף · "לתשלום"'],
  ]],
  ['באנר חגים אוטומטי', [
    ['seasonal', 'באנר לפי לוח השנה העברי (הצגה/הסתרה)', {kind:'section', background:true}],
  ]],
  ['מועדון לקוחות', [
    ['club', 'אזור ההרשמה לעדכונים (הצגה/הסתרה)', {kind:'section', background:true}],
    ['clubTitle', 'כותרת המועדון', {def:'👑 מועדון מרכז חב״ד משיח'}],
    ['clubText', 'טקסט המועדון'],
    ['clubButton', 'כפתור ההרשמה', {def:'הצטרפות'}],
    ['clubWhatsapp', 'קישור עדכונים ב־WhatsApp', {hide:true}],
  ]],
  ['פס עזרה', [
    ['helpBand', 'פס העזרה (הצגה/הסתרה)', {kind:'section', background:true}],
    ['helpTitle', 'כותרת העזרה', {def:'לא בטוחים מה לבחור?'}],
    ['helpText', 'טקסט העזרה', {kind:'long'}],
    ['helpButton', 'כפתור WhatsApp', {whatsappMessage:true}],
  ]],
  ['תחתית העמוד', [
    ['footer', 'התחתית (צבעים)', {kind:'section', background:true, hideable:false}],
    ['footerName', 'שם החנות בתחתית'],
    ['footerTagline', 'משפט בתחתית', {kind:'long'}],
    ['footerWhatsapp', 'קישור WhatsApp', {hide:true}],
    ['footerAccount', 'קישור החשבון', {hide:true}],
    ['footerAbout', 'קישור אודות', {hide:true}],
    ['footerPrivacy', 'קישור מדיניות פרטיות', {hide:true}],
    ['waFloat', 'כפתור WhatsApp צף', {kind:'section'}],
  ]],
];

const privacyLabels = {he:'עברית', fr:'צרפתית', en:'אנגלית'};
const privacyElements = [
  ['ראש העמוד', [
    ['privacyBack', 'קישור חזרה לחנות', {def:'← חזרה לחנות מרכז חב״ד משיח'}],
    ['privacyTitle', 'כותרת העמוד', {def:'מדיניות פרטיות · Privacy Policy'}],
    ['privacyUpdated', 'תאריך עדכון', {kind:'long'}],
    ['privacyIntro', 'משפט פתיחה', {kind:'long'}],
    ['privacyLanguages', 'תפריט השפות', {kind:'section'}],
  ]],
  ...Object.entries(privacyLabels).map(([lang, label]) => ['מדיניות ב' + label, [
    ['privacy_' + lang, 'כל החלק ב' + label + ' (הצגה/הסתרה)', {kind:'section'}],
    ...[1, 2, 3, 4, 5, 6, 7].flatMap(n => [
      ['privacy_' + lang + n + 'Title', 'סעיף ' + n + ' · כותרת'],
      ['privacy_' + lang + n + 'Text', 'סעיף ' + n + ' · טקסט', {kind:'long'}],
    ]),
  ]]),
  ['תחתית', [['privacyFooter', 'טקסט התחתית', {kind:'long'}]]],
];

const accountElements = [
  ['ראש העמוד', [
    ['accountBrand', 'כותרת הסרגל', {def:'מרכז חב״ד משיח · האזור האישי'}],
    ['accountBack', 'קישור חזרה לחנות'],
    ['accountPrivacyLink', 'קישור מדיניות פרטיות'],
  ]],
  ['כניסה והרשמה', [
    ['accountLogin', 'כותרת הכניסה', {def:'כניסה / הרשמה'}],
    ['accountIntro', 'טקסט מתחת לכותרת', {def:'התחברו כדי לשלוח הזמנה ולעקוב אחר מצבה.'}],
    ['accountLoginTab', 'לשונית כניסה'],
    ['accountSignupTab', 'לשונית הרשמה'],
    ['accountForgot', 'כפתור שכחתי סיסמה'],
    ['accountNote', 'הערה בתחתית הכניסה', {kind:'long'}],
  ]],
  ['לאחר כניסה', [
    ['accountTitle', 'כותרת החשבון לאחר כניסה', {def:'החשבון שלי'}],
    ['checkoutTitle', 'כותרת שליחת הזמנה'],
    ['checkoutNote', 'הודעה על התשלום', {kind:'long'}],
    ['checkoutPrivacyNote', 'הערת פרטיות בטופס', {kind:'long'}],
    ['accountOrders', 'כותרת ההזמנות', {def:'ההזמנות שלי'}],
  ]],
];

export const elementGroups = {home:homeElements, account:accountElements, privacy:privacyElements};
// Flat list per page, kept for callers that only need [key, label].
export const elements = Object.fromEntries(Object.entries(elementGroups)
  .map(([page, groups]) => [page, groups.flatMap(([, items]) => items)]));

// Site-wide contact details (phone and WhatsApp links on every page).
const contactFields = [
  ['contactPhone', 'טלפון לתצוגה', 'text', '053-377-0073'],
  ['contactPhoneIntl', 'טלפון בפורמט בינלאומי (לחיוג)', 'tel', '+972533770073'],
  ['contactWhatsapp', 'מספר WhatsApp (ספרות בלבד, עם 972)', 'tel', '972533770073'],
];
export const CONTACT = 'contact';

const homeStyle = [
  ['paper', 'רקע העמוד', 'color', '#ffffff', '--paper'],
  ['ink', 'צבע הטקסט', 'color', '#0f1b4d', '--ink'],
  ['accent', 'צבע הדגשה', 'color', '#ffd21f', '--gold'],
  ['buttonBackground', 'רקע כפתורים ראשיים', 'color', '#ffd21f', '--cms-button-bg'],
  ['buttonText', 'טקסט כפתורים ראשיים', 'color', '#0f1b4d', '--cms-button-text'],
  ['textSize', 'גודל הטקסט הכללי (%)', 'number', 100, '--cms-text-size', 85, 125, '%'],
  ['buttonSize', 'גודל טקסט בכפתורים (פיקסלים)', 'number', 16, '--cms-button-size', 12, 22, 'px'],
  ['buttonRadius', 'עיגול פינות כפתורים (פיקסלים)', 'number', 0, '--cms-button-radius', 0, 32, 'px'],
  ['menuOrder', 'סדר קישורים', 'select', 'account', {account:'חשבון ואז קטלוג', catalog:'קטלוג ואז חשבון'}],
  ['hideCatalog', 'הסתרת קישור הקטלוג בתפריט', 'checkbox', false],
  ['hideAccount', 'הסתרת קישור החשבון בתפריט', 'checkbox', false],
  ['heroLayout', 'מיקום הסרטון באזור הפתיחה', 'select', 'original', {original:'ברירת מחדל', opposite:'החלפת צד עם הטקסט'}],
];
const seoFields = page => [
  [page + 'MetaTitle', 'כותרת הדף בגוגל ובלשונית הדפדפן', 'text', null],
  [page + 'MetaDescription', 'תיאור הדף בגוגל', 'textarea', null],
];

export const pageFields = {
  home: [...homeStyle, ...seoFields('home')],
  account: [
    ['accountBackground', 'רקע העמוד', 'color', null, '--cms-account-bg'],
    ['accountInk', 'צבע הטקסט בעמוד', 'color', null, '--cms-account-ink'],
    ...seoFields('account'),
  ],
  privacy: [
    ['privacyBackground', 'רקע העמוד', 'color', null, '--cms-privacy-bg'],
    ['privacyInk', 'צבע הטקסט בעמוד', 'color', null, '--cms-privacy-ink'],
    ...seoFields('privacy'),
  ],
};

function typographyFields(key, {max = 200, min = 60} = {}) {
  return [
    [key + 'Size', 'גודל (%)', 'number', 100, null, min, max, 'scale'],
    [key + 'Font', 'גופן', 'select', 'original', fontLabels],
    [key + 'Color', 'צבע הטקסט', 'color', null],
    ...(key === 'eyebrow' ? [[key + 'Background', 'צבע רקע התגית', 'color', '#0f1b4d']] : []),
    [key + 'Weight', 'משקל', 'select', 'original', fontWeights],
    [key + 'Underline', 'קו תחתון', 'checkbox', false],
    ...(heroElements.has(key) ? [
      [key + 'Align', 'יישור', 'select', 'original', alignments],
      [key + 'Position', 'מיקום באזור הפתיחה', 'select', 'original', positions],
    ] : []),
  ];
}

function fieldsForElement(key, options = {}) {
  const kind = options.kind || 'text';
  const link = options.link ? [[key + 'Link', 'כתובת הקישור', 'url', null]] : [];
  const hide = options.hide ? [[key + 'Hidden', 'הסתרה מהאתר', 'checkbox', false]] : [];
  if (kind === 'group') return options.fields.map(([field, label, def]) => [field, label, 'text', def]);
  if (kind === 'placeholder') return [[key, 'טקסט', 'text', options.def ?? null]];
  if (kind === 'section') return [
    ...(options.hideable === false ? [] : [[key + 'Hidden', 'הסתרה מהאתר', 'checkbox', false]]),
    ...link,
    ...(options.background ? [
      [key + 'Background', 'צבע רקע', 'color', null],
      [key + 'Color', 'צבע טקסט', 'color', null],
    ] : []),
  ];
  if (kind === 'image') return [
    [key, 'תמונה', 'image', null],
    [key + 'Hidden', 'הסתרת התמונה', 'checkbox', false],
  ];
  if (kind === 'media') return [
    [key + 'Image', 'תמונה במקום הסרטון (אופציונלי)', 'image', null],
    [key, 'קישור לקובץ וידאו (MP4)', 'url', null],
    [key + 'Poster', 'תמונת פתיחה של הסרטון', 'image', null],
    [key + 'Hidden', 'הסתרת הסרטון/התמונה', 'checkbox', false],
  ];
  if (kind === 'long') return [
    [key, 'טקסט (שורה חדשה = Enter, **מודגש**)', 'textarea', options.def ?? null],
    [key + 'Size', 'גודל (%)', 'number', 100, null, 60, 200, 'scale'],
    [key + 'Color', 'צבע הטקסט', 'color', null],
    ...hide,
  ];
  return [
    [key, 'טקסט', 'text', options.def ?? null],
    ...(options.whatsappMessage ? [[key + 'Message', 'ההודעה שתיפתח ב־WhatsApp', 'textarea', null]] : []),
    ...link,
    ...(options.typo === false ? [] : typographyFields(key, options)),
    ...hide,
  ];
}

export const elementKinds = {};
export const elementFields = {[CONTACT]:contactFields};
for (const items of Object.values(elements)) {
  for (const [key, , options = {}] of items) {
    elementKinds[key] = options.kind || 'text';
    elementFields[key] = fieldsForElement(key, options);
  }
}

const fieldsByKey = Object.fromEntries([...Object.values(pageFields).flat(), ...Object.values(elementFields).flat()]
  .map(field => [field[0], field]));

// ---------------------------------------------------------------------------
// Validation: only known keys, bounded text, safe URLs.
// ---------------------------------------------------------------------------
export function safeImageUrl(value) {
  if (typeof value !== 'string' || value.length > 600) return null;
  if (/^\/(?!\/)[\w\-./%]+\.(?:webp|jpe?g|png|gif|svg|avif)$/i.test(value)) return value;
  if (value.startsWith(storagePrefix) && /^[\w\-./%]+$/.test(value.slice(storagePrefix.length))) return value;
  return null;
}
export function safeVideoUrl(value) {
  if (typeof value !== 'string' || value.length > 600) return null;
  if (/^\/(?!\/)[\w\-./%]+\.(?:mp4|webm)$/i.test(value)) return value;
  if (value.startsWith(storagePrefix) && /^[\w\-./%]+\.(?:mp4|webm)$/i.test(value.slice(storagePrefix.length))) return value;
  return null;
}
export function safeLink(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 600) return null;
  const link = value.trim();
  if (/^#[\w-]*$/.test(link)) return link;
  if (/^\/(?!\/)[^\s"'<>\\]*$/.test(link)) return link;
  if (/^tel:\+?[\d-]{6,20}$/.test(link)) return link;
  if (/^mailto:[^\s"'<>\\@]+@[^\s"'<>\\@]+$/.test(link)) return link;
  try {
    const url = new URL(link);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch {}
  return null;
}

export function sanitizeAppearance(raw) {
  const settings = {};
  for (const [key, , type, , choices, min, max] of Object.values(fieldsByKey)) {
    const value = raw?.[key];
    if (value === undefined || value === null) continue;
    if (type === 'text' && typeof value === 'string' && value.trim() && value.length <= TEXT_MAX) settings[key] = value.trim();
    if (type === 'textarea' && typeof value === 'string' && value.trim() && value.length <= LONG_MAX) settings[key] = value.replace(/\r\n?/g, '\n').trim();
    if (type === 'tel' && typeof value === 'string' && /^\+?\d{6,15}$/.test(value.trim())) settings[key] = value.trim();
    if (type === 'color' && typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)) settings[key] = value;
    if (type === 'number' && Number.isInteger(value) && value >= min && value <= max) settings[key] = value;
    if (type === 'select' && Object.hasOwn(choices, value)) settings[key] = value;
    if (type === 'checkbox' && typeof value === 'boolean') settings[key] = value;
    if (type === 'image' && safeImageUrl(value)) settings[key] = value;
    if (type === 'url') {
      const safe = elementKinds[key] === 'media' ? safeVideoUrl(value) : safeLink(value);
      if (safe) settings[key] = safe;
    }
  }
  return settings;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
const originals = new WeakMap();
function remember(node, name) {
  let saved = originals.get(node);
  if (!saved) originals.set(node, saved = {});
  if (!(name in saved)) saved[name] = name === 'html' ? node.innerHTML : node.getAttribute(name);
  return saved[name];
}
function restore(node, name) {
  const saved = originals.get(node);
  if (!saved || !(name in saved)) return;
  if (name === 'html') node.innerHTML = saved.html;
  else if (saved[name] === null) node.removeAttribute(name);
  else node.setAttribute(name, saved[name]);
}

/** Original page text for an element (used by the editor as the default value). */
export function originalText(doc, key) {
  const node = doc?.querySelector(`[data-appearance-text="${key}"]`);
  if (node) {
    const saved = originals.get(node);
    const holder = doc.createElement('div');
    holder.innerHTML = saved?.html ?? node.innerHTML;
    for (const bold of holder.querySelectorAll('b, strong')) bold.replaceWith('**' + bold.textContent + '**');
    return holder.textContent.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
  }
  const input = doc?.querySelector(`[data-appearance-placeholder="${key}"]`);
  if (input) return originals.get(input)?.placeholder ?? input.getAttribute('placeholder') ?? '';
  return null;
}

function renderRich(node, value, long) {
  const doc = node.ownerDocument;
  const parts = [];
  for (const piece of value.split(/(\*\*[^*\n]+\*\*)/)) {
    if (!piece) continue;
    if (/^\*\*[^*\n]+\*\*$/.test(piece)) {
      const bold = doc.createElement('b');
      bold.textContent = piece.slice(2, -2);
      parts.push(bold);
    } else if (long) {
      for (const chunk of piece.split(/(https:\/\/[^\s<>"']+)/)) {
        if (!chunk) continue;
        if (chunk.startsWith('https://') && safeLink(chunk)) {
          const anchor = doc.createElement('a');
          anchor.href = safeLink(chunk);
          anchor.textContent = chunk.replace(/^https:\/\//, '').replace(/\/$/, '');
          anchor.rel = 'noopener noreferrer';
          parts.push(anchor);
        } else parts.push(doc.createTextNode(chunk));
      }
    } else parts.push(doc.createTextNode(piece));
  }
  node.replaceChildren(...parts);
}

function nodesFor(root, key) {
  return root.querySelectorAll(
    `[data-appearance-text="${key}"],[data-appearance-section="${key}"],[data-appearance-image="${key}"],` +
    `[data-appearance-media="${key}"],[data-appearance-placeholder="${key}"]`);
}

function applyTypography(node, key, settings) {
  const size = settings[key + 'Size'];
  if (size === undefined) node.style.removeProperty('--cms-element-scale');
  else node.style.setProperty('--cms-element-scale', String(size / 100));
  node.toggleAttribute('data-cms-scaled', size !== undefined);
  node.style.color = settings[key + 'Color'] || '';
  if (key === 'eyebrow') node.style.backgroundColor = settings.eyebrowBackground || '';
  const align = settings[key + 'Align'];
  if (align && align !== 'original') node.dataset.cmsAlign = align;
  else delete node.dataset.cmsAlign;
  const position = settings[key + 'Position'];
  node.style.order = position === 'before' ? '-1' : position === 'after' ? '1' : '';
  const weight = settings[key + 'Weight'];
  node.style.fontFamily = fontFamilies[settings[key + 'Font']] || '';
  node.style.fontWeight = cssFontWeights[weight] ?? '';
  node.style.textDecorationLine = settings[key + 'Underline'] ? 'underline' : '';
}

function applyContact(root, settings) {
  const phone = settings.contactPhone;
  const intl = settings.contactPhoneIntl;
  const whatsapp = settings.contactWhatsapp;
  for (const node of root.querySelectorAll('[data-appearance-phone]')) {
    remember(node, 'html');
    if (phone) node.textContent = phone;
    else restore(node, 'html');
  }
  for (const link of root.querySelectorAll('a[href^="tel:"]')) {
    remember(link, 'href');
    if (intl) link.setAttribute('href', 'tel:' + intl);
    else restore(link, 'href');
  }
  for (const link of root.querySelectorAll('a[href*="wa.me/"]')) {
    const original = remember(link, 'href');
    link.setAttribute('href', whatsapp ? original.replace(/wa\.me\/\d+/, 'wa.me/' + whatsapp.replace(/\D/g, '')) : original);
  }
}

function applyMeta(root, settings, page) {
  const doc = root.ownerDocument;
  if (root !== doc.documentElement) return;
  const title = doc.querySelector('title');
  if (title) {
    remember(title, 'html');
    if (settings[page + 'MetaTitle']) title.textContent = settings[page + 'MetaTitle'];
    else restore(title, 'html');
  }
  const description = doc.querySelector('meta[name="description"]');
  if (description) {
    remember(description, 'content');
    if (settings[page + 'MetaDescription']) description.setAttribute('content', settings[page + 'MetaDescription']);
    else restore(description, 'content');
  }
}

export function applyAppearance(root, raw, page = 'home') {
  const settings = sanitizeAppearance(raw);
  for (const [key, , type, , property, , , unit] of pageFields[page] || []) {
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

  // Contact details first so later text overrides (e.g. a link label) still win.
  applyContact(root, settings);

  for (const node of root.querySelectorAll('[data-appearance-text]')) {
    const key = node.dataset.appearanceText;
    if (!Object.hasOwn(elementFields, key)) continue;
    const long = elementKinds[key] === 'long';
    remember(node, 'html');
    if (settings[key] !== undefined) {
      renderRich(node, settings[key], long);
      node.toggleAttribute('data-cms-long', long);
    } else {
      restore(node, 'html');
      node.removeAttribute('data-cms-long');
      if (node.hasAttribute('data-appearance-phone') && settings.contactPhone) node.textContent = settings.contactPhone;
    }
    applyTypography(node, key, settings);
  }

  for (const node of root.querySelectorAll('[data-appearance-placeholder]')) {
    const key = node.dataset.appearancePlaceholder;
    remember(node, 'placeholder');
    if (settings[key]) node.setAttribute('placeholder', settings[key]);
    else restore(node, 'placeholder');
  }

  for (const node of root.querySelectorAll('[data-appearance-href]')) {
    const key = node.dataset.appearanceHref;
    const link = settings[key + 'Link'];
    const original = remember(node, 'href') || '';
    if (link) node.setAttribute('href', link);
    else {
      restore(node, 'href');
      // Restoring a phone/WhatsApp link must keep the site-wide contact number.
      if (/^(?:tel:|https:\/\/wa\.me\/)/.test(original)) applyContact(node.parentNode || root, settings);
    }
    const message = settings[key + 'Message'];
    if (message && /wa\.me\//.test(node.getAttribute('href'))) {
      const url = new URL(node.getAttribute('href'));
      url.search = '?text=' + encodeURIComponent(message);
      node.setAttribute('href', url.href);
    }
  }

  for (const node of root.querySelectorAll('[data-appearance-section]')) {
    const key = node.dataset.appearanceSection;
    node.style.backgroundColor = settings[key + 'Background'] || '';
    node.style.color = settings[key + 'Color'] || '';
  }

  for (const node of root.querySelectorAll('[data-appearance-image]')) {
    const key = node.dataset.appearanceImage;
    remember(node, 'src');
    if (settings[key]) node.setAttribute('src', settings[key]);
    else restore(node, 'src');
    if (node.hasAttribute('data-appearance-optional')) node.toggleAttribute('data-cms-empty', !settings[key]);
  }

  for (const node of root.querySelectorAll('[data-appearance-media]')) {
    const key = node.dataset.appearanceMedia;
    remember(node, 'src');
    remember(node, 'poster');
    const video = settings[key];
    const poster = settings[key + 'Poster'];
    if (video && node.getAttribute('src') !== video) node.setAttribute('src', video);
    else if (!video) {
      const saved = originals.get(node).src;
      if (saved !== null && node.getAttribute('src') !== saved) node.setAttribute('src', saved);
    }
    if (poster) node.setAttribute('poster', poster);
    else restore(node, 'poster');
    const replaced = Boolean(settings[key + 'Image']);
    node.toggleAttribute('data-cms-replaced', replaced);
    const holder = node.closest('.exhibit');
    holder?.toggleAttribute('data-cms-photo', replaced);
    if (replaced && !node.paused) node.pause();
  }

  // Hide toggles work on every node type.
  for (const key of Object.keys(elementFields)) {
    const hidden = settings[key + 'Hidden'] === true;
    for (const node of nodesFor(root, key)) node.toggleAttribute('data-cms-hidden', hidden);
  }

  applyMeta(root, settings, page);

  const account = root.querySelector('[data-appearance-link="account"]');
  const catalog = root.querySelector('[data-appearance-link="catalog"]');
  if (account && catalog) {
    account.hidden = settings.hideAccount === true;
    catalog.hidden = settings.hideCatalog === true;
    if (settings.menuOrder === 'catalog') account.before(catalog);
    else catalog.before(account);
  }

  // Scripts that build content dynamically (catalogue, cart) read these texts.
  const doc = root.ownerDocument;
  doc.cmsSettings = settings;
  doc.dispatchEvent(new (doc.defaultView?.CustomEvent || CustomEvent)('cms:applied', {detail:settings}));
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
    if (error?.code === '23514') throw new Error('התוכן חורג מנפח האחסון (64KB). קצרו טקסטים ארוכים או אפסו הגדרות שאינן דרושות.');
    throw new Error('הפרסום נכשל. יש לבדוק את החיבור ואת הרשאת הניהול.');
  }
  const [row] = await response.json();
  if (!row) throw new Error('העיצוב השתנה בחלון אחר או שההרשאה פגה. טענו מחדש את הגרסה שפורסמה.');
  return row;
}

export async function uploadCmsImage(file, token) {
  if (!file?.size) throw new Error('לא נבחר קובץ.');
  const types = {'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp'};
  if (!types[file.type] || file.size > 20 * 1024 * 1024) throw new Error('יש לבחור תמונה JPG/PNG/WebP עד 20MB.');
  // JPG/PNG → WebP in the browser before upload (loaded only in the admin editor).
  const {prepareUpload} = await import('/admin/webp.js?v=1');
  const ready = await prepareUpload(file, {maxSize: 2000});
  const key = 'cms/' + crypto.randomUUID() + '.' + ready.ext;
  const response = await fetch(storageOrigin + '/storage/v1/object/mercaz-product-images/' + key, {
    method:'POST',
    headers:{apikey, Authorization:'Bearer ' + token, 'Content-Type':ready.type, 'cache-control':'31536000'},
    body:ready.blob,
  });
  if (!response.ok) throw new Error('העלאת התמונה נכשלה (' + response.status + ').');
  return storagePrefix + 'mercaz-product-images/' + key;
}
