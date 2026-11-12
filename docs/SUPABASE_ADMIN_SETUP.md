# Supabase backend for Mercaz Habad — staged, not published

Create a **new dedicated Supabase project** (the existing projects belong to other sites). This branch does not touch the live Pages store or add real checkout.

## SQL migration sequence

1. Run `supabase/001_schema_rls.sql` on the **new** project only.
2. Run `supabase/002_seed_84.sql` on the new project only.
3. Check `select count(*) as products, count(*) filter (where price_agorot is null) as unknown_price, count(*) filter (where stock <> 0) as initialized_stock from public.mercaz_products;` → 84 / 9 / 0.
4. Create an administrator using Supabase Auth, and insert **their real Auth UUID** into `mercaz_admins` via the trusted SQL editor. Do not guess a UUID. Enable MFA for the administrator.
5. Keep `service_role` and secret keys out of source control. Only a publishable key can be used in the browser, behind RLS.
6. Configure a dedicated private photos bucket with admin-only upload policies. Never grant anonymous uploads.
7. Verify unauthenticated SELECT only sees active products; anonymous writes are denied; non-admin authenticated writes are denied; an admin can edit prices/photos/stocks; and the nine prices stay unknown.
8. Only then connect the storefront/admin frontend on a preview branch. Keep payments disabled.

The old D1 experiment is isolated in PR #3. Do not merge it together with this alternative Supabase architecture without choosing one backend.
