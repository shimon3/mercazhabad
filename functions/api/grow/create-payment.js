import {answer,environment,growCall,supabaseBackend,verifyCustomer,isUuid,paymentOrigin} from './_shared.js';
const SITE='https://mercaz-habad.pages.dev';
export async function onRequestPost({request,env}){
 const base=environment(env);
 if(!base)return answer(503,{error:'Grow payments are not enabled'});
 if(!request.headers.get('content-type')?.startsWith('application/json'))return answer(415,{error:'JSON required'});
 const user=await verifyCustomer((request.headers.get('Authorization')||'').replace(/^Bearer /i,''));
 if(!user)return answer(401,{error:'Authenticated session required'});
 let body;
 try{body=await request.json()}catch{return answer(400,{error:'Invalid JSON'})}
 if(!body||Object.keys(body).length!==1||!isUuid(body.orderId))return answer(400,{error:'Only orderId is accepted'});
 try{
  // Amount and ownership are reloaded using a server-only key. Never trust browser prices.
  const rows=await supabaseBackend(env,'/rest/v1/mercaz_orders?select=id,customer_id,customer_name,customer_phone,total_agorot,payment_status,fulfillment_status&id=eq.'+encodeURIComponent(body.orderId)+'&limit=1');
  const order=rows?.[0];
  if(!order||order.customer_id!==user.id)return answer(404,{error:'Order not found'});
  if(order.payment_status!=='pending_payment'||order.fulfillment_status==='cancelled'||!Number.isSafeInteger(order.total_agorot)||order.total_agorot<=0)return answer(409,{error:'Order not payable'});
  // Grow's sandbox requires a full name and valid Israeli mobile number.
  if(!/^\S+\s+\S+/.test(order.customer_name)||!/^05\d{8}$/.test(order.customer_phone.replace(/[ -]/g,'')))return answer(422,{error:'Please check full name and Israeli mobile number in the order'});
  const params={
   userId:env.GROW_USER_ID,pageCode:env.GROW_PAGE_CODE,chargeType:1,
   sum:(order.total_agorot/100).toFixed(2),
   successUrl:SITE+'/account/?grow=returned',cancelUrl:SITE+'/account/?grow=cancelled',
   notifyUrl:SITE+'/api/grow/webhook',description:'Order '+order.id.replace(/-/g,''),
   'pageField[fullName]':order.customer_name,'pageField[phone]':order.customer_phone.replace(/[ -]/g,''),
   'pageField[email]':user.email||'',
   cField1:order.id.replace(/-/g,'')
  };
  if(env.GROW_API_KEY)params.apiKey=env.GROW_API_KEY;
  const result=await growCall(base,'createPaymentProcess',params);
  const redirect=new URL(result?.url||'');
  if(redirect.protocol!=='https:'||redirect.origin!==paymentOrigin(base))return answer(502,{error:'Untrusted payment redirect URL'});
  // Do not reveal processId or processToken to the browser.
  return answer(200,{redirectUrl:redirect.href});
 }catch{return answer(502,{error:'Payment provider unavailable'})}
}
