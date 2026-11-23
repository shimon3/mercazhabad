// Staff "קהילה" tab: moderate customer reviews and export the newsletter list.
// Injected into the protected dashboard after MFA. RLS (aal2 + role) protects every call.
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
};

export function injectCommunityTab() {
  const nav = document.querySelector('#dashboard .navtabs');
  if (!nav || document.querySelector('[data-view="community"]')) return;
  const tab = el('button', '⭐ קהילה וקופונים');
  tab.dataset.view = 'community';
  tab.setAttribute('aria-pressed', 'false');
  nav.append(tab);
  const panel = el('section', '', 'hidden');
  panel.dataset.panel = 'community';
  panel.append(
    el('h2', 'קודי קופון'),
    el('p', 'ההנחה מחושבת בשרת לפי סכום ההזמנה. קוד לא פעיל או שפג תוקפו נדחה אוטומטית.', 'muted'),
    Object.assign(el('div'), {id: 'couponAdmin'}),
    el('h2', 'חוות דעת לאישור'),
    el('p', 'חוות דעת מתפרסמות באתר ובעמודי המוצר רק אחרי אישור. אין לאשר תוכן פוגעני או פרסומי.', 'muted'),
    Object.assign(el('div'), {id: 'pendingReviews'}),
    el('h2', 'מועדון לקוחות (דוא״ל)'),
    el('p', 'רשימת הנרשמים לעדכונים, כולם אישרו קבלת דיוור. שלחו רק למי שלא ביקש הסרה.', 'muted'),
    Object.assign(el('div', '', 'row'), {id: 'newsletterSummary'}),
  );
  nav.parentElement.append(panel);
}

const shekel = agorot => '₪' + (agorot / 100).toLocaleString('he-IL', {maximumFractionDigits: 2});
function field(labelText, input) {
  const label = el('label', labelText, 'field');
  label.append(input);
  return label;
}
function input(attrs) { return Object.assign(document.createElement('input'), attrs); }

async function renderCoupons(api, role, host) {
  let coupons, stats;
  try {
    [coupons, stats] = await Promise.all([
      api('/rest/v1/mercaz_coupons?select=*&order=created_at.desc&limit=200'),
      api('/rest/v1/mercaz_coupon_stats?select=code,uses,discount_total_agorot'),
    ]);
  } catch {
    host.replaceChildren(el('p', 'טבלת הקופונים עדיין לא הוגדרה (יש להריץ את sql/coupons.sql).', 'status error'));
    return;
  }
  const usage = new Map(stats.map(row => [row.code, row]));
  const nodes = [];
  if (role === 'admin') {
    const form = el('form', '', 'coupon-form');
    const code = input({name: 'code', required: true, pattern: '[A-Za-z0-9_\\-]{3,30}', maxLength: 30, placeholder: 'CHANUKA10', dir: 'ltr'});
    const kind = document.createElement('select');
    kind.name = 'kind';
    kind.append(new Option('אחוז הנחה (%)', 'percent'), new Option('סכום קבוע (₪)', 'fixed'));
    const value = input({name: 'value', type: 'number', required: true, min: '1', step: '0.01'});
    const min = input({name: 'min', type: 'number', min: '0', step: '0.01', placeholder: '0'});
    const expires = input({name: 'expires', type: 'date'});
    const maxUses = input({name: 'max_uses', type: 'number', min: '1', step: '1', placeholder: 'ללא הגבלה'});
    const once = input({name: 'once', type: 'checkbox', checked: true});
    const onceLabel = el('label', '', 'field');
    onceLabel.append(once, ' פעם אחת לכל לקוח');
    const note = input({name: 'note', maxLength: 200, placeholder: 'למשל: קבוצת WhatsApp חנוכה'});
    const submit = el('button', 'יצירת קופון');
    submit.type = 'submit';
    const status = el('p', '', 'status');
    status.setAttribute('role', 'status');
    const grid = el('div', '', 'grid');
    grid.append(field('קוד', code), field('סוג ההנחה', kind), field('גובה ההנחה (₪ או %)', value), field('מינימום הזמנה (₪)', min),
      field('תוקף עד (כולל)', expires), field('מספר שימושים מרבי', maxUses), onceLabel, field('הערה פנימית', note));
    // Quick choice: a fixed amount in shekels or a percentage, in one click (still editable below).
    const presets = el('div', '', 'coupon-presets');
    presets.append(el('span', 'בחירה מהירה:', 'coupon-presets-label'));
    const setPreset = (k, v, button) => {
      kind.value = k;
      value.value = String(v);
      value.step = k === 'percent' ? '1' : '0.01';
      value.max = k === 'percent' ? '100' : '';
      for (const b of presets.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b === button));
      if (!code.value) code.value = k === 'percent' ? 'SAVE' + v : 'OFF' + v;
    };
    for (const [k, v, label] of [['fixed', 5, '₪5'], ['fixed', 10, '₪10'], ['fixed', 20, '₪20'], ['percent', 5, '5%'], ['percent', 10, '10%'], ['percent', 15, '15%'], ['percent', 20, '20%']]) {
      const b = el('button', label, 'secondary coupon-preset');
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => setPreset(k, v, b));
      presets.append(b);
    }
    const valueHint = el('small', 'בסכום קבוע: ההנחה בשקלים. באחוזים: מספר שלם בין 1 ל־100.', 'muted');
    kind.addEventListener('change', () => {
      value.step = kind.value === 'percent' ? '1' : '0.01';
      value.max = kind.value === 'percent' ? '100' : '';
      for (const b of presets.querySelectorAll('button')) b.setAttribute('aria-pressed', 'false');
    });
    value.addEventListener('input', () => { for (const b of presets.querySelectorAll('button')) b.setAttribute('aria-pressed', 'false'); });
    form.append(presets, grid, valueHint, submit, status);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const amount = Number(value.value);
      if (kind.value === 'percent' && (!Number.isInteger(amount) || amount < 1 || amount > 100)) { status.textContent = 'אחוז חייב להיות מספר שלם בין 1 ל־100'; status.className = 'status error'; return; }
      const row = {
        code: code.value.trim().toUpperCase(), kind: kind.value,
        value: kind.value === 'percent' ? amount : Math.round(amount * 100),
        min_total_agorot: Math.round(Number(min.value || 0) * 100),
        expires_at: expires.value ? new Date(expires.value + 'T23:59:59').toISOString() : null,
        max_uses: maxUses.value ? Number(maxUses.value) : null,
        one_per_customer: once.checked, note: note.value.trim() || null,
      };
      submit.disabled = true;
      try {
        await api('/rest/v1/mercaz_coupons', 'POST', row);
        status.textContent = 'הקופון ' + row.code + ' נוצר ✓'; status.className = 'status ok';
        form.reset(); once.checked = true;
        await renderCoupons(api, role, host);
      } catch (error) {
        status.textContent = /duplicate|unique/i.test(error.message) ? 'קוד זה כבר קיים' : 'השמירה נכשלה: ' + error.message;
        status.className = 'status error';
      } finally { submit.disabled = false; }
    });
    nodes.push(form);
  }
  if (!coupons.length) nodes.push(el('p', 'עדיין אין קופונים.', 'muted'));
  for (const coupon of coupons) {
    const used = usage.get(coupon.code);
    const expired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
    const card = el('div', '', 'order');
    const head = el('div', '', 'row');
    head.append(el('strong', coupon.code),
      el('span', coupon.kind === 'percent' ? coupon.value + '% הנחה' : shekel(coupon.value) + ' הנחה', 'pill'),
      el('span', !coupon.active ? 'מושבת' : expired ? 'פג תוקף' : 'פעיל', 'pill'));
    const details = [
      coupon.min_total_agorot ? 'מינימום ' + shekel(coupon.min_total_agorot) : null,
      coupon.expires_at ? 'עד ' + new Date(coupon.expires_at).toLocaleDateString('he-IL') : 'ללא תאריך תפוגה',
      (used?.uses || 0) + (coupon.max_uses ? ' / ' + coupon.max_uses : '') + ' שימושים',
      'סה״כ הנחות ' + shekel(used?.discount_total_agorot || 0),
      coupon.one_per_customer ? 'פעם אחת ללקוח' : 'ללא הגבלה ללקוח',
      coupon.note,
    ].filter(Boolean).join(' · ');
    card.append(head, el('p', details, 'muted'));
    if (role === 'admin') {
      const toggle = el('button', coupon.active ? 'השבתה' : 'הפעלה מחדש', 'secondary');
      toggle.type = 'button';
      toggle.addEventListener('click', async () => {
        toggle.disabled = true;
        try {
          await api('/rest/v1/mercaz_coupons?code=eq.' + encodeURIComponent(coupon.code), 'PATCH', {active: !coupon.active});
          await renderCoupons(api, role, host);
        } catch (error) { toggle.disabled = false; alert('הפעולה נכשלה: ' + error.message); }
      });
      card.append(toggle);
    }
    nodes.push(card);
  }
  host.replaceChildren(...nodes);
}

export async function loadCommunity(api, role = 'manager') {
  const couponHost = document.getElementById('couponAdmin');
  if (couponHost) renderCoupons(api, role, couponHost).catch(() => {});
  const reviewsHost = document.getElementById('pendingReviews');
  const newsHost = document.getElementById('newsletterSummary');
  if (!reviewsHost || !newsHost) return;

  async function renderReviews() {
    let reviews;
    try {
      reviews = await api('/rest/v1/mercaz_reviews?select=id,product_id,display_name,rating,body,created_at&status=eq.pending&order=created_at.asc&limit=100');
    } catch {
      reviewsHost.replaceChildren(el('p', 'טבלת חוות הדעת עדיין לא הוגדרה (יש להריץ את sql/reviews-and-newsletter.sql).', 'status error'));
      return;
    }
    if (!reviews.length) { reviewsHost.replaceChildren(el('p', 'אין חוות דעת שממתינות לאישור ✓', 'muted')); return; }
    reviewsHost.replaceChildren(...reviews.map(review => {
      const card = el('div', '', 'order');
      card.append(
        el('strong', '★'.repeat(review.rating) + ' · ' + review.display_name + ' · ' + review.product_id),
        el('p', review.body),
        el('p', new Date(review.created_at).toLocaleString('he-IL'), 'muted'),
      );
      const actions = el('div', '', 'row');
      const decide = (label, status, className) => {
        const button = el('button', label, className);
        button.type = 'button';
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            await api('/rest/v1/mercaz_reviews?id=eq.' + encodeURIComponent(review.id), 'PATCH', {status, moderated_at: new Date().toISOString()});
            card.remove();
            if (!reviewsHost.children.length) reviewsHost.replaceChildren(el('p', 'אין חוות דעת שממתינות לאישור ✓', 'muted'));
          } catch (error) { button.disabled = false; alert('הפעולה נכשלה: ' + error.message); }
        });
        return button;
      };
      actions.append(decide('אישור ופרסום', 'approved', ''), decide('דחייה', 'rejected', 'secondary'));
      card.append(actions);
      return card;
    }));
  }

  async function renderNewsletter() {
    let rows;
    try {
      rows = await api('/rest/v1/mercaz_newsletter?select=email,created_at,unsubscribed_at,source&order=created_at.desc&limit=5000');
    } catch {
      newsHost.replaceChildren(el('p', 'טבלת המועדון עדיין לא הוגדרה.', 'status error'));
      return;
    }
    const active = rows.filter(row => !row.unsubscribed_at);
    const exportButton = el('button', 'ייצוא CSV', 'secondary');
    exportButton.type = 'button';
    exportButton.disabled = !active.length;
    exportButton.addEventListener('click', () => {
      // Prefix formula-like values so the CSV cannot trigger spreadsheet formulas.
      const safe = value => '"' + String(value).replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""') + '"';
      const csv = 'email,created_at,source\n' + active.map(row => [row.email, row.created_at, row.source].map(safe).join(',')).join('\n');
      const link = el('a');
      link.href = URL.createObjectURL(new Blob(['﻿' + csv], {type: 'text/csv;charset=utf-8'}));
      link.download = 'mercaz-club-' + new Date().toISOString().slice(0, 10) + '.csv';
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    });
    newsHost.replaceChildren(el('strong', active.length + ' נרשמים פעילים'), exportButton);
  }

  await Promise.all([renderReviews(), renderNewsletter()]);
}
