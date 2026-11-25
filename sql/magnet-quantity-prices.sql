-- Additive pricing schema. Does not change existing product prices.
begin;
create table if not exists public.mercaz_quantity_prices (
 product_id text primary key references public.mercaz_products(id) on delete cascade,
 price_10_agorot integer not null check(price_10_agorot between 0 and 100000000),
 price_20_agorot integer not null check(price_20_agorot between 0 and price_10_agorot),
 updated_at timestamptz not null default now()
);
alter table public.mercaz_quantity_prices enable row level security;
revoke all on public.mercaz_quantity_prices from public,anon,authenticated;
grant select on public.mercaz_quantity_prices to anon,authenticated;
drop policy if exists mercaz_quantity_read on public.mercaz_quantity_prices;
create policy mercaz_quantity_read on public.mercaz_quantity_prices for select to anon,authenticated
using(exists(select 1 from public.mercaz_products p where p.id=product_id and p.active));
drop policy if exists mercaz_quantity_staff_read on public.mercaz_quantity_prices;
create policy mercaz_quantity_staff_read on public.mercaz_quantity_prices for select to authenticated
using(auth.jwt()->>'aal'='aal2' and exists(select 1 from public.mercaz_roles r where r.user_id=auth.uid() and r.role in ('admin','manager')));

create or replace function mercaz_private.quantity_unit_price(p_id text,p_qty integer,p_base integer)
returns integer language sql stable set search_path='' as $$
 select case when p_base is null then null else least(p_base,coalesce((
  select case when p_qty>=20 then q.price_20_agorot when p_qty>=10 then q.price_10_agorot else p_base end
  from public.mercaz_quantity_prices q where q.product_id=p_id),p_base)) end
$$;
revoke all on function mercaz_private.quantity_unit_price(text,integer,integer) from public,anon,authenticated;

create or replace function public.mercaz_save_product_with_prices(p_product_id text,p_product jsonb,p_price_10 integer,p_price_20 integer)
returns void language plpgsql security definer set search_path='' as $$
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
  or (p_price_10 is not null and (v_category<>'CarMagnets' or v_price is null or p_price_10<0 or p_price_10>v_price or p_price_20<0 or p_price_20>p_price_10))
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

commit;
