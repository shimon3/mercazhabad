
const BASE='https://bdalhyqpruefdbyirykp.supabase.co', KEY='sb_publishable_K6ciGUejNpRfLeIEc598Iw_L3VoMJYM';
const $=id=>document.getElementById(id),phone=$('phone');let active=null,seq=0;
const models={Samsung:['S23','S23+','S23 Ultra','S24','S24+','S24 Ultra','S25','S25+','S25 Ultra'],iPhone:['15','15 Plus','15 Pro','15 Pro Max','16','16 Plus','16 Pro','16 Pro Max','17','17 Pro','17 Pro Max' ]};
function populate(){const m=$('model');m.replaceChildren();models[$('brand').value].forEach(v=>m.add(new Option(($('brand').value==='Samsung'?'Galaxy ':'iPhone ')+v,v)));}populate();$('brand').onchange=()=>{populate();updateCase()};$('model').onchange=updateCase;
document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{phone.className='phone '+(b.dataset.color==='black'?'':b.dataset.color);document.querySelectorAll('[data-color]').forEach(x=>x.classList.toggle('selected',x===b));updateCase();});
function updateCase(){const brand=$('brand').value,model=$('model').value;phone.dataset.brand=brand;phone.dataset.model=model;phone.classList.toggle('iphone',brand==='iPhone');phone.classList.toggle('ultra',/Ultra|Pro Max/.test(model));phone.classList.toggle('pro',/Pro/.test(model));phone.setAttribute('aria-label',brand+' '+model+' — הדמיה כללית, לא מידות יצרן');}
updateCase();
function choose(el){active=el;document.querySelectorAll('.decal').forEach(d=>d.style.outline='none');$('size').value=parseInt(el.style.width)||95;$('angle').value=Number(el.dataset.angle)||0;}

/* Remove near-white connected background, preserving white artwork inside the sticker.
   Work on a copy: the original catalogue image is never modified. */
const cutoutCache=new Map();
async function cutout(url){
  if(cutoutCache.has(url))return cutoutCache.get(url);
  const job=(async()=>{
    const image=new Image();image.crossOrigin='anonymous';image.src=url;await image.decode();
    const max=700,scale=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight));
    const w=Math.max(1,Math.round(image.naturalWidth*scale)),h=Math.max(1,Math.round(image.naturalHeight*scale));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,w,h);
    const frame=ctx.getImageData(0,0,w,h),d=frame.data,visited=new Uint8Array(w*h),queue=new Int32Array(w*h);
    let head=0,tail=0;
    const nearWhite=i=>{const k=i*4;return d[k+3]<24||(d[k]>224&&d[k+1]>224&&d[k+2]>224&&Math.max(d[k],d[k+1],d[k+2])-Math.min(d[k],d[k+1],d[k+2])<24)};
    function seed(i){if(!visited[i]&&nearWhite(i)){visited[i]=1;queue[tail++]=i;}}
    for(let x=0;x<w;x++){seed(x);seed((h-1)*w+x)}
    for(let y=0;y<h;y++){seed(y*w);seed(y*w+w-1)}
    while(head<tail){const i=queue[head++],x=i%w,y=(i-x)/w;if(x>0)seed(i-1);if(x<w-1)seed(i+1);if(y>0)seed(i-w);if(y<h-1)seed(i+w)}
    // Avoid stripping a mostly white sticker or an image with no real foreground.
    if(tail<w*h*.02||tail>w*h*.92)return url;
    for(let i=0;i<w*h;i++){if(visited[i])d[i*4+3]=0;}
    ctx.putImageData(frame,0,0);
    return canvas.toDataURL('image/png');
  })().catch(()=>url);
  cutoutCache.set(url,job);return job;
}

async function addSticker(p){const source=await cutout(p.image_key);const img=document.createElement('img');img.className='decal';img.alt=p.name_he;img.crossOrigin='anonymous';img.src=source;img.dataset.productId=p.id;img.dataset.angle='0';img.style.width='95px';img.style.height='95px';img.style.left=(65+seq%3*18)+'px';img.style.top=(150+seq%5*25)+'px';seq++;phone.append(img);choose(img);let origin;img.addEventListener('pointerdown',e=>{choose(img);origin={x:e.clientX,y:e.clientY,l:parseFloat(img.style.left),t:parseFloat(img.style.top)};img.setPointerCapture(e.pointerId);e.preventDefault()});img.addEventListener('pointermove',e=>{if(!origin)return;img.style.left=Math.max(0,Math.min(phone.clientWidth-img.offsetWidth,origin.l+e.clientX-origin.x))+'px';img.style.top=Math.max(115,Math.min(phone.clientHeight-img.offsetHeight,origin.t+e.clientY-origin.y))+'px'});img.addEventListener('pointerup',()=>origin=null);img.addEventListener('pointercancel',()=>origin=null);}
$('size').oninput=e=>{if(active){active.style.width=e.target.value+'px';active.style.height=e.target.value+'px'}};$('angle').oninput=e=>{if(active){active.dataset.angle=e.target.value;active.style.transform='rotate('+e.target.value+'deg)'}};$('remove').onclick=()=>{active?.remove();active=null};$('clear').onclick=()=>{phone.querySelectorAll('.decal').forEach(x=>x.remove());active=null};
async function load(){try{const res=await fetch(BASE+'/rest/v1/mercaz_products?select=id,name_he,image_key,category,active&category=eq.PhoneStickers&active=eq.true&order=created_at.asc',{headers:{apikey:KEY,Authorization:'Bearer '+KEY}});if(!res.ok)throw Error('HTTP '+res.status);const products=await res.json(),host=$('assets');host.replaceChildren();let n=0;for(const p of products){if(!p.image_key)continue;let u;try{u=new URL(p.image_key,location.origin);if(!['https:','http:'].includes(u.protocol)||![location.origin,BASE].includes(u.origin))continue;}catch{continue;}p.image_key=u.href;const b=document.createElement('button'),img=document.createElement('img'),name=document.createElement('small');img.src=u.href;img.loading='lazy';img.alt=p.name_he;name.textContent=p.name_he;b.append(img,name);b.title=p.name_he;b.onclick=()=>{addSticker(p).catch(()=>{$('error').textContent='לא ניתן להוסיף מדבקה זו';})};host.append(b);n++;}if(!n)host.textContent='אין מדבקות זמינות';}catch(e){$('assets').textContent='לא ניתן לטעון מדבקות';$('error').textContent='שגיאת טעינת הקטלוג: '+e.message;}}load();
$('save').onclick=async()=>{const c=document.createElement('canvas');c.width=470;c.height=900;const ctx=c.getContext('2d');const color=phone.classList.contains('white')?'#f4f2ed':phone.classList.contains('clear')?'#dce6f1':'#161616';ctx.fillStyle=color;ctx.fillRect(0,0,470,900);ctx.fillStyle='#383c44';ctx.beginPath();ctx.roundRect(30,34,160,210,35);ctx.fill();ctx.strokeStyle='#858a96';ctx.lineWidth=5;ctx.stroke();for(const [x,y] of [[80,85],[145,85],[80,160]]){ctx.beginPath();ctx.arc(x,y,24,0,Math.PI*2);ctx.fillStyle='#080a10';ctx.fill();ctx.strokeStyle='#8a909a';ctx.stroke();}for(const d of phone.querySelectorAll('.decal')){try{const image=new Image();image.crossOrigin='anonymous';image.src=d.src;await image.decode();const x=parseFloat(d.style.left)*2,y=parseFloat(d.style.top)*2,w=d.offsetWidth*2;ctx.save();ctx.translate(x+w/2,y+w/2);ctx.rotate(Number(d.dataset.angle||0)*Math.PI/180);ctx.drawImage(image,-w/2,-w/2,w,w);ctx.restore()}catch(e){$('error').textContent='לא ניתן לייצא תמונה זו בגלל הגבלות גישה לתמונות המקור.';return}}try{const a=document.createElement('a');a.download='mercaz-case-preview.png';a.href=c.toDataURL('image/png');a.click()}catch(e){$('error').textContent='שמירת התמונה נכשלה';}};
