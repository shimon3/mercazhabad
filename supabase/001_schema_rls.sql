-- Supabase proposal for Mercaz Habad — separate project only.
-- No table is dropped, overwritten or truncated.
create table if not exists public.mercaz_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.mercaz_products (
  id text primary key,
  category text not null,
  name_he text not null,
  name_fr text not null default '',
  description text not null default '',
  price_agorot integer check (price_agorot is null or price_agorot >= 0),
  old_price_agorot integer check (old_price_agorot is null or old_price_agorot >= 0),
  image_key text not null,
  stock integer not null default 0 check (stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mercaz_products_category on public.mercaz_products(category);
alter table public.mercaz_admins enable row level security;
alter table public.mercaz_products enable row level security;
-- No user can add themselves as an admin through the REST API.
revoke all on public.mercaz_admins from anon, authenticated;
grant select on public.mercaz_admins to authenticated;
grant select on public.mercaz_products to anon, authenticated;
grant insert, update on public.mercaz_products to authenticated;
drop policy if exists mercaz_admin_read_self on public.mercaz_admins;
create policy mercaz_admin_read_self on public.mercaz_admins for select to authenticated
using (user_id = (select auth.uid()));
drop policy if exists mercaz_public_catalog on public.mercaz_products;
create policy mercaz_public_catalog on public.mercaz_products for select to anon, authenticated
using (active = true);
drop policy if exists mercaz_admin_read_all on public.mercaz_products;
create policy mercaz_admin_read_all on public.mercaz_products for select to authenticated
using (exists (select 1 from public.mercaz_admins a where a.user_id = (select auth.uid())));
drop policy if exists mercaz_admin_insert on public.mercaz_products;
create policy mercaz_admin_insert on public.mercaz_products for insert to authenticated
with check (exists (select 1 from public.mercaz_admins a where a.user_id = (select auth.uid())));
drop policy if exists mercaz_admin_update on public.mercaz_products;
create policy mercaz_admin_update on public.mercaz_products for update to authenticated
using (exists (select 1 from public.mercaz_admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.mercaz_admins a where a.user_id = (select auth.uid())));
-- Explicitly omit delete grants and policies to reduce accidental catalogue loss.
