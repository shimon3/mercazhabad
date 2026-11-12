#!/usr/bin/env python3
"""Offline non-destructive migration and catalog validation (no Cloudflare credentials)."""
import json,re,sqlite3,pathlib,subprocess,tempfile
root=pathlib.Path(__file__).resolve().parents[1]
s=(root/"index.html").read_text(encoding="utf-8")
m=re.search(r"const PRODUCTS=(\[.*?\]);\s*const ",s,re.S)
assert m,"Missing static PRODUCTS"
static=json.loads(m.group(1))
assert len(static)==84
assert len({p["id"] for p in static})==84
assert sum(p["price"] is None for p in static)==9
assert len({p["image"] for p in static})==84
assert all((root/p["image"]).is_file() for p in static)
db=sqlite3.connect(":memory:")
db.executescript((root/"migrations/0001_products.sql").read_text())
seed=(root/"migrations/0002_import_84_products.sql").read_text()
db.executescript(seed)
assert db.execute("SELECT count(*) FROM products").fetchone()[0]==84
assert db.execute("SELECT count(*) FROM products WHERE price_agorot IS NULL").fetchone()[0]==9
assert db.execute("SELECT count(*) FROM products WHERE stock != 0").fetchone()[0]==0
assert db.execute("SELECT count(*) FROM products WHERE active=1").fetchone()[0]==84
db.execute("UPDATE products SET name_he='שינוי בבדיקה',stock=8,price_agorot=1234 WHERE id=?",(static[0]["id"],))
db.executescript(seed)
assert db.execute("SELECT name_he,stock,price_agorot FROM products WHERE id=?",(static[0]["id"],)).fetchone()==("שינוי בבדיקה",8,1234)
assert db.execute("SELECT count(*) FROM products").fetchone()[0]==84
assert "אין רכישה או חיוב" in s,"Checkout demo status must remain"
assert "matchingProduct(p,q)" in s,"Hebrew search fix must remain"
assert (root/"functions/api/admin/[[path]].js").exists()
assert (root/"admin/index.html").exists()
assert (root/"functions/api/catalog.js").exists()
assert (root/"functions/api/images/[[key]].js").exists()
# Check inline scripts without executing browser or DB.
for i,code in enumerate(re.findall(r"<script[^>]*>(.*?)</script>",s,re.S)+re.findall(r"<script[^>]*>(.*?)</script>",(root/"admin/index.html").read_text(),re.S)):
    with tempfile.NamedTemporaryFile(mode="w",suffix=".js",delete=True) as f:
        f.write(code);f.flush();subprocess.run(["node","--check",f.name],check=True,capture_output=True)
print("PASS: 84 products, 9 unknown prices, 84 photos, 0 assumed stock, idempotent seed, JS syntax, demo checkout preserved")
