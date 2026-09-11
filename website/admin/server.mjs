import http from 'node:http';
import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { execFile } from 'node:child_process';
import { collect, github, reportMarkdown, statsRepo } from './providers.mjs';
const root=dirname(fileURLToPath(import.meta.url));
export const storage=process.env.PINE_ADMIN_DATA??join(process.env.LOCALAPPDATA??root,'PINE SERVER','Admin');
const port=Number(process.env.PINE_ADMIN_PORT??18473);
const accessKey=randomBytes(32).toString('hex');
const origin=`http://127.0.0.1:${port}`;
let settings={},lastReport=null,busy=false;
async function atomic(path,text){const temp=path+'.'+randomBytes(6).toString('hex')+'.tmp';await writeFile(temp,text,{mode:0o600});await rename(temp,path);}
export async function protect(text,decode=false){
 const script=decode?'$s=[Console]::In.ReadToEnd() | ConvertTo-SecureString; $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p))} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}':'$s=[Console]::In.ReadToEnd(); [Console]::Out.Write((ConvertTo-SecureString $s -AsPlainText -Force | ConvertFrom-SecureString))';
 return new Promise((resolve,reject)=>{
  const child=execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:15000,maxBuffer:1024*1024},(error,stdout)=>error?reject(new Error('Windowsの暗号化保存に失敗しました。')):resolve(stdout.trim()));
  child.stdin.end(text);
 });
}
export function allowedRequest(req,key=accessKey,expected=origin){
 if(req.headers.host!==new URL(expected).host)return false;
 if(req.headers.origin&&req.headers.origin!==expected)return false;
 if(req.headers['sec-fetch-site']==='cross-site')return false;
 const value=req.headers.authorization??'';
 const actual=Buffer.from(value),wanted=Buffer.from('Bearer '+key);
 return actual.length===wanted.length&&timingSafeEqual(actual,wanted);
}
export function validateSettings(input,previous={}){
 const result={provider:input.provider??'ga4'};
 if(!['cloudflare','ga4'].includes(result.provider))throw new Error('計測サービスを選んでください。');
 for(const field of ['accountId','siteTag','beaconToken']){
  const value=String(input[field]??'').trim();
  if(value&&!/^[a-f0-9]{32}$/i.test(value))throw new Error('CloudflareのIDは32桁の英数字を確認してください。');
  result[field]=value;
 }
 result.apiToken=String(input.apiToken||previous.apiToken||'').trim();
 if(result.apiToken.length>500||/[\r\n]/.test(result.apiToken))throw new Error('APIトークンの形式を確認してください。');
 result.measurementId=String(input.measurementId??'').trim();
 if(result.measurementId&&!/^G-[A-Z0-9]{4,20}$/.test(result.measurementId))throw new Error('GA4測定IDの形式を確認してください。');
 result.propertyId=String(input.propertyId??'').trim();
 if(result.propertyId&&!/^\d{1,20}$/.test(result.propertyId))throw new Error('GA4プロパティIDは数字で入力してください。');
 result.serviceAccount=input.serviceAccount?JSON.parse(input.serviceAccount):previous.serviceAccount;
 if(result.serviceAccount&&(!/@.*\.iam\.gserviceaccount\.com$/.test(result.serviceAccount.client_email??'')||!String(result.serviceAccount.private_key??'').includes('BEGIN PRIVATE KEY')))throw new Error('サービスアカウントJSONの形式を確認してください。');
 return result;
}
const publicSettings=()=>({provider:settings.provider??'ga4',accountId:settings.accountId??'',siteTag:settings.siteTag??'',beaconToken:settings.beaconToken??'',hasApiToken:!!settings.apiToken,measurementId:settings.measurementId??'',propertyId:settings.propertyId??'',hasServiceAccount:!!settings.serviceAccount});
async function saveReport(){
 if(!lastReport)throw new Error('先に最新データを取得してください。');
 const repo=await github('repos/'+statsRepo);
 if(!repo.private||repo.owner.login.toLowerCase()!=='o0okayuzz')throw new Error('保存先が本人の非公開リポジトリではないため保存しません。');
 let existing=null;
 try{existing=await github('repos/'+statsRepo+'/contents/README.md?ref=reports');}catch{}
 const body={message:'Update private PINE SERVER analytics report',branch:'reports',content:Buffer.from(reportMarkdown(lastReport)).toString('base64'),...(existing?{sha:existing.sha}:{})};
 const path=join(storage,'report-upload-'+randomBytes(8).toString('hex')+'.json');
 try{await writeFile(path,JSON.stringify(body),{mode:0o600});await github('repos/'+statsRepo+'/contents/README.md',{args:['--method','PUT','--input',path]});}
 finally{await rm(path,{force:true});}
 return {url:'https://github.com/'+statsRepo};
}
async function body(req){let raw='';for await(const part of req){raw+=part;if(Buffer.byteLength(raw)>65536)throw new Error('入力サイズが大きすぎます。');}return JSON.parse(raw||'{}');}
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
const send=(res,status,value,type='application/json; charset=utf-8')=>{res.writeHead(status,{...headers,'Content-Type':type});res.end(type.startsWith('application/json')?JSON.stringify(value):value);};
export function createServer(){return http.createServer(async(req,res)=>{
 try{
  if(req.headers.host!==new URL(origin).host){send(res,403,{error:'拒否しました。'});return;}
  const url=new URL(req.url,origin);
  if(url.pathname.startsWith('/api/')){
   if(!allowedRequest(req)){send(res,403,{error:'デスクトップのアイコンから開き直してください。'});return;}
   if(req.method==='GET'&&url.pathname==='/api/state'){send(res,200,{settings:publicSettings(),report:lastReport});return;}
   if(req.method==='POST'&&url.pathname==='/api/settings'){
    const input=await body(req);const next=validateSettings(input,settings);
    await atomic(join(storage,'settings.dat'),await protect(JSON.stringify(next)));settings=next;lastReport=null;
    send(res,200,{settings:publicSettings()});return;
   }
   if(req.method==='POST'&&url.pathname==='/api/refresh'){
    if(busy){send(res,409,{error:'取得中です。少し待ってから更新してください。'});return;}
    const input=await body(req);busy=true;
    try{lastReport=await collect(settings,Number(input.days??7));send(res,200,{report:lastReport});}finally{busy=false;}return;
   }
   if(req.method==='POST'&&url.pathname==='/api/github'){send(res,200,await saveReport());return;}
   if(req.method==='GET'&&url.pathname==='/api/export'){
    if(!lastReport){send(res,409,{error:'先に最新データを取得してください。'});return;}
    send(res,200,lastReport);return;
   }
   send(res,404,{error:'見つかりません。'});return;
  }
  if(req.method!=='GET'){send(res,405,{error:'許可されていません。'});return;}
  const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
  if(!files[url.pathname]){send(res,404,'Not found','text/plain');return;}
  const type=url.pathname.endsWith('.js')?'application/javascript':url.pathname.endsWith('.css')?'text/css':'text/html';
  send(res,200,await readFile(join(root,'ui',files[url.pathname]),'utf8'),type+'; charset=utf-8');
 }catch(error){send(res,400,{error:['SyntaxError'].includes(error.name)?'入力内容を確認してください。':error.message?.startsWith('Command failed')?'GitHubへの接続に失敗しました。ログインと権限を確認してください。':error.message});}
});}
export async function start(){
 await mkdir(storage,{recursive:true});
 try{settings=JSON.parse(await protect(await readFile(join(storage,'settings.dat'),'utf8'),true));}catch(error){if(error.code!=='ENOENT')throw new Error('保存済み設定を開けません。同じWindowsアカウントで起動してください。');}
 const server=createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 await atomic(join(storage,'session.json'),JSON.stringify({url:origin+'/#'+accessKey,pid:process.pid}));
 // Access key and provider secrets must never appear in logs.
 console.log('PINE SERVER Admin is ready on loopback.');
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
 return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url))start().catch(()=>{console.error('管理画面を起動できませんでした。ポートまたは保存設定を確認してください。');process.exit(1);});
