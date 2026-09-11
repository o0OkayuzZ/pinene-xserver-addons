import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedRequest, validateSettings, protect } from '../server.mjs';
import { requestFor, reportRows, ga4Analytics } from '../ga4.mjs';
import { period, normalizeAnalytics, queryFor, webAnalytics, reportMarkdown } from '../providers.mjs';
test('local API requires exact host, key and same-origin requests',()=>{
 const req={headers:{host:'127.0.0.1:18473',authorization:'Bearer local-test-key'}};
 assert.equal(allowedRequest(req,'local-test-key'),true);
 for(const addition of [{host:'evil.example:18473'},{authorization:'Bearer wrong'},{origin:'https://evil.example'},{'sec-fetch-site':'cross-site'}])assert.equal(allowedRequest({headers:{...req.headers,...addition}},'local-test-key'),false);
});
test('Windows DPAPI encrypts and restores settings without a plaintext file',{skip:process.platform!=='win32'},async()=>{
 const text=JSON.stringify({apiToken:'synthetic-secret-for-dpapi-test'});
 const encrypted=await protect(text);
 assert.ok(!encrypted.includes('synthetic-secret'));assert.equal(await protect(encrypted,true),text);
});
test('settings validate IDs and preserve existing secrets without returning them',()=>{
 const previous={apiToken:'not-a-real-secret',serviceAccount:{client_email:'reader@project.iam.gserviceaccount.com',private_key:'-----BEGIN PRIVATE KEY-----'}};
 const saved=validateSettings({provider:'ga4',measurementId:'G-TEST1234',propertyId:'123'},previous);
 assert.equal(saved.apiToken,previous.apiToken);assert.equal(saved.serviceAccount,previous.serviceAccount);
 for(const bad of [{provider:'other'},{provider:'ga4',measurementId:'<script>'},{provider:'ga4',propertyId:'../42'},{accountId:'bad'},{serviceAccount:'{}'}])assert.throws(()=>validateSettings(bad));
});
test('GA4 report always scopes host and pine-server path and uses inclusive dates',()=>{
 const request=requestFor(7,['pagePath']);
 assert.equal(request.dateRanges[0].startDate,'6daysAgo');assert.equal(requestFor(1).dateRanges[0].startDate,'today');
 assert.deepEqual(request.dimensionFilter.andGroup.expressions.map(e=>e.filter.stringFilter.value),['o0okayuzz.github.io','/pine-server/']);
 assert.throws(()=>requestFor(300));assert.throws(()=>period(300));
});
test('unconfigured analytics is not a fabricated zero',async()=>{
 const offline=()=>{throw new Error('Must not call network');};
 for(const result of [await ga4Analytics({},7,offline),await webAnalytics({},7,offline)]){assert.equal(result.status,'unconfigured');assert.equal(result.pageviews,undefined);}
});
test('provider metrics reject invalid values and label missing dimensions unavailable',()=>{
 assert.throws(()=>reportRows({rows:[{metricValues:[{value:'NaN'}]}]}));
 const model={visits:false,dimensions:{pages:'requestPath',devices:null}};
 const result=normalizeAnalytics({viewer:{accounts:[{total:[{count:6}],pages:[{count:6,dimensions:{requestPath:'/pine-server/'}}]}]}},model,period(7));
 assert.equal(result.visits,null);assert.equal(result.groups.devices.status,'unsupported');assert.equal(result.pageviews,6);
 assert.throws(()=>normalizeAnalytics({viewer:{accounts:[{total:[{count:-1}],pages:[]}]}},model,period(7)));
});
test('Cloudflare query pins account, site and optional public path scope',()=>{
 const config={accountId:'a'.repeat(32),siteTag:'b'.repeat(32)};
 const query=queryFor({visits:true,dimensions:{pages:'requestPath'},pathFilter:true},config,period(7));
 assert.ok(query.includes('siteTag:"'+config.siteTag+'"'));assert.ok(query.includes('/pine-server/%'));
 assert.throws(()=>queryFor({dimensions:{}},{accountId:'malicious'},period(7)));
});
test('private report uses aggregate fields and distinguishes repository traffic',()=>{
 const report={generatedAt:'2026-09-12T00:00:00Z',web:{status:'unconfigured'},health:{status:'ok'},repository:{status:'ok',views:3,uniques:2},settings:{apiToken:'DO_NOT_EXPORT'}};
 const text=reportMarkdown(report);assert.ok(text.includes('0人という意味ではありません'));assert.ok(text.includes('Webとは別'));assert.ok(!text.includes('DO_NOT_EXPORT'));
});
