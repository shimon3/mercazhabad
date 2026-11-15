# Merkaz Habad — Security & launch checklist

Last reviewed: 2026-11-15.

## Architecture and authorization
- Cloudflare Pages hosts static public catalogue, customer account and staff consoles.
- Supabase Auth provides email/password and TOTP MFA.
- Authoritative roles: `public.mercaz_roles` (admin / manager), NOT the legacy `mercaz_admins` table.
- RLS isolates customer orders and allows staff product/order access only with role + MFA JWT `aal2`.
- Supabase publishable key may be in browser JS. Never commit `service_role`, secret keys, payment keys or SMTP credentials.
- Staff factors and access tokens are secrets. Do not share TOTP QR/screenshots or browser session tokens.

## Applied mitigations
- Cloudflare `_headers`: CSP, HSTS, frame denial, nosniff, referrer policy; no-store on management/account pages.
- Sensitive CSS extracted to same-origin assets. QR generation shipped locally, not remotely.
- Old storage policies on `mercaz_admins` removed. Staff upload authorization requires MFA and manager/admin role.
- Customer and staff sessions removed together during logout.
- Server-side prices calculated from Supabase product records; hourly and open-order limits enforced in order RPC.
- `stock_tracking_enabled` is opt-in: **existing 88 products have unverified stock = 0**. This is not an out-of-stock signal until a manager enters actual quantities and explicitly enables tracking.
- When tracking is enabled, order RPC checks aggregate requested quantities per product in a transaction; sticker packs count individual pieces. This check does NOT reserve or deduct stock, and does not substitute for a payment-time atomic inventory reservation.

## Owner actions before launch
1. Supabase Dashboard > Authentication > Security and Protection: enable leaked-password protection (if plan supports it), use strong password minimum, review auth rate limits and CAPTCHA/Turnstile for signup as supported.
2. Confirm Supabase Auth Site URL and redirect allowlist use the real domain, never `localhost` in production.
3. Require and test Microsoft Authenticator TOTP for admin and manager; remove previously exposed/unverified factors.
4. Enter real stock quantities in `/manager/` and only then enable tracked stock per product; plan stock reservation at verified payment.
5. Add independent authorization testing (customer A cannot read B; manager cannot edit roles; anon cannot read private orders or upload).
6. Verify HTTP response headers with Chrome DevTools Network panel, not only the source `_headers`.
7. Consider Cloudflare Zero Trust Access for staff paths with carefully tested allowlisted identities; do NOT block the public customer checkout.
8. Configure service monitoring, alerts and backups; test restore before taking money.
9. Before card payments: server-side payment creation, signed provider webhook, idempotency, payment status transitions and stock reservation only after verified provider response.
10. Determine carrier/data retention/privacy and legal disclosures, business owner identity and GDPR/international applicability before foreign sales.

## Regression checks
On 2026-11-15, an external browser smoke test confirmed public homepage, 88-product catalog display, category/search interaction, product images, cart modal, and /account, /admin, /manager and /privacy pages load without observed visible errors. No logged-in administrative or payment flow was executed.

## Incident response
If a staff TOTP QR/secret is exposed: revoke that factor through a trusted admin session, enroll a new one, and verify the old factor cannot authenticate. If a session or credential leaks: revoke sessions and rotate the credential. Back up before structural changes.
