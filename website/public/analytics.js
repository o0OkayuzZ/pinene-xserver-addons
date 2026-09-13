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
