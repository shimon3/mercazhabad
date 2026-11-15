-- Grow sandbox payment ledger. Deliberately excludes card data and raw webhooks.
begin;
create table if not exists mercaz_private.mercaz_grow_transactions (
  order_id uuid not null unique references public.mercaz_orders(id) on delete restrict,
  transaction_id text primary key check (transaction_id ~ '^[0-9]{1,30}$'),
  amount_agorot integer not null check (amount_agorot > 0),
  status text not null default 'paid' check (status='paid'),
  recorded_at timestamptz not null default now()
);
revoke all on mercaz_private.mercaz_grow_transactions from public,anon,authenticated;
create or replace function mercaz_private.mercaz_record_verified_grow_payment(
 p_order uuid,p_transaction_id text,p_amount_agorot integer
) returns boolean language plpgsql security definer set search_path='' as $$
declare v_order public.mercaz_orders%rowtype; v_existing mercaz_private.mercaz_grow_transactions%rowtype;
begin
 if (select auth.jwt()->>'role') is distinct from 'service_role' then
   raise exception 'Backend role required' using errcode='42501';
 end if;
 if p_order is null or p_transaction_id !~ '^[0-9]{1,30}$'
   or p_amount_agorot is null or p_amount_agorot<=0
 then raise exception 'Invalid verified transaction input' using errcode='22023'; end if;
 select * into v_order from public.mercaz_orders where id=p_order for update;
 if not found then raise exception 'Order not found' using errcode='P0002'; end if;
 select * into v_existing from mercaz_private.mercaz_grow_transactions
  where transaction_id=p_transaction_id or order_id=p_order for update;
 if found then
  if v_existing.transaction_id=p_transaction_id
   and v_existing.order_id=p_order and v_existing.amount_agorot=p_amount_agorot
   and v_order.payment_status='paid'
  then return false; end if;
  raise exception 'Duplicate or inconsistent Grow transaction' using errcode='23505';
 end if;
 if v_order.payment_status <> 'pending_payment'
    or v_order.fulfillment_status='cancelled'
    or v_order.total_agorot<>p_amount_agorot
 then raise exception 'Order is not payable for the verified amount' using errcode='22023'; end if;
 insert into mercaz_private.mercaz_grow_transactions(order_id,transaction_id,amount_agorot,status)
 values(p_order,p_transaction_id,p_amount_agorot,'paid');
 update public.mercaz_orders
 set payment_status='paid',updated_at=now()
 where id=p_order and payment_status='pending_payment';
 -- Existing BEFORE UPDATE trigger deducts tracked inventory exactly once.
 return true;
end $$;
revoke all on function mercaz_private.mercaz_record_verified_grow_payment(uuid,text,integer) from public,anon,authenticated;
grant execute on function mercaz_private.mercaz_record_verified_grow_payment(uuid,text,integer) to service_role;
create or replace function public.mercaz_record_verified_grow_payment(
 p_order uuid,p_transaction_id text,p_amount_agorot integer
) returns boolean language sql security invoker set search_path='' as $$
 select mercaz_private.mercaz_record_verified_grow_payment(p_order,p_transaction_id,p_amount_agorot)
$$;
revoke all on function public.mercaz_record_verified_grow_payment(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.mercaz_record_verified_grow_payment(uuid,text,integer) to service_role;
-- Disallow the older browser-triggered manual "paid" path: only the verified
-- Cloudflare webhook service role is authorized to transition to paid.
revoke all on function public.mercaz_confirm_manual_payment(uuid,text,boolean) from public,anon,authenticated;
revoke all on function mercaz_private.mercaz_confirm_manual_payment(uuid,text,boolean) from public,anon,authenticated;
commit;