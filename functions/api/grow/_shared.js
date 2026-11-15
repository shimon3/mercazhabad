// Cloudflare Pages Functions only. No browser imports; never log webhook payloads.
const BASE='https://bdalhyqpruefdbyirykp.supabase.co';
const PUBLIC_KEY='sb_publishable_K6ciGUejNpRfLeIEc598Iw_L3VoMJYM';
export function answer(status,data){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
export function environment(env){
 if(!['sandbox','production'].includes(env.GROW_MODE))return null;
 if(env.GROW_MODE==='production'&&env.GROW_PRODUCTION_APPROVED!=='true')return null;
 if(!env.GROW_USER_ID||!env.GROW_PAGE_CODE||!env.GROW_DB_ADMIN_TOKEN)return null;
 return env.GROW_MODE==='sandbox'?'https://sandbox.meshulam.co.il/api/light/server/1.0':'https://secure.meshulam.co.il/api/light/server/1.0';
}
export async function growCall(base,endpoint,params){
 const fields=new URLSearchParams();
 for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null)fields.set(k,String(v));
 const resp=await fetch(base+'/'+endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:fields,signal:AbortSignal.timeout(12000)});
 if(!resp.ok)throw Error('Grow upstream HTTP failure');
 const result=await resp.json();
 if(String(result?.status)!=='1')throw Error('Grow rejected the request');
 return result.data;
}
export async function supabaseBackend(env,path,options={}){
 const key=env.GROW_DB_ADMIN_TOKEN;
 const response=await fetch(BASE+path,{...options,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...(options.headers||{})}});
 if(!response.ok)throw Error('Database request rejected');
 const raw=await response.text();
 return raw?JSON.parse(raw):null;
}
export async function verifyCustomer(jwt){
 if(!jwt||jwt.split('.').length!==3)return null;
 const r=await fetch(BASE+'/auth/v1/user',{headers:{apikey:PUBLIC_KEY,Authorization:'Bearer '+jwt}});
 if(!r.ok)return null;
 const user=await r.json();
 return typeof user?.id==='string'?user:null;
}
export function isUuid(v){return typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)}
export function normalizeUuid(value){
 if(typeof value!=='string'||!/^[0-9a-f]{32}$/i.test(value))return null;
 const s=value.toLowerCase();return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);
}
export function asAgorot(value){
 const str=String(value);
 if(!/^[0-9]{1,7}(?:\.[0-9]{1,2})?$/.test(str))return null;
 const [a,b='']=str.split('.');
 const n=Number(a)*100+Number(b.padEnd(2,'0'));
 return Number.isSafeInteger(n)?n:null;
}
export function paymentOrigin(base){
 return base.startsWith('https://sandbox.')?'https://sandbox.meshulam.co.il':'https://secure.meshulam.co.il';
}
