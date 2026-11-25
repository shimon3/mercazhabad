-- Run after the all-product migration inside a transaction; roll back everything.
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from public.mercaz_roles where role='admin' limit 1),'role','authenticated','aal','aal2')::text,true);
set local role authenticated;
do $$
declare p public.mercaz_products%rowtype; payload jsonb; v_id text;
begin
 for p in select * from public.mercaz_products where id in(
  select distinct on(category) id from public.mercaz_products order by category,id
 ) or id='hero/purple' loop
  payload:=jsonb_build_object('name_he',p.name_he,'name_fr',coalesce(p.name_fr,''),'category',p.category,
   'subcategory',coalesce(p.subcategory,''),'price_agorot',2000,'old_price_agorot',2500,
   'stock',p.stock,'description',coalesce(p.description,''),'image_key',coalesce(p.image_key,''),
   'stock_tracking_enabled',p.stock_tracking_enabled,'active',p.active);
  perform public.mercaz_save_product_with_prices(p.id,payload,1500,1200);
  if not exists(select 1 from public.mercaz_quantity_prices where product_id=p.id and price_20_agorot=1200)
  then raise exception 'TEST: category % not saved',p.category; end if;
 end loop;
 v_id:='test-quantity-'||gen_random_uuid()::text;
 payload:=payload||jsonb_build_object('id',v_id,'name_he','בדיקת מחירי כמות','category','PhoneStickers','subcategory','','active',false);
 if public.mercaz_create_product_with_prices(payload,1500,1200)<>v_id then raise exception 'TEST: create return value'; end if;
 if not exists(select 1 from public.mercaz_products where id=v_id and sku ~ '^MH-[0-9]{6,}$')
  or not exists(select 1 from public.mercaz_quantity_prices where product_id=v_id and price_20_agorot=1200)
 then raise exception 'TEST: creation was incomplete'; end if;
 begin
  perform public.mercaz_create_product_with_prices(payload||jsonb_build_object('id',v_id||'-bad'),1500,1600);
  raise exception 'TEST: invalid create accepted';
 exception when raise_exception then
  if sqlerrm<>'Invalid price ladder' then raise; end if;
 end;
 if exists(select 1 from public.mercaz_products where id=v_id||'-bad') then raise exception 'TEST: failed create left a product'; end if;
 perform set_config('request.jwt.claims','{}',true);
 begin
  perform public.mercaz_create_product_with_prices(payload,1500,1200);
  raise exception 'TEST: unauthorized create accepted';
 exception when raise_exception then
  if sqlerrm<>'Administrator MFA required' then raise; end if;
 end;
end $$;
reset role;
do $$
declare s record;
begin
 select * into strict s from mercaz_private.sale_price('hero/purple','PhoneStickers',20,null,2000);
 if s.pack_size is not null or s.unit_price_agorot<>1200 then raise exception 'TEST: configured stickers ignore unit tiers'; end if;
 select * into strict s from mercaz_private.sale_price('hero/purple','PhoneStickers',10,null,2000);
 if s.unit_price_agorot<>1500 then raise exception 'TEST: sticker 10 threshold'; end if;
 select * into strict s from mercaz_private.sale_price('hero/purple','PhoneStickers',20,'4',2000);
 if s.pack_size<>4 or s.unit_price_agorot<>1500 then raise exception 'TEST: legacy pack changed'; end if;
 select * into strict s from mercaz_private.sale_price('not-configured','PhoneStickers',20,'10',500);
 if s.pack_size<>10 or s.unit_price_agorot<>3000 then raise exception 'TEST: default pack changed'; end if;
 begin
  perform * from mercaz_private.sale_price('not-configured','PhoneStickers',20,null,500);
  raise exception 'TEST: unconfigured sticker accepted as individual';
 exception when raise_exception then
  if sqlerrm<>'Invalid sticker pack' then raise; end if;
 end;
 begin
  perform * from mercaz_private.sale_price('hero/purple','PhoneStickers',20,'2',2000);
  raise exception 'TEST: invalid custom pack accepted';
 exception when raise_exception then
  if sqlerrm<>'Invalid sticker pack' then raise; end if;
 end;
 if has_function_privilege('anon','public.mercaz_create_product_with_prices(jsonb,integer,integer)','EXECUTE')
 then raise exception 'TEST: anonymous create grant'; end if;
end $$;
