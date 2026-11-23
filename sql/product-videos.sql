-- Product presentation videos (shown under the photo in the product view). Idempotent.
-- Run once in Supabase SQL Editor.

-- 1. Column on products: only videos from the shop's own storage or the site's /assets-v8 folder.
alter table public.mercaz_products add column if not exists video_key text;
alter table public.mercaz_products drop constraint if exists mercaz_products_video_key_check;
alter table public.mercaz_products add constraint mercaz_products_video_key_check check (
  video_key is null
  or video_key ~ '^https://bdalhyqpruefdbyirykp\.supabase\.co/storage/v1/object/public/mercaz-product-videos/[A-Za-z0-9._-]+\.(mp4|webm)$'
  or video_key ~ '^/assets-v8/[A-Za-z0-9._/-]+\.(mp4|webm)$');
-- Harmless if the table already uses table-wide grants; needed if grants are per column.
grant select (video_key) on public.mercaz_products to anon, authenticated;
grant update (video_key) on public.mercaz_products to authenticated;

-- 2. Public bucket for videos (MP4/WebM, max 50 MB each).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mercaz-product-videos', 'mercaz-product-videos', true, 52428800, array['video/mp4','video/webm'])
on conflict (id) do update set public = true, file_size_limit = 52428800, allowed_mime_types = array['video/mp4','video/webm'];

-- 3. Only an admin with MFA (aal2) may upload, replace or delete videos. Reading is public (public bucket).
drop policy if exists mercaz_videos_admin_insert on storage.objects;
create policy mercaz_videos_admin_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'mercaz-product-videos' and (select auth.jwt()->>'aal') = 'aal2' and exists (
    select 1 from public.mercaz_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'));
drop policy if exists mercaz_videos_admin_update on storage.objects;
create policy mercaz_videos_admin_update on storage.objects for update to authenticated using (
  bucket_id = 'mercaz-product-videos' and (select auth.jwt()->>'aal') = 'aal2' and exists (
    select 1 from public.mercaz_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'));
drop policy if exists mercaz_videos_admin_delete on storage.objects;
create policy mercaz_videos_admin_delete on storage.objects for delete to authenticated using (
  bucket_id = 'mercaz-product-videos' and (select auth.jwt()->>'aal') = 'aal2' and exists (
    select 1 from public.mercaz_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'));
