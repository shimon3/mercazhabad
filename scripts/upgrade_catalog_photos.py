#!/usr/bin/env python3
"""Generate non-destructive, opaque, uniformly framed V8 photos from ORIGINAL catalog JPGs.

Never apply a circular mask to a square photo: the old approach introduced large
black circular backgrounds and cut off objects (e.g. sticker tweezers).
"""
import json
import re
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
OUTPUT = ROOT / "assets-v8"
OUTPUT.mkdir(exist_ok=True)
TARGET = 640
BACKGROUND = np.array([249, 247, 242], dtype=np.float32)
source_html = INDEX.read_text(encoding="utf-8")
match = re.search(r"const PRODUCTS=(\[.*?\]);\s*const ", source_html, re.S)
assert match, "Catalog PRODUCTS missing"
products = json.loads(match.group(1))
assert len(products) == 84 and len({p["id"] for p in products}) == 84
assert sum(p["price"] is None for p in products) == 9

def clean_photo(source):
    im = Image.open(source).convert("RGB")
    width, height = im.size
    array = np.asarray(im).astype(np.int16)
    contrast_from_white = 255 - np.min(array, axis=2)
    mask = np.uint8(contrast_from_white > 43) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    _, _, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    components = [(int(x), int(y), int(x+w), int(y+h))
                  for x, y, w, h, area in stats[1:]
                  if area >= max(9, width*height*.003)]
    if components:
        x0 = min(c[0] for c in components); y0 = min(c[1] for c in components)
        x1 = max(c[2] for c in components); y1 = max(c[3] for c in components)
    else:
        x0, y0, x1, y1 = 0, 0, width, height
    pad = max(5, round(max(x1-x0, y1-y0)*.07))
    x0, y0 = max(0, x0-pad), max(0, y0-pad)
    x1, y1 = min(width, x1+pad), min(height, y1+pad)
    crop = im.crop((x0, y0, x1, y1))
    cw, ch = crop.size

    # Only fade nearly-white pixels near the rectangle edges; never erase
    # black/colored artwork and never create a black transparent halo.
    pixels = np.asarray(crop).astype(np.float32)
    yy, xx = np.indices((ch, cw))
    edge = np.minimum.reduce([xx, yy, cw-1-xx, ch-1-yy]).astype(np.float32)
    feather = max(3, int(min(cw, ch)*.09))
    blend = np.clip(edge/feather, 0, 1)[..., None]
    near_white = np.clip((np.min(pixels, axis=2)-185)/55, 0, 1)[..., None]
    alpha = blend + (1-blend)*(1-near_white)
    composite = np.uint8(np.clip(pixels*alpha + BACKGROUND*(1-alpha), 0, 255))
    crop = Image.fromarray(composite, mode="RGB")
    crop = ImageEnhance.Contrast(crop).enhance(1.03)
    crop = crop.filter(ImageFilter.UnsharpMask(radius=.65, percent=95, threshold=3))
    scale = min(TARGET*.84/cw, TARGET*.84/ch)
    new_size = max(1, round(cw*scale)), max(1, round(ch*scale))
    resized = crop.resize(new_size, Image.Resampling.LANCZOS)
    result = Image.new("RGB", (TARGET, TARGET), tuple(map(int, BACKGROUND)))
    result.paste(resized, ((TARGET-new_size[0])//2, (TARGET-new_size[1])//2))
    return result

for p in products:
    slug = Path(p["image"]).stem
    assert re.fullmatch(r"[A-Za-z0-9._-]+", slug), f"Unexpected slug {slug}"
    original = ROOT / "assets" / (slug+".jpg")
    assert original.is_file(), f"Missing original JPG {original}"
    out = OUTPUT / (slug+".webp")
    clean_photo(original).save(out, "WEBP", quality=90, method=5)
    assert Image.open(out).mode == "RGB", f"Unexpected transparency {out}"
    p["image"] = "assets-v8/"+out.name

assert len(list(OUTPUT.glob("*.webp"))) == 84
updated = source_html[:match.start(1)]+json.dumps(products,ensure_ascii=False,separators=(",",":"))+source_html[match.end(1):]
INDEX.write_text(updated, encoding="utf-8")
print("PASS 84 opaque RGB V8 images, 84 IDs, 9 unknown prices; originals and payment settings unchanged")
