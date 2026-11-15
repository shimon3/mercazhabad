-- Security hardening: only administrators with verified MFA may mutate catalogue/stock.
-- Customers retain SELECT of their own orders; creation is exclusively via
-- the SECURITY DEFINER mercaz_create_order RPC which computes DB-side totals.
begin;
alter table public.mercaz_products enable row level security;
alter table public.mercaz_orders enable row level security;
alter table public.mercaz_order_items enable row level security;
alter table public.mercaz_roles enable row level security;
alter table public.mercaz_delivery_options enable row level security;
drop policy if exists mercaz_staff_insert_products on public.mercaz_products;
create policy mercaz_staff_insert_products on public.mercaz_products
for insert to authenticated
with check (exists (
  select 1 from public.mercaz_roles r
  where r.user_id=(select auth.uid()) and r.role='admin'
    and (select auth.jwt()->>'aal')='aal2'
));
drop policy if exists mercaz_staff_update_products on public.mercaz_products;
create policy mercaz_staff_update_products on public.mercaz_products
for update to authenticated
using (exists (
  select 1 from public.mercaz_roles r
  where r.user_id=(select auth.uid()) and r.role='admin'
    and (select auth.jwt()->>'aal')='aal2'
))
with check (exists (
  select 1 from public.mercaz_roles r
  where r.user_id=(select auth.uid()) and r.role='admin'
    and (select auth.jwt()->>'aal')='aal2'
));
-- Explicit least-privilege table grants; RLS further restricts product edits.
revoke all on public.mercaz_products from public,anon,authenticated;
grant select on public.mercaz_products to anon,authenticated;
grant insert,update on public.mercaz_products to authenticated;
revoke all on public.mercaz_delivery_options from public,anon,authenticated;
grant select on public.mercaz_delivery_options to anon,authenticated;
grant update(enabled,area_description,fee_agorot,instructions,updated_at) on public.mercaz_delivery_options to authenticated;
revoke all on public.mercaz_roles from public,anon,authenticated;
grant select on public.mercaz_roles to authenticated;
revoke all on public.mercaz_orders from public,anon,authenticated;
grant select on public.mercaz_orders to authenticated;
revoke all on public.mercaz_order_items from public,anon,authenticated;
grant select on public.mercaz_order_items to authenticated;
-- Row-level validation; no user-supplied prices or status writes are granted.
alter table public.mercaz_orders
  add constraint mercaz_order_customer_name_check check (
    char_length(btrim(customer_name)) between 2 and 120
  ),
  add constraint mercaz_order_customer_phone_check check (
    char_length(btrim(customer_phone)) between 6 and 30
    and btrim(customer_phone) ~ '^\+?[0-9][0-9(). -]{4,28}[0-9]$'
  ),
  add constraint mercaz_order_shipping_address_check check (
    char_length(btrim(shipping_address)) between 6 and 400
  ),
  add constraint mercaz_order_notes_length_check check (
    char_length(notes) <= 800
  ),
  add constraint mercaz_order_total_check check (
    total_agorot >= 0 and total_agorot <= 100000000
  );
alter table public.mercaz_order_items
  add constraint mercaz_order_item_qty_check check (quantity between 1 and 100),
  add constraint mercaz_order_item_price_check check (
    unit_price_agorot >= 0 and
    line_total_agorot = unit_price_agorot * quantity
  );
commit;