import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ga4Analytics } from './ga4.mjs';
const exec = promisify(execFile);
const endpoint='https://api.cloudflare.com/client/v4/graphql';
export const publicSite='https://o0okayuzz.github.io/pine-server/';
export const statsRepo='o0OkayuzZ/pine-server-stats';

export async function github(path, options={}) {
 const {stdout}=await exec('gh',['api',path,...(options.args??[])],{windowsHide:true,timeout:30000,maxBuffer:4*1024*1024});
 return stdout.trim()?JSON.parse(stdout):null;
}
export function period(days,now=new Date()) {
 if(![1,7,30].includes(days))throw new Error('期間は1日・7日・30日から選んでください。');
 return {days,start:new Date(now.getTime()-days*86400000).toISOString(),end:now.toISOString()};
}
export async function siteHealth(fetcher=fetch) {
 const checkedAt=new Date().toISOString();
 try{
  const response=await fetcher(publicSite,{signal:AbortSignal.timeout(15000),cache:'no-store'});
  const html=await response.text();
  return {status:response.ok?'ok':'error',httpStatus:response.status,checkedAt,beaconInstalled:/static\.cloudflareinsights\.com\/beacon\.min\.js/.test(html),ga4Configured:/data-measurement-id="G-[A-Z0-9]+"/.test(html)};
 }catch{return {status:'unavailable',httpStatus:null,checkedAt,beaconInstalled:null};}
}
export async function repositoryTraffic(api=github){
 try{
  const [views,referrers,paths]=await Promise.all([
   api('repos/o0OkayuzZ/pine-server/traffic/views'),
   api('repos/o0OkayuzZ/pine-server/traffic/popular/referrers'),
   api('repos/o0OkayuzZ/pine-server/traffic/popular/paths'),
  ]);
  return {status:'ok',views:views.count,uniques:views.uniques,daily:views.views,referrers,paths,days:14};
 }catch{return {status:'unavailable',message:'GitHubにログインしているアカウントのアクセス権を確認してください。'};}
}
const unwrap=type=>type ? (type.name||unwrap(type.ofType)) : undefined;
const typeFragment='kind name ofType { kind name ofType { kind name ofType { kind name } } }';
const schemas=new Map();
async function cloudflare(query,config,fetcher){
 const response=await fetcher(endpoint,{method:'POST',headers:{Authorization:'Bearer '+config.apiToken,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw new Error(`Cloudflare取得エラー（HTTP ${response.status}）。アカウントと読み取り権限を確認してください。`);
 const body=await response.json();
 if(body.errors?.length)throw new Error('Cloudflareが集計を受け付けませんでした。権限・サイトID・取得可能期間を確認してください。');
 return body.data;
}
// Cloudflare has a dynamic schema: discover fields and types before querying.
// Never pretend an unavailable metric is zero or silently query another site.
export function discover(schema){
 const types=schema.types;
 const node=types.flatMap(t=>t.fields??[]).find(f=>f.name==='rumPageloadEventsAdaptiveGroups'&&f.args?.some(a=>a.name==='filter'));
 if(!node)throw new Error('このアカウントでWeb Analyticsのデータセットを確認できません。');
 const type=name=>types.find(t=>t.name===name);
 const fields=type(unwrap(node.type))?.fields??[];
 const filterFields=type(unwrap(node.args.find(a=>a.name==='filter')?.type))?.inputFields??[];
 const filterNames=new Set(filterFields.map(f=>f.name));
 if(!['datetime_geq','datetime_lt','siteTag'].every(f=>filterNames.has(f)))throw new Error('計測サイトと期間を限定できるAPI形式を確認できません。');
 if(!fields.some(f=>f.name==='count'))throw new Error('ページ表示数のAPI項目を確認できません。');
 const dimensions=type(unwrap(fields.find(f=>f.name==='dimensions')?.type))?.fields??[];
 const available=new Set(dimensions.map(f=>f.name));
 const choose=(...names)=>names.find(n=>available.has(n))??null;
 const sums=type(unwrap(fields.find(f=>f.name==='sum')?.type))?.fields??[];
 return {visits:sums.some(f=>f.name==='visits'),dimensions:{daily:choose('date','datetimeDate'),pages:choose('requestPath'),referrers:choose('refererHost'),devices:choose('deviceType'),countries:choose('countryName','country'),browsers:choose('browserName')},pathFilter:filterNames.has('requestPath_like')};
}
export function queryFor(model,config,range){
 for(const key of ['accountId','siteTag'])if(!/^[a-f0-9]{32}$/i.test(config[key]??''))throw new Error('アカウントID・サイトIDは32桁の英数字を確認してください。');
 const filter=`datetime_geq:${JSON.stringify(range.start)},datetime_lt:${JSON.stringify(range.end)},siteTag:${JSON.stringify(config.siteTag)}${model.pathFilter?',requestPath_like:"/pine-server/%"':''}`;
 const metric='count'+(model.visits?' sum { visits }':'');
 const node=(alias,dimension)=>`${alias}:rumPageloadEventsAdaptiveGroups(limit:${dimension?1000:1},filter:{${filter}}){${metric}${dimension?` dimensions { ${dimension} }`:''}}`;
 return `{viewer{accounts(filter:{accountTag:${JSON.stringify(config.accountId)}}){${node('total',null)} ${Object.entries(model.dimensions).filter(([,v])=>v).map(([key,v])=>node(key,v)).join(' ')}}}}`;
}
const numeric=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
export function normalizeAnalytics(data,model,range){
 const account=data?.viewer?.accounts?.[0];
 if(!account||!Array.isArray(account.total))throw new Error('Cloudflareの集計結果を読み取れません。');
 const total=account.total[0];
 if(total&&(!numeric(total.count)||(model.visits&&!numeric(total.sum?.visits))))throw new Error('Cloudflareの集計値が不正です。');
 const result={status:'ok',period:range,pageviews:total?.count??0,visits:model.visits?(total?.sum?.visits??0):null,groups:{},notes:['訪問回数は人数ではありません。計測コードが動作したアクセスの集計です。','Cloudflareのサンプリングにより推計を含むことがあります。期間はUTCの直近時間で集計しています。']};
 for(const [key,dimension]of Object.entries(model.dimensions)){
  if(!dimension){result.groups[key]={status:'unsupported',rows:[]};continue;}
  if(!Array.isArray(account[key]))throw new Error('分類別の集計結果を読み取れません。');
  const rows=account[key].map(row=>{
   if(!numeric(row.count))throw new Error('分類別の集計値が不正です。');
   return {label:String(row.dimensions?.[dimension]??''),views:row.count};
  });
  result.groups[key]={status:'ok',truncated:rows.length>=1000,rows:rows.sort(key==='daily'?(a,b)=>a.label.localeCompare(b.label):(a,b)=>b.views-a.views)};
 }
 return result;
}
export async function webAnalytics(config,days,fetcher=fetch){
 const range=period(days);
 if(!config?.apiToken||!config.accountId||!config.siteTag)return {status:'unconfigured',period:range,message:'Cloudflareとの接続前です。訪問数はまだ取得できません。'};
 try{
  const key=config.accountId+':'+config.siteTag;
  let model=fetcher===fetch?schemas.get(key):null;
  if(!model){
   const data=await cloudflare(`{__schema{types{name kind fields{name type{${typeFragment}} args{name type{${typeFragment}}}} inputFields{name type{${typeFragment}}}}}}`,config,fetcher);
   model=discover(data.__schema);if(fetcher===fetch)schemas.set(key,model);
  }
  return normalizeAnalytics(await cloudflare(queryFor(model,config,range),config,fetcher),model,range);
 }catch(error){return {status:'error',period:range,message:error.message};}
}
export async function collect(config,days=7){
 period(days);
 const [web,repository,health]=await Promise.all([config?.provider==='cloudflare'?webAnalytics(config,days):ga4Analytics(config,days),repositoryTraffic(),siteHealth()]);
 return {generatedAt:new Date().toISOString(),site:publicSite,web,repository,health};
}
const safeCell=value=>String(value).replace(/[|\r\n<>]/g,' ').replace(/\[/g,'\\[').slice(0,250);
export function reportMarkdown(report){
 const w=report.web;
 let text=`# PINE SERVER 管理レポート\n\n本人用の非公開レポート。更新: ${report.generatedAt}\n\n[公開サイト](${publicSite}) / デスクトップの「PINE SERVER 管理画面」から詳細を確認できます。\n\n## Webサイトのアクセス\n\n`;
 if(w.status!=='ok')text+='**未計測・取得できていません。0人という意味ではありません。**\n\n';
 else{
  text+=`期間${w.period.days}日（${safeCell(w.period.timezone??'UTC')}） / ページ表示: ${w.pageviews} / 訪問回数: ${w.visits??'取得対象外'} / アクティブユーザー: ${w.activeUsers??'取得対象外'}\n\n訪問回数は人数ではありません。推計を含む場合があります。\n\n`;
  const titles={daily:'日別のページ表示',pages:'人気ページ',referrers:'流入元',devices:'端末',countries:'国・地域',browsers:'ブラウザ',content:'コンテンツ',events:'操作',eventPages:'ページ別の操作',landing:'入口ページ',hours:'時間帯',os:'OS'};
  for(const [key,group]of Object.entries(w.groups)){
   text+=`### ${titles[key]}\n\n`;
   if(group.status!=='ok'){text+='取得対象外\n\n';continue;}
   if(!group.rows.length){text+='この期間のデータはありません。\n\n';continue;}
   text+=`|項目|${key.startsWith('event')?'操作件数':'ページ表示'}|\n|---|---:|\n`+group.rows.slice(0,30).map(r=>`|${safeCell(r.label)||'直接・不明'}|${r.views}|`).join('\n')+'\n\n';
   if(group.truncated)text+='取得上限に達したため、一部のみの表示です。\n\n';
  }
 }
 text+='## 公開状態\n\n'+(report.health.status==='ok'?'公開ページは応答しています。':'公開ページの応答を確認できませんでした。')+'\n\n';
 text+='## GitHubリポジトリへのアクセス（Webとは別）\n\n';
 text+=report.repository.status==='ok'?`過去14日: 表示 ${report.repository.views} / ユニーク閲覧者 ${report.repository.uniques}\n\n`:'GitHubの統計を取得できません。\n\n';
 return text+'個人の氏名・IPアドレス・閲覧履歴一覧は保存しません。\n';
}
