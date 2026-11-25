import {filterProducts,mountProductKindFilters} from '/admin/product-kind-filters.js?v=1';
const products=[{id:'sticker-a',sku:'EX-ST-1',name_he:'מדבקה סגולה',category:'PhoneStickers'},
 {id:'sticker-b',sku:'EX-ST-2',name_he:'מדבקה זהובה',category:'PhoneStickers'},
 {id:'magnet-a',sku:'EX-MG-1',name_he:'מגנט לרכב',category:'CarMagnets'},
 {id:'pin-a',sku:'EX-PIN-1',name_he:'סיכת משיח',category:'Pins'}];
let kind='';const input=document.getElementById('query');
const controls=mountProductKindFilters(document.getElementById('fixture'),value=>{kind=value;render()});
function render(){
 const list=filterProducts(products,{kind,query:input.value});controls.update(products,{kind,query:input.value});
 document.getElementById('count').textContent=list.length+' מוצרים';
 document.getElementById('results').replaceChildren(...list.map(p=>{const li=document.createElement('li');li.textContent=p.name_he+' — '+p.sku;return li}));
}
input.addEventListener('input',render);render();
