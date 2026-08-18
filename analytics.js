(()=>{
  const ENDPOINT=window.ZDRAPSE_ANALYTICS_ENDPOINT||'';
  const STORAGE_KEY='zdrapse-analytics-id';
  const SESSION_KEY='zdrapse-session-id';
  const HISTORY_KEY='zdrapse-analytics-debug';
  const makeId=()=>crypto.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const getId=(storage,key)=>{let id=storage.getItem(key);if(!id){id=makeId();storage.setItem(key,id)}return id};
  const userId=getId(localStorage,STORAGE_KEY);
  const sessionId=getId(sessionStorage,SESSION_KEY);
  let scratchStarted=false,lastRevealedId=null;

  function currentCard(){
    return {
      scratch_id:document.getElementById('fortune')?.textContent?window.current?.id||null:null,
      category:document.getElementById('category')?.textContent||null
    };
  }

  function remember(event){
    try{
      const history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
      history.push(event);
      localStorage.setItem(HISTORY_KEY,JSON.stringify(history.slice(-100)));
    }catch(e){}
  }

  function send(event){
    window.dataLayer=window.dataLayer||[];
    window.dataLayer.push({event:`zdrapse_${event.name}`,...event.props});
    window.dispatchEvent(new CustomEvent('zdrapse:analytics',{detail:event}));
    remember(event);
    if(!ENDPOINT)return;
    const body=JSON.stringify(event);
    try{
      if(navigator.sendBeacon){
        navigator.sendBeacon(ENDPOINT,new Blob([body],{type:'application/json'}));
      }else{
        fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body,keepalive:true}).catch(()=>{});
      }
    }catch(e){}
  }

  function track(name,props={}){
    send({
      name,
      props:{...props},
      user_id:userId,
      session_id:sessionId,
      path:location.pathname,
      shared_id:new URLSearchParams(location.search).get('s')||null,
      referrer:document.referrer||null,
      ts:new Date().toISOString()
    });
  }

  window.zdrapseAnalytics={track,userId,sessionId};

  function boot(){
    const params=new URLSearchParams(location.search);
    track('page_view',{entry:params.has('s')?'shared':'direct'});
    if(params.has('s'))track('shared_open',{scratch_id:params.get('s')});

    const launch=document.getElementById('launch');
    const again=document.getElementById('again');
    const share=document.getElementById('share');
    const canvas=document.getElementById('scratch');
    const actions=document.getElementById('actions');
    const home=document.getElementById('homeLink');
    const theme=document.getElementById('themeToggle');

    launch?.addEventListener('click',()=>{scratchStarted=false;track('scratch_open',{source:'home',selected_category:'LOS'})});
    again?.addEventListener('click',()=>{scratchStarted=false;track('scratch_again',currentCard())});
    share?.addEventListener('click',()=>track('share_intent',currentCard()));
    home?.addEventListener('click',()=>track('home_return',currentCard()));
    theme?.addEventListener('click',()=>track('theme_toggle',{theme:document.documentElement.dataset.theme}));

    document.querySelectorAll('.cat').forEach(button=>button.addEventListener('click',()=>{
      scratchStarted=false;
      track('category_select',{category:button.dataset.cat});
    }));

    canvas?.addEventListener('pointerdown',()=>{
      if(scratchStarted)return;
      scratchStarted=true;
      track('scratch_start',currentCard());
    });

    if(actions){
      new MutationObserver(()=>{
        if(!actions.classList.contains('show'))return;
        const card=currentCard();
        const key=`${card.category}:${document.getElementById('fortune')?.textContent||''}`;
        if(key===lastRevealedId)return;
        lastRevealedId=key;
        track('scratch_reveal',card);
      }).observe(actions,{attributes:true,attributeFilter:['class']});
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
