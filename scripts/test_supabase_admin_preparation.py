#!/usr/bin/env python3
"""Static validation; does NOT replace running SQL on a dedicated Supabase project."""
import json,re,subprocess,tempfile,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
home=(root/"index.html").read_text(encoding="utf-8")
products=json.loads(re.search(r"const PRODUCTS=(\[.*?\]);\s*const ",home,re.S).group(1))
seed=(root/"supabase/setup/02_seed_84_products.sql").read_text(encoding="utf-8")
schema=(root/"supabase/setup/01_schema.sql").read_text(encoding="utf-8")
admin=(root/"admin-supabase/index.html").read_text(encoding="utf-8")
config=(root/"admin-supabase/config.js").read_text(encoding="utf-8")
assert len(products)==84 and len({p["id"] for p in products})==84
assert sum(p["price"] is None for p in products)==9
assert seed.count("on conflict (id) do nothing;")==84
assert seed.count("insert into public.mercaz_products")==84
assert all(("/"+p["image"]).replace("'","''") in seed for p in products)
assert "on conflict (id) do update" not in seed.lower()
assert "enable row level security" in schema
assert schema.count("enable row level security")==3
for pattern in ("mercaz_admin_self","mercaz_public_active","mercaz_admin_insert","mercaz_admin_update","mercaz_photos_admin_insert","mercaz_photos_admin_update","mercaz_audit_admin_read"):
    assert pattern in schema,pattern
assert "user_meta_data" not in schema
assert "from public.mercaz_admin_users" in schema
assert 'service_role' not in admin.lower()
assert "SUPABASE_URL = ''" in config
assert "SUPABASE_PUBLISHABLE_KEY = ''" in config
assert '"/api/catalog"' not in home and "functions/api/admin" not in home
match=re.search(r'<script type="module">([\s\S]*?)</script>',admin)
assert match
with tempfile.TemporaryDirectory() as tmp:
    p=pathlib.Path(tmp)/"admin.mjs";p.write_text(match.group(1),encoding="utf-8")
    subprocess.run(["node","--check",str(p)],check=True,capture_output=True)
print("PASS: 84 unique products, 9 missing prices, non-overwriting seed, RLS allowlist/storage rules, no secret key, admin syntax")
