const BASE = 'https://bdalhyqpruefdbyirykp.supabase.co';
const KEY = 'sb_publishable_K6ciGUejNpRfLeIEc598Iw_L3VoMJYM';
const money = n => n == null ? '' : (n / 100).toFixed(2);
const photoHost = '/storage/v1/object/public/mercaz-product-images/';
const validImage = url => {
  try {
    const parsed = new URL(url, location.origin);
    return ['https:', 'http:'].includes(parsed.protocol) && [location.origin, BASE].includes(parsed.origin) ? parsed.href : '';
  } catch { return ''; }
};

export async function mountProductVisualEditor(host, getToken, back, initialProductId = null, initialField = null) {
  host.replaceChildren();
  const layout = document.createElement('div');
  layout.className = 'appearance-workspace';
  const sidebar = document.createElement('form');
  sidebar.className = 'appearance-sidebar';
  sidebar.innerHTML = '<h2>עריכת מוצרים בקליק</h2><p>בחרו מוצר בתצוגה המקדימה או מהרשימה. כל שינוי נשמר רק בלחיצה על שמירה.</p><label>מוצר <select name="product" required></select></label><fieldset class="appearance-fields" data-fields></fieldset><div class="appearance-actions"><button type="submit">שמירת המוצר</button><button type="button" class="secondary" data-back>חזרה לעריכת העיצוב</button></div><p role="status" class="status" aria-live="polite"></p>';
  const preview = document.createElement('div');
  preview.className = 'appearance-preview';
  preview.innerHTML = '<div class="appearance-preview-bar"><span>לחצו על כל כרטיס מוצר לעריכה</span><button type="button" class="secondary" data-mobile>תצוגת נייד</button></div><iframe title="תצוגה מקדימה של המוצרים" sandbox="allow-same-origin allow-scripts"></iframe>';
  layout.append(sidebar, preview);
  host.append(layout);
  const select = sidebar.elements.product;
  const fields = sidebar.querySelector('[data-fields]');
  const status = sidebar.querySelector('[role="status"]');
  const iframe = preview.querySelector('iframe');
  async function loadPreview() {
    report('טוען תצוגה מקדימה…');
    try {
      // The public storefront deliberately sends X-Frame-Options: DENY and
      // CSP frame-ancestors 'none'. A direct iframe.src request is therefore
      // blocked. Build an isolated same-origin srcdoc preview instead.
      const url = new URL('/', location.origin);
      const response = await fetch(url, {cache:'no-store', signal:AbortSignal.timeout(10000)});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const html = new DOMParser().parseFromString(await response.text(), 'text/html');
      html.documentElement.dataset.cmsProductPreview = 'true';
      for (const node of html.querySelectorAll('[src], [href]')) {
        for (const attribute of ['src', 'href']) {
          const value = node.getAttribute(attribute);
          if (!value || value.startsWith('#')) continue;
          try { node.setAttribute(attribute, new URL(value, url).href); } catch {}
        }
      }
      iframe.srcdoc = '<!doctype html>' + html.documentElement.outerHTML;
      report('');
    } catch (error) {
      report('טעינת התצוגה המקדימה נכשלה: ' + error.message, true);
    }
  }
  let products = [], selected = null, cropFile = null, videoFile = null, removeVideo = false, dirty = false, loading = false;
  const report = (message, bad = false) => { status.textContent = message; status.className = 'status ' + (bad ? 'error' : 'ok'); };
  const request = async (path, opts = {}) => {
    const res = await fetch(BASE + path, {cache:'no-store', ...opts, headers:{apikey:KEY, Authorization:'Bearer ' + getToken(), ...(opts.headers || {})}});
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || error.msg || 'HTTP ' + res.status);
    }
    return res.status === 204 ? null : res.json();
  };
  const add = (name, text, type, value, options = {}) => {
    const label = document.createElement('label');
    label.textContent = text;
    const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
    input.name = name;
    if (type !== 'textarea') input.type = type;
    if (type === 'number') { input.step = options.step || '0.01'; input.min = options.min ?? '0'; }
    if (options.maxLength) input.maxLength = options.maxLength;
    if (type === 'checkbox') input.checked = !!value;
    else if (type !== 'file') input.value = value ?? '';
    label.append(input); fields.append(label);
    input.addEventListener('input', () => { dirty = true; updatePreview(); });
    return input;
  };
  const currentCard = () => iframe.contentDocument?.querySelectorAll('[data-product-id]');
  function updatePreview() {
    if (!selected) return;
    const form = sidebar.elements;
    for (const card of currentCard() || []) {
      if (card.dataset.productId !== selected.id) continue;
      const title = card.querySelector('[data-product-field="title"]');
      const subtitle = card.querySelector('[data-product-field="subtitle"]');
      const price = card.querySelector('[data-product-field="price"]');
      const badge = card.querySelector('[data-product-field="discount"]');
      const image = card.querySelector('[data-product-field="image"] img');
      if (title) title.textContent = form.name_he.value;
      if (subtitle) { subtitle.textContent = form.description.value; subtitle.hidden = !form.description.value.trim(); }
      const amount = Number(form.price.value), old = Number(form.old_price.value);
      if (price) price.textContent = form.price.value ? '₪ ' + amount.toFixed(2) + (old > amount ? '  (₪ ' + old.toFixed(2) + ')' : '') : 'מחיר בבירור';
      if (badge) {
        const pct = old > amount && amount >= 0 && form.price.value ? Math.round((1 - amount / old) * 100) : 0;
        badge.textContent = 'חסכו ' + pct + '%';
        badge.hidden = !pct;
      }
      if (image && cropFile?.url) image.src = cropFile.url;
      card.classList.add('cms-product-selected');
      card.scrollIntoView({block:'nearest'});
    }
  }
  function selectProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    if (dirty && !confirm('השינויים במוצר הנוכחי טרם נשמרו. להמשיך ללא שמירה?')) return;
    selected = product; dirty = false; cropFile = null;
    select.value = id; fields.replaceChildren();
    add('active','המוצר מוצג באתר (ביטול הסימון = הסתרה מהקטלוג)','checkbox',product.active!==false);
    add('name_he','שם המוצר','text',product.name_he,{maxLength:250});
    add('description','כותרת משנה / תיאור קצר מתחת לתמונה','textarea',product.description,{maxLength:800});
    add('price','מחיר נוכחי (₪)','number',money(product.price_agorot));
    add('old_price','מחיר לפני הנחה (₪, ריק = ללא מבצע)','number',money(product.old_price_agorot));
    add('image_key','כתובת תמונה נוכחית','text',product.image_key,{maxLength:800});
    const file = add('photo','החלפת תמונה JPG / PNG / WebP (עד 5MB)','file',null);
    file.accept = 'image/jpeg,image/png,image/webp';
    const zoom = add('zoom','חיתוך: זום (%)','range',100);
    zoom.min='100';zoom.max='300';zoom.step='5';
    const x = add('crop_x','מיקום אופקי (%)','range',50);x.min='0';x.max='100';
    const y = add('crop_y','מיקום אנכי (%)','range',50);y.min='0';y.max='100';
    const cropPreview = document.createElement('canvas');
    cropPreview.width=320;cropPreview.height=320;
    cropPreview.className='cms-crop-preview';
    fields.append(cropPreview);
    // Presentation video shown under the photo in the shop (MP4/WebM, up to 50 MB).
    videoFile = null; removeVideo = false;
    const videoBox = document.createElement('div');
    videoBox.className = 'cms-video-field';
    const videoTitle = document.createElement('p');
    videoTitle.className = 'cms-video-title';
    videoTitle.textContent = 'סרטון הצגה מתחת לתמונה (MP4 / WebM, עד 50MB)';
    const videoNote = document.createElement('small');
    const current = document.createElement('video');
    Object.assign(current, {controls:true, muted:true, playsInline:true, preload:'metadata'});
    current.className = 'cms-video-preview';
    current.hidden = true;
    const videoInput = document.createElement('input');
    Object.assign(videoInput, {type:'file', accept:'video/mp4,video/webm', name:'video'});
    const removeLabel = document.createElement('label');
    const removeBox = Object.assign(document.createElement('input'), {type:'checkbox'});
    removeLabel.append(removeBox, ' הסרת הסרטון מהמוצר');
    removeLabel.hidden = true;
    videoBox.append(videoTitle, current, videoInput, removeLabel, videoNote);
    fields.append(videoBox);
    request('/rest/v1/mercaz_products?select=video_key&id=eq.'+encodeURIComponent(product.id)).then(rows=>{
      const key=rows?.[0]?.video_key;
      if(selected!==product)return;
      if(key){current.src=key;current.hidden=false;removeLabel.hidden=false;videoNote.textContent='יש סרטון למוצר. אפשר להחליף או להסיר.';}
      else videoNote.textContent='אין עדיין סרטון למוצר.';
    }).catch(()=>{videoNote.textContent='כדי להוסיף סרטונים יש להריץ את sql/product-videos.sql.';videoInput.disabled=true;});
    videoInput.addEventListener('change',()=>{
      const chosen=videoInput.files?.[0];videoFile=null;
      if(!chosen)return;
      if(!['video/mp4','video/webm'].includes(chosen.type)||chosen.size>50*1024*1024){videoInput.value='';report('יש לבחור סרטון MP4 או WebM עד 50MB.',true);return}
      videoFile=chosen;removeBox.checked=false;removeVideo=false;dirty=true;
      videoNote.textContent='נבחר: '+chosen.name+' ('+(chosen.size/1024/1024).toFixed(1)+'MB) — יועלה בלחיצה על שמירה.';
    });
    removeBox.addEventListener('change',()=>{removeVideo=removeBox.checked;if(removeVideo){videoFile=null;videoInput.value='';}dirty=true;});
    const source = new Image();
    source.onload = () => redraw();
    source.onerror = () => { if (file.files?.length) report('לא ניתן לקרוא את התמונה.',true); };
    const redraw = () => {
      if (!source.naturalWidth) return;
      const ctx = cropPreview.getContext('2d');
      const size=320, scale=Math.max(size/source.naturalWidth,size/source.naturalHeight)*Number(zoom.value)/100;
      const w=source.naturalWidth*scale,h=source.naturalHeight*scale;
      ctx.clearRect(0,0,size,size);
      ctx.fillStyle='#ffffff';ctx.fillRect(0,0,size,size);
      ctx.drawImage(source,(size-w)*Number(x.value)/100,(size-h)*Number(y.value)/100,w,h);
      cropPreview.toBlob(blob => {
        if (!blob) return;
        if (cropFile?.url) URL.revokeObjectURL(cropFile.url);
        cropFile = {blob, url:URL.createObjectURL(blob)};
        updatePreview();
      },'image/webp',0.9);
    };
    file.addEventListener('change', () => {
      const chosen=file.files?.[0];
      if (!chosen) return;
      if (!['image/jpeg','image/png','image/webp'].includes(chosen.type) || chosen.size>5*1024*1024) {
        file.value='';report('יש לבחור תמונה JPG/PNG/WebP עד 5MB.',true);return;
      }
      const url=URL.createObjectURL(chosen);
      source.onload=()=>{URL.revokeObjectURL(url);redraw();};
      source.src=url;
    });
    for(const control of [zoom,x,y]) control.addEventListener('input', () => {
      if (!source.naturalWidth) {
        report('כדי לחתוך תמונה קיימת יש לבחור אותה כקובץ מהמחשב.',true);
        return;
      }
      redraw();
    });
    // Display the stored photo without generating an upload or changing it.
    const original=validImage(product.image_key);
    if (original) {
      const img = new Image();
      img.crossOrigin='anonymous';
      img.onload=()=>{
        const ctx=cropPreview.getContext('2d');
        ctx.clearRect(0,0,320,320);ctx.fillStyle='#fff';ctx.fillRect(0,0,320,320);
        const ratio=Math.min(320/img.naturalWidth,320/img.naturalHeight);
        ctx.drawImage(img,(320-img.naturalWidth*ratio)/2,(320-img.naturalHeight*ratio)/2,img.naturalWidth*ratio,img.naturalHeight*ratio);
      };
      img.src=original;
    }
    for (const card of currentCard() || []) card.classList.toggle('cms-product-selected',card.dataset.productId===id);
    updatePreview();
  }
  select.addEventListener('change',()=>selectProduct(select.value));
  sidebar.querySelector('[data-back]').addEventListener('click',()=>{if (!dirty || confirm('לצאת בלי לשמור שינויים?')) back();});
  preview.querySelector('[data-mobile]').addEventListener('click',()=>iframe.classList.toggle('mobile'));
  iframe.addEventListener('load',()=>{
    const doc=iframe.contentDocument;
    if (!doc || doc.documentElement.dataset.cmsProductPreview !== 'true') return;
    doc.addEventListener('click',event=>{
      const card=event.target.closest('[data-product-id]');
      event.preventDefault();event.stopImmediatePropagation();
      if (card) selectProduct(card.dataset.productId);
    },true);
    doc.addEventListener('submit',e=>e.preventDefault(),true);
    const style=doc.createElement('style');
    style.textContent='.cms-product-selected{outline:3px solid #e9b800!important;outline-offset:-3px}.item [data-product-field="subtitle"]{display:block;font-size:.78rem;color:#59647a}.item [data-product-field="subtitle"][hidden]{display:none}';
    doc.head.append(style);
    // Catalogue cards are populated asynchronously by the storefront module.
    // Keep the clicked product selected when those cards appear.
    const listing = doc.getElementById('products');
    if (listing) {
      const observer = new MutationObserver(() => {
        if (!listing.querySelector('[data-product-id]')) return;
        observer.disconnect();
        const selectedCard = [...listing.querySelectorAll('[data-product-id]')]
          .find(card => card.dataset.productId === selected?.id);
        selectedCard?.scrollIntoView({block:'center'});
        updatePreview();
      });
      observer.observe(listing, {childList:true});
      if (listing.querySelector('[data-product-id]')) {
        observer.disconnect();
        updatePreview();
      }
    }
    updatePreview();
  });
  sidebar.addEventListener('submit',async event=>{
    event.preventDefault();
    if (!selected || loading) return;
    const form=sidebar.elements;
    const parsePrice=value=>value.trim()===''?null:Math.round(Number(value)*100);
    const price=parsePrice(form.price.value),old=parsePrice(form.old_price.value);
    if ((price!==null && (!Number.isFinite(price)||price<0)) || (old!==null && (!Number.isFinite(old)||old<0))) {report('מחיר לא תקין.',true);return;}
    if (old!==null && (price===null || old<=price)) {report('מחיר קודם חייב להיות גבוה מהמחיר הנוכחי, או להשאיר ריק.',true);return;}
    if (!form.name_he.value.trim()) {report('שם המוצר חובה.',true);return;}
    loading=true;sidebar.querySelector('[type="submit"]').disabled=true;
    try {
      const payload={active:form.active.checked,name_he:form.name_he.value.trim(),description:form.description.value.trim(),price_agorot:price,old_price_agorot:old,image_key:form.image_key.value.trim()};
      if (cropFile?.blob) {
        const filename=crypto.randomUUID()+'.webp';
        const uploaded=await fetch(BASE+'/storage/v1/object/mercaz-product-images/'+filename,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+getToken(),'Content-Type':'image/webp','cache-control':'3600'},body:cropFile.blob});
        if (!uploaded.ok) throw new Error('העלאת התמונה נכשלה: HTTP '+uploaded.status);
        payload.image_key=BASE+photoHost+filename;
      } else if (payload.image_key && !validImage(payload.image_key)) throw new Error('כתובת התמונה חייבת להיות מהאתר או מאחסון התמונות של החנות.');
      // The video column is sent only when it changes, so saving still works before the video SQL is installed.
      if (videoFile) {
        report('מעלה סרטון…');
        const ext=videoFile.type==='video/webm'?'webm':'mp4';
        const filename=crypto.randomUUID()+'.'+ext;
        const up=await fetch(BASE+'/storage/v1/object/mercaz-product-videos/'+filename,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+getToken(),'Content-Type':videoFile.type,'cache-control':'31536000'},body:videoFile});
        if (!up.ok) throw new Error('העלאת הסרטון נכשלה: HTTP '+up.status);
        payload.video_key=BASE+'/storage/v1/object/public/mercaz-product-videos/'+filename;
      } else if (removeVideo) payload.video_key=null;
      await request('/rest/v1/mercaz_products?id=eq.'+encodeURIComponent(selected.id),{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(payload)});
      products=products.map(p=>p.id===selected.id?{...p,...payload}:p);
      const option=[...select.options].find(o=>o.value===selected.id);if(option)option.text=(payload.active?'':'🚫 מוסתר · ')+payload.name_he+' · '+(selected.sku||selected.id);
      dirty=false;
      report('המוצר נשמר. התצוגה תתעדכן.',false);
      await loadPreview();
      cropFile=null;videoFile=null;removeVideo=false;
      selectProduct(selected.id);
    }catch(err){report(err.message,true);}
    finally{loading=false;sidebar.querySelector('[type="submit"]').disabled=false;}
  });
  try {
    products=await request('/rest/v1/mercaz_products?select=id,sku,name_he,description,price_agorot,old_price_agorot,image_key,active&order=name_he.asc&limit=300');
    for (const p of products) select.add(new Option((p.active===false?'🚫 מוסתר · ':'')+p.name_he+' · '+(p.sku||p.id),p.id));
    if (products.length) {
      selectProduct(products.some(p => p.id === initialProductId) ? initialProductId : products[0].id);
      const fieldName = {image:'photo', title:'name_he',subtitle:'description',price:'price',discount:'old_price'}[initialField];
      const focusField = fieldName && sidebar.elements.namedItem(fieldName);
      if (focusField) {
        focusField.scrollIntoView({block:'nearest'});
        if (focusField.type !== 'file') focusField.focus({preventScroll:true});
      }
    }
    await loadPreview();
  } catch(err){report('לא ניתן לטעון מוצרים: '+err.message,true);}
}
