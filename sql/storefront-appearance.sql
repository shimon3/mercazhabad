begin;
create table public.mercaz_storefront_appearance (
  id integer primary key check (id = 1),
  settings jsonb not null default '{}' check (
    jsonb_typeof(settings) = 'object' and octet_length(settings::text) <= 8192
  ),
  revision integer not null default 0 check (revision >= 0)
);
insert into public.mercaz_storefront_appearance (id) values (1);

alter table public.mercaz_storefront_appearance enable row level security;
revoke all on public.mercaz_storefront_appearance from public, anon, authenticated;
grant select on public.mercaz_storefront_appearance to anon, authenticated;
grant update (settings, revision) on public.mercaz_storefront_appearance to authenticated;
create policy storefront_appearance_read on public.mercaz_storefront_appearance
  for select to anon, authenticated using (true);
create policy storefront_appearance_publish on public.mercaz_storefront_appearance
  for update to authenticated
  using (
    (select auth.jwt()->>'aal') = 'aal2' and exists (
      select 1 from public.mercaz_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'
    )
  )
  with check (
    (select auth.jwt()->>'aal') = 'aal2' and exists (
      select 1 from public.mercaz_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'
    )
  );
commit;
