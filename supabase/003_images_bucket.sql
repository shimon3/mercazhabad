-- Product image storage: public reads, authenticated ADMIN writes only.
-- Dedicated bucket, limited file size and media types; no broad upload grants.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('mercaz-product-images','mercaz-product-images',true,5000000,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists mercaz_images_admin_read on storage.objects;
create policy mercaz_images_admin_read on storage.objects
for select to authenticated
using (
  bucket_id='mercaz-product-images'
  and exists (select 1 from public.mercaz_admins a where a.user_id=(select auth.uid()))
);

drop policy if exists mercaz_images_admin_insert on storage.objects;
create policy mercaz_images_admin_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='mercaz-product-images'
  and name like 'products/%'
  and exists (select 1 from public.mercaz_admins a where a.user_id=(select auth.uid()))
);

drop policy if exists mercaz_images_admin_update on storage.objects;
create policy mercaz_images_admin_update on storage.objects
for update to authenticated
using (
  bucket_id='mercaz-product-images'
  and name like 'products/%'
  and exists (select 1 from public.mercaz_admins a where a.user_id=(select auth.uid()))
)
with check (
  bucket_id='mercaz-product-images'
  and name like 'products/%'
  and exists (select 1 from public.mercaz_admins a where a.user_id=(select auth.uid()))
);

-- Deliberately no anonymous INSERT/UPDATE policy and no DELETE policy.
