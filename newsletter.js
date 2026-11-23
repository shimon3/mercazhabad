// Club / newsletter sign-up. Insert-only for visitors (RLS); explicit consent required by law (חוק הספאם).
const BASE = 'https://bdalhyqpruefdbyirykp.supabase.co';
const KEY = 'sb_publishable_K6ciGUejNpRfLeIEc598Iw_L3VoMJYM';

for (const form of document.querySelectorAll('form[data-newsletter]')) {
  const status = form.querySelector('[role="status"]');
  const button = form.querySelector('button[type="submit"]');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    if (data.get('website')) return; // honeypot filled by bots
    if (!data.get('consent')) { status.textContent = 'יש לאשר קבלת עדכונים.'; return; }
    button.disabled = true;
    status.textContent = 'שולח…';
    try {
      const response = await fetch(BASE + '/rest/v1/mercaz_newsletter', {
        method: 'POST',
        headers: {apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal'},
        body: JSON.stringify({email: String(data.get('email')).trim(), consent: true, source: form.dataset.newsletter || 'home'}),
        signal: AbortSignal.timeout(8000),
      });
      // 409 = already subscribed: same answer, so the form does not reveal who is on the list.
      if (!response.ok && response.status !== 409) throw Error('signup');
      form.reset();
      status.textContent = 'תודה! נרשמתם לעדכוני המבצעים 🎉';
    } catch {
      status.textContent = 'ההרשמה לא הצליחה. נסו שוב או כתבו לנו ב־WhatsApp.';
    }
    button.disabled = false;
  });
}
