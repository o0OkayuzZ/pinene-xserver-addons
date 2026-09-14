import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { ga4Analytics } from '../ga4.mjs';
test('GA4 adapter handles totals, groups and an optional group failure without network',async()=>{
 const pair=generateKeyPairSync('rsa',{modulusLength:2048});
 const config={propertyId:'123',serviceAccount:{client_email:'reader@project.iam.gserviceaccount.com',private_key:pair.privateKey.export({type:'pkcs8',format:'pem'})}};
 let reports=0;
 const fetcher=async(url,options)=>{
  if(url.includes('oauth2'))return {ok:true,json:async()=>({access_token:'unit-test-token'})};
  const body=JSON.parse(options.body);assert.ok(body.dimensionFilter.andGroup);reports++;
  if(body.dimensions[0]?.name==='browser')return {ok:false,status:403};
  return {ok:true,json:async()=>({metadata:{timeZone:'Asia/Tokyo'},rowCount:1,rows:[{dimensionValues:body.dimensions.map(()=>({value:'fixture'})),metricValues:body.metrics.map(()=>({value:'2'}))}]})};
 };
 const result=await ga4Analytics(config,7,fetcher);assert.equal(result.status,'ok');assert.equal(result.pageviews,2);assert.equal(result.activeUsers,2);assert.equal(result.groups.browsers.status,'error');assert.equal(result.period.timezone,'Asia/Tokyo');assert.equal(reports,13);
});
