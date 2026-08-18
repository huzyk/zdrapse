(()=>{
  const ENDPOINT=window.ZDRAPSE_ANALYTICS_ENDPOINT||'';
  const STORAGE_KEY='zdrapse-analytics-id';
  const SESSION_KEY='zdrapse-session-id';
  const HISTORY_KEY='zdrapse-analytics-debug';
  const RATING_KEY='zdrapse-ratings';
  const makeId=()=>crypto.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const getId=(storage,key)=>{let id=storage.getItem(key);if(!id){id=makeId();storage.setItem(key,id)}return id};
  const userId=getId(localStorage,STORAGE_KEY);
  const sessionId=getId(sessionStorage,SESSION_KEY);
  let scratchStarted=false,lastRevealedId=null;

  function hash(value){
    let h=2166136261;
    for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}
    return (h>>>0).toString(36);
  }

  function currentCard(){
    const text=document.getElementById('fortune')?.textContent||'';
    const category=document.getElementById('category')?.textContent||null;
    return {
      scratch_key:text?hash(`${category}|${text}`):null,
      category
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

  function loadRatings(){
    try{return JSON.parse(localStorage.getItem(RATING_KEY)||'{}')}catch(e){return {}}
  }

  function saveRating(scratchKey,rating){
    if(!scratchKey)return;
    const ratings=loadRatings();
    ratings[scratchKey]=rating;
    try{localStorage.setItem(RATING_KEY,JSON.stringify(ratings))}catch(e){}
  }

  function ratingUI(){
    const actions=document.getElementById('actions');
    if(!actions||document.getElementById('ratingBox'))return;
    const style=document.createElement('style');
    style.textContent=`
      .rating-box{display:none;margin-top:12px;padding:12px;border:1px solid var(--border);border-radius:17px;background:var(--panel)}
      .rating-box.show{display:block}
      .rating-label{font-size:10px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted);margin:0 0 9px;text-align:center}
      .rating-buttons{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .rating-btn{border:1px solid var(--border);border-radius:14px;background:var(--bg);color:var(--ink);font:inherit;font-size:12px;font-weight:950;padding:12px 8px;cursor:pointer;transition:transform .12s,background .12s,border-color .12s}
      .rating-btn:active{transform:translateY(1px)}
      .rating-btn.active{background:var(--lemon);color:#121212;border-color:transparent}
      .rating-thanks{display:none;margin-top:8px;text-align:center;font-size:10px;font-weight:850;color:var(--muted)}
      .rating-thanks.show{display:block}
    `;
    document.head.appendChild(style);
    const box=document.createElement('div');
    box.className='rating-box';
    box.id='ratingBox';
    box.innerHTML=`<div class="rating-label">No i jak?</div><div class="rating-buttons"><button class="rating-btn" type="button" data-rating="hit">TRAFIONE 🎯</button><button class="rating-btn" type="button" data-rating="shit">CO ZA GÓWNO 💩</button></div><div class="rating-thanks" id="ratingThanks">Zapisane. Los przyjął do wiadomości.</div>`;
    actions.insertAdjacentElement('afterend',box);

    box.querySelectorAll('.rating-btn').forEach(button=>button.addEventListener('click',()=>{
      const card=currentCard();
      if(!card.scratch_key)return;
      const rating=button.dataset.rating;
      const previous=loadRatings()[card.scratch_key]||null;
      saveRating(card.scratch_key,rating);
      box.querySelectorAll('.rating-btn').forEach(b=>b.classList.toggle('active',b===button));
      document.getElementById('ratingThanks')?.classList.add('show');
      track('scratch_rating',{...card,rating,previous_rating:previous});
    }));
  }

  function syncRatingUI(show){
    const box=document.getElementById('ratingBox');
    if(!box)return;
    box.classList.toggle('show',show);
    if(!show)return;
    const card=currentCard();
    const rating=card.scratch_key?loadRatings()[card.scratch_key]:null;
    box.querySelectorAll('.rating-btn').forEach(button=>button.classList.toggle('active',button.dataset.rating===rating));
    document.getElementById('ratingThanks')?.classList.toggle('show',Boolean(rating));
  }

  window.zdrapseAnalytics={track,userId,sessionId};

  function boot(){
    const params=new URLSearchParams(location.search);
    track('page_view',{entry:params.has('s')?'shared':'direct'});
    if(params.has('s'))track('shared_open',{scratch_id:params.get('s')});

    ratingUI();
    const launch=document.getElementById('launch');
    const again=document.getElementById('again');
    const share=document.getElementById('share');
    const canvas=document.getElementById('scratch');
    const actions=document.getElementById('actions');
    const home=document.getElementById('homeLink');
    const theme=document.getElementById('themeToggle');

    launch?.addEventListener('click',()=>{scratchStarted=false;syncRatingUI(false);track('scratch_open',{source:'home',selected_category:'LOS'})});
    again?.addEventListener('click',()=>{scratchStarted=false;syncRatingUI(false);track('scratch_again',currentCard())});
    share?.addEventListener('click',()=>track('share_intent',currentCard()));
    home?.addEventListener('click',()=>{syncRatingUI(false);track('home_return',currentCard())});
    theme?.addEventListener('click',()=>track('theme_toggle',{theme:document.documentElement.dataset.theme}));

    document.querySelectorAll('.cat').forEach(button=>button.addEventListener('click',()=>{
      scratchStarted=false;
      syncRatingUI(false);
      track('category_select',{category:button.dataset.cat});
    }));

    canvas?.addEventListener('pointerdown',()=>{
      if(scratchStarted)return;
      scratchStarted=true;
      track('scratch_start',currentCard());
    });

    if(actions){
      new MutationObserver(()=>{
        const visible=actions.classList.contains('show');
        syncRatingUI(visible);
        if(!visible)return;
        const card=currentCard();
        if(card.scratch_key===lastRevealedId)return;
        lastRevealedId=card.scratch_key;
        track('scratch_reveal',card);
      }).observe(actions,{attributes:true,attributeFilter:['class']});
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
