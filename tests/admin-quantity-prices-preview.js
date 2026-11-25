import {priceFields,bindPriceFields,readPriceInputs} from '/admin/product-prices.js?v=2';
const form=document.getElementById('fixture');
document.getElementById('priceFields').insertAdjacentHTML('beforeend',priceFields({category:'PhoneStickers',old_price_agorot:2500,quantityPrices:{price_10_agorot:1500,price_20_agorot:1200}}));
bindPriceFields(form);
form.addEventListener('submit',event=>{
 event.preventDefault();
 try{const prices=readPriceInputs(form,Math.round(Number(form.elements.price.value)*100));document.getElementById('result').textContent='20 יחידות: '+((prices.twenty??Number(form.elements.price.value)*100)*20/100)+' ₪';}
 catch(error){document.getElementById('result').textContent=error.message;}
});
