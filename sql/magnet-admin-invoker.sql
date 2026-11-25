-- Keep the atomic save function within the caller's RLS permissions.
begin;
grant insert,update,delete on public.mercaz_quantity_prices to authenticated;
drop policy if exists mercaz_quantity_admin_write on public.mercaz_quantity_prices;
create policy mercaz_quantity_admin_write on public.mercaz_quantity_prices
for all to authenticated
using((select auth.jwt()->>'aal')='aal2' and exists(
 select 1 from public.mercaz_roles r where r.user_id=(select auth.uid()) and r.role='admin'
))
with check((select auth.jwt()->>'aal')='aal2' and exists(
 select 1 from public.mercaz_roles r where r.user_id=(select auth.uid()) and r.role='admin'
) and exists(
 select 1 from public.mercaz_products p where p.id=product_id and p.category='CarMagnets'
 and p.price_agorot>=price_10_agorot
));
alter function public.mercaz_save_product_with_prices(text,jsonb,integer,integer) security invoker;
commit;
