-- Preserves the existing order function, including inventory, limits and ownership.
-- Only the database-derived non-pack unit price changes.
begin;
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
   v_pack:=null;
   if v_product.category='PhoneStickers' and v_product.id not like 'mix-%' then
     if coalesce(v_item->>'pack','') not in ('4','10') then raise exception 'Invalid sticker pack'; end if;
     v_pack:=(v_item->>'pack')::int;
     v_unit:=case when v_pack=4 then 1500 else 3000 end;
   else
     if v_item ? 'pack' and v_item->>'pack' is not null then raise exception 'Invalid pack'; end if;
     v_unit:=mercaz_private.quantity_unit_price(v_product.id,v_qty,v_product.price_agorot);
     if v_unit is null then raise exception 'Price unavailable'; end if;
   end if;
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
