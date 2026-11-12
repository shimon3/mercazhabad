#!/usr/bin/env python3
"""Regenerate the 84 storefront images from original assets; no fabricated product details."""
import json, re
from pathlib import Path
import numpy as np
import cv2
from PIL import Image, ImageOps, ImageFilter, ImageEnhance

root=Path(__file__).resolve().parent.parent
index=root/"index.html"
source=index.read_text(encoding="utf-8")
match=re.search(r"const PRODUCTS=(\[.*?\]);\s*const ",source,re.S)
assert match, "PRODUCTS missing"
products=json.loads(match.group(1))
assert len(products)==84 and len({p["id"] for p in products})==84
assert sum(p["price"] is None for p in products)==9
output=root/"assets-v7"
output.mkdir(exist_ok=True)
natural={"carte","k-mix","k1","k2","k3","k4","k5","k6","k7","k8","kippa-soldat","ko/1","ko/2","ko/3","lot-80","mg/20-drapeau","mg/21","patch","s/1-temple","s/2-temple","s/3-temple","s/4","t/t"}
natural_names={"ko_1","ko_2","ko_3","mg_20-drapeau","mg_21","s_1-temple","s_2-temple","s_3-temple","s_4","t_t"}
N=768
def extract_box(im):
    rgb=np.asarray(im.convert("RGB")).astype(np.int16)
    white_dist=np.max(255-rgb,axis=2)
    mask=np.asarray(white_dist>42,np.uint8)*255
    mask=cv2.morphologyEx(mask,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
    count,labels,stats,centers=cv2.connectedComponentsWithStats(mask,8)
    found=[(int(x),int(y),int(x+w),int(y+h)) for x,y,w,h,area in stats[1:] if area>=max(14,im.width*im.height*.0015)]
    if not found:return (0,0,im.width,im.height)
    return (min(x[0] for x in found),min(x[1] for x in found),max(x[2] for x in found),max(x[3] for x in found))
def upgrade(path,round_shape):
    img=Image.open(path).convert("RGB")
    x0,y0,x1,y1=extract_box(img)
    if round_shape:
        cx=(x0+x1)/2;cy=(y0+y1)/2
        radius=max(x1-x0,y1-y0)/2+2.2
        x0=max(0,int(cx-radius-1));x1=min(img.width,int(cx+radius+2))
        y0=max(0,int(cy-radius-1));y1=min(img.height,int(cy+radius+2))
        cropped=img.crop((x0,y0,x1,y1)).convert("RGBA")
        xx,yy=np.meshgrid(np.arange(cropped.width),np.arange(cropped.height))
        rx=cx-x0;ry=cy-y0
        rr=min(rx,cropped.width-rx,ry,cropped.height-ry)-.4
        alpha=np.clip((rr-np.sqrt((xx-rx)**2+(yy-ry)**2))*220+130,0,255).astype("uint8")
        cropped.putalpha(Image.fromarray(alpha,"L"))
    else:
        margin=max(2,int(max(x1-x0,y1-y0)*.04))
        cropped=img.crop((max(0,x0-margin),max(0,y0-margin),min(img.width,x1+margin),min(img.height,y1+margin))).convert("RGBA")
    rgb=ImageOps.autocontrast(cropped.convert("RGB"),cutoff=.5)
    rgb=ImageEnhance.Contrast(rgb).enhance(1.03).filter(ImageFilter.UnsharpMask(radius=.85,percent=115,threshold=2))
    enhanced=rgb.convert("RGBA")
    enhanced.putalpha(cropped.getchannel("A"))
    scale=min((N*.80)/enhanced.width,(N*.80)/enhanced.height)
    nw,nh=max(1,round(enhanced.width*scale)),max(1,round(enhanced.height*scale))
    enhanced=enhanced.resize((nw,nh),Image.Resampling.LANCZOS)
    result=Image.new("RGBA",(N,N),(0,0,0,0))
    result.alpha_composite(enhanced,((N-nw)//2,(N-nh)//2))
    return result
for product in products:
    src=root/product["image"]
    assert src.is_file(),f"Missing original: {src}"
    name=Path(product["image"]).stem
    is_circle=product["id"] not in natural and name not in natural_names
    dest=output/(name+".webp")
    upgrade(src,is_circle).save(dest,format="WEBP",quality=89,method=5)
    product["image"]="assets-v7/"+dest.name
assert len(list(output.glob("*.webp")))==84
updated=source[:match.start(1)]+json.dumps(products,ensure_ascii=False,separators=(",",":"))+source[match.end(1):]
styles='<style id="photo-v7">.photo img,.category img,.modal-layout img,.cartitem img{object-fit:contain!important;object-position:center!important;mix-blend-mode:normal!important;filter:none!important}.photo img{width:100%!important;height:100%!important}.photo{background:#f9f7f2!important;padding:8px!important}.product:hover .photo img{transform:none!important}@media(max-width:560px){.photo{padding:5px!important}}</style>'
if 'id="photo-v7"' not in updated:updated=updated.replace("</head>",styles+"</head>")
index.write_text(updated,encoding="utf-8")
print("PASS 84/84 images, 9 unpriced products preserved, payment configuration unchanged")
