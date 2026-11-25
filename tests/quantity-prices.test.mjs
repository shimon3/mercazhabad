import test from 'node:test';
import assert from 'node:assert/strict';
import {quantityUnitPrice, choicePrice, loadQuantityPrices} from '../quantity-prices.js';
import {discountFrom20, bindPriceFields, readPriceInputs, priceFields} from '../admin/product-prices.js';

const tiers={price_10_agorot:1500,price_20_agorot:1200};

test('same 40% ladder at 1/9/10/19/20/100 units',()=>{
 for(const [q,unit] of [[1,2000],[9,2000],[10,1500],[19,1500],[20,1200],[100,1200]])assert.equal(quantityUnitPrice(2000,q,tiers),unit);
 assert.equal(choicePrice({price:2000,quantityPrices:tiers},20)*20,24000);
});
test('no tiers and sticker packs retain their original price',()=>{
 assert.equal(quantityUnitPrice(2000,20),2000);assert.equal(choicePrice({price:1500,units:4},20),1500);
 assert.equal(quantityUnitPrice(null,20,tiers),null);
});
test('a later lower base price never increases at a bulk threshold',()=>assert.equal(quantityUnitPrice(1000,20,tiers),1000));
test('40% from 20 gives 12, and missing/zero base has no fabricated percent',()=>{
 assert.equal(discountFrom20(20,12),.4);assert.equal(discountFrom20(0,0),null);assert.equal(discountFrom20(20,22),null);
});
const field=value=>({value,handlers:{},addEventListener(name,handler){this.handlers[name]=handler;}});
test('admin percentage and bulk price stay in sync in both directions',()=>{
 const form={elements:{price:field('20'),price_20:field('12'),discount_20:field('')}};
 bindPriceFields(form);assert.equal(form.elements.discount_20.value,'40');
 form.elements.price_20.value='10';form.elements.price_20.handlers.input();assert.equal(form.elements.discount_20.value,'50');
 form.elements.discount_20.value='40';form.elements.discount_20.handlers.input();assert.equal(form.elements.price_20.value,'12.00');
 form.elements.price.value='25';form.elements.price.handlers.input();assert.equal(form.elements.price_20.value,'15.00');
});
test('admin prices validate the complete ladder and preserve zero',()=>{
 const form={elements:{old_price:{value:'25'},price_10:{value:'15'},price_20:{value:'12'}}};
 assert.deepEqual(readPriceInputs(form,2000),{old:2500,ten:1500,twenty:1200});
 form.elements.price_20.value='0';assert.equal(readPriceInputs(form,2000).twenty,0);
 form.elements.price_20.value='';assert.throws(()=>readPriceInputs(form,2000),/שני/);
 form.elements.price_10.value='';assert.deepEqual(readPriceInputs(form,2000),{old:2500,ten:null,twenty:null});
});
test('only magnets get quantity controls; all inputs use numeric attribute values',()=>{
 assert.match(priceFields({category:'CarMagnets',quantityPrices:tiers}),/name="price_10"/);
 assert.match(priceFields({category:'CarMagnets'}),/name="discount_20"/);
 assert.doesNotMatch(priceFields({category:'PhoneStickers'}),/name="price_10"/);
});
