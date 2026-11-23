-- Coupon codes (קודי קופון). Run once in Supabase SQL Editor. Idempotent.
-- Prerequisites already in the project: mercaz_products, mercaz_orders, mercaz_roles,
-- public.mercaz_create_order(p_items, p_name, p_phone, p_address, p_notes).
--
-- Security model
--   * Coupons are never readable by the public API (no enumeration). Admin (MFA aal2) manages them;
--     manager (aal2) can read them.
--   * The discount is computed ONLY in the database, from the order total that mercaz_create_order
--     already computed server-side. The browser never sends an amount.
--   * Order creation + coupon redemption happen in ONE transaction: an invalid code cancels
--     the whole order (no half-applied discount). Coupon row is locked to respect max_uses.

create table if not exists public.mercaz_coupons (
  code text primary key check (code ~ '^[A-Z0-9_-]{3,30}$'),
  kind text not null check (kind in ('percent','fixed')),
  value integer not null check (value > 0),                 -- percent: 1..100 · fixed: agorot
  min_total_agorot integer not null default 0 check (min_total_agorot >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  one_per_customer boolean not null default true,
  active boolean not null default true,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  constraint mercaz_coupons_percent_range check (kind <> 'percent' or value <= 100)
);

create table if not exists public.mercaz_coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_code text not null references public.mercaz_coupons(code) on update cascade on delete restrict,
  order_id uuid not null unique references public.mercaz_orders(id) on delete cascade,
  customer_id uuid not null,
  total_before_agorot integer not null,
  discount_agorot integer not null check (discount_agorot >= 0),
  created_at timestamptz not null default now()
);
create index if not exists mercaz_coupon_redemptions_code_idx on public.mercaz_coupon_redemptions (coupon_code, customer_id);

alter table public.mercaz_orders add column if not exists coupon_code text;
alter table public.mercaz_orders add column if not exists discount_agorot integer not null default 0;

alter table public.mercaz_coupons enable row level security;
alter table public.mercaz_coupon_redemptions enable row level security;
revoke all on public.mercaz_coupons, public.mercaz_coupon_redemptions from public, anon, authenticated;
grant select, insert, update on public.mercaz_coupons to authenticated;
grant select on public.mercaz_coupon_redemptions to authenticated;

drop policy if exists mercaz_coupons_staff_read on public.mercaz_coupons;
create policy mercaz_coupons_staff_read on public.mercaz_coupons for select to authenticated using (
  (select auth.jwt()->>'aal') = 'aal2' and exists (
    select 1 from public.mercaz_roles r where r.user_id = (select auth.uid()) and r.role in ('admin','manager')));
drop policy if exists mercaz_coupons_admin_insert on public.mercaz_coupons;
create policy mercaz_coupons_admin_insert on public.mercaz_coupons for insert to authenticated with check (
  (select auth.jwt()->>'aal') = 'aal2' and exists (
    select 1 from public.mercaz_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'));
drop policy if exists mercaz_coupons_admin_update on public.mercaz_coupons;
create policy mercaz_coupons_admin_update on public.mercaz_coupons for update to authenticated using (
  (select auth.jwt()->>'aal') = 'aal2' and exists (
    select 1 from public.mercaz_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'));
drop policy if exists mercaz_coupon_redemptions_staff_read on public.mercaz_coupon_redemptions;
create policy mercaz_coupon_redemptions_staff_read on public.mercaz_coupon_redemptions for select to authenticated using (
  (select auth.jwt()->>'aal') = 'aal2' and exists (
    select 1 from public.mercaz_roles r where r.user_id = (select auth.uid()) and r.role in ('admin','manager')));

-- Shared validation. Returns the discount in agorot or raises a Hebrew error the shop can show.
create or replace function public.mercaz_coupon_discount(p_code text, p_total integer, p_customer uuid, p_lock boolean)
returns integer language plpgsql security definer set search_path = public as $$
declare c public.mercaz_coupons%rowtype; v_uses integer; v_discount integer;
begin
  if p_customer is null then raise exception 'יש להתחבר כדי להשתמש בקוד קופון' using errcode = 'P0001'; end if;
  if p_lock then
    select * into c from public.mercaz_coupons where code = upper(btrim(p_code)) for update;
  else
    select * into c from public.mercaz_coupons where code = upper(btrim(p_code));
  end if;
  if not found or not c.active
     or (c.starts_at is not null and now() < c.starts_at)
     or (c.expires_at is not null and now() > c.expires_at) then
    raise exception 'קוד הקופון אינו תקף' using errcode = 'P0001';
  end if;
  if p_total < c.min_total_agorot then
    raise exception 'הקופון תקף בהזמנה מעל ₪%', rtrim(to_char(c.min_total_agorot / 100.0, 'FM999990.##'), '.') using errcode = 'P0001';
  end if;
  if c.max_uses is not null then
    select count(*) into v_uses from public.mercaz_coupon_redemptions where coupon_code = c.code;
    if v_uses >= c.max_uses then raise exception 'הקופון כבר נוצל עד הסוף' using errcode = 'P0001'; end if;
  end if;
  if c.one_per_customer and exists (
      select 1 from public.mercaz_coupon_redemptions where coupon_code = c.code and customer_id = p_customer) then
    raise exception 'כבר השתמשתם בקופון הזה' using errcode = 'P0001';
  end if;
  v_discount := case c.kind when 'percent' then floor(p_total * c.value / 100.0)::integer else c.value end;
  return greatest(0, least(v_discount, p_total));
end $$;
revoke execute on function public.mercaz_coupon_discount(text, integer, uuid, boolean) from public, anon, authenticated;

-- Preview for the checkout page (no write). Signed-in customers only.
create or replace function public.mercaz_check_coupon(p_code text, p_total_agorot integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_discount integer;
begin
  if p_total_agorot is null or p_total_agorot < 0 or p_total_agorot > 100000000 then
    raise exception 'סכום לא תקין' using errcode = 'P0001';
  end if;
  v_discount := public.mercaz_coupon_discount(p_code, p_total_agorot, auth.uid(), false);
  return jsonb_build_object('code', upper(btrim(p_code)), 'discount_agorot', v_discount);
end $$;
revoke execute on function public.mercaz_check_coupon(text, integer) from public, anon;
grant execute on function public.mercaz_check_coupon(text, integer) to authenticated;

-- Create the order with the existing server-side pricing, then apply the coupon — atomically.
create or replace function public.mercaz_create_order_with_coupon(
  p_items jsonb, p_name text, p_phone text, p_address text, p_notes text, p_coupon text)
returns text language plpgsql security definer set search_path = public as $$
declare v_result text; v_order public.mercaz_orders%rowtype; v_discount integer; v_code text := upper(btrim(p_coupon));
begin
  if auth.uid() is null then raise exception 'יש להתחבר' using errcode = 'P0001'; end if;
  if v_code is null or v_code !~ '^[A-Z0-9_-]{3,30}$' then raise exception 'קוד הקופון אינו תקף' using errcode = 'P0001'; end if;
  -- Lock the coupon first so two simultaneous orders cannot both take the last use.
  perform 1 from public.mercaz_coupons where code = v_code for update;
  -- Quoted literals resolve to whatever types the existing function declares (json/jsonb/text),
  -- so this wrapper does not depend on its exact signature.
  execute format('select public.mercaz_create_order(p_items => %L, p_name => %L, p_phone => %L, p_address => %L, p_notes => %L)::text',
                 p_items::text, p_name, p_phone, p_address, p_notes) into v_result;
  -- mercaz_create_order returns the new order's id: use it (never "the latest order", which could race).
  select * into v_order from public.mercaz_orders
    where id = v_result::uuid and customer_id = auth.uid() for update;
  if not found or v_order.payment_status <> 'pending_payment' or coalesce(v_order.discount_agorot, 0) <> 0 then
    raise exception 'לא ניתן להחיל את הקופון על ההזמנה' using errcode = 'P0001';
  end if;
  v_discount := public.mercaz_coupon_discount(v_code, v_order.total_agorot, auth.uid(), true);
  insert into public.mercaz_coupon_redemptions (coupon_code, order_id, customer_id, total_before_agorot, discount_agorot)
    values (v_code, v_order.id, auth.uid(), v_order.total_agorot, v_discount);
  update public.mercaz_orders
     set total_agorot = v_order.total_agorot - v_discount, discount_agorot = v_discount, coupon_code = v_code
   where id = v_order.id;
  return v_result;
end $$;
revoke execute on function public.mercaz_create_order_with_coupon(jsonb, text, text, text, text, text) from public, anon;
grant execute on function public.mercaz_create_order_with_coupon(jsonb, text, text, text, text, text) to authenticated;

-- Usage counts for the admin list.
create or replace view public.mercaz_coupon_stats with (security_invoker = true) as
  select c.code, count(r.id)::integer as uses, coalesce(sum(r.discount_agorot), 0)::integer as discount_total_agorot
  from public.mercaz_coupons c left join public.mercaz_coupon_redemptions r on r.coupon_code = c.code
  group by c.code;
revoke all on public.mercaz_coupon_stats from public, anon;
grant select on public.mercaz_coupon_stats to authenticated;
