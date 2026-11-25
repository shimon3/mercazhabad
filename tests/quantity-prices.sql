-- Run inside the same transaction as the two pricing migrations, then ROLLBACK.
-- No customer orders, stock changes or persistent product edits are created.
do $$
declare v_admin uuid; v_product jsonb;
begin
 select user_id into strict v_admin from public.mercaz_roles where role='admin' limit 1;
 select jsonb_build_object('name_he',name_he,'name_fr',coalesce(name_fr,''),'category',category,
  'subcategory',coalesce(subcategory,''),'price_agorot',2000,'old_price_agorot',2500,
  'stock',stock,'description',coalesce(description,''),'image_key',coalesce(image_key,''),
  'stock_tracking_enabled',stock_tracking_enabled,'active',active)
 into strict v_product from public.mercaz_products where id='mg/8';
 perform set_config('request.jwt.claims','{}',true);
 begin
  perform public.mercaz_save_product_with_prices('mg/8',v_product,1500,1200);
  raise exception 'TEST: anonymous save was accepted';
 exception when raise_exception then
  if sqlerrm<>'Administrator MFA required' then raise; end if;
 end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated','aal','aal1')::text,true);
 begin
  perform public.mercaz_save_product_with_prices('mg/8',v_product,1500,1200);
  raise exception 'TEST: non-MFA save was accepted';
 exception when raise_exception then
  if sqlerrm<>'Administrator MFA required' then raise; end if;
 end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated','aal','aal2')::text,true);
 perform public.mercaz_save_product_with_prices('mg/8',v_product,1500,1200);
 if mercaz_private.quantity_unit_price('mg/8',9,2000)<>2000
  or mercaz_private.quantity_unit_price('mg/8',10,2000)<>1500
  or mercaz_private.quantity_unit_price('mg/8',19,2000)<>1500
  or mercaz_private.quantity_unit_price('mg/8',20,2000)<>1200
  or mercaz_private.quantity_unit_price('mg/8',100,2000)<>1200
  or mercaz_private.quantity_unit_price('mg/8',20,1000)<>1000
 then raise exception 'TEST: threshold calculation mismatch'; end if;
 if mercaz_private.quantity_unit_price('not-present',20,2000)<>2000 then raise exception 'TEST: base-price fallback'; end if;
 begin
  perform public.mercaz_save_product_with_prices('mg/8',v_product,1500,1600);
  raise exception 'TEST: invalid ladder accepted';
 exception when raise_exception then
  if sqlerrm<>'Invalid price ladder' then raise; end if;
 end;
 if (select price_20_agorot from public.mercaz_quantity_prices where product_id='mg/8')<>1200 then raise exception 'TEST: failed save changed prices'; end if;
 if has_table_privilege('anon','public.mercaz_quantity_prices','UPDATE')
  or has_table_privilege('authenticated','public.mercaz_quantity_prices','UPDATE')
  or has_function_privilege('anon','public.mercaz_save_product_with_prices(text,jsonb,integer,integer)','EXECUTE')
 then raise exception 'TEST: pricing privileges too broad'; end if;
 if position('mercaz_private.quantity_unit_price' in pg_get_functiondef('mercaz_private.mercaz_create_order(jsonb,text,text,text,text)'::regprocedure))=0 then raise exception 'TEST: checkout ignores quantity prices'; end if;
 insert into public.mercaz_quantity_prices(product_id,price_10_agorot,price_20_agorot) values('mg/4',1500,1200);
 perform set_config('request.jwt.claims','{}',true);
end $$;
set local role anon;
do $$ begin
 if (select count(*) from public.mercaz_quantity_prices where product_id='mg/8')<>1 then raise exception 'TEST: active prices not readable'; end if;
 if exists(select 1 from public.mercaz_quantity_prices where product_id='mg/4') then raise exception 'TEST: hidden prices exposed'; end if;
end $$;
reset role;
