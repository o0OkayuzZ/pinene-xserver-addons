const $=id=>document.getElementById(id);
let key=location.hash.slice(1)||sessionStorage.getItem('pine-admin-session');
if(location.hash){sessionStorage.setItem('pine-admin-session',key);history.replaceState(null,'',location.pathname);}
let report=null,group='pages',limit=50;
let takuyaQuestions=[],takuyaBefore=null,takuyaHasMore=false;
const takuyaStatusNames={answered:'回答済み',knowledge_error:'資料取得失敗',model_error:'AI応答失敗',empty_response:'空の応答',received:'受信済み'};
const names={page_view:'ページ表示',pine_search:'図鑑検索を使用',pine_filter:'図鑑の絞り込み',pine_expand:'一覧・説明を展開',pine_recipe_view:'レシピの閲覧',pine_item_view:'アイテムの閲覧',pine_guide_open:'図鑑の詳細を開く',pine_join_open:'参加案内を開く',pine_content_open:'コンテンツを開く',scroll:'スクロール',click:'外部リンクを開く',file_download:'ダウンロードリンクをクリック',video_start:'動画の再生開始',video_progress:'動画の再生進捗',video_complete:'動画の再生完了',user_engagement:'ページへの関与',session_start:'訪問開始',first_visit:'初回訪問'};
function notice(text,type=''){const node=$('notice');node.textContent=text;node.className='notice '+type;}
async function api(path,body){const res=await fetch('/api/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await res.json();if(!res.ok)throw new Error(data.error??'取得に失敗しました。');return data;}
function metric(id,value,suffix=''){$(id).textContent=value==null?'—':Number(value).toLocaleString('ja-JP',{maximumFractionDigits:1})+suffix;}
function render(){
 const w=report?.web;const ready=w?.status==='ok';
 for(const id of ['pageviews','visits','activeUsers','newUsers'])metric(id,ready?w[id]:null);
 metric('duration',ready?w.averageSessionDuration:null,'秒');metric('engagement',ready&&w.engagementRate!=null?w.engagementRate*100:null,'%');
 $('updated').textContent=report?'最終取得：'+new Date(report.generatedAt).toLocaleString('ja-JP'):'最終取得：未取得';
 const health=report?.health;$('health').textContent=health?'公開状態：'+(health.status==='ok'?'正常（HTTP '+health.httpStatus+'）':'要確認'):'公開状態：確認前';
 $('timezone').textContent=ready?`${w.period.days}日間 / ${w.period.timezone??'UTC'}`:'計測前';
 $('notes').textContent=ready?w.notes.join(' '):'未接続は「0人」とは異なります。計測開始前のアクセスは復元できません。';
 $('repo-status').textContent=report?.repository.status==='ok'?`過去14日：表示 ${report.repository.views} / ユニーク閲覧者 ${report.repository.uniques}`:'GitHub統計は未取得、または取得できません。';
 const chart=$('chart');chart.replaceChildren();
 const daily=ready?w.groups.daily?.rows??[]:[];
 if(!daily.length){const p=document.createElement('p');p.className='empty';p.textContent=ready?'この期間の日別データはありません。':'接続すると、日ごとの変化がここに表示されます。';chart.append(p);}
 else{const max=Math.max(1,...daily.map(r=>r.views));for(const row of daily){const box=document.createElement('div');box.className='bar-column';const button=document.createElement('button');button.title=row.label+'：'+row.views+'回';button.setAttribute('aria-label',button.title);button.addEventListener('click',()=>notice(button.title,'ok'));const value=document.createElement('span');value.textContent=row.views.toLocaleString();const bar=document.createElement('span');bar.className='bar';bar.style.height=(row.views/max*130)+'px';const label=document.createElement('small');label.textContent=row.label;button.append(value,bar,label);box.append(button);chart.append(box);}}
 renderRows();
}
function filteredRows(){return (report?.web.status==='ok'?report.web.groups[group]?.rows??[]:[]).filter(row=>(row.label+' '+(names[row.label]??'')).toLowerCase().includes($('filter').value.toLowerCase()));}
function renderRows(){
 const node=$('rows');node.replaceChildren();const data=report?.web.groups?.[group];const rows=filteredRows();
 const events=group.startsWith('event');$('value-heading').textContent=events?'操作件数':'ページ表示';
 $('group-note').textContent=(events?'操作の件数です。同じ人の移動順やファネルの達成率ではありません。 ':'')+(data?.truncated?'取得上限の1,000行に達しています。表示割合は取得できた行の中での割合です。 ':'')+(data?.thresholded?'GA4のしきい値による制限があります。':'');
 if(!rows.length){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=3;td.className='empty';td.textContent=report?.web.status!=='ok'?'接続後にデータを取得してください。':!data||data.status!=='ok'?'この内訳は取得できないか、対象外です。':$('filter').value?'一致する項目はありません。':'この期間のデータはありません。';tr.append(td);node.append(tr);}
 const total=rows.reduce((sum,row)=>sum+row.views,0);
 for(const row of rows.slice(0,limit)){const tr=document.createElement('tr');for(const value of [names[row.label]??row.label??'直接・不明',row.views.toLocaleString(),total?(row.views/total*100).toFixed(1)+'%':'—']){const td=document.createElement('td');td.textContent=value||'直接・不明';tr.append(td);}node.append(tr);}
 $('row-count').textContent=`${Math.min(limit,rows.length)} / ${rows.length}件`;$('more').hidden=rows.length<=limit;
}
async function action(button,fn){button.disabled=true;try{await fn();}catch(error){notice(error.message,'error');}finally{button.disabled=false;}}
async function refresh(){notice('最新データを取得しています…');const data=await api('refresh',{days:Number($('days').value)});report=data.report;render();notice(report.web.status==='ok'?'最新の集計を取得しました。':report.web.message,report.web.status==='ok'?'ok':'');}
$('refresh').addEventListener('click',event=>action(event.currentTarget,refresh));
$('days').addEventListener('change',()=>action($('refresh'),refresh));
document.querySelectorAll('[data-group]').forEach(button=>button.addEventListener('click',()=>{group=button.dataset.group;limit=50;document.querySelectorAll('[data-group]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderRows();}));
$('filter').addEventListener('input',()=>{limit=50;renderRows();});$('more').addEventListener('click',()=>{limit+=50;renderRows();});
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('csv').addEventListener('click',()=>{const rows=filteredRows();if(!rows.length){notice('保存できる内訳がありません。');return;}const cell=value=>'"'+String(value).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';download('\ufeff項目,件数\r\n'+rows.map(r=>[cell(r.label),r.views].join(',')).join('\r\n'),'pine-'+group+'.csv','text/csv;charset=utf-8');});
$('export').addEventListener('click',()=>{if(!report){notice('先に最新データを取得してください。');return;}download(JSON.stringify(report,null,2),'pine-report.json','application/json');});
function filteredTakuya(){const query=$('takuya-filter').value.toLowerCase();return takuyaQuestions.filter(row=>{const sources=(row.sources??[]).map(source=>source.title??source.id??'').join(' ');return (row.message+' '+sources+' '+(takuyaStatusNames[row.status]??row.status??'')).toLowerCase().includes(query);});}
function renderTakuya(){
 const node=$('takuya-rows');node.replaceChildren();const rows=filteredTakuya();
 if(!rows.length){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=5;td.className='empty';td.textContent=takuyaQuestions.length?'絞り込みに一致する質問はありません。':'この期間の質問はまだありません。';tr.append(td);node.append(tr);}
 for(const row of rows){
  const tr=document.createElement('tr');
  const time=document.createElement('td');time.textContent=new Date(Number(row.created_at)).toLocaleString('ja-JP');tr.append(time);
  const question=document.createElement('td');question.className='question-text';question.textContent=row.message;tr.append(question);
  const status=document.createElement('td');status.textContent=takuyaStatusNames[row.status]??row.status??'—';tr.append(status);
  const session=document.createElement('td');session.textContent=String(row.session_hash??'').slice(0,8)||'—';session.title='匿名の会話ID';tr.append(session);
  const sources=document.createElement('td');sources.className='question-sources';
  const list=row.sources??[];
  if(!list.length)sources.textContent='—';
  else for(const [index,source]of list.entries()){if(index)sources.append(document.createTextNode(' / '));if(source.url){const a=document.createElement('a');a.href='https://o0okayuzz.github.io/pine-server'+source.url;a.target='_blank';a.rel='noreferrer';a.textContent=source.title??source.id??'関連ページ';sources.append(a);}else sources.append(document.createTextNode(source.title??source.id??'関連項目'));}
  tr.append(sources);node.append(tr);
 }
 $('takuya-count').textContent=`${rows.length} / ${takuyaQuestions.length}件表示`;$('takuya-more').hidden=!takuyaHasMore;
}
async function loadTakuya(append=false){
 const suffix=append&&takuyaBefore?`&before=${encodeURIComponent(takuyaBefore)}`:'';
 const data=await api('takuya/questions?limit=100'+suffix);
 if(data.status==='unconfigured'){
  takuyaQuestions=[];takuyaBefore=null;takuyaHasMore=false;renderTakuya();$('takuya-status').textContent='拓也ログの読み取り設定が未完了です。';return;
 }
 if(data.status!=='ok')throw new Error('拓也の質問ログを取得できません。');
 takuyaQuestions=append?[...takuyaQuestions,...(data.questions??[])]:data.questions??[];
 takuyaBefore=data.nextBefore??null;takuyaHasMore=!!data.hasMore;renderTakuya();
 $('takuya-status').textContent=`直近${data.retentionDays??30}日 / ${takuyaQuestions.length}件読み込み / 最終更新 ${new Date().toLocaleTimeString('ja-JP')}`;
}
$('takuya-refresh').addEventListener('click',event=>action(event.currentTarget,()=>loadTakuya(false)));
$('takuya-filter').addEventListener('input',renderTakuya);
$('takuya-more').addEventListener('click',event=>action(event.currentTarget,()=>loadTakuya(true)));
$('takuya-csv').addEventListener('click',()=>{
 const rows=filteredTakuya();if(!rows.length){notice('保存できる質問がありません。');return;}
 const cell=value=>'"'+String(value??'').replace(/^[=+@-]/,"'$('save-github').addEventListener").replaceAll('"','""')+'"';
 const text='\ufeff日時,質問,状態,会話,参照先\r\n'+rows.map(row=>[new Date(Number(row.created_at)).toLocaleString('ja-JP'),row.message,takuyaStatusNames[row.status]??row.status,String(row.session_hash??'').slice(0,8),(row.sources??[]).map(source=>source.title??source.id??'').join(' / ')].map(cell).join(',')).join('\r\n');
 download(text,'takuya-questions.csv','text/csv;charset=utf-8');
});
$('save-github').addEventListener('click',event=>action(event.currentTarget,async()=>{await api('github',{});notice('本人用のGitHub非公開レポートへ保存しました。','ok');}));
function providerFields(){const ga4=$('provider').value==='ga4';$('ga4-fields').hidden=!ga4;$('cloudflare-fields').hidden=ga4;}
$('provider').addEventListener('change',providerFields);
function showSettings(settings){for(const [name,value]of Object.entries(settings)){const field=$('settings-form').elements.namedItem(name);if(field&&typeof value==='string')field.value=value;}$('settings-state').textContent=`読み取りキー：GA4 ${settings.hasServiceAccount?'保存済み':'未設定'} / Cloudflare ${settings.hasApiToken?'保存済み':'未設定'}。公開用測定IDを保存しても、Webの計測コードが自動公開されるわけではありません。`;providerFields();}
$('settings-form').addEventListener('submit',event=>{event.preventDefault();const button=event.submitter;action(button,async()=>{const data=Object.fromEntries(new FormData(event.target));const result=await api('settings',data);event.target.elements.apiToken.value='';event.target.elements.serviceAccount.value='';showSettings(result.settings);notice('接続設定を暗号化して保存しました。「最新の状態に更新」で接続を確認できます。','ok');});});
if(key)api('state').then(data=>{showSettings(data.settings);report=data.report;render();notice('管理画面を開きました。初回は下の接続設定を行ってください。');void action($('refresh'),refresh);void loadTakuya(false).catch(error=>{$('takuya-status').textContent=error.message;});}).catch(error=>notice(error.message,'error'));
else{notice('デスクトップの「PINE SERVER 管理画面」から開いてください。','error');document.querySelectorAll('button').forEach(button=>button.disabled=true);}
