// Offline security and CRUD verification of real Pages Functions with mock D1/R2.
// No Cloudflare deployment and no real order/payment.
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
const {subtle}=webcrypto;
const load=async path=>import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL(path,import.meta.url),'utf8')).toString('base64'));
const {onRequest}=await load('../functions/api/admin/[[path]].js');
const {onRequestGet:catalog}=await load('../functions/api/catalog.js');
const {onRequestGet:readImage}=await load('../functions/api/images/[[key]].js');
const issuer='https://testing.cloudflareaccess.com';
const audience='mercaz-test-audience';
const email='admin@example.test';
const {publicKey,privateKey}=await subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk=await subtle.exportKey('jwk',publicKey);jwk.kid='test-key';
const originalFetch=globalThis.fetch;
globalThis.fetch=async url=>url===issuer+'/cdn-cgi/access/certs'?new Response(JSON.stringify({keys:[jwk]}),{status:200}):new Response('',{status:404});
const b64=value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('base64url');
async function jwt(overrides={}) {
 const claims={iss:issuer,aud:[audience],email,exp:Math.floor(Date.now()/1000)+600,nbf:Math.floor(Date.now()/1000)-30,...overrides};
 const content=b64({alg:'RS256',kid:'test-key',typ:'JWT'})+'.'+b64(claims);
 const signature=await subtle.sign('RSASSA-PKCS1-v1_5',privateKey,new TextEncoder().encode(content));
 return content+'.'+Buffer.from(signature).toString('base64url');
}
const row={id:'mg/18',category:'Magnets',name_he:'מגנט',name_fr:'Magnet',description:'Original',price_agorot:1000,old_price_agorot:2000,image_key:'assets-v7/mg_18.webp',stock:0,active:1,variant_label:'',created_at:'2026',updated_at:'2026'};
let state={...row};const audits=[];const objectMap=new Map();
function prepare(sql){
 let args=[];
 return {
  bind(...v){args=v;return this},
  async first(){return args[0]===state.id?{...state}:null},
  async all(){return {results:[{...state}]}},
  _run(){if(sql.startsWith('UPDATE products')){if(args.at(-1)!==state.id)throw Error('wrong_id');Object.assign(state,{name_he:args[0],name_fr:args[1],description:args[2],price_agorot:args[3],old_price_agorot:args[4],image_key:args[5],stock:args[6],active:args[7],variant_label:args[8]})}
  else if(sql.startsWith('INSERT INTO product_audit'))audits.push({id:args[0],email:args[1],operation:args[2],before:JSON.parse(args[3]),after:JSON.parse(args[4])});
  else throw Error('Unexpected SQL '+sql)}
 };
}
const DB={prepare,async batch(items){items.forEach(s=>s._run());return items.map(()=>({success:true}))}};
const PRODUCT_IMAGES={
 async put(key,data,opts){objectMap.set(key,{data,opts})},
 async get(key){const x=objectMap.get(key);return x?{body:x.data,httpMetadata:{contentType:x.opts.httpMetadata.contentType}}:null}
};
const env={DB,PRODUCT_IMAGES,CF_ACCESS_TEAM_DOMAIN:'testing.cloudflareaccess.com',CF_ACCESS_AUD:audience,ADMIN_EMAILS:email};
const url='https://preview.example.test';
const token=await jwt();
function make(path,method='GET',body=undefined,extras={},useToken=token){
 const headers={...extras};if(useToken)headers['Cf-Access-Jwt-Assertion']=useToken;
 if(method!=='GET'&&!headers.Origin)headers.Origin=url;
 return new Request(url+path,{method,headers,body});
}
async function call(path,method='GET',body=undefined,extras={},useToken=token,testEnv=env){
 return onRequest({request:make(path,method,body,extras,useToken),env:testEnv});
}
const missingDb=await call('/api/admin/products','GET',undefined,{},token,{...env,DB:undefined});assert.equal(missingDb.status,503);
assert.equal((await call('/api/admin/products','GET',undefined,{},null)).status,403);
assert.equal((await call('/api/admin/products','GET',undefined,{},await jwt({aud:['wrong']}))).status,403);
assert.equal((await call('/api/admin/products','GET',undefined,{},await jwt({email:'outsider@example.test'}))).status,403);
assert.equal((await call('/api/admin/products','GET',undefined,{},await jwt({exp:Math.floor(Date.now()/1000)-1}))).status,403);
assert.equal((await call('/api/admin/products','GET',undefined,{},token.slice(0,-10)+'tamperxxxx')).status,403);
assert.equal((await call('/api/admin/products')).status,200);
const update={name_he:'מגנט משופר',price_agorot:1250,old_price_agorot:2000,stock:7,active:1};
const payload=JSON.stringify(update);
assert.equal((await call('/api/admin/products/mg%2F18','PUT',payload,{'Content-Type':'application/json',Origin:'https://evil.test'})).status,403);
assert.equal((await call('/api/admin/products/mg%2F18','PUT',JSON.stringify({stock:-1}),{'Content-Type':'application/json'})).status,400);
assert.equal((await call('/api/admin/products/mg%2F18','PUT',JSON.stringify({image_key:'javascript:alert(1)'}),{'Content-Type':'application/json'})).status,400);
assert.equal((await call('/api/admin/products/mg%2F18','PUT',JSON.stringify({price_agorot:999.5}),{'Content-Type':'application/json'})).status,400);
assert.equal((await call('/api/admin/products/wrong','PUT',payload,{'Content-Type':'application/json'})).status,404);
assert.equal((await call('/api/admin/products/mg%2F18','PUT',payload,{'Content-Type':'application/json'})).status,200);
assert.equal(state.stock,7);assert.equal(state.price_agorot,1250);assert.equal(audits.length,1);assert.equal(audits[0].email,email);
const tooSmall=await call('/api/admin/images','POST',new TextEncoder().encode('short'),{'Content-Type':'image/png'});assert.equal(tooSmall.status,400);
const badUpload=await call('/api/admin/images','POST',new TextEncoder().encode('invalid image content deliberately not PNG'),{'Content-Type':'image/png'});assert.equal(badUpload.status,415);
const goodJpg=new Uint8Array([255,216,255,...Array(20).fill(1),255,217]);
const uploaded=await call('/api/admin/images','POST',goodJpg,{'Content-Type':'image/jpeg'});assert.equal(uploaded.status,201);
const key=(await uploaded.json()).image_key;assert.match(key,/^\/api\/images\/products\/[a-f0-9-]+\.jpg$/);
assert.equal((await readImage({params:{key:key.replace('/api/images/','')},env})).status,200);
assert.equal((await readImage({params:{key:'../../private.env'},env})).status,404);
const publicCatalog=await catalog({env});assert.equal(publicCatalog.status,200);assert.equal((await publicCatalog.json()).products[0].price,12.5);
assert.equal((await catalog({env:{}})).status,503);
globalThis.fetch=originalFetch;
console.log('PASS admin API: JWT signature, audience, expiry, allowlist, origin, CRUD, audit, input validation, R2 JPEG, public catalog, disabled DB');
