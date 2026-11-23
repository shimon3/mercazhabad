-- Coupon preview in the cart BEFORE login (like big shops: "הזנת קופון" in the basket).
-- Run once in Supabase SQL Editor, after sql/coupons.sql. Idempotent.
-- Read-only: it only says whether a code is valid for this basket amount. The real discount is
-- still computed and recorded by mercaz_create_order_with_coupon at confirmation (signed-in).
-- Anti-guessing: max 20 checks per 10 minutes per IP address, and the same message for any bad code.

create table if not exists public.mercaz_coupon_attempts (
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists mercaz_coupon_attempts_ip_idx on public.mercaz_coupon_attempts (ip, at);
alter table public.mercaz_coupon_attempts enable row level security;
revoke all on public.mercaz_coupon_attempts from public, anon, authenticated;

create or replace function public.mercaz_preview_coupon(p_code text, p_total_agorot integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.mercaz_coupons%rowtype; v_uses integer; v_discount integer; v_ip text;
  v_code text := upper(btrim(coalesce(p_code, '')));
begin
  v_ip := coalesce(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), 'unknown');
  delete from public.mercaz_coupon_attempts where at < now() - interval '1 day';
  if (select count(*) from public.mercaz_coupon_attempts where ip = v_ip and at > now() - interval '10 minutes') >= 20 then
    raise exception 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות' using errcode = 'P0001';
  end if;
  insert into public.mercaz_coupon_attempts (ip) values (v_ip);
  -- From here, invalid cases RETURN an error (a raise would roll back the attempt and defeat the limit).

  if p_total_agorot is null or p_total_agorot < 0 or p_total_agorot > 100000000 then
    return jsonb_build_object('error', 'סכום לא תקין');
  end if;
  if v_code !~ '^[A-Z0-9_-]{3,30}$' then return jsonb_build_object('error', 'קוד הקופון אינו תקף'); end if;
  select * into c from public.mercaz_coupons where code = v_code;
  if not found or not c.active
     or (c.starts_at is not null and now() < c.starts_at)
     or (c.expires_at is not null and now() > c.expires_at) then
    return jsonb_build_object('error', 'קוד הקופון אינו תקף');
  end if;
  if c.max_uses is not null then
    select count(*) into v_uses from public.mercaz_coupon_redemptions where coupon_code = c.code;
    if v_uses >= c.max_uses then return jsonb_build_object('error', 'הקופון כבר נוצל עד הסוף'); end if;
  end if;
  if p_total_agorot < c.min_total_agorot then
    return jsonb_build_object('error', format('הקופון תקף בהזמנה מעל ₪%s', rtrim(to_char(c.min_total_agorot / 100.0, 'FM999990.##'), '.')));
  end if;
  v_discount := case c.kind when 'percent' then floor(p_total_agorot * c.value / 100.0)::integer else c.value end;
  return jsonb_build_object('code', c.code, 'discount_agorot', greatest(0, least(v_discount, p_total_agorot)),
                            'kind', c.kind, 'value', c.value, 'one_per_customer', c.one_per_customer);
end $$;
revoke execute on function public.mercaz_preview_coupon(text, integer) from public;
grant execute on function public.mercaz_preview_coupon(text, integer) to anon, authenticated;
