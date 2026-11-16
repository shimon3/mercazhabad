// Non-destructive regression checks for Mercaz Habad. Run with Node 20+:
// node tests/security-smoke.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
let checks=0;
const check=(cond,message)=>{assert.ok(cond,message);checks++};
for(const path of [
 'staff.js','account.js','catalogue-editorial.js',
 'functions/api/grow/_shared.js','functions/api/grow/create-payment.js',
 'functions/api/grow/webhook.js','functions/api/grow/status.js',
 'functions/api/staff/dashboard.js'
]){
 execFileSync(process.execPath,['--check',new URL('../'+path,import.meta.url).pathname],{stdio:'pipe'});
 checks++;
}
const admin=read('admin/index.html'),manager=read('manager/index.html'),
 account=read('account/index.html'),home=read('index.html'),
 staff=read('staff.js'),privacy=read('privacy/index.html');
check(admin.includes('<div id="dashboard" class="hidden"></div>')&&!admin.includes('id="ordersCount"'),'Admin HTML must be login shell only');
check(manager.includes('<div id="dashboard" class="hidden"></div>')&&!manager.includes('id="ordersCount"'),'Manager HTML must be login shell only');
check(staff.includes('await loadProtectedDashboard();bindDashboardHandlers();'),'Dashboard handlers may only load after MFA');
check(!account.includes('href="/admin/"')&&!account.includes('id="staffShortcut"'),'Customer page must not expose admin shortcut');
check(!admin.includes('supabase.com/dashboard/project/')&&!manager.includes('supabase.com/dashboard/project/'),'No Supabase Dashboard link in staff pages');
check(home.includes('<a href="/" class="brand" ')&&!home.includes('s/3-temple</bdi>'),'Storefront legend and logo corrected');
check(home.includes('<noscript>')&&account.includes('<noscript>'),'No-script fallbacks exist');
check(['he','fr','en'].every(id=>privacy.includes('id="'+id+'"')),'Privacy language anchors resolve');
const headers=read('_headers');
for(const name of ['Content-Security-Policy:','Strict-Transport-Security:','X-Frame-Options: DENY','X-Content-Type-Options: nosniff','Referrer-Policy: strict-origin-when-cross-origin','Permissions-Policy:'])check(headers.includes(name),'Missing header '+name);
check(!/sb_secret_|SUPABASE_SERVICE_ROLE_KEY/.test([staff,read('account.js'),read('catalogue-editorial.js')].join('\n')),'Secret key appears in checked browser scripts');
const shared=read('functions/api/grow/_shared.js'),grow=read('functions/api/grow/create-payment.js'),
 webhook=read('functions/api/grow/webhook.js');
check(shared.includes("GROW_ENABLE_PAYMENTS!=='true'"),'Missing explicit payment enable switch');
check(grow.includes('Object.keys(body).length!==1')&&grow.includes('order.customer_id!==user.id'),'Grow request accepts orderId only and checks ownership');
check(grow.includes('order.total_agorot')&&!grow.includes('body.amount'),'Grow total must be database-derived');
check(webhook.includes("getTransactionInfo")&&webhook.includes("mercaz_record_verified_grow_payment")&&webhook.includes("approveTransaction"),'Webhook must verify, record, acknowledge');
check(!/console\.(log|debug|error)/.test(webhook),'Webhook should not log callback/card data');
check(webhook.includes('expectedDescription')&&webhook.includes('Verified order reference mismatch'),'Webhook requires verified order correlation');
check(!account.includes('<iframe'),'Do not embed card payment');
console.log('PASS: '+checks+' static/syntax checks; no external APIs or payments were invoked.');
