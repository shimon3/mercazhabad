const TYPES = [['','כל המוצרים'],['sticker','מדבקה'],['magnet','מגנט']];
const STATUS_LABELS = {out:'מוצרים שאזלו',photos:'מוצרים ללא תמונה',untracked:'מלאי לא מאומת'};

export function productKind(product) {
  return product.category === 'PhoneStickers' ? 'sticker' : product.category === 'CarMagnets' ? 'magnet' : 'other';
}

export function filterProducts(products, {kind='',status='',query=''} = {}) {
  const term = query.trim().toLowerCase();
  return products.filter(p => {
    if (kind && productKind(p) !== kind) return false;
    if (status === 'out' && !(p.active && p.stock_tracking_enabled && p.stock <= 0)) return false;
    if (status === 'photos' && !(p.active && !String(p.image_key || '').trim())) return false;
    if (status === 'untracked' && !(p.active && !p.stock_tracking_enabled)) return false;
    return !term || (p.id+' '+(p.sku||'')+' '+p.name_he+' '+p.category+' '+(p.subcategory==='HeroesOfMessiah'?'גיבורי אל משיח':'')).toLowerCase().includes(term);
  });
}

export function mountProductKindFilters(host, onSelect) {
  const root = document.createElement('div');root.className='product-kind-section';
  const title=document.createElement('p');title.className='product-kind-heading';title.textContent='בחירה לפי סוג מוצר';
  const nav=document.createElement('nav');nav.className='product-kind-filters';nav.setAttribute('aria-label','סוג מוצר');
  const buttons = TYPES.map(([kind,label])=>{
    const button=document.createElement('button');button.type='button';button.dataset.productKind=kind;button.setAttribute('aria-pressed',String(kind===''));
    const text=document.createElement('span');text.textContent=label;
    const count=document.createElement('span');count.className='product-kind-count';count.textContent='0';
    button.append(text,count);button.addEventListener('click',()=>onSelect(kind));nav.append(button);
    return {kind,button,count};
  });
  const status=document.createElement('p');status.className='product-kind-status';status.hidden=true;status.setAttribute('role','status');
  root.append(title,nav,status);
  const toolbar=host.querySelector('.toolbar');
  if(toolbar)toolbar.after(root);else host.prepend(root);
  return {update(products,{kind='',status:statusKey='',query=''}={}){
    const candidates=filterProducts(products,{status:statusKey,query});
    for(const item of buttons){
      const count=item.kind?candidates.filter(p=>productKind(p)===item.kind).length:candidates.length;
      item.count.textContent=String(count);item.button.setAttribute('aria-pressed',String(item.kind===kind));
      item.button.setAttribute('aria-label',TYPES.find(([key])=>key===item.kind)[1]+' — '+count+' מוצרים');
    }
    status.hidden=!statusKey;status.textContent=STATUS_LABELS[statusKey]?'מסנן נוסף: '+STATUS_LABELS[statusKey]:'';
  }};
}
