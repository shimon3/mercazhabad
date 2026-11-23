// Customer reviews on the storefront: approved-only display + signed-in submission (moderated).
// All rules are enforced by RLS in sql/reviews-and-newsletter.sql; this file only renders.
const BASE = 'https://bdalhyqpruefdbyirykp.supabase.co';
const KEY = 'sb_publishable_K6ciGUejNpRfLeIEc598Iw_L3VoMJYM';

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export const starsText = rating => '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));

// product_id → {average, count}. Empty map when the table is missing or offline.
export async function loadReviewSummary() {
  const summary = new Map();
  try {
    const response = await fetch(BASE + '/rest/v1/mercaz_reviews?select=product_id,rating&status=eq.approved&limit=2000',
      {headers: {apikey: KEY}, signal: AbortSignal.timeout(5000)});
    if (!response.ok) return summary;
    for (const {product_id: id, rating} of await response.json()) {
      const entry = summary.get(id) || {total: 0, count: 0};
      entry.total += rating;
      entry.count += 1;
      summary.set(id, entry);
    }
    for (const entry of summary.values()) entry.average = entry.total / entry.count;
  } catch {}
  return summary;
}

export function ratingBadge(entry) {
  if (!entry?.count) return null;
  const node = el('p', '', 'rating-line');
  node.append(el('span', starsText(entry.average), 'rating-stars'), el('span', entry.average.toFixed(1) + ' (' + entry.count + ')', 'rating-count'));
  node.setAttribute('aria-label', 'דירוג ' + entry.average.toFixed(1) + ' מתוך 5, ' + entry.count + ' חוות דעת');
  return node;
}

async function fetchReviews(productId) {
  const response = await fetch(BASE + '/rest/v1/mercaz_reviews?select=display_name,rating,body,created_at&status=eq.approved&product_id=eq.' +
    encodeURIComponent(productId) + '&order=created_at.desc&limit=20', {headers: {apikey: KEY}, signal: AbortSignal.timeout(5000)});
  if (!response.ok) throw Error('reviews');
  return response.json();
}

function reviewForm(product, status) {
  const token = sessionStorage.getItem('merkaz_customer_token');
  if (!token) {
    const login = el('p', '', 'review-login');
    const link = el('a', 'התחברו לחשבון');
    link.href = '/account/';
    login.append('קניתם את המוצר? ', link, ' כדי לכתוב חוות דעת.');
    return login;
  }
  const form = el('form', '', 'review-form');
  form.noValidate = false;
  const legend = el('p', 'כתבו חוות דעת', 'review-form-title');
  const rating = el('fieldset', '', 'review-rating');
  rating.append(el('legend', 'דירוג'));
  for (let value = 5; value >= 1; value--) {
    const label = el('label');
    const input = el('input');
    Object.assign(input, {type: 'radio', name: 'rating', value: String(value), required: true});
    label.append(input, ' ' + '★'.repeat(value));
    rating.append(label);
  }
  const nameLabel = el('label', 'שם לתצוגה');
  const name = el('input');
  Object.assign(name, {name: 'display_name', required: true, minLength: 2, maxLength: 40, autocomplete: 'given-name'});
  nameLabel.append(name);
  const bodyLabel = el('label', 'חוות הדעת');
  const body = el('textarea');
  Object.assign(body, {name: 'body', required: true, minLength: 10, maxLength: 1000, rows: 3});
  bodyLabel.append(body);
  const submit = el('button', 'שליחה לאישור', 'review-submit');
  submit.type = 'submit';
  const note = el('p', 'חוות הדעת תפורסם לאחר אישור החנות.', 'review-note');
  form.append(legend, rating, nameLabel, bodyLabel, submit, note);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    submit.disabled = true;
    status.textContent = '';
    try {
      const response = await fetch(BASE + '/rest/v1/mercaz_reviews', {
        method: 'POST',
        headers: {apikey: KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'return=minimal'},
        body: JSON.stringify({product_id: product.id, rating: Number(data.get('rating')),
          display_name: String(data.get('display_name')).trim(), body: String(data.get('body')).trim()}),
      });
      if (response.status === 409) status.textContent = 'כבר שלחתם חוות דעת על המוצר הזה. תודה!';
      else if (response.status === 401) status.textContent = 'פג תוקף ההתחברות. התחברו מחדש בעמוד החשבון.';
      else if (!response.ok) throw Error('submit');
      else { status.textContent = 'תודה! חוות הדעת נשלחה ותופיע לאחר אישור.'; form.replaceChildren(status); return; }
    } catch { status.textContent = 'לא ניתן לשלוח כרגע. נסו שוב מאוחר יותר.'; }
    submit.disabled = false;
  });
  return form;
}

// Section appended to the product dialog. Loads lazily so the dialog opens instantly.
export function reviewsSection(product) {
  const section = el('section', '', 'dialog-reviews');
  const heading = el('h3', 'חוות דעת של לקוחות');
  const list = el('ul', '', 'review-list');
  const status = el('p', '', 'review-status');
  status.setAttribute('role', 'status');
  section.append(heading, list);
  fetchReviews(product.id).then(reviews => {
    if (!reviews.length) list.replaceWith(el('p', 'עדיין אין חוות דעת על המוצר.', 'review-empty'));
    for (const review of reviews) {
      const item = el('li');
      item.append(el('p', starsText(review.rating), 'rating-stars'), el('p', review.body),
        el('p', review.display_name + ' · ' + new Date(review.created_at).toLocaleDateString('he-IL'), 'review-meta'));
      list.append(item);
    }
  }).catch(() => list.replaceWith(el('p', 'עדיין אין חוות דעת על המוצר.', 'review-empty')));
  section.append(reviewForm(product, status), status);
  return section;
}
