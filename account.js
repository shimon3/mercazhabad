'use strict';
const BASE='https://bdalhyqpruefdbyirykp.supabase.co', KEY='sb_publishable_K6ciGUejNpRfLeIEc598Iw_L3VoMJYM';
const $=x=>document.getElementById(x),money=v=>'₪'+(v/100).toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2});
let token=sessionStorage.getItem('merkaz_customer_token')||'',register=false;
async function api(path,method='GET',data=undefined,authenticated=true){const headers={apikey:KEY};if(authenticated&&token)headers.Authorization='Bearer '+token;if(data!==undefined)headers['Content-Type']='application/json';const res=await fetch(BASE+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});const raw=await res.text();let out;try{out=raw?JSON.parse(raw):null}catch{out=null}if(!res.ok)throw Error(out?.msg||out?.message||out?.error_description||'HTTP '+res.status);return out}
function msg(id,t,bad=false){const x=$(id);x.textContent=t;x.className='status '+(bad?'error':'ok')}
function switchMode(signup){register=signup;$('showSignup').className=signup?'active':'secondary';$('showLogin').className=signup?'secondary':'active';$('authSubmit').textContent=signup?'יצירת חשבון':'כניסה';$('password').autocomplete=signup?'new-password':'current-password'}
$('showLogin').onclick=()=>switchMode(false);$('showSignup').onclick=()=>switchMode(true);
$('authForm').onsubmit=async e=>{e.preventDefault();const button=$('authSubmit');button.disabled=true;try{const endpoint=register?'/auth/v1/signup?redirect_to='+encodeURIComponent(location.origin+'/account/'):'/auth/v1/token?grant_type=password';const r=await api(endpoint,'POST',{email:$('email').value.trim(),password:$('password').value},false);$('password').value='';
if(!r.access_token){msg('authStatus','נשלח קישור לאישור הדוא״ל. לאחר האישור חזרו לאתר, בחרו כניסה והתחברו עם אותה סיסמה. לעובדי החנות: ניתן לפתוח /admin/ או /manager/ ישירות.');switchMode(false);return}
token=r.access_token;sessionStorage.setItem('merkaz_customer_token',token);await showAccount();
}catch(err){msg('authStatus',err.message,true)}finally{button.disabled=false}};
async function showAccount(){const u=await api('/auth/v1/user');$('authView').classList.add('hidden');$('accountView').classList.remove('hidden');$('accountEmail').textContent=u.email||'';const draft=readCart();$('checkout').classList.toggle('hidden',!draft.length);try{const roles=await api('/rest/v1/mercaz_roles?select=role&user_id=eq.'+encodeURIComponent(u.id));const staff=roles?.[0]?.role;if(staff==='admin'||staff==='manager'){$('staffShortcut').classList.remove('hidden');$('staffShortcutLink').href=staff==='admin'?'/admin/':'/manager/';$('staffShortcutLink').textContent=staff==='admin'?'כניסה לממשק מנהל ראשי':'כניסה לממשק ניהול הזמנות'}}catch{}await Promise.all([loadOrders(),showCart()])}
$('logout').onclick=async()=>{try{await api('/auth/v1/logout','POST',{})}catch{}token='';sessionStorage.removeItem('merkaz_customer_token');sessionStorage.removeItem('merkaz_staff_token');location.reload()};
function readCart(){try{const c=JSON.parse(sessionStorage.getItem('merkaz_pending_cart')||'[]');if(!Array.isArray(c)||c.length>30)return[];return c.filter(x=>typeof x.key==='string'&&Number.isInteger(x.quantity)&&x.quantity>0&&x.quantity<=100)}catch{return[]}}
async function showCart(){const items=readCart();if(!items.length)return;try{
const keys=[...new Set(items.map(i=>i.key.split('::')[0]))];const products=await api('/rest/v1/mercaz_products?select=id,name_he,category,price_agorot,active&active=eq.true', 'GET',undefined,false);const names=new Map(products.map(p=>[p.id,p]));let total=0;
const el=$('cartSummary');el.replaceChildren();const list=document.createElement('ul');
for(const line of items){const id=line.key.split('::')[0],pack=line.key.split('::')[1],p=names.get(id);if(!p)continue;const unit=pack==='4'?1500:pack==='10'?3000:p.price_agorot;if(unit==null)continue;total+=unit*line.quantity;const li=document.createElement('li');li.textContent=p.name_he+(pack?' ('+pack+' יח׳)':'')+' × '+line.quantity+' — '+money(unit*line.quantity);list.append(li)}
el.append(list);const cost=document.createElement('strong');cost.textContent='סה״כ מוצרים: '+money(total)+' (לפני דמי משלוח אם יחולו)';el.append(cost);
}catch(e){msg('checkoutStatus','לא ניתן לטעון את פרטי הסל. רעננו את הדף.',true)}}
let reviewDetails=null;
function shippingInfo(){
  return {name:$('customerName').value.trim(),phone:$('customerPhone').value.trim(),address:$('customerAddress').value.trim(),notes:$('customerNotes').value.trim()};
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
  const host=$('reviewSummary');
  host.replaceChildren();
  const cartDisplay=$('cartSummary').cloneNode(true);
  cartDisplay.removeAttribute('id');
  host.append(cartDisplay,
    formReviewLabel('שם:',reviewDetails.name),
    formReviewLabel('טלפון:',reviewDetails.phone),
    formReviewLabel('כתובת:',reviewDetails.address),
    formReviewLabel('הערות:',reviewDetails.notes));
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
    const created=await api('/rest/v1/rpc/mercaz_create_order','POST',{p_items:items,p_name:reviewDetails.name,p_phone:reviewDetails.phone,p_address:reviewDetails.address,p_notes:reviewDetails.notes});
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
async function loadOrders(){const orders=await api('/rest/v1/mercaz_orders?select=id,customer_name,total_agorot,payment_status,fulfillment_status,created_at&order=created_at.desc&limit=100');const host=$('orders');host.replaceChildren();if(!orders.length){host.textContent='עדיין אין הזמנות בחשבון';return}
for(const o of orders){const block=document.createElement('div');block.className='order';const h=document.createElement('strong');h.textContent='הזמנה '+o.id.slice(0,8)+' · '+money(o.total_agorot);block.append(h);const p=document.createElement('p');p.className='muted';p.textContent=new Date(o.created_at).toLocaleString('he-IL')+' · תשלום: '+(payText[o.payment_status]||o.payment_status)+' · משלוח: '+(deliverText[o.fulfillment_status]||o.fulfillment_status);block.append(p);
const names=document.createElement('div');names.className='muted';names.textContent='טוען פריטים...';block.append(names);host.append(block);
api('/rest/v1/mercaz_order_items?select=product_name,quantity,pack_size,line_total_agorot&order_id=eq.'+encodeURIComponent(o.id)).then(items=>{names.textContent=items.map(x=>x.product_name+(x.pack_size?' ('+x.pack_size+' יח׳)':'')+' × '+x.quantity+' — '+money(x.line_total_agorot)).join(' | ')}).catch(()=>names.textContent='פרטי הפריטים אינם זמינים כעת')}
}
$('reload').onclick=()=>loadOrders().catch(e=>msg('authStatus',e.message,true));
// Supabase email confirmation may return a session in the URL fragment.
const fragment=new URLSearchParams(location.hash.slice(1));
if(fragment.has('access_token')&&fragment.get('token_type')==='bearer'){
  const incoming=fragment.get('access_token');
  if(incoming&&incoming.split('.').length===3){
    token=incoming;
    sessionStorage.setItem('merkaz_customer_token',token);
  }
  history.replaceState(null,'',location.pathname+location.search);
}
if(token)showAccount().catch(()=>{sessionStorage.removeItem('merkaz_customer_token');token='';$('authView').classList.remove('hidden');$('accountView').classList.add('hidden');msg('authStatus','יש להתחבר מחדש',true)});
