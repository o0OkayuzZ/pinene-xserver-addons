import { createSign } from 'node:crypto';
const api='https://analyticsdata.googleapis.com/v1beta/properties/';
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
async function accessToken(credentials,fetcher){
 const now=Math.floor(Date.now()/1000);
 const content=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:credentials.client_email,scope:'https://www.googleapis.com/auth/analytics.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 const assertion=content+'.'+createSign('RSA-SHA256').update(content).sign(credentials.private_key,'base64url');
 const res=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(20000)});
 if(!res.ok)throw new Error('Google認証に失敗しました。サービスアカウントのキーを確認してください。');
 const body=await res.json();if(!body.access_token)throw new Error('Googleの読み取り認証を確認できません。');return body.access_token;
}
export function requestFor(days,dimensions=[],metrics=['screenPageViews'],offset=0){
 if(![1,7,30].includes(days))throw new Error('期間が不正です。');
 return {dateRanges:[{startDate:days===1?'today':`${days-1}daysAgo`,endDate:'today'}],dimensions:dimensions.map(name=>({name})),metrics:metrics.map(name=>({name})),dimensionFilter:{andGroup:{expressions:[{filter:{fieldName:'hostName',stringFilter:{matchType:'EXACT',value:'o0okayuzz.github.io',caseSensitive:false}}},{filter:{fieldName:'pagePath',stringFilter:{matchType:'BEGINS_WITH',value:'/pine-server/'}}}]}},orderBys:dimensions.length?[{metric:{metricName:metrics[0]},desc:true}]:[],limit:1000,offset,keepEmptyRows:false};
}
export function reportRows(report){
 return (report.rows??[]).map(row=>{
  const values=(row.metricValues??[]).map(x=>Number(x.value));
  if(values.some(x=>!Number.isFinite(x)||x<0))throw new Error('GA4の集計値が不正です。');
  return {label:(row.dimensionValues??[]).map(x=>x.value).join(' / '),views:values[0]??0,values};
 });
}
export async function ga4Analytics(config,days,fetcher=fetch){
 const period={days,timezone:'GA4プロパティ設定',start:days===1?'today':`${days-1}daysAgo`,end:'today'};
 if(!config?.propertyId||!config?.serviceAccount)return {status:'unconfigured',provider:'ga4',period,message:'GA4未接続です。設定からプロパティIDと読み取り用キーを登録してください。'};
 if(!/^\d+$/.test(config.propertyId))return {status:'error',provider:'ga4',period,message:'プロパティIDを確認してください。'};
 try{
  const token=await accessToken(config.serviceAccount,fetcher);
  async function run(dimensions,metrics){
   const res=await fetcher(api+config.propertyId+':runReport',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(requestFor(days,dimensions,metrics)),signal:AbortSignal.timeout(25000)});
   if(!res.ok)throw new Error(`GA4取得エラー（HTTP ${res.status}）。Data APIの有効化とプロパティの閲覧権限を確認してください。`);
   const report=await res.json();if(report.error)throw new Error('GA4のレポートを取得できません。');return report;
  }
  const metricNames=['screenPageViews','sessions','activeUsers','newUsers','averageSessionDuration','engagementRate'];
  const total=await run([],metricNames);
  const numbers=reportRows(total)[0]?.values??metricNames.map(()=>0);
  const groups={};
  const specs={daily:['date'],pages:['pagePath'],referrers:['sessionSourceMedium'],devices:['deviceCategory'],countries:['country'],browsers:['browser'],content:['contentGroup'],events:['eventName'],eventPages:['eventName','pagePath'],landing:['landingPage'],hours:['hour'],os:['operatingSystem']};
  // Limit concurrent requests; a failed optional breakdown never hides totals.
  const pairs=Object.entries(specs);
  for(let i=0;i<pairs.length;i+=3)await Promise.all(pairs.slice(i,i+3).map(async([key,dims])=>{
   try{
    const report=await run(dims,[key.startsWith('event')?'eventCount':'screenPageViews']);
    groups[key]={status:'ok',truncated:(report.rowCount??0)>1000,thresholded:report.metadata?.subjectToThresholding??false,rows:reportRows(report).sort(['daily','hours'].includes(key)?(a,b)=>a.label.localeCompare(b.label):(a,b)=>b.views-a.views)};
   }catch{groups[key]={status:'error',rows:[]};}
  }));
  return {status:'ok',provider:'ga4',period:{...period,timezone:total.metadata?.timeZone??period.timezone},pageviews:numbers[0],visits:numbers[1],activeUsers:numbers[2],newUsers:numbers[3],averageSessionDuration:numbers[4],engagementRate:numbers[5],groups,notes:['GA4で計測された利用状況です。同意しなかった訪問や計測をブロックした訪問は含まれません。','集計には反映待ち・しきい値による制限がある場合があります。過去の未計測アクセスは復元できません。','操作別の件数は集計です。同じ人が順番に操作した割合を示すファネルではありません。']};
 }catch(error){return {status:'error',provider:'ga4',period,message:error.message.startsWith('GA4')||error.message.startsWith('Google')?error.message:'GA4の接続設定または読み取りキーを確認してください。'};}
}
