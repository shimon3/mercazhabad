-- Mercaz Habad / Supabase. Additive only. No existing tables touched.
-- Run in a dedicated Supabase project, never another site's database.
begin;
create table if not exists public.mercaz_admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.mercaz_products (
  id text primary key check (char_length(id) between 1 and 100),
  category text not null,
  name_he text not null,
  name_fr text not null default '',
  description text not null default '',
  price_agorot integer check (price_agorot is null or price_agorot >= 0),
  old_price_agorot integer check (old_price_agorot is null or old_price_agorot >= 0),
  image_url text not null check (char_length(image_url) <= 512),
  stock integer not null default 0 check (stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mercaz_products_category_idx on public.mercaz_products (category);
create table if not exists public.mercaz_product_audit (
  audit_id bigint generated always as identity primary key,
  product_id text not null,
  actor_id uuid,
  previous_value jsonb,
  new_value jsonb,
  changed_at timestamptz not null default now()
);
alter table public.mercaz_admin_users enable row level security;
alter table public.mercaz_products enable row level security;
alter table public.mercaz_product_audit enable row level security;
revoke all on public.mercaz_admin_users from anon, authenticated;
revoke all on public.mercaz_product_audit from anon, authenticated;
grant select on public.mercaz_admin_users to authenticated;
grant select on public.mercaz_product_audit to authenticated;
grant select on public.mercaz_products to anon, authenticated;
grant insert, update on public.mercaz_products to authenticated;

drop policy if exists mercaz_admin_self on public.mercaz_admin_users;
create policy mercaz_admin_self on public.mercaz_admin_users
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists mercaz_public_active on public.mercaz_products;
create policy mercaz_public_active on public.mercaz_products
for select to anon, authenticated using (active);

drop policy if exists mercaz_admin_all_read on public.mercaz_products;
create policy mercaz_admin_all_read on public.mercaz_products
for select to authenticated using
(exists(select 1 from public.mercaz_admin_users x where x.user_id = (select auth.uid())));

drop policy if exists mercaz_admin_insert on public.mercaz_products;
create policy mercaz_admin_insert on public.mercaz_products
for insert to authenticated with check
(exists(select 1 from public.mercaz_admin_users x where x.user_id = (select auth.uid())));

drop policy if exists mercaz_admin_update on public.mercaz_products;
create policy mercaz_admin_update on public.mercaz_products
for update to authenticated
using (exists(select 1 from public.mercaz_admin_users x where x.user_id = (select auth.uid())))
with check (exists(select 1 from public.mercaz_admin_users x where x.user_id = (select auth.uid())));

drop policy if exists mercaz_audit_admin_read on public.mercaz_product_audit;
create policy mercaz_audit_admin_read on public.mercaz_product_audit
for select to authenticated using
(exists(select 1 from public.mercaz_admin_users x where x.user_id = (select auth.uid())));

-- Privileged trigger records updates; callable only by PostgreSQL trigger, not public API.
create schema if not exists mercaz_private;
create or replace function mercaz_private.log_product_changes() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.updated_at := now();
  insert into public.mercaz_product_audit(product_id,actor_id,previous_value,new_value)
  values(old.id,auth.uid(),to_jsonb(old),to_jsonb(new));
  return new;
end $$;
revoke all on function mercaz_private.log_product_changes() from public, anon, authenticated;
drop trigger if exists mercaz_products_audit_update on public.mercaz_products;
create trigger mercaz_products_audit_update before update on public.mercaz_products
for each row execute function mercaz_private.log_product_changes();

-- Public product photos stored in dedicated bucket; only admins can write.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('mercaz-photos','mercaz-photos',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists mercaz_photos_public on storage.objects;
create policy mercaz_photos_public on storage.objects
for select to anon, authenticated
using (bucket_id = 'mercaz-photos');

drop policy if exists mercaz_photos_admin_insert on storage.objects;
create policy mercaz_photos_admin_insert on storage.objects
for insert to authenticated with check (
 bucket_id = 'mercaz-photos'
 and name like 'products/%'
 and exists(select 1 from public.mercaz_admin_users x where x.user_id = (select auth.uid()))
);
drop policy if exists mercaz_photos_admin_update on storage.objects;
create policy mercaz_photos_admin_update on storage.objects
for update to authenticated
using (
 bucket_id = 'mercaz-photos' and name like 'products/%'
 and exists(select 1 from public.mercaz_admin_users x where x.user_id = (select auth.uid()))
)
with check (
 bucket_id = 'mercaz-photos' and name like 'products/%'
 and exists(select 1 from public.mercaz_admin_users x where x.user_id = (select auth.uid()))
);
commit;
