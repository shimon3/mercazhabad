'use strict';
const BASE='https://bdalhyqpruefdbyirykp.supabase.co', KEY='sb_publishable_K6ciGUejNpRfLeIEc598Iw_L3VoMJYM';
const CATEGORY={'PhoneStickers':'מדבקות לפלאפון','CarMagnets':'מגנטים לרכב','Pins':'סיכות משיח','Kippas':'כיפות משיח','Caps':'כובעי משיח','Keychains':'מחזיקי מפתחות','SoldierPatches':'פאצ׳ים לחיילים','Flags':'דגלי משיח','General':'מוצרי משיח כללי'};
const $=x=>document.getElementById(x);
const clean=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'₪'+(n/100).toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2});
const panel=location.pathname.startsWith('/admin')?'admin':'manager';
let token=sessionStorage.getItem('merkaz_staff_token')||sessionStorage.getItem('merkaz_customer_token')||'',role='',products=[],orders=[],pendingFactor=null,challengeId=null,productFilter='',orderFilter='';
function notice(msg,bad=false,id='notice'){const el=$(id);el.textContent=msg;el.className='status '+(bad?'error':'ok')}
async function api(path,method='GET',body=undefined,authed=true){const headers={apikey:KEY};if(authed&&token)headers.Authorization='Bearer '+token;if(body!==undefined)headers['Content-Type']='application/json';
const res=await fetch(BASE+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});const raw=await res.text();let data;try{data=raw?JSON.parse(raw):null}catch{data=null}if(!res.ok)throw Error(data?.msg||data?.message||data?.error_description||'HTTP '+res.status);return data}
async function who(){if(!token)throw Error('יש להתחבר');return api('/auth/v1/user')}
async function getRole(user){const found=await api('/rest/v1/mercaz_roles?select=role&user_id=eq.'+encodeURIComponent(user.id));role=found?.[0]?.role||'';if(!['admin','manager'].includes(role)||(panel==='admin'&&role!=='admin'))throw Error('אין הרשאה למסך ניהול זה');return role}
function getAal(){try{return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).aal||'aal1'}catch{return 'aal1'}}
let dashboardReady=false,communityModule=null;
async function loadProtectedDashboard(){
 if(dashboardReady)return;
 const res=await fetch('/api/staff/dashboard?panel='+encodeURIComponent(panel),{
   headers:{Authorization:'Bearer '+token},cache:'no-store'
 });
 if(!res.ok)throw Error('ממשק הניהול אינו זמין: יש לוודא הרשאות ואימות דו־שלבי');
 const markup=await res.text();
 const doc=new DOMParser().parseFromString(markup,'text/html');
 const protectedRoot=doc.querySelector('#dashboard');
 if(!protectedRoot)throw Error('תוכן ניהול לא תקין');
 $('dashboard').replaceChildren(...Array.from(protectedRoot.childNodes));
 // Reviews moderation + club export tab (added before tab handlers are bound).
 communityModule=await import('/admin/community.js?v=2').catch(()=>null);
 communityModule?.injectCommunityTab();
 (await import('/admin/webp-tool.js?v=1').catch(()=>null))?.injectWebpTab();
 dashboardReady=true;
}
let handlersBound=false;
function bindDashboardHandlers(){
 if(handlersBound)return;
 handlersBound=true;
 const appearanceEditor = $('appearanceEditor');
 if (appearanceEditor && role === 'admin' && getAal() === 'aal2') {
   const appearanceTab = document.querySelector('[data-view="appearance"]');
   appearanceTab.addEventListener('click', () => {
     import('/admin/appearance-editor.js?v=16')
       .then(({mountAppearanceEditor}) => mountAppearanceEditor(appearanceEditor, () => token))
       .catch(() => { appearanceEditor.textContent = 'עורך העיצוב לא נטען. רעננו את הדף.'; });
   }, {once:true});
 }
 $('logout').onclick=async()=>{try{await api('/auth/v1/logout','POST',{})}catch{}sessionStorage.removeItem('merkaz_staff_token');sessionStorage.removeItem('merkaz_customer_token');token='';location.reload()};
const heroImporter=$('importHeroPhotos');
if(heroImporter)heroImporter.onclick=async()=>{
 const files=Array.from($('heroPhotoFiles').files||[]);
 const status=$('heroPhotoImportStatus');
 const report=(text,bad=false)=>{status.textContent=text;status.className='status '+(bad?'error':'ok')};
 if(role!=='admin'||getAal()!=='aal2'){report('נדרשת כניסת מנהל עם אימות דו־שלבי.',true);return}
 if(!files.length){report('בחרו את קובצי התמונה שהתקבלו מחבילת ה־WebP.',true);return}
 if(files.length>18){report('החבילה מכילה לכל היותר 18 קובצי תמונה.',true);return}
 const targets=new Set(),jobs=[];
 for(const file of files){
  const id=HERO_PHOTO_TARGETS[file.name.toLowerCase()];
  if(!id||targets.has(id)){report('שם קובץ אינו מוכר או כפול: '+file.name,true);return}
  if(file.type!=='image/webp'||file.size>5*1024*1024){report('קובץ WebP לא תקין (עד 5MB): '+file.name,true);return}
  const p=products.find(item=>item.id===id&&item.category==='PhoneStickers'&&item.subcategory==='HeroesOfMessiah');
  if(!p){report('מוצר מתאים לא נמצא במסד הנתונים: '+file.name,true);return}
  targets.add(id);jobs.push([file,p]);
 }
 heroImporter.disabled=true;
 let done=0;const failed=[];
 try{
  for(const [file,p] of jobs){
   report('מעלה '+(done+failed.length+1)+'/'+jobs.length+': '+file.name);
   try{
    const url=await upload(file);
    if(!url)throw Error('לא נוצר קישור לתמונה');
    await api('/rest/v1/mercaz_products?id=eq.'+encodeURIComponent(p.id),'PATCH',{image_key:url});
    done++;
   }catch(e){failed.push(file.name+' ('+e.message+')')}
  }
  await loadProducts();
  report('עודכנו '+done+' מתוך '+jobs.length+' תמונות'+(failed.length?'. שגיאות: '+failed.join('; '):'. כל התמונות נשמרו.'),failed.length>0);
 }finally{heroImporter.disabled=false}
};
$('findProduct').oninput=showProducts;
$('printFilteredLabels').onclick=()=>{const term=$('findProduct').value.trim().toLowerCase();printProductLabels(filteredProducts().filter(p=>(p.id+' '+(p.sku||'')+' '+p.name_he+' '+p.category).toLowerCase().includes(term)))};
$('resetProductFilter').onclick=()=>setProductFilter('');
$('resetOrderFilter').onclick=()=>setOrderFilter('');
for(const tile of document.querySelectorAll('[data-insight]')){
 tile.onclick=()=>tile.dataset.insight==='pending'?setOrderFilter('pending'):setProductFilter(tile.dataset.insight);
}
for(const [v,n] of Object.entries(CATEGORY))$('newCategory').add(new Option(n,v));
$('newProduct').onsubmit=async e=>{e.preventDefault();if(role!=='admin'){notice('רק מנהל ראשי עם MFA יכול ליצור מוצרים.',true);return}const b=e.target.querySelector('button');b.disabled=true;try{const data=makePayload(e.target);let id=$('newId').value.trim();if(!id)id='p-'+crypto.randomUUID();if(!/^[\w/-]{1,90}$/.test(id))throw Error('מזהה פנימי לא תקין');data.id=id;const img=await upload(e.target.elements.photo.files[0]);if(img)data.image_key=img;await api('/rest/v1/mercaz_products','POST',data);e.target.reset();await loadProducts();const created=products.find(p=>p.id===id);notice('המוצר נוסף · מק״ט: '+(created?.sku||'נוצר אוטומטית'))}catch(err){notice(err.message,true)}finally{b.disabled=false}};
$('findOrder').oninput=showOrders;
$('reloadOrders').onclick=()=>loadOrders().catch(e=>notice(e.message,true));
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{const show=b.dataset.view;for(const el of document.querySelectorAll('[data-panel]'))el.classList.toggle('hidden',el.dataset.panel!==show);for(const btn of document.querySelectorAll('[data-view]')){btn.classList.toggle('active',btn===b);btn.setAttribute('aria-pressed',String(btn===b))}};

}
async function initStaff(){const user=await who();await getRole(user);$('login').classList.add('hidden');if(getAal()!=='aal2'){await showMfa(user);return}
await loadProtectedDashboard();bindDashboardHandlers();
if(new URLSearchParams(location.search).has('customize'))document.querySelector('[data-view="appearance"]')?.click();
$('mfa').classList.add('hidden');$('dashboard').classList.remove('hidden');$('roleBadge').textContent=role==='admin'?'מנהל ראשי':'ניהול הזמנות (מוצרים לקריאה בלבד)';if(role!=='admin'){$('newProduct').hidden=true;const heading=$('newProduct').previousElementSibling;if(heading?.tagName==='H2')heading.hidden=true;}$('onlyAdmin').classList.toggle('hidden',role!=='admin');await Promise.all([loadProducts(),loadOrders()]);communityModule?.loadCommunity(api,role).catch(()=>{});if(role==='admin')await loadDeliverySettings()}
async function showMfa(user){$('mfa').classList.remove('hidden');$('dashboard').classList.add('hidden');$('totpSetup').classList.add('hidden');$('totpVerify').classList.add('hidden');$('startMfa').classList.add('hidden');
const active=(Array.isArray(user.factors)?user.factors:[]).find(f=>f.factor_type==='totp'&&f.status==='verified');if(active){pendingFactor=active.id;$('mfaInfo').textContent='יש להזין את הקוד בן 6 הספרות מאפליקציית האימות.';$('totpVerify').classList.remove('hidden');try{await challenge()}catch(e){notice('לא ניתן לשלוח בקשת אימות: '+e.message,true,'mfaStatus')}}else{$('startMfa').classList.remove('hidden');$('mfaInfo').textContent='לפני כניסה ראשונה נדרש להפעיל אימות דו־שלבי באפליקציית Authenticator.'}}
async function challenge(){const c=await api('/auth/v1/factors/'+encodeURIComponent(pendingFactor)+'/challenge','POST',{});challengeId=c.id}

function showEnrollment(f){
 if(!f?.totp?.secret || !f.totp.uri?.startsWith('otpauth://totp/')) throw Error('לא התקבל קוד QR תקין. נסו שוב.');
 const box=$('totpQr');box.replaceChildren();
 if(typeof QRCode!=='function')throw Error('רכיב ה־QR לא נטען. נסו לרענן את הדף.');
 new QRCode(box,{text:f.totp.uri,width:220,height:220,colorDark:'#151515',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
 $('totpSecret').textContent=f.totp.secret;
 $('totpManual').classList.add('hidden');
 $('totpSetup').classList.remove('hidden');
 $('startMfa').classList.add('hidden');
 $('totpVerify').classList.remove('hidden');
}
$('showTotpSecret').onclick=()=>{$('totpManual').classList.toggle('hidden')};
async function clearUnverifiedFactors(){
 const user=await who();
 const old=(Array.isArray(user.factors)?user.factors:[]).filter(f=>f.factor_type==='totp'&&f.status==='unverified');
 for(const factor of old) await api('/auth/v1/factors/'+encodeURIComponent(factor.id),'DELETE');
}
async function beginEnrollment(){
 $('mfaStatus').textContent='';
 await clearUnverifiedFactors();
 const f=await api('/auth/v1/factors','POST',{factor_type:'totp',friendly_name:'Mercaz Habad'});
 pendingFactor=f.id;
 showEnrollment(f);
 await challenge();
}
$('startMfa').onclick=async()=>{try{await beginEnrollment()}catch(e){notice('לא ניתן להגדיר אימות: '+e.message,true,'mfaStatus')}};
$('restartMfa').onclick=async()=>{
 $('totpSecret').textContent='';
 $('totpQr').replaceChildren();
 $('totpSetup').classList.add('hidden');$('totpVerify').classList.add('hidden');
 try{await beginEnrollment()}catch(e){notice('לא ניתן להנפיק קוד חדש: '+e.message,true,'mfaStatus');$('startMfa').classList.remove('hidden')}
};
$('totpVerify').onsubmit=async ev=>{ev.preventDefault();const b=ev.target.querySelector('button');b.disabled=true;try{const v=await api('/auth/v1/factors/'+encodeURIComponent(pendingFactor)+'/verify','POST',{challenge_id:challengeId,code:$('totpCode').value.trim()});if(!v.access_token)throw Error('אימות נכשל');$('totpQr').replaceChildren();$('totpSecret').textContent='';token=v.access_token;sessionStorage.setItem('merkaz_staff_token',token);$('totpCode').value='';await initStaff()}catch(e){notice(e.message,true,'mfaStatus');try{await challenge()}catch{}}finally{b.disabled=false}};
$('loginForm').onsubmit=async ev=>{ev.preventDefault();const b=ev.target.querySelector('button');b.disabled=true;try{const v=await api('/auth/v1/token?grant_type=password','POST',{email:$('email').value.trim(),password:$('password').value},false);token=v.access_token;sessionStorage.setItem('merkaz_staff_token',token);$('password').value='';await initStaff()}catch(e){const message=String(e?.message||'שגיאה');notice('לא ניתן להשלים את הכניסה: '+message,true,'loginStatus');token='';sessionStorage.removeItem('merkaz_staff_token')}finally{b.disabled=false}};
async function loadDeliverySettings(){
 const host=$('deliverySettingsForms');if(!host||role!=='admin')return;
 host.replaceChildren();
 try{
  const options=await api('/rest/v1/mercaz_delivery_options?select=id,label_he,enabled,area_description,fee_agorot,instructions&order=id.asc');
  for(const item of options){
   if(!['delivery','pickup'].includes(item.id))continue;
   const form=document.createElement('form');form.className='delivery-option-form';
   const heading=document.createElement('h4');heading.textContent=item.label_he;form.append(heading);
   const makeField=(label,control)=>{
    const wrapper=document.createElement('label');wrapper.className='field';
    const caption=document.createElement('span');caption.textContent=label;wrapper.append(caption,control);
    form.append(wrapper);return control;
   };
   const enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=item.enabled;
   makeField('אפשרות זמינה ללקוחות',enabled);
   const area=document.createElement('textarea');area.rows=2;area.maxLength=500;area.value=item.area_description||'';
   makeField(item.id==='pickup'?'כתובת נקודת איסוף':'אזורי חלוקה',area);
   const price=document.createElement('input');price.type='number';price.min='0';price.max='10000';price.step='0.01';price.placeholder='לתיאום מול החנות';price.value=item.fee_agorot==null?'':String(item.fee_agorot/100);
   makeField('דמי משלוח / איסוף (₪, ריק = בתיאום)',price);
   const instructions=document.createElement('textarea');instructions.rows=2;instructions.maxLength=600;instructions.value=item.instructions||'';
   makeField('הוראות ללקוח',instructions);
   const submit=document.createElement('button');submit.type='submit';submit.textContent='שמירת '+item.label_he;form.append(submit);
   form.onsubmit=async ev=>{
    ev.preventDefault();submit.disabled=true;
    try{
     if(item.id==='pickup'&&enabled.checked&&!area.value.trim())throw Error('יש להזין כתובת איסוף לפני הפעלת איסוף עצמי');
     const amount=price.value.trim();
     const fee=amount===''?null:Math.round(Number(amount)*100);
     if(fee!==null&&(!Number.isSafeInteger(fee)||fee<0||fee>1000000))throw Error('סכום דמי מסירה אינו תקין');
     const payload={enabled:enabled.checked,area_description:area.value.trim(),fee_agorot:fee,instructions:instructions.value.trim(),updated_at:new Date().toISOString()};
     await api('/rest/v1/mercaz_delivery_options?id=eq.'+encodeURIComponent(item.id),'PATCH',payload);
     notice('הגדרות '+item.label_he+' עודכנו',false,'deliverySettingsStatus');
     await loadDeliverySettings();
    }catch(err){notice(err.message,true,'deliverySettingsStatus')}
    finally{submit.disabled=false}
   };
   host.append(form);
  }
 }catch(err){notice('לא ניתן לטעון הגדרות מסירה: '+err.message,true,'deliverySettingsStatus')}
}
const HERO_PHOTO_TARGETS=Object.freeze({
 'messiah-black-gold.webp':'s/3',
 'messiah-gold-black.webp':'s/1',
 'messiah-israel-blue-white.webp':'hero/israel',
 'messiah-white-black.webp':'s/2',
 'messiah-silver-white.webp':'hero/silver',
 'messiah-blue-rings.webp':'hero/blue',
 'messiah-green-rings.webp':'hero/green',
 'messiah-pink.webp':'hero/pink',
 'messiah-orange-rings.webp':'hero/orange',
 'messiah-brown-rings.webp':'hero/brown',
 'messiah-yellow-blue-red.webp':'hero/yellow',
 'messiah-turquoise-rings.webp':'hero/turquoise',
 'messiah-magenta-rings.webp':'hero/magenta',
 'messiah-temple.webp':'hero/temple',
 'messiah-set-10-colors.webp':'hero/set-10',
 'messiah-770.webp':'hero/770',
 'messiah-black-white.webp':'hero/black-white',
 'messiah-purple-pink.webp':'hero/purple'
});
function fields(p){const categoryOptions=Object.entries(CATEGORY).map(([v,label])=>'<option value="'+clean(v)+'" '+(v===p.category?'selected':'')+'>'+clean(label)+'</option>').join('');
return '<div class="sku-display"><strong>מק״ט: '+clean(p.sku||'טרם הוקצה')+'</strong><button type="button" class="secondary copy-sku">העתקת מק״ט</button><small>מספר קבוע וייחודי שהמערכת מקצה אוטומטית. מזהה פנימי: '+clean(p.id)+'</small></div><div class="grid"><div class="field"><label>שם בעברית</label><input name="name_he" required maxlength="250" value="'+clean(p.name_he)+'"></div>'+
'<div class="field"><label>שם בצרפתית</label><input name="name_fr" maxlength="250" value="'+clean(p.name_fr)+'"></div>'+
'<div class="field"><label>קטגוריה</label><select name="category">'+categoryOptions+'</select></div>'+
'<div class="field"><label>תת־קטגוריה (מדבקות לפלאפון)</label><select name="subcategory"><option value="">ללא תת־קטגוריה</option><option value="HeroesOfMessiah" '+(p.subcategory==='HeroesOfMessiah'?'selected':'')+'>גיבורי אל משיח</option></select></div>'+
'<div class="field"><label>מחיר (₪)</label><input name="price" type="number" min="0" step="0.01" value="'+(p.price_agorot==null?'':p.price_agorot/100)+'"></div>'+
'<div class="field"><label>מלאי</label><input name="stock" type="number" min="0" step="1" value="'+(p.stock||0)+'"></div>'+
'<div class="field"><label><input name="stock_tracking_enabled" type="checkbox" '+(p.stock_tracking_enabled?'checked':'')+'> הגבלת הזמנות לפי מלאי שהוזן</label><small>יש לסמן רק אם הכמות אמיתית ומעודכנת (למדבקות: מספר מדבקות בודדות).</small></div>'+
'<div class="field"><label>תמונה חדשה (עד 5MB)</label><input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></div>'+
'<div class="field"><label>תיאור</label><input name="description" maxlength="800" value="'+clean(p.description)+'"></div>'+
'<div class="field"><label>קישור / נתיב לתמונה</label><input name="image_key" maxlength="800" value="'+clean(p.image_key)+'"></div>'+
'<div class="field"><label><input name="active" type="checkbox" '+(p.active?'checked':'')+'> מוצר פעיל</label></div></div>';
}
function makePayload(form){const v=new FormData(form), price=(v.get('price')||'').toString().trim(), stock=Number(v.get('stock'));if(!Number.isInteger(stock)||stock<0)throw Error('מלאי לא תקין');const agorot=price===''?null:Math.round(Number(price)*100);if(agorot!==null&&(!Number.isFinite(agorot)||agorot<0||agorot>100000000))throw Error('מחיר לא תקין');
const name=(v.get('name_he')||'').toString().trim();if(!name)throw Error('שם חובה');return {name_he:name,name_fr:String(v.get('name_fr')||'').trim(),category:String(v.get('category')),subcategory:String(v.get('category'))==='PhoneStickers'&&v.get('subcategory')==='HeroesOfMessiah'?'HeroesOfMessiah':'',price_agorot:agorot,stock,description:String(v.get('description')||'').trim(),image_key:String(v.get('image_key')||'').trim(),stock_tracking_enabled:v.has('stock_tracking_enabled'),active:v.has('active')}}
async function upload(file){if(!file||!file.size)return null;if(file.size>20*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('יש לבחור קובץ תמונה JPG/PNG/WebP עד 20MB');
// JPG/PNG are converted to WebP in the browser before upload (smaller files, faster shop).
const {prepareUpload}=await import('/admin/webp.js?v=1');const ready=await prepareUpload(file);
const key=crypto.randomUUID()+'.'+ready.ext;const res=await fetch(BASE+'/storage/v1/object/mercaz-product-images/'+key,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+token,'Content-Type':ready.type,'cache-control':'3600'},body:ready.blob});if(!res.ok)throw Error('העלאת התמונה נכשלה: '+res.status);return BASE+'/storage/v1/object/public/mercaz-product-images/'+key;}
async function loadProducts(){products=await api('/rest/v1/mercaz_products?select=*&order=created_at.desc&limit=300');showProducts();updateSellerInsights()}
function productThumb(p){
 let url=null;
 try{url=p.image_key?new URL(p.image_key,location.origin):null}catch{url=null}
 if(url&&[location.origin,BASE].includes(url.origin)){const img=document.createElement('img');img.className='product-thumb';img.alt='';img.loading='lazy';img.src=url.href;img.onerror=()=>img.replaceWith(Object.assign(document.createElement('span'),{className:'product-thumb',textContent:'📷'}));return img}
 return Object.assign(document.createElement('span'),{className:'product-thumb',textContent:'📷'});
}
function chip(text,kind){return Object.assign(document.createElement('span'),{className:'chip is-'+kind,textContent:text})}
function productSummary(p){
 const summary=document.createElement('summary');
 const main=document.createElement('span');main.className='product-main';
 const name=document.createElement('span');name.textContent=p.name_he;
 const meta=document.createElement('span');meta.className='product-meta';
 meta.append('מק״ט '+(p.sku||p.id),chip(CATEGORY[p.category]||p.category,'category'));
 if(!p.active)meta.append(chip('מוסתר','cancelled'));
 if(p.stock_tracking_enabled)meta.append(p.stock>0?chip('מלאי '+p.stock,'completed'):chip('אזל','failed'));
 if(!p.image_key)meta.append(chip('ללא תמונה','processing'));
 main.append(name,meta);
 const price=document.createElement('span');price.className='product-price';price.textContent=p.price_agorot==null?'ללא מחיר':money(p.price_agorot);
 summary.append(productThumb(p),main,price);
 return summary;
}
function showProducts(){const term=$('findProduct').value.trim().toLowerCase();const matches=filteredProducts().filter(p=>(p.id+' '+(p.sku||'')+' '+p.name_he+' '+p.category+' '+(p.subcategory==='HeroesOfMessiah'?'גיבורי אל משיח':'')).toLowerCase().includes(term));$('productCount').textContent=matches.length+' מוצרים';$('resetProductFilter').hidden=!productFilter;const host=$('products');host.replaceChildren();for(const p of matches){const details=document.createElement('details');details.className='product';const summary=productSummary(p);
const form=document.createElement('form');form.innerHTML=fields(p)+'<button type="submit">שמירת שינויים</button><button type="button" class="secondary print-single-label">הדפסת תווית מק״ט + QR</button>';
details.append(summary,form);
if(role!=='admin'){
  for(const input of form.querySelectorAll('input,select,textarea'))input.disabled=true;
  form.querySelector('button[type="submit"]').remove();
}form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;try{const payload=makePayload(form);const img=await upload(form.elements.photo.files[0]);if(img)payload.image_key=img;
if(p.id.startsWith('hero/')&&payload.active&&(!payload.image_key||payload.price_agorot==null))throw Error('כדי לפרסם וריאציה חדשה יש להזין תמונה ומחיר מאומת');
await api('/rest/v1/mercaz_products?id=eq.'+encodeURIComponent(p.id),'PATCH',payload);notice('נשמר: '+p.id);await loadProducts()}catch(err){notice(err.message,true)}finally{button.disabled=false}};const printOne=details.querySelector('.print-single-label');if(printOne)printOne.onclick=()=>printProductLabels([p]);const copy=details.querySelector('.copy-sku');if(copy)copy.onclick=async()=>{try{await navigator.clipboard.writeText(p.sku||'');notice('המק״ט הועתק: '+p.sku)}catch{notice('לא ניתן להעתיק אוטומטית. המק״ט: '+p.sku,true)}};host.append(details)}}
function filteredProducts(){
 if(productFilter==='out')return products.filter(p=>p.active&&p.stock_tracking_enabled&&p.stock<=0);
 if(productFilter==='photos')return products.filter(p=>p.active&&!String(p.image_key||'').trim());
 if(productFilter==='untracked')return products.filter(p=>p.active&&!p.stock_tracking_enabled);
 return products;
}
function setProductFilter(value){
 productFilter=value;$('findProduct').value='';
 document.querySelector('[data-view="products"]').click();
 showProducts();
 $('findProduct').focus();
}
function setOrderFilter(value){
 orderFilter=value;$('findOrder').value='';
 document.querySelector('[data-view="orders"]').click();
 showOrders();
 $('findOrder').focus();
}
function updateSellerInsights(){
 if(!$('sellerInsights'))return;
 const active=products.filter(p=>p.active);
 const out=active.filter(p=>p.stock_tracking_enabled&&p.stock<=0);
 const photoMissing=active.filter(p=>!String(p.image_key||'').trim());
 const untracked=active.filter(p=>!p.stock_tracking_enabled);
 const attention=orders.filter(o=>o.fulfillment_status==='new'||o.fulfillment_status==='processing');
 $('insightPending').textContent=attention.length;
 $('insightOut').textContent=out.length;
 $('insightPhotos').textContent=photoMissing.length;
 $('insightUntracked').textContent=untracked.length;
 const actions=$('priorityActions');actions.replaceChildren();
 const cases=[
   [attention.length,attention.length+' הזמנות ממתינות לטיפול','pending'],
   [out.length,out.length+' מוצרים אזלו מהמלאי','out'],
   [photoMissing.length,photoMissing.length+' מוצרים ללא תמונה','photos'],
   [untracked.length,untracked.length+' מוצרים עם מלאי שטרם אומת','untracked']
 ];
 for(const [count,title,key] of cases){
   if(!count)continue;
   const btn=document.createElement('button');btn.type='button';btn.className='priority-link secondary';btn.textContent=title+' ←';
   btn.onclick=()=>key==='pending'?setOrderFilter('pending'):setProductFilter(key);
   actions.append(btn);
 }
 if(!actions.children.length)actions.textContent='אין כרגע משימות דחופות במוצרים ובהזמנות האחרונות.';
}
function printProductLabels(items){
 if(!items.length){notice('אין מוצרים מתאימים להדפסה',true);return}
 if(typeof QRCode!=='function'){notice('מחולל QR לא נטען. רעננו את העמוד.',true);return}
 const sheet=$('printSheet');sheet.replaceChildren();
 if(items.length>150){notice('ניתן להדפיס עד 150 מוצרים בבת אחת. סננו את הרשימה ונסו שוב.',true);return}
 const safe=items;
 for(const p of safe){
  const item=document.createElement('article');item.className='printed-label';
  const words=document.createElement('div');words.className='printed-label-info';
  const brand=document.createElement('small');brand.textContent='מרכז חב״ד משיח';
  const title=document.createElement('strong');title.textContent=p.name_he;
  const sku=document.createElement('bdi');sku.textContent='מק״ט: '+p.sku;
  words.append(brand,title,sku);
  const qr=document.createElement('div');qr.className='printed-label-qr';
  item.append(words,qr);sheet.append(item);
  // Encodes the public catalogue deep link; the product is looked up by immutable SKU.
  new QRCode(qr,{text:location.origin+'/?sku='+encodeURIComponent(p.sku),width:92,height:92,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
 }
 document.body.classList.add('printing-labels');
 $('printSheet').setAttribute('aria-hidden','false');
 requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()));
}
window.addEventListener('afterprint',()=>{
 document.body.classList.remove('printing-labels');
 $('printSheet').setAttribute('aria-hidden','true');
 $('printSheet').replaceChildren();
});
function statusLabel(p){return {'pending_payment':'ממתין לתשלום','paid':'שולם','failed':'התשלום נכשל','refunded':'הוחזר'}[p]||p}
function fulfillmentLabel(s){return {'new':'חדשה','processing':'בטיפול','shipped':'נשלחה','completed':'הושלמה','cancelled':'בוטלה'}[s]||s}
async function loadOrders(){orders=await api('/rest/v1/mercaz_orders?select=*&order=created_at.desc&limit=100');const paid=orders.filter(x=>x.payment_status==='paid');$('ordersCount').textContent=orders.length;$('paidTotal').textContent=money(paid.reduce((x,o)=>x+o.total_agorot,0));$('pendingCount').textContent=orders.filter(x=>x.payment_status==='pending_payment').length;showOrders();updateSellerInsights()}
async function showOrders(){const host=$('orders');host.replaceChildren();$('resetOrderFilter').hidden=!orderFilter;const q=$('findOrder').value.toLowerCase().trim();for(const o of orders.filter(o=>(!orderFilter||orderFilter!=='pending'||['new','processing'].includes(o.fulfillment_status))&&(o.id+' '+o.customer_name+' '+o.customer_phone).toLowerCase().includes(q))){const block=document.createElement('div');block.className='order status-'+o.fulfillment_status;const head=document.createElement('div');head.className='row';const title=document.createElement('strong');title.textContent=o.customer_name+' · '+money(o.total_agorot);head.append(title,chip(fulfillmentLabel(o.fulfillment_status),o.fulfillment_status),chip(statusLabel(o.payment_status),o.payment_status));const id=document.createElement('span');id.className='muted';id.textContent=o.id.slice(0,8)+' · '+new Date(o.created_at).toLocaleString('he-IL');head.append(id);if(o.coupon_code)head.append(chip('קופון '+o.coupon_code+' · −'+money(o.discount_agorot||0),'coupon'));block.append(head);
const info=document.createElement('p');info.className='muted';info.textContent='תשלום: '+statusLabel(o.payment_status)+' · סטטוס: '+fulfillmentLabel(o.fulfillment_status);block.append(info);
if(o.manual_payment_confirmed_at){
 const audit=document.createElement('p');audit.className='manual-payment-audit';
 audit.textContent='תשלום ידני אושר ב־'+new Date(o.manual_payment_confirmed_at).toLocaleString('he-IL')+' · מאשר: '+(o.manual_payment_confirmed_by||'לא ידוע')+' · אסמכתא: '+(o.manual_payment_reference||'לא צוינה');
 block.append(audit);
}
const contact=document.createElement('p');contact.className='muted';contact.textContent=o.customer_phone+' · '+o.shipping_address+(o.notes?' · '+o.notes:'');block.append(contact);
const itemList=document.createElement('div');itemList.className='muted order-items';itemList.textContent='טוען פריטים...';block.append(itemList);
const row=document.createElement('div');row.className='row';const status=document.createElement('select');status.classList.add('order-status-select');for(const v of ['new','processing','shipped','completed','cancelled'])status.add(new Option(fulfillmentLabel(v),v));status.value=o.fulfillment_status;const save=document.createElement('button');save.textContent='עדכון סטטוס';save.onclick=async()=>{save.disabled=true;try{await api('/rest/v1/rpc/mercaz_set_fulfillment_status','POST',{p_order:o.id,p_status:status.value});notice('עודכן סטטוס ההזמנה');await loadOrders()}catch(e){notice(e.message,true)}finally{save.disabled=false}};row.append(status,save);
block.append(row);host.append(block);
api('/rest/v1/mercaz_order_items?select=product_name,quantity,pack_size,line_total_agorot&order_id=eq.'+encodeURIComponent(o.id)).then(items=>{itemList.textContent=items.map(x=>x.product_name+(x.pack_size?' (×'+x.pack_size+')':'')+' · '+x.quantity+' · '+money(x.line_total_agorot)).join(' | ')||'אין פריטים'}).catch(()=>itemList.textContent='לא ניתן לטעון פריטים');}
if(!host.children.length)host.textContent='אין הזמנות להצגה';}
if(token)initStaff().catch(err=>{token='';sessionStorage.removeItem('merkaz_staff_token');$('login').classList.remove('hidden');$('mfa').classList.add('hidden');notice('לא ניתן להמשיך מהחשבון הקיים: '+(err?.message||'שגיאה')+'. יש להתחבר מחדש.',true,'loginStatus')});
