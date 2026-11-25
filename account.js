'use strict';
import {quantityUnitPrice, loadQuantityPrices} from '/quantity-prices.js?v=2';
const BASE='https://bdalhyqpruefdbyirykp.supabase.co', KEY='sb_publishable_K6ciGUejNpRfLeIEc598Iw_L3VoMJYM';
const $=x=>document.getElementById(x),money=v=>'₪'+(v/100).toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2});
let token=sessionStorage.getItem('merkaz_customer_token')||'',register=false,recoverySession=false,deliveryOptions=[],cartTotal=0,coupon=null;
async function api(path,method='GET',data=undefined,authenticated=true){const headers={apikey:KEY};if(authenticated&&token)headers.Authorization='Bearer '+token;if(data!==undefined)headers['Content-Type']='application/json';const res=await fetch(BASE+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});const raw=await res.text();let out;try{out=raw?JSON.parse(raw):null}catch{out=null}if(!res.ok)throw Error(out?.msg||out?.message||out?.error_description||'HTTP '+res.status);return out}
function msg(id,t,bad=false){const x=$(id);x.textContent=t;x.className='status '+(bad?'error':'ok')}
function switchMode(signup){register=signup;$('showSignup').className=signup?'active':'secondary';$('showLogin').className=signup?'secondary':'active';$('authSubmit').textContent=signup?'יצירת חשבון':'כניסה';$('password').autocomplete=signup?'new-password':'current-password'}
$('showLogin').onclick=()=>switchMode(false);
$('forgotPassword').onclick=()=>{$('recoverSection').classList.remove('hidden');$('authForm').classList.add('hidden');$('forgotPassword').classList.add('hidden');$('recoverEmail').value=$('email').value;$('recoverEmail').focus()};
$('cancelRecover').onclick=()=>{$('recoverSection').classList.add('hidden');$('authForm').classList.remove('hidden');$('forgotPassword').classList.remove('hidden')};
$('recoverForm').onsubmit=async e=>{
 e.preventDefault();const b=e.target.querySelector('button[type="submit"]');b.disabled=true;
 try{
  const email=$('recoverEmail').value.trim();
  await api('/auth/v1/recover?redirect_to='+encodeURIComponent(location.origin+'/account/'),'POST',{email},false);
  msg('recoverStatus','אם הכתובת רשומה, יישלח אליה קישור לאיפוס הסיסמה. בדקו גם בדואר הזבל.');
 }catch(err){msg('recoverStatus','לא ניתן לשלוח כעת קישור. נסו מאוחר יותר.',true)}
 finally{b.disabled=false}
};
$('newPasswordForm').onsubmit=async e=>{
 e.preventDefault();const b=e.target.querySelector('button[type="submit"]');b.disabled=true;
 try{
  const password=$('newPassword').value;
  if(password!==$('confirmNewPassword').value)throw Error('הסיסמאות אינן זהות');
  if(password.length<8)throw Error('הסיסמה קצרה מדי');
  if(!token||!recoverySession)throw Error('קישור האיפוס אינו בתוקף. בקשו קישור חדש.');
  await api('/auth/v1/user','PUT',{password});
  msg('newPasswordStatus','הסיסמה עודכנה. ניתן להיכנס באמצעות הסיסמה החדשה.');
  $('newPassword').value='';$('confirmNewPassword').value='';
  try{await api('/auth/v1/logout','POST',{})}catch{}
  token='';recoverySession=false;sessionStorage.removeItem('merkaz_customer_token');
  $('newPasswordSection').classList.add('hidden');$('authForm').classList.remove('hidden');$('forgotPassword').classList.remove('hidden');
 }catch(err){msg('newPasswordStatus',err.message,true)}finally{b.disabled=false}
};$('showSignup').onclick=()=>switchMode(true);
$('authForm').onsubmit=async e=>{e.preventDefault();const button=$('authSubmit');button.disabled=true;try{const endpoint=register?'/auth/v1/signup?redirect_to='+encodeURIComponent(location.origin+'/account/'):'/auth/v1/token?grant_type=password';const r=await api(endpoint,'POST',{email:$('email').value.trim(),password:$('password').value},false);$('password').value='';
if(!r.access_token){msg('authStatus','נשלח קישור לאישור הדוא״ל. לאחר האישור חזרו לאתר, בחרו כניסה והתחברו עם אותה סיסמה. לעובדי החנות: ניתן לפתוח /admin/ או /manager/ ישירות.');switchMode(false);return}
token=r.access_token;sessionStorage.setItem('merkaz_customer_token',token);await showAccount();
}catch(err){msg('authStatus',err.message,true)}finally{button.disabled=false}};
async function showAccount(){const u=await api('/auth/v1/user');$('authView').classList.add('hidden');$('accountView').classList.remove('hidden');$('accountEmail').textContent=u.email||'';const draft=readCart();$('checkout').classList.toggle('hidden',!draft.length);await Promise.all([loadOrders(),showCart(),loadDeliveryOptions()])}
$('logout').onclick=async()=>{try{await api('/auth/v1/logout','POST',{})}catch{}token='';sessionStorage.removeItem('merkaz_customer_token');sessionStorage.removeItem('merkaz_staff_token');location.reload()};
async function loadDeliveryOptions(){
 const selector=$('deliveryMethod');const info=$('deliveryInfo');
 try{
  const options=await api('/rest/v1/mercaz_delivery_options?select=id,label_he,enabled,area_description,fee_agorot,instructions&order=id.asc','GET',undefined,false);
  deliveryOptions=options.filter(x=>x.enabled&&['delivery','pickup'].includes(x.id));
  selector.replaceChildren();
  for(const option of deliveryOptions){
   const el=new Option(option.label_he,option.id);selector.add(el);
  }
  if(!deliveryOptions.length){selector.add(new Option('לא הוגדרו אפשרויות להזמנה',''));selector.disabled=true;$('reviewOrder').disabled=true;info.textContent='אפשרויות המסירה אינן זמינות. יש לפנות לחנות לפני שליחת בקשת הזמנה.';return}
  selector.disabled=false;$('reviewOrder').disabled=false;
  selector.value=deliveryOptions.some(x=>x.id==='delivery')?'delivery':deliveryOptions[0].id;
  updateDeliveryMethod();
 }catch(e){selector.replaceChildren(new Option('לא ניתן לטעון שיטות מסירה',''));selector.disabled=true;$('reviewOrder').disabled=true;info.textContent='לא ניתן לטעון אפשרויות מסירה. נסו לרענן את הדף.'}
}
function updateDeliveryMethod(){
 const option=deliveryOptions.find(x=>x.id===$('deliveryMethod').value);
 if(!option)return;
 const pickup=option.id==='pickup';
 $('addressLabel').textContent=pickup?'פרטי קשר / הערה לאיסוף (אופציונלי)':'כתובת למשלוח';
 $('customerAddress').required=!pickup;
 $('customerAddress').minLength=pickup?0:6;
 const fee=option.fee_agorot==null?'דמי מסירה יקבעו מול החנות':option.fee_agorot===0?'ללא דמי מסירה':'דמי מסירה: '+money(option.fee_agorot);
 $('deliveryInfo').textContent=[option.area_description,option.instructions,fee,'הסכום לתשלום יאושר מול החנות; לא יתבצע חיוב באתר.'].filter(Boolean).join(' · ');
}
$('deliveryMethod').onchange=updateDeliveryMethod;
// Coupon: the preview is informative only; the real discount is computed again by the database on confirmation.
const couponInput=()=>$('couponCode').value.trim().toUpperCase();
function couponText(c){return 'קוד '+c.code+' · הנחה של '+money(c.discount_agorot)+' (הסכום הסופי יחושב בעת אישור ההזמנה)'}
$('couponCode').oninput=()=>{coupon=null;$('couponStatus').textContent='';$('couponStatus').className='muted'};
// Coupon typed in the shop's basket before login: pre-fill it and check it once the form is shown.
let savedCoupon=null;try{savedCoupon=JSON.parse(sessionStorage.getItem('merkaz_coupon')||'null')}catch{}
if(savedCoupon?.code){$('couponCode').value=savedCoupon.code;const note=document.createElement('p');note.className='muted';note.textContent='🎟️ הקופון '+savedCoupon.code+' נשמר ויוחל בסיום ההזמנה.';$('authForm')?.before(note)}
$('checkCoupon').onclick=async()=>{
  const code=couponInput();coupon=null;
  if(!/^[A-Z0-9_-]{3,30}$/.test(code)){msg('couponStatus','קוד הקופון אינו תקף',true);return}
  $('checkCoupon').disabled=true;
  try{const r=await api('/rest/v1/rpc/mercaz_check_coupon','POST',{p_code:code,p_total_agorot:cartTotal});coupon=r;msg('couponStatus','✓ '+couponText(r))}
  catch(e){msg('couponStatus',e.message||'קוד הקופון אינו תקף',true)}
  finally{$('checkCoupon').disabled=false}
};
function readCart(){try{const c=JSON.parse(sessionStorage.getItem('merkaz_pending_cart')||'[]');if(!Array.isArray(c)||c.length>30)return[];return c.filter(x=>typeof x.key==='string'&&Number.isInteger(x.quantity)&&x.quantity>0&&x.quantity<=100)}catch{return[]}}
async function showCart(){const items=readCart();if(!items.length)return;try{
const keys=[...new Set(items.map(i=>i.key.split('::')[0]))];const products=await api('/rest/v1/mercaz_products?select=id,name_he,category,price_agorot,active&active=eq.true', 'GET',undefined,false);const tiers=await loadQuantityPrices(BASE,KEY);const names=new Map(products.map(p=>[p.id,p]));let total=0;
const el=$('cartSummary');el.replaceChildren();const list=document.createElement('ul');
for(const line of items){const id=line.key.split('::')[0],pack=line.key.split('::')[1],p=names.get(id);if(!p)continue;const unit=pack==='4'?1500:pack==='10'?3000:quantityUnitPrice(p.price_agorot,line.quantity,tiers.get(id));if(unit==null)continue;total+=unit*line.quantity;const li=document.createElement('li');li.textContent=p.name_he+(pack?' ('+pack+' יח׳)':'')+' × '+line.quantity+' — '+money(unit*line.quantity);list.append(li)}
cartTotal=total;if($('couponCode').value&&!coupon)setTimeout(()=>$('checkCoupon').click(),0);el.append(list);const cost=document.createElement('strong');cost.textContent='סה״כ מוצרים: '+money(total)+' (לפני דמי משלוח אם יחולו)';el.append(cost);
}catch(e){msg('checkoutStatus','לא ניתן לטעון את פרטי הסל. רעננו את הדף.',true)}}
let reviewDetails=null;
function shippingInfo(){
  return {name:$('customerName').value.trim(),phone:$('customerPhone').value.trim(),address:$('customerAddress').value.trim(),notes:$('customerNotes').value.trim(),deliveryMethod:$('deliveryMethod').value};
}
function formReviewLabel(label,value){
  const block=document.createElement('p');
  const title=document.createElement('strong');
  title.textContent=label+' ';
  block.append(title,document.createTextNode(value||'—'));
  return block;
}
$('checkoutForm').onsubmit=async e=>{
  e.preventDefault();
  if(!$('checkoutForm').reportValidity())return;
  const cart=readCart();
  if(!cart.length){msg('checkoutStatus','הסל ריק',true);return}
  reviewDetails=shippingInfo();
  const selected=deliveryOptions.find(x=>x.id===reviewDetails.deliveryMethod&&x.enabled);
  if(!selected){msg('checkoutStatus','יש לבחור דרך מסירה זמינה',true);return}
  reviewDetails.deliveryLabel=selected.label_he;
  reviewDetails.deliveryNotes=selected.instructions;
  reviewDetails.deliveryFee=selected.fee_agorot;
  if(reviewDetails.deliveryMethod==='pickup')reviewDetails.address='איסוף עצמי בתיאום מראש';
  const typed=couponInput();
  if(typed&&(!coupon||coupon.code!==typed)){
    try{coupon=await api('/rest/v1/rpc/mercaz_check_coupon','POST',{p_code:typed,p_total_agorot:cartTotal})}
    catch(err){msg('checkoutStatus',err.message||'קוד הקופון אינו תקף',true);msg('couponStatus',err.message||'קוד הקופון אינו תקף',true);reviewDetails=null;return}
  }
  if(!typed)coupon=null;
  reviewDetails.coupon=coupon;
  const host=$('reviewSummary');
  host.replaceChildren();
  const cartDisplay=$('cartSummary').cloneNode(true);
  cartDisplay.removeAttribute('id');
  host.append(cartDisplay,
    formReviewLabel('שם:',reviewDetails.name),
    formReviewLabel('טלפון:',reviewDetails.phone),
    formReviewLabel('דרך מסירה:',reviewDetails.deliveryLabel),
    formReviewLabel('דמי מסירה:',reviewDetails.deliveryFee==null?'ייקבעו מול החנות':money(reviewDetails.deliveryFee)),
    formReviewLabel('כתובת / איסוף:',reviewDetails.address),
    formReviewLabel('הערות:',reviewDetails.notes),
    ...(reviewDetails.coupon?[formReviewLabel('קופון:',couponText(reviewDetails.coupon))]:[]));
  $('checkoutForm').classList.add('hidden');
  $('orderReview').classList.remove('hidden');
  msg('checkoutStatus','');
};
$('editOrder').onclick=()=>{
  reviewDetails=null;
  $('orderReview').classList.add('hidden');
  $('checkoutForm').classList.remove('hidden');
};
$('confirmOrder').onclick=async()=>{
  const b=$('confirmOrder');b.disabled=true;
  try{
    if(!reviewDetails)throw Error('יש לבדוק שוב את פרטי ההזמנה');
    const cart=readCart();
    if(!cart.length)throw Error('הסל ריק');
    const items=cart.map(x=>{const parts=x.key.split('::');return {id:parts[0],quantity:x.quantity,...(parts[1]?{pack:Number(parts[1])}:{})}});
    const chosen=deliveryOptions.find(x=>x.id===reviewDetails.deliveryMethod&&x.enabled);
    if(!chosen)throw Error('אפשרות המסירה אינה זמינה. יש לבדוק שוב את ההזמנה');
    const deliveryText='דרך מסירה: '+chosen.label_he+' ('+chosen.id+')';
    const notes=[deliveryText,reviewDetails.notes].filter(Boolean).join(' | ');
    if(notes.length>800)throw Error('ההערות ארוכות מדי');
    const orderData={p_items:items,p_name:reviewDetails.name,p_phone:reviewDetails.phone,p_address:reviewDetails.address,p_notes:notes};
    // With a coupon, order + discount are created in one database transaction (invalid code = no order).
    const created=reviewDetails.coupon
      ?await api('/rest/v1/rpc/mercaz_create_order_with_coupon','POST',{...orderData,p_coupon:reviewDetails.coupon.code})
      :await api('/rest/v1/rpc/mercaz_create_order','POST',orderData);
    coupon=null;$('couponCode').value='';$('couponStatus').textContent='';try{sessionStorage.removeItem('merkaz_coupon')}catch{}
    sessionStorage.removeItem('merkaz_pending_cart');
    $('checkout').classList.add('hidden');
    reviewDetails=null;
    await loadOrders();
    const p=document.createElement('p');
    p.className='ok';
    p.textContent='בקשת ההזמנה נרשמה. מספר הזמנה: '+created+'. לא בוצע חיוב בכרטיס.';
    $('orders').prepend(p);
  }catch(err){
    msg('checkoutStatus',err.message,true);
  }finally{b.disabled=false}
};
const payText={pending_payment:'ממתין לתשלום',paid:'שולם',failed:'נכשל',refunded:'הוחזר'},deliverText={new:'התקבלה',processing:'בטיפול',shipped:'נשלחה',completed:'הושלמה',cancelled:'בוטלה'};
async function growEnabled(){
 try{const r=await fetch('/api/grow/status',{cache:'no-store'});return r.ok&&!!(await r.json()).enabled}
 catch{return false}
}
async function redirectToGrow(orderId,button){
 button.disabled=true;
 try{
  const r=await fetch('/api/grow/create-payment',{
   method:'POST',cache:'no-store',
   headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({orderId})
  });
  const body=await r.json();
  if(!r.ok)throw Error(body?.error||'Payment setup unavailable');
  const url=new URL(body.redirectUrl);
  if(url.protocol!=='https:'||!['sandbox.meshulam.co.il','secure.meshulam.co.il'].includes(url.hostname))
   throw Error('Invalid payment destination');
  // Hosted page only: never embed a card input or iframe on this domain.
  location.assign(url.href);
 }catch(e){msg('authStatus','לא ניתן לפתוח את דף התשלום המאובטח. נסו מאוחר יותר.',true);button.disabled=false}
}
async function loadOrders(){
 const [orders,canGrow]=await Promise.all([
  api('/rest/v1/mercaz_orders?select=id,customer_name,total_agorot,payment_status,fulfillment_status,created_at&order=created_at.desc&limit=100'),
  growEnabled()
 ]);
 const host=$('orders');host.replaceChildren();
 if(!orders.length){host.textContent='עדיין אין הזמנות בחשבון';return}
 for(const o of orders){
  const block=document.createElement('div');block.className='order';
  const h=document.createElement('strong');h.textContent='הזמנה '+o.id.slice(0,8)+' · '+money(o.total_agorot);block.append(h);
  const p=document.createElement('p');p.className='muted';
  p.textContent=new Date(o.created_at).toLocaleString('he-IL')+' · תשלום: '+(payText[o.payment_status]||o.payment_status)+' · משלוח: '+(deliverText[o.fulfillment_status]||o.fulfillment_status);
  block.append(p);
  if(canGrow&&o.payment_status==='pending_payment'&&o.fulfillment_status!=='cancelled'){
   const pay=document.createElement('button');pay.type='button';pay.textContent='מעבר לתשלום מאובטח ב-Grow';
   pay.onclick=()=>redirectToGrow(o.id,pay);block.append(pay);
  }
  const names=document.createElement('div');names.className='muted';names.textContent='טוען פריטים...';block.append(names);host.append(block);
  api('/rest/v1/mercaz_order_items?select=product_name,quantity,pack_size,line_total_agorot&order_id=eq.'+encodeURIComponent(o.id))
   .then(items=>{names.textContent=items.map(x=>x.product_name+(x.pack_size?' ('+x.pack_size+' יח׳)':'')+' × '+x.quantity+' — '+money(x.line_total_agorot)).join(' | ')})
   .catch(()=>names.textContent='פרטי הפריטים אינם זמינים כעת');
 }
}
$('reload').onclick=()=>loadOrders().catch(e=>msg('authStatus',e.message,true));
// Supabase email confirmation may return a session in the URL fragment.
const fragment=new URLSearchParams(location.hash.slice(1));
if(fragment.has('access_token')&&fragment.get('token_type')==='bearer'){
  const incoming=fragment.get('access_token');
  if(incoming&&incoming.split('.').length===3){
    token=incoming;
    recoverySession=fragment.get('type')==='recovery';
    if(!recoverySession)sessionStorage.setItem('merkaz_customer_token',token);
    else sessionStorage.removeItem('merkaz_customer_token');
  }
  history.replaceState(null,'',location.pathname+location.search);
}
if(recoverySession){
 $('authForm').classList.add('hidden');
 $('forgotPassword').classList.add('hidden');
 $('newPasswordSection').classList.remove('hidden');
 $('newPassword').focus();
}else if(token)showAccount().catch(()=>{sessionStorage.removeItem('merkaz_customer_token');token='';$('authView').classList.remove('hidden');$('accountView').classList.add('hidden');msg('authStatus','יש להתחבר מחדש',true)});
