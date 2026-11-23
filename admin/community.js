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
  const tab = el('button', '⭐ קהילה');
  tab.dataset.view = 'community';
  tab.setAttribute('aria-pressed', 'false');
  nav.append(tab);
  const panel = el('section', '', 'hidden');
  panel.dataset.panel = 'community';
  panel.append(
    el('h2', 'חוות דעת לאישור'),
    el('p', 'חוות דעת מתפרסמות באתר ובעמודי המוצר רק אחרי אישור. אין לאשר תוכן פוגעני או פרסומי.', 'muted'),
    Object.assign(el('div'), {id: 'pendingReviews'}),
    el('h2', 'מועדון לקוחות (דוא״ל)'),
    el('p', 'רשימת הנרשמים לעדכונים, כולם אישרו קבלת דיוור. שלחו רק למי שלא ביקש הסרה.', 'muted'),
    Object.assign(el('div', '', 'row'), {id: 'newsletterSummary'}),
  );
  nav.parentElement.append(panel);
}

export async function loadCommunity(api) {
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
