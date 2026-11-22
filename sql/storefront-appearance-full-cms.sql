-- Applied 2026-11-22: the full-site CMS (every text, image, link and section)
-- needs more room than the original 8 KB design settings.
alter table public.mercaz_storefront_appearance drop constraint if exists mercaz_storefront_appearance_settings_check;
alter table public.mercaz_storefront_appearance add constraint mercaz_storefront_appearance_settings_check
  check (jsonb_typeof(settings) = 'object' and octet_length(settings::text) <= 65536);
