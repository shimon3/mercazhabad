import {answer,environment,growCall,supabaseBackend,normalizeUuid,asAgorot} from './_shared.js';
// Never log, persist or return raw Grow callbacks. They may contain card metadata.
function pickPayload(form){
 let nested={};
 const raw=form.get('data');
 if(typeof raw==='string'&&raw.length<12000){try{nested=JSON.parse(raw)||{}}catch{}}
 const get=(key)=>nested?.[key]??form.get('data['+key+']')??form.get(key);
 const custom=nested.customFields||{};
 const cf=custom.cField1??form.get('data[customFields][cField1]')??form.get('customFields[cField1]')??form.get('cField1');
 return {transactionId:get('transactionId'),transactionToken:get('transactionToken'),orderRef:cf};
}
function validTransaction(id,token){
 return typeof id==='string'&&/^[0-9]{1,30}$/.test(id)&&typeof token==='string'&&/^[a-zA-Z0-9]{10,200}$/.test(token);
}
export async function onRequestPost({request,env}){
 const base=environment(env);
 if(!base)return answer(503,{error:'Payment webhook disabled'});
 if(!['application/x-www-form-urlencoded','multipart/form-data'].some(type=>request.headers.get('content-type')?.startsWith(type)))return answer(415,{error:'Invalid content type'});
 if(Number(request.headers.get('content-length')||0)>16000)return answer(413,{error:'Notification too large'});
 let received;
 try{received=pickPayload(await request.formData())}catch{return answer(400,{error:'Invalid notification'})}
 const id=String(received.transactionId||'');
 const token=String(received.transactionToken||'');
 const orderId=normalizeUuid(received.orderRef);
 if(!validTransaction(id,token)||!orderId)return answer(400,{error:'Invalid transaction references'});
 try{
  // The callback itself is untrusted; verify payment directly with Grow first.
  const info=await growCall(base,'getTransactionInfo',{pageCode:env.GROW_PAGE_CODE,transactionId:id,transactionToken:token});
  if(String(info?.transactionId)!==id||String(info?.transactionToken)!==token)return answer(409,{error:'Grow verification mismatch'});
  if(String(info?.statusCode)!=='2')return answer(409,{error:'Transaction not settled'});
  // Never trust callback order references without independent Grow correlation.
  const ref=info?.customFields?.cField1
    ?? (Array.isArray(info?.customField)
      ? info.customField.find(v=>v?.cField1)?.cField1
      : info?.customField?.cField1);
  const verifiedOrder=normalizeUuid(String(ref||''));
  const verifiedDescription=String(info?.description||'').trim();
  const expectedDescription='Order '+orderId.replace(/-/g,'');
  if(verifiedOrder!==orderId && verifiedDescription!==expectedDescription)
    return answer(409,{error:'Verified order reference mismatch'});
  const amount=asAgorot(info.sum);
  if(!amount||amount<=0)return answer(409,{error:'Verified amount invalid'});
  // A single transactionId is accepted once, and DB checks the order amount
  // under a row lock. Existing paid-status trigger performs tracked stock debit.
  const result=await supabaseBackend(env,'/rest/v1/rpc/mercaz_record_verified_grow_payment',{
   method:'POST',body:JSON.stringify({p_order:orderId,p_transaction_id:id,p_amount_agorot:amount})
  });
  // Grow requires acknowledgment after a successful callback. Card fields, if
  // included by Grow, are only forwarded in memory, never retained or logged.
  const keys=['transactionTypeId','paymentType','firstPaymentSum','periodicalPaymentSum','paymentsNum','allPaymentsNum',
    'paymentDate','asmachta','description','fullName','payerPhone','payerEmail','cardSuffix','cardType','cardTypeCode',
    'cardBrand','cardBrandCode','cardExp','processId','processToken','paymentLinkProcessId','paymentLinkProcessToken'];
  const approve={pageCode:env.GROW_PAGE_CODE,transactionId:id,transactionToken:token,sum:info.sum};
  if(env.GROW_API_KEY)approve.apiKey=env.GROW_API_KEY;
  for(const k of keys){if(info[k]!==undefined&&info[k]!==null)approve[k]=info[k]}
  await growCall(base,'approveTransaction',approve);
  return answer(200,{received:true});
 }catch{
  // No sensitive upstream details or callback bodies in logs/responses.
  return answer(503,{error:'Verification or acknowledgment failed; retry delivery'});
 }
}
