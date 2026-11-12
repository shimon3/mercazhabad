// Catalog reads from D1 only after migrations and binding are configured.
// If D1 is absent, the existing storefront retains its 84-item static catalog.
export async function onRequestGet({env}){
  if(!env.DB)return new Response(JSON.stringify({error:"not_configured"}),{status:503,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
  const result=await env.DB.prepare("SELECT id,category,name_he,name_fr,description,price_agorot,old_price_agorot,image_key,variant_label FROM products WHERE active=1 ORDER BY category,id LIMIT 500").all();
  const products=result.results.map(p=>({
    id:p.id,category:p.category,name:p.name_he,fr:p.name_fr,description:p.description,
    price:p.price_agorot===null?null:p.price_agorot/100,
    old:p.old_price_agorot===null?null:p.old_price_agorot/100,
    image:p.image_key,variant_label:p.variant_label
  }));
  return new Response(JSON.stringify({products}),{headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}