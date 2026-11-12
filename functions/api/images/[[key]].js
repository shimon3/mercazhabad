// Public image delivery; only generated product keys are permitted.
export async function onRequestGet({params,env}){
  const key=Array.isArray(params.key)?params.key.join("/"):String(params.key||"");
  if(!/^products\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(key))return new Response("Not found",{status:404});
  if(!env.PRODUCT_IMAGES)return new Response("Unavailable",{status:503});
  const object=await env.PRODUCT_IMAGES.get(key);
  if(!object)return new Response("Not found",{status:404});
  return new Response(object.body,{headers:{"Content-Type":object.httpMetadata?.contentType||"application/octet-stream","Cache-Control":"public, max-age=86400","X-Content-Type-Options":"nosniff"}});
}