-- Product reviews (moderated) and newsletter / club sign-ups.
-- Run once in Supabase SQL Editor. Idempotent: safe to run again.
-- Security model:
--   * Reviews: anyone reads APPROVED reviews only; a signed-in customer may create ONE pending review
--     per product; only staff (admin/manager with MFA aal2) can approve, reject or delete.
--     customer_id is never readable through the public API.
--   * Newsletter: anonymous visitors may only INSERT (with explicit consent). Nobody but staff
--     (MFA aal2) can read the list.

-- ---------------------------------------------------------------- reviews
create table if not exists public.mercaz_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.mercaz_products(id) on delete cascade,
  customer_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 40),
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(btrim(body)) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  moderated_at timestamptz,
  unique (product_id, customer_id)
);
create index if not exists mercaz_reviews_product_status_idx on public.mercaz_reviews (product_id, status);

alter table public.mercaz_reviews enable row level security;

revoke all on public.mercaz_reviews from public, anon, authenticated;
-- Column-level grants: customer_id stays private.
grant select (id, product_id, display_name, rating, body, status, created_at, moderated_at) on public.mercaz_reviews to anon, authenticated;
grant insert (product_id, display_name, rating, body) on public.mercaz_reviews to authenticated;
grant update (status, moderated_at) on public.mercaz_reviews to authenticated;
grant delete on public.mercaz_reviews to authenticated;

drop policy if exists mercaz_reviews_public_read on public.mercaz_reviews;
create policy mercaz_reviews_public_read on public.mercaz_reviews
  for select to anon, authenticated using (status = 'approved');

drop policy if exists mercaz_reviews_staff_read on public.mercaz_reviews;
create policy mercaz_reviews_staff_read on public.mercaz_reviews
  for select to authenticated using (
    (select auth.jwt()->>'aal') = 'aal2' and exists (
      select 1 from public.mercaz_roles r where r.user_id = (select auth.uid()) and r.role in ('admin','manager')));

drop policy if exists mercaz_reviews_customer_insert on public.mercaz_reviews;
create policy mercaz_reviews_customer_insert on public.mercaz_reviews
  for insert to authenticated with check (
    customer_id = (select auth.uid()) and status = 'pending'
    and exists (select 1 from public.mercaz_products p where p.id = product_id and p.active));

drop policy if exists mercaz_reviews_staff_update on public.mercaz_reviews;
create policy mercaz_reviews_staff_update on public.mercaz_reviews
  for update to authenticated using (
    (select auth.jwt()->>'aal') = 'aal2' and exists (
      select 1 from public.mercaz_roles r where r.user_id = (select auth.uid()) and r.role in ('admin','manager')))
  with check (status in ('pending','approved','rejected'));

drop policy if exists mercaz_reviews_staff_delete on public.mercaz_reviews;
create policy mercaz_reviews_staff_delete on public.mercaz_reviews
  for delete to authenticated using (
    (select auth.jwt()->>'aal') = 'aal2' and exists (
      select 1 from public.mercaz_roles r where r.user_id = (select auth.uid()) and r.role in ('admin','manager')));

-- Anti-flood: max 5 reviews per customer per 24h.
create or replace function public.mercaz_reviews_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.mercaz_reviews
      where customer_id = new.customer_id and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Too many reviews, try again tomorrow' using errcode = 'P0001';
  end if;
  new.status := 'pending';
  new.display_name := btrim(new.display_name);
  new.body := btrim(new.body);
  return new;
end $$;
drop trigger if exists mercaz_reviews_rate_limit on public.mercaz_reviews;
create trigger mercaz_reviews_rate_limit before insert on public.mercaz_reviews
  for each row execute function public.mercaz_reviews_rate_limit();

-- ---------------------------------------------------------------- newsletter
create table if not exists public.mercaz_newsletter (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  consent boolean not null check (consent),
  source text not null default 'home' check (source in ('home','product','about')),
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);
create unique index if not exists mercaz_newsletter_email_idx on public.mercaz_newsletter (lower(email));

alter table public.mercaz_newsletter enable row level security;
revoke all on public.mercaz_newsletter from public, anon, authenticated;
grant insert (email, consent, source) on public.mercaz_newsletter to anon, authenticated;
grant select, update (unsubscribed_at) on public.mercaz_newsletter to authenticated;

drop policy if exists mercaz_newsletter_signup on public.mercaz_newsletter;
create policy mercaz_newsletter_signup on public.mercaz_newsletter
  for insert to anon, authenticated with check (consent);

drop policy if exists mercaz_newsletter_staff_read on public.mercaz_newsletter;
create policy mercaz_newsletter_staff_read on public.mercaz_newsletter
  for select to authenticated using (
    (select auth.jwt()->>'aal') = 'aal2' and exists (
      select 1 from public.mercaz_roles r where r.user_id = (select auth.uid()) and r.role in ('admin','manager')));

drop policy if exists mercaz_newsletter_staff_update on public.mercaz_newsletter;
create policy mercaz_newsletter_staff_update on public.mercaz_newsletter
  for update to authenticated using (
    (select auth.jwt()->>'aal') = 'aal2' and exists (
      select 1 from public.mercaz_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'));

-- Anti-flood: at most 30 sign-ups per minute site-wide.
create or replace function public.mercaz_newsletter_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.mercaz_newsletter where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Too many sign-ups' using errcode = 'P0001';
  end if;
  new.email := lower(btrim(new.email));
  return new;
end $$;
drop trigger if exists mercaz_newsletter_guard on public.mercaz_newsletter;
create trigger mercaz_newsletter_guard before insert on public.mercaz_newsletter
  for each row execute function public.mercaz_newsletter_guard();

revoke execute on function public.mercaz_reviews_rate_limit() from public, anon, authenticated;
revoke execute on function public.mercaz_newsletter_guard() from public, anon, authenticated;
