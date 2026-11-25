-- Extend quantity pricing to every category. Does not change existing prices.
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
 select 1 from public.mercaz_products p where p.id=product_id
 and p.price_agorot>=price_10_agorot
));

create or replace function public.mercaz_save_product_with_prices(p_product_id text,p_product jsonb,p_price_10 integer,p_price_20 integer)
returns void language plpgsql security invoker set search_path='' as $$
declare v_price integer; v_old integer; v_category text;
begin
 if (auth.jwt()->>'aal') is distinct from 'aal2' or not exists(
  select 1 from public.mercaz_roles r where r.user_id=auth.uid() and r.role='admin'
 ) then raise exception 'Administrator MFA required'; end if;
 if jsonb_typeof(p_product) is distinct from 'object' or not(p_product ?& array['name_he','name_fr','category','subcategory','price_agorot','old_price_agorot','stock','description','image_key','stock_tracking_enabled','active'])
  or exists(select 1 from jsonb_object_keys(p_product) k where k not in('name_he','name_fr','category','subcategory','price_agorot','old_price_agorot','stock','description','image_key','stock_tracking_enabled','active'))
 then raise exception 'Invalid product fields'; end if;
 v_price:=(p_product->>'price_agorot')::integer; v_old:=(p_product->>'old_price_agorot')::integer;
 v_category:=p_product->>'category';
 if (v_price is not null and v_price not between 0 and 100000000)
  or (v_old is not null and (v_price is null or v_old<v_price or v_old>100000000))
  or ((p_price_10 is null)<>(p_price_20 is null))
  or (p_price_10 is not null and (v_price is null or p_price_10<0 or p_price_10>v_price or p_price_20<0 or p_price_20>p_price_10))
 then raise exception 'Invalid price ladder'; end if;
 if char_length(btrim(p_product->>'name_he')) not between 1 and 250
  or (p_product->>'stock')::integer<0 then raise exception 'Invalid product'; end if;
 update public.mercaz_products set name_he=btrim(p_product->>'name_he'),name_fr=p_product->>'name_fr',
  category=v_category,subcategory=p_product->>'subcategory',price_agorot=v_price,old_price_agorot=v_old,
  stock=(p_product->>'stock')::integer,description=p_product->>'description',image_key=p_product->>'image_key',
  stock_tracking_enabled=(p_product->>'stock_tracking_enabled')::boolean,active=(p_product->>'active')::boolean,
  updated_at=now() where id=p_product_id;
 if not found then raise exception 'Unknown product'; end if;
 if p_price_10 is null then delete from public.mercaz_quantity_prices where product_id=p_product_id;
 else insert into public.mercaz_quantity_prices(product_id,price_10_agorot,price_20_agorot)
  values(p_product_id,p_price_10,p_price_20) on conflict(product_id) do update
  set price_10_agorot=excluded.price_10_agorot,price_20_agorot=excluded.price_20_agorot,updated_at=now(); end if;
end $$;
revoke all on function public.mercaz_save_product_with_prices(text,jsonb,integer,integer) from public,anon,authenticated;
grant execute on function public.mercaz_save_product_with_prices(text,jsonb,integer,integer) to authenticated;


create or replace function public.mercaz_create_product_with_prices(p_product jsonb,p_price_10 integer,p_price_20 integer)
returns text language plpgsql security invoker set search_path='' as $$
declare v_id text:=p_product->>'id';
begin
 if (auth.jwt()->>'aal') is distinct from 'aal2' or not exists(
  select 1 from public.mercaz_roles r where r.user_id=auth.uid() and r.role='admin'
 ) then raise exception 'Administrator MFA required'; end if;
 if v_id is null or v_id !~ '^[A-Za-z0-9_/-]{1,90}$' then raise exception 'Invalid product id'; end if;
 insert into public.mercaz_products(id,name_he,name_fr,category,subcategory,price_agorot,old_price_agorot,stock,description,image_key,stock_tracking_enabled,active)
 values(v_id,p_product->>'name_he',p_product->>'name_fr',p_product->>'category',p_product->>'subcategory',
  (p_product->>'price_agorot')::integer,(p_product->>'old_price_agorot')::integer,(p_product->>'stock')::integer,
  p_product->>'description',p_product->>'image_key',(p_product->>'stock_tracking_enabled')::boolean,(p_product->>'active')::boolean);
 perform public.mercaz_save_product_with_prices(v_id,p_product-'id',p_price_10,p_price_20);
 return v_id;
end $$;
revoke all on function public.mercaz_create_product_with_prices(jsonb,integer,integer) from public,anon,authenticated;
grant execute on function public.mercaz_create_product_with_prices(jsonb,integer,integer) to authenticated;

-- Explicit custom unit tiers take precedence over default sticker packs.
-- Previously stored pack orders remain valid at their existing pack prices.
create or replace function mercaz_private.sale_price(p_id text,p_category text,p_qty integer,p_pack text,p_base integer)
returns table(pack_size integer,unit_price_agorot integer)
language plpgsql stable set search_path='' as $$
begin
 pack_size:=null;
 if p_category='PhoneStickers' and p_id not like 'mix-%'
  and (p_pack is not null or not exists(select 1 from public.mercaz_quantity_prices where product_id=p_id)) then
  if coalesce(p_pack,'') not in('4','10') then raise exception 'Invalid sticker pack'; end if;
  pack_size:=p_pack::integer;
  unit_price_agorot:=case when pack_size=4 then 1500 else 3000 end;
 else
  if p_pack is not null then raise exception 'Invalid pack'; end if;
  unit_price_agorot:=mercaz_private.quantity_unit_price(p_id,p_qty,p_base);
 end if;
 if unit_price_agorot is null then raise exception 'Price unavailable'; end if;
 return next;
end $$;
revoke all on function mercaz_private.sale_price(text,text,integer,text,integer) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION mercaz_private.mercaz_create_order(p_items jsonb, p_name text, p_phone text, p_address text, p_notes text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_customer uuid:=auth.uid();
 v_order uuid;
 v_item jsonb;
 v_product public.mercaz_products%rowtype;
 v_qty int; v_pack int; v_unit int; v_total bigint:=0; v_demand int;
 v_requested jsonb:='{}'::jsonb;
begin
 if v_customer is null then raise exception 'Authentication required'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array'
 or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'Invalid cart'; end if;
 if char_length(trim(coalesce(p_name,''))) not between 2 and 120
 or char_length(trim(coalesce(p_phone,''))) not between 6 and 30
 or char_length(trim(coalesce(p_address,''))) not between 6 and 400
 or char_length(coalesce(p_notes,''))>800 then raise exception 'Invalid shipping details'; end if;
 -- Throttle attempts that persist as database orders without needing external services.
 if (select count(*) from public.mercaz_orders where customer_id=v_customer and created_at>now()-interval '1 hour')>=5
 or (select count(*) from public.mercaz_orders where customer_id=v_customer
     and payment_status='pending_payment' and fulfillment_status <> 'cancelled')>=10
 then raise exception 'Order limit reached'; end if;
 insert into public.mercaz_orders(customer_id,customer_name,customer_phone,shipping_address,notes,total_agorot)
 values(v_customer,trim(p_name),trim(p_phone),trim(p_address),coalesce(p_notes,''),0)
 returning id into v_order;
 for v_item in select value from jsonb_array_elements(p_items) loop
   if jsonb_typeof(v_item)<>'object' or coalesce(v_item->>'id','')=''
    or coalesce(v_item->>'quantity','') !~ '^[0-9]{1,3}$'
   then raise exception 'Invalid order line'; end if;
   v_qty:=(v_item->>'quantity')::int;
   if v_qty<1 or v_qty>100 then raise exception 'Invalid quantity'; end if;
   select * into v_product from public.mercaz_products where id=v_item->>'id' and active=true for update;
   if not found then raise exception 'Product unavailable'; end if;
   select s.pack_size,s.unit_price_agorot into v_pack,v_unit
   from mercaz_private.sale_price(v_product.id,v_product.category,v_qty,v_item->>'pack',v_product.price_agorot) s;
   -- Tracked sticker inventory counts individual stickers; others count sale units/bundles.
   v_demand := v_qty * coalesce(v_pack,1);
   v_demand := v_demand+coalesce((v_requested->>v_product.id)::int,0);
   v_requested:=jsonb_set(v_requested,ARRAY[v_product.id],to_jsonb(v_demand),true);
   if v_product.stock_tracking_enabled and v_demand>v_product.stock then
     raise exception 'Insufficient stock for product %',v_product.id;
   end if;
   v_total:=v_total + (v_unit::bigint*v_qty);
   if v_total>100000000 then raise exception 'Order exceeds maximum'; end if;
   insert into public.mercaz_order_items(order_id,product_id,product_name,pack_size,quantity,unit_price_agorot,line_total_agorot)
    values(v_order,v_product.id,v_product.name_he,v_pack,v_qty,v_unit,v_unit*v_qty);
 end loop;
 update public.mercaz_orders set total_agorot=v_total::int where id=v_order;
 return v_order;
end $function$
;
commit;
