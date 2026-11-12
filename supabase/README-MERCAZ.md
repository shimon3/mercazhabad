# Mercaz Habad — Supabase backend preparation

**Current status:** code only; this branch is not published. No Supabase project was created or modified. Public shop remains the static demo until a dedicated Supabase project is created, configured, tested and intentionally deployed.

## Create dedicated project (cost confirmation first)
Select your intended Supabase organization. Create a *new project* named \`mercazhabad\` in the approved organization only after reviewing its quoted cost. Do not reuse \`leonid-studio\` or another unrelated existing database. Choose a nearby region if offered (e.g. EU central), without guessing entitlements.

## Install schema & seed
1. Open SQL Editor in the **dedicated new project**.
2. Run \`supabase/setup/01_schema.sql\`, followed by \`supabase/setup/02_seed_84_products.sql\`.
3. Verify: \`select count(*) from public.mercaz_products;\` should return 84; \`select count(*) from public.mercaz_products where price_agorot is null;\` should return 9.
4. Seed uses \`on conflict (id) do nothing\`; repeat executions must not overwrite edited products.
5. Inventory starts at zero, as no real stock count was provided. No order or payment feature is activated.

## Grant an administrator
Use Supabase Authentication > Users to invite/create the actual store administrator (enable suitable email auth and allowed redirects). Do not enable open self-signup for admin privileges. After the user **exists**, obtain their exact UUID from Authentication > Users.

Only then, from the secure Supabase SQL Editor, insert their UUID:
\`\`\`sql
insert into public.mercaz_admin_users(user_id)
values ('REPLACE_WITH_ACTUAL_AUTH_USER_UUID')
on conflict (user_id) do nothing;
\`\`\`
Never use a placeholder UUID or guessed email here. RLS checks the authenticated \`auth.uid()\` against this table, not editable user metadata.

## Configure public frontend
In \`admin-supabase/config.js\`, fill **only** the Supabase HTTPS project URL and **publishable** API key (never a secret, service_role, DB password, or access token). Do this in a reviewed deployment commit after the backend tests pass.

Configure Auth redirect URL to the preview URL \`/admin-supabase/\`. The page uses Supabase email magic link, with no auto-creation of users. Test the approved account and an unapproved account.

\`admin-supabase/\` provides editing for names, descriptions, price, previous price, stock, visibility and photos. Photos are stored in a dedicated \`mercaz-photos\` public bucket. RLS restricts uploads and updates to allowlisted admins; existing images remain as static \`/assets-v8/...\` URLs.

The public \`index.html\` optionally reads active products through the Supabase REST Data API, and falls back to its existing 84 static products if Supabase is missing/unreachable. This fallback is for **availability**, not for disabling security; server-side RLS must be tested.

## Security and tests before publishing
- Test anonymous SELECT only returns active products.
- Test unauthorized and unauthenticated INSERT/UPDATE are blocked.
- Test authorized admin can edit a price and stock; then revert test changes.
- Check updates create \`mercaz_product_audit\` entries with the actor ID.
- Test storage upload denied to anonymous and permitted to admin only under \`products/\`, size <= 5 MB, PNG/JPEG/WebP.
- Run Supabase security/performance advisors and resolve findings.
- Test Android/mobile editor, 84 catalog items, and mock cart. The 9 unknown prices must not be silently invented.
- Never publish actual checkout or production credentials without explicit separate approval.

## Rollback
Revert the frontend configuration commit to the empty values to restore the static catalog. Do not delete Supabase data; schema and seed are non-destructive.
