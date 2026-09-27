// No provider loads before explicit opt-in. Never send query strings or input text.
(()=>{
 const root=document.getElementById('pine-analytics');if(!root)return;
 const id=root.dataset.measurementId;if(!/^G-[A-Z0-9]{4,20}$/.test(id))return;
 const consentKey='pine-analytics-consent-v1';let allowed=false,started=false,searchTimer;
 const panel=document.getElementById('analytics-choice');
 const safeLocation=()=>location.origin+location.pathname;
 const referrer=()=>{try{return new URL(document.referrer).origin+'/';}catch{return '';}};
 function tag(){(window.dataLayer=window.dataLayer||[]).push(arguments);}
 function emit(name,params={}){if(!allowed)return;tag('event',name,{send_to:id,page_location:safeLocation(),page_referrer:referrer(),content_group:root.dataset.contentGroup,...params});}
 function start(){
  allowed=true;if(started)return;started=true;window['ga-disable-'+id]=false;
  tag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  tag('js',new Date());tag('config',id,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,page_location:safeLocation(),page_referrer:referrer(),content_group:root.dataset.contentGroup});
  const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id);document.head.append(script);
  emit('page_view',{page_title:document.title});
  if(root.dataset.entryKind==='recipe')emit('pine_recipe_view',{content_id:root.dataset.entryId});
  if(root.dataset.entryKind==='item')emit('pine_item_view',{content_id:root.dataset.entryId});
 }
 function stop(){allowed=false;window['ga-disable-'+id]=true;
  // Remove this site's GA cookies when withdrawing permission.
  for(const cookie of document.cookie.split(';')){const name=cookie.split('=')[0].trim();if(name==='_ga'||name.startsWith('_ga_')){document.cookie=name+'=; Max-Age=0; Path=/';document.cookie=name+'=; Max-Age=0; Path=/; Domain='+location.hostname;}}
 }
 let choice;try{choice=localStorage.getItem(consentKey);}catch{}
 if(choice==='yes')start();else if(choice!=='no')panel.hidden=false;
 root.querySelectorAll('[data-consent]').forEach(button=>button.addEventListener('click',()=>{
  const yes=button.dataset.consent==='yes';try{localStorage.setItem(consentKey,yes?'yes':'no');}catch{}
  panel.hidden=true;if(yes){if(started&&!allowed){location.reload();return;}start();}else stop();
 }));
 document.getElementById('analytics-settings').addEventListener('click',()=>{panel.hidden=false;root.querySelector('[data-consent]').focus();});
 document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[href]');if(!link)return;
  let url;try{url=new URL(link.href,location.href);}catch{return;}
  if(url.origin!==location.origin||!url.pathname.startsWith('/pine-server/'))return;
  if(url.pathname.endsWith('/start/'))emit('pine_join_open');
  else if(url.pathname.includes('/database/entries/'))emit('pine_guide_open',{content_id:url.pathname.split('/').filter(Boolean).at(-1)});
  else if(url.pathname.includes('/contents/'))emit('pine_content_open',{content_id:url.pathname.split('/').filter(Boolean).at(-1)});
 });
 document.addEventListener('change',event=>{const select=event.target;if(!['guide-content','guide-kind'].includes(select.id))return;const value=select.value;if(/^[a-z0-9-]+$/.test(value)&&[...select.options].some(option=>option.value===value))emit('pine_filter',{content_type:select.id,content_id:value});});
 document.getElementById('guide-search')?.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>emit('pine_search',{content_type:'guide'}),1000);});
 document.addEventListener('toggle',event=>{if(event.target.tagName==='DETAILS'&&event.target.open)emit('pine_expand',{content_type:'details'});},true);
})();

// Takuya client-side repeat guard. This is a display safety net in addition to Worker cleanup.
(()=>{
 const originalFetch=window.fetch.bind(window);
 const clean=value=>{
  let text=String(value??'').replace(/\r\n?/g,'\n').trim();if(!text)return '';
  const lines=[];for(const raw of text.split('\n')){const line=raw.trimEnd();if(line.trim()&&lines.at(-1)?.trim()===line.trim())continue;lines.push(line);}
  text=lines.join('\n').replace(/\n{3,}/g,'\n\n').trim();
  const paragraphs=[];for(const part of text.split(/\n{2,}/)){if(part.trim()&&paragraphs.at(-1)?.trim()===part.trim())continue;paragraphs.push(part);}text=paragraphs.join('\n\n');
  let before;const sentence=/(^|[。！？!?\n])([^。！？!?\n]{4,}[。！？!?])(?:[ \t]*\2)+/gmu;
  do{before=text;text=text.replace(sentence,'$1$2');}while(text!==before);
  before=null;
  while(text!==before){
   before=text;const max=Math.min(160,Math.floor(text.length/2));
   for(let len=max;len>=6;len--){const unit=text.slice(-len),core=unit.trim();if(core.length<6||!/[\p{L}\p{N}]/u.test(core))continue;let count=1,cursor=text.length-len;while(cursor-len>=0&&text.slice(cursor-len,cursor)===unit){count++;cursor-=len;}if(count>=2){text=text.slice(0,text.length-len*(count-1)).trimEnd();break;}}
  }
  return text.trim();
 };
 window.fetch=async(...args)=>{
  const response=await originalFetch(...args);
  try{
   const target=typeof args[0]==='string'?args[0]:args[0]?.url??'';
   if(!target.includes('pine-takuya.pinene-server.workers.dev/chat')||!response.ok)return response;
   const data=await response.clone().json();if(typeof data.answer!=='string')return response;
   const answer=clean(data.answer);if(answer===data.answer)return response;
   const headers=new Headers(response.headers);headers.delete('content-length');
   return new Response(JSON.stringify({...data,answer}),{status:response.status,statusText:response.statusText,headers});
  }catch{return response;}
 };
})();
