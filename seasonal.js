// Automatic seasonal banner driven by the Hebrew calendar (no yearly manual update needed).
// Each season: Hebrew month (as named by Intl "en-u-ca-hebrew"), day range, texts, catalogue link.
const SEASONS = [
  {from: ['Elul', 1], to: ['Tishri', 23], icon: '🍯', title: 'חגי תשרי', text: 'כיפות, סיכות ומדבקות משיח לחגים — מתנה לכל המשפחה', link: '/?category=Kippas#catalog', cta: 'לכיפות משיח'},
  {from: ['Kislev', 1], to: ['Kislev', 19], icon: '🎉', title: 'י״ט כסלו — ראש השנה לחסידות', text: 'מוצרי דגל המשיח להתוועדויות ולחלוקה', link: '/#catalog', cta: 'לכל המוצרים'},
  {from: ['Kislev', 20], to: ['Tevet', 3], icon: '🕎', title: 'חנוכה שמח!', text: 'מתנות משיח לחנוכה: מחזיקי מפתחות, סיכות ומדבקות', link: '/?category=Keychains#catalog', cta: 'למתנות לחנוכה'},
  {from: ['Tevet', 20], to: ['Shevat', 10], icon: '👑', title: 'י׳ שבט', text: 'דגלים ומדבקות משיח להפצה ולמבצעים', link: '/?category=Flags#catalog', cta: 'לדגלי משיח'},
  {from: ['Adar', 1], to: ['Adar', 15], icon: '🎭', title: 'פורים', text: 'מוסיפים דגל משיח למשלוח המנות — מדבקות ומגנטים במבצע', link: '/?category=PhoneStickers#catalog', cta: 'למדבקות'},
  {from: ['Nisan', 1], to: ['Nisan', 11], icon: '🎂', title: 'י״א ניסן', text: 'חוגגים את יום הולדת הרבי עם מוצרי דגל המשיח', link: '/#catalog', cta: 'לכל המוצרים'},
  {from: ['Iyar', 1], to: ['Iyar', 18], icon: '🔥', title: 'ל״ג בעומר', text: 'דגלים, כובעים וכיפות משיח לתהלוכות', link: '/?category=Flags#catalog', cta: 'לדגלי משיח'},
  {from: ['Sivan', 20], to: ['Tamuz', 3], icon: '✨', title: 'ג׳ תמוז', text: 'מפרסמים את הגאולה — מדבקות ודגלים להפצה', link: '/?category=PhoneStickers#catalog', cta: 'למדבקות'},
];
// Civil-year order of months; leap-year Adar I/II both count as "Adar" (Purim is in Adar II).
const ORDER = ['Tishri', 'Heshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Nisan', 'Iyar', 'Sivan', 'Tamuz', 'Av', 'Elul'];

export function hebrewDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-u-ca-hebrew', {month: 'long', day: 'numeric'}).formatToParts(date);
  let month = parts.find(p => p.type === 'month')?.value || '';
  const day = Number(parts.find(p => p.type === 'day')?.value);
  if (month === 'Adar II') month = 'Adar';
  return {month, day, leapFirstAdar: month === 'Adar I'};
}

export function currentSeason(date = new Date()) {
  const {month, day, leapFirstAdar} = hebrewDate(date);
  if (leapFirstAdar || !ORDER.includes(month)) return null;
  // Elul belongs to the end of the cycle, before Tishri of the next year.
  const position = (m, d) => ((ORDER.indexOf(m) + 1) % 12) * 31 + d;
  const now = position(month, day);
  return SEASONS.find(s => now >= position(...s.from) && now <= position(...s.to)) || null;
}

const banner = document.getElementById('seasonal');
const season = banner && new URLSearchParams(location.search).get('season') !== 'off' ? currentSeason() : null;
// A season can be hidden from the admin CMS (section switch) — appearance.js marks it with data-cms-hidden.
if (banner && season && !banner.hasAttribute('data-cms-hidden')) {
  banner.querySelector('.seasonal-icon').textContent = season.icon;
  banner.querySelector('.seasonal-title').textContent = season.title;
  banner.querySelector('.seasonal-text').textContent = season.text;
  const cta = banner.querySelector('.seasonal-cta');
  cta.textContent = season.cta + ' ←';
  cta.href = season.link;
  banner.hidden = false;
}
