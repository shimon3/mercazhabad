// Cloudflare Pages Function. Fail closed if Access and D1 are not configured.
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const decode=x=>JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(x.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0))));
function base64url(s){return Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0))}
async function identity(request,env){
  if(!env.CF_ACCESS_TEAM_DOMAIN||!env.CF_ACCESS_AUD||!env.ADMIN_EMAILS)throw Error("auth_unconfigured");
  const jwt=request.headers.get("Cf-Access-Jwt-Assertion");
  if(!jwt)throw Error("no_access_token");
  const chunks=jwt.split(".");if(chunks.length!==3)throw Error("bad_token");
  const header=decode(chunks[0]), claims=decode(chunks[1]);
  if(header.alg!=="RS256"||!header.kid)throw Error("bad_alg");
  const domain=String(env.CF_ACCESS_TEAM_DOMAIN).replace(/^https?:\/\//,"").replace(/\/+$/,"");
  if(!/^[a-z0-9.-]+\.cloudflareaccess\.com$/i.test(domain))throw Error("bad_domain");
  const issuer="https://"+domain;
  const audience=String(env.CF_ACCESS_AUD);
  const now=Math.floor(Date.now()/1000);
  if(claims.iss!==issuer||!Array.isArray(claims.aud)||!claims.aud.includes(audience)||typeof claims.exp!=="number"||claims.exp<=now||typeof claims.nbf==="number"&&claims.nbf>now+30)throw Error("token_claims");
  const keyResp=await fetch(issuer+"/cdn-cgi/access/certs");
  if(!keyResp.ok)throw Error("jwks_unavailable");
  const certs=await keyResp.json();
  const jwk=(certs.keys||[]).find(k=>k.kid===header.kid&&k.kty==="RSA");
  if(!jwk)throw Error("key_missing");
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  const valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,base64url(chunks[2]),new TextEncoder().encode(chunks[0]+"."+chunks[1]));
  if(!valid)throw Error("invalid_signature");
  const email=String(claims.email||"").toLowerCase();
  const allow=String(env.ADMIN_EMAILS).split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(!email||!allow.includes(email))throw Error("not_admin");
  return email;
}
function parsePrice(v){if(v===null)return null;if(!Number.isInteger(v)||v<0||v>100000000)throw Error("invalid_price_agorot");return v}
function parseStr(v,max){if(typeof v!=="string"||v.trim().length<1||v.length>max)throw Error("invalid_text");return v.trim()}
function safeImage(v){if(typeof v!=="string"||v.length>240||!(/^(assets-v7\/[A-Za-z0-9._-]+\.webp|\/api\/images\/products\/[a-f0-9-]{36}\.(png|jpg|webp))$/).test(v))throw Error("invalid_image");return v}
function validImage(bytes,mime){
  const a=new Uint8Array(bytes);
  if(mime==="image/png"&&a.length>7&&[137,80,78,71,13,10,26,10].every((v,i)=>a[i]===v))return "png";
  if(mime==="image/jpeg"&&a[0]===255&&a[1]===216&&a[2]===255)return "jpg";
  if(mime==="image/webp"&&String.fromCharCode(...a.slice(0,4))==="RIFF"&&String.fromCharCode(...a.slice(8,12))==="WEBP")return "webp";
  return null;
}
export async function onRequest(context){
  const {request,env}=context;
  if(!env.DB)return json({error:"database_not_configured"},503);
  let email;
  try{email=await identity(request,env)}catch{return json({error:"forbidden"},403)}
  const url=new URL(request.url);
  const path=url.pathname.replace(/\/+$/,"");
  if(request.method!=="GET"){
    const origin=request.headers.get("Origin");
    if(!origin||origin!==url.origin)return json({error:"origin_rejected"},403);
  }
  if(request.method==="GET"&&path==="/api/admin/products"){
    const rows=await env.DB.prepare("SELECT id,category,name_he,name_fr,description,price_agorot,old_price_agorot,image_key,stock,active,variant_label,updated_at FROM products ORDER BY category,id LIMIT 500").all();
    return json({products:rows.results});
  }
  if(request.method==="PUT"&&path.startsWith("/api/admin/products/")){
    const id=decodeURIComponent(path.slice("/api/admin/products/".length));
    if(!id||id.length>100)return json({error:"invalid_id"},400);
    let data;try{data=await request.json()}catch{return json({error:"invalid_json"},400)}
    const allowed=["name_he","name_fr","description","price_agorot","old_price_agorot","image_key","stock","active","variant_label"];
    if(!data||typeof data!=="object"||Array.isArray(data)||Object.keys(data).some(k=>!allowed.includes(k)))return json({error:"invalid_fields"},400);
    const original=await env.DB.prepare("SELECT * FROM products WHERE id=?").bind(id).first();
    if(!original)return json({error:"not_found"},404);
    const updated={...original};
    try{
      for(const [key,val] of Object.entries(data)){
        if(key==="name_he")updated[key]=parseStr(val,200);
        else if(["name_fr","description","variant_label"].includes(key))updated[key]=typeof val==="string"&&val.length<=3000?val:(()=>{throw Error("invalid_text")})();
        else if(["price_agorot","old_price_agorot"].includes(key))updated[key]=parsePrice(val);
        else if(key==="stock")updated[key]=Number.isInteger(val)&&val>=0&&val<=1000000?val:(()=>{throw Error("invalid_stock")})();
        else if(key==="active")updated[key]=val===0||val===1?val:(()=>{throw Error("invalid_active")})();
        else if(key==="image_key")updated[key]=safeImage(val);
      }
      if(updated.old_price_agorot!==null&&updated.price_agorot!==null&&updated.old_price_agorot<updated.price_agorot)throw Error("old_price_below_price");
    }catch(e){return json({error:e.message||"invalid_input"},400)}
    const update=env.DB.prepare("UPDATE products SET name_he=?,name_fr=?,description=?,price_agorot=?,old_price_agorot=?,image_key=?,stock=?,active=?,variant_label=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(updated.name_he,updated.name_fr,updated.description,updated.price_agorot,updated.old_price_agorot,updated.image_key,updated.stock,updated.active,updated.variant_label,id);
    const audit=env.DB.prepare("INSERT INTO product_audit(product_id,admin_email,operation,before_json,after_json) VALUES (?,?,?,?,?)").bind(id,email,"update",JSON.stringify(original),JSON.stringify(updated));
    await env.DB.batch([update,audit]);
    return json({ok:true,id});
  }
  if(request.method==="POST"&&path==="/api/admin/images"){
    if(!env.PRODUCT_IMAGES)return json({error:"image_storage_not_configured"},503);
    const mime=request.headers.get("Content-Type")?.split(";")[0]?.trim();
    const size=Number(request.headers.get("Content-Length")||0);
    if(size>5000000)return json({error:"image_too_large"},413);
    const bytes=await request.arrayBuffer();
    if(bytes.byteLength>5000000||bytes.byteLength<16)return json({error:"invalid_image_size"},400);
    const ext=validImage(bytes,mime);
    if(!ext)return json({error:"unsupported_image"},415);
    const key="products/"+crypto.randomUUID()+"."+ext;
    await env.PRODUCT_IMAGES.put(key,bytes,{httpMetadata:{contentType:mime}});
    return json({image_key:"/api/images/"+key},201);
  }
  return json({error:"not_found"},404);
}