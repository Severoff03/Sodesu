/* ============================================================
   study.js — карточки. Обычный режим (кандзи/слова/грамматика)
   и режим «Зазубрить» (🔥). Оценки: Трудно/Легко/🔥/Знаю/Архив.
   ============================================================ */
const Study = (() => {
  const D = window.GENKI_DATA;
  const $ = id=>document.getElementById(id);
  let deck='kanji', mode='normal', q=[], cur=null, revealed=false, noKnow=false, blitz=false, blitzTimer=0, blitzNextTimer=0, blitzToken=0;
  let onChange=()=>{}; function setOnChange(fn){ onChange=fn; } function setDeck(d){ deck=d; }
  const esc=s=>(s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const furi=()=>mode==='cram' ? !!Store.settings().cramFuri : !!Store.settings().studyFuri;
  function ruby(j,k){ return (furi()&&j&&/[一-鿿]/.test(j))?`<ruby>${esc(j)}<rt>${esc(k)}</rt></ruby>`:esc(j||k); }
  function wordFront(w){
    const text=w.k||w.j;
    const btn=Store.settings().studyAudioButton!==false ? `<div class="study-audio-corner">${WordAudio.button(text, 'Прослушать', w.a||w.audio)}</div>` : '';
    const showPitch=furi() && Store.settings().pitchAccent!==false;
    const pitch=showPitch ? `<div class="study-pitch">${Pitch.render(w.k||w.j, w.j||w.k, w.pa||w.pitch)}</div>` : '';
    return `${btn}<div class="word">${ruby(w.j,w.k)}</div>
      ${pitch}`;
  }
  const T=(m)=>{ if(window.toast) toast(m); };

  const REND = {
    kanji:{ front:k=>`<div class="kanji">${esc(k.c)}</div>`, tag:k=>LU.lessonLabel(k.lib,k.l),
      back:k=>(k.ex||[]).map(i=>D.vocab[i]).filter(v=>v&&v.j&&v.j.includes(k.c)).slice(0,5).map(rowEx).join('') },
    words:{ front:w=>wordFront(w), tag:w=>LU.lessonLabel(w.lib,w.l),
      back:w=>`${w.j?`<div class="ex"><span class="w">${esc(w.j)}</span><span class="rd">${esc(w.k)}</span></div>`:''}
        <div class="ex"><span class="w" style="min-width:auto">${LU.ml(w.r)}</span></div>
        <div class="ex"><span class="w" style="min-width:auto;color:var(--muted)">${LU.ml(w.e)}</span></div>` },
    grammar:{ front:g=>`<div class="word" style="font-size:clamp(34px,9vw,56px)">${esc(g.t)}</div>`, tag:g=>'文 '+LU.lessonLabel(g.lib,g.l),
      back:g=>`<div class="ex"><span class="w" style="min-width:auto;color:var(--accent);font-size:18px">${esc(g.p)}</span></div>
        <div class="ex"><span class="w" style="min-width:auto;color:var(--muted);line-height:1.5">${esc(g.d||g.m)}</span></div>` },
  };
  function rowEx(v){ return `<div class="ex"><span class="w">${ruby(v.j,v.k)}</span><span class="rd">${esc(v.k)}</span>
    <span class="mn">${esc(v.r)}<br><span style="color:var(--muted2)">${esc(v.e)}</span></span></div>`; }
  function typeOf(x){ return x.c!==undefined?'kanji':(x.p!==undefined?'grammar':'words'); }
  const itemsFor={kanji:()=>D.kanji,words:()=>D.words,grammar:()=>D.grammar};
  function allItems(){ return D.kanji.concat(D.words,D.grammar); }
  function cramItems(){ const s=new Set(Store.cramList()); return allItems().filter(x=>s.has(x.uid)&&Store.cramReady(x.uid)); }

  function remaining(){ return Store.deckRemaining(deck); }
  function rebuild(){ const left=remaining(); q = mode==='cram' ? shuffle(cramItems()) : (left>0?SRS.queue(itemsFor[deck](),Store,{newLimit:left,limit:left}).queue:[]); }
  function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  // При опустошении сессионной колоды пересобираем из актуального состояния —
  // иначе «на сегодня всё» при ещё оставшихся (по счётчикам) карточках.
  function clearBlitzTimers(){ clearTimeout(blitzTimer); clearTimeout(blitzNextTimer); blitzTimer=0; blitzNextTimer=0; blitzToken++; }
  function next(){ clearBlitzTimers(); revealed=false; noKnow=false; cur=q.shift()||null; if(!cur && mode!=='cram'){ rebuild(); cur=q.shift()||null; } render(); }
  function counters(){ const st=$('studyTop'); if(st) st.style.display=mode==='cram'?'none':'';
    if(mode==='cram')return;
    if($('leftLeft')) $('leftLeft').textContent=Math.min(remaining(),q.length+(cur?1:0)); }
  function topbar(){
    if(mode==='cram') return `<div class="chips deck-switch"><span class="pill on">🔥 Зазубрить (${q.length+(cur?1:0)})</span>
      <span class="pill${blitz?' on':''}" id="blitzToggle">⚡ Блиц</span>
      <span class="pill" id="cramExit">← выйти</span></div>`;
    return `<div class="chips deck-switch">
      <span class="pill${deck==='kanji'?' on':''}" data-deck="kanji">漢 Кандзи</span>
      <span class="pill${deck==='words'?' on':''}" data-deck="words">あ Слова</span>
      <span class="pill${deck==='grammar'?' on':''}" data-deck="grammar">文 Грамматика</span></div>`;
  }
  function render(){
    counters(); const area=$('studyArea');
    if(!cur){
      let cramMsg='Слова из «зазубрить» пройдены.';
      if(mode==='cram'){ const ms=Store.cramNextMs(); if(ms>0){ const m=Math.ceil(ms/60000); cramMsg=`Возвращайтесь через ${m<60?m+' мин':Math.ceil(m/60)+' ч'} и зубрите дальше.`; } }
      area.innerHTML=topbar()+`<div class="card empty"><div class="big">${mode==='cram'?'🔥':'🎉'}</div>
      <b>${mode==='cram'?'Зазубрено на сегодня!':'На сегодня всё!'}</b><div style="margin-top:8px">${mode==='cram'?cramMsg:'Карточек в этой колоде нет. Переключи колоду или измени настройки деки.'}</div>
      ${mode==='cram'?`<button class="btn primary" data-go="home" style="margin-top:14px">← На главную</button>`:''}</div>`;
      bindBar(); onChange(); return; }
    const t=typeOf(cur), c=REND[t];
    area.innerHTML=topbar()+`
      <div class="flash card" id="flash">
        <div class="sw-badge sw-left">НЕ ЗНАЮ</div>
        <div class="sw-badge sw-right">ЗНАЮ</div>
        <span class="pill lesson-tag">${c.tag(cur)}</span><span class="freq-tag">出典</span>
        ${c.front(cur)}
        <div class="hint" id="topHint">Тап — перевод · ← в деку · знаю →</div>
        <div class="back">${c.back(cur)}</div>
      </div><div id="controls"></div>`;
    bindBar(); bindSwipe($('flash')); scheduleBlitz();
  }
  function bindBar(){
    const sw=document.querySelector('.deck-switch'); if(!sw) return;
    sw.onclick=e=>{ if(e.target.closest('#cramExit')){ blitz=false; mode='normal'; deck='kanji'; start(); return; }
      if(e.target.closest('#blitzToggle')){ clearBlitzTimers(); blitz=!blitz; Sound.play('tap'); render(); return; }
      const p=e.target.closest('[data-deck]'); if(!p||p.dataset.deck===deck)return; deck=p.dataset.deck; Sound.play('tap'); start(); };
  }
  function wasNew(){ return Store.status(cur.uid)==='new'; }
  function showBack(){ clearBlitzTimers(); const f=$('flash'); if(f) f.classList.add('revealed'); const th=$('topHint'); if(th) th.style.display='none'; revealed=true; Sound.play('flip'); }

  function scheduleBlitz(){
    clearTimeout(blitzTimer); clearTimeout(blitzNextTimer); blitzTimer=0; blitzNextTimer=0;
    if(mode!=='cram'||!blitz||!cur||revealed) return;
    const c=$('controls');
    if(c) c.innerHTML='<div class="blitz-panel"><b>⚡ Блиц</b><span>Свайп вправо за 4 секунды</span></div>';
    const token=++blitzToken;
    blitzTimer=setTimeout(()=>blitzMiss(token),4000);
  }
  function blitzMiss(token){
    if(token!==blitzToken||mode!=='cram'||!blitz||!cur||revealed) return;
    const word=cur;
    showBack();
    if(window.WordAudio) WordAudio.speak(word.k||word.j, word.a||word.audio);
    const c=$('controls');
    if(c) c.innerHTML=`<div class="blitz-panel miss"><b>Не успел</b><span>${esc(word.k||word.j||'')}</span><small>${LU.ml(word.r||word.m||word.e||'')}</small></div>`;
    const nextToken=blitzToken;
    blitzNextTimer=setTimeout(()=>{ if(nextToken===blitzToken&&cur===word) cramNo(); },4000);
  }

  function reveal(){
    if(revealed) return; showBack();
    if(mode==='cram'){
      $('controls').innerHTML=`<div class="grade" style="grid-template-columns:1fr 1fr">
        <button class="g-hard" id="cNo">✗ Не знаю</button>
        <button class="g-easy" id="cKnow">✓ Знаю</button></div>
        <div class="hint hint-bottom">свайп → знаю · ← не знаю</div>`;
      $('cNo').onclick=()=>cramNo();
      $('cKnow').onclick=()=>cramKnow();
      return;
    }
    const cramOn=Store.settings().cramMode!==false;
    $('controls').innerHTML=`
      <div class="grade" style="grid-template-columns:${cramOn?'1fr 1fr 1fr':'1fr 1fr'}">
        <button class="g-hard" data-g="1">Повторить завтра<small>≈1 день</small></button>
        <button class="g-easy" data-g="3">Повторить через неделю<small>≈7 дней</small></button>
        ${cramOn?'<button class="g-cram" id="cramBtn">🔥 Зазубрить</button>':''}
      </div>
      <div class="grade" style="grid-template-columns:1fr 1fr;margin-top:8px">
        <button class="btn know-btn" id="knowBtn">✓ Знаю</button>
        <button class="btn" id="arcBtn">🗄 В архив</button>
      </div>
      <div class="hint hint-bottom">свайп → знаю · ← дальше</div>`;
    $('controls').querySelector('.grade').onclick=e=>{ const b=e.target.closest('[data-g]'); if(!b)return; const g=+b.dataset.g;
      Store.set(cur.uid,SRS.grade(Store.get(cur.uid),g)); consumeDeckCard(); Sound.play('correct'); next(); };
    if(cramOn&&$('cramBtn')) $('cramBtn').onclick=()=>{ Store.setCram(cur.uid,true); const r=SRS.grade(Store.get(cur.uid),SRS.GRADE.HARD); Store.set(cur.uid,r); consumeDeckCard(); Sound.play('add'); T('Добавлено в 🔥 Зазубрить'); next(); };
    $('knowBtn').onclick=()=>{ markKnown(); next(); };
    $('arcBtn').onclick=()=>{ Store.setArchive(cur.uid,true); consumeDeckCard(); Sound.play('add'); T('Отложено в архив'); next(); };
  }
  function leftReveal(){
    Store.set(cur.uid, SRS.grade(Store.get(cur.uid), SRS.GRADE.HARD)); consumeDeckCard(); Sound.play('add');
    reveal();
    // Отмечено «не знаю»: дальше любой свайп просто листает, штампы убираем.
    noKnow=true; const f=$('flash'); if(f) f.querySelectorAll('.sw-badge').forEach(b=>{ b.style.display='none'; });
    const th=$('topHint'); if(th){ th.style.display='block'; th.textContent='Свайп в любую сторону — дальше'; }
  }
  // «Зазубрить»: «Знаю» — серия подряд (+1, пауза); «Не знаю» — сброс серии + пауза. Без счётчиков/тостов.
  function cramKnow(){ if(!cur) return; markKnown(true); const rem=Store.cramHit(cur.uid); if(rem>0) Store.cramSnooze(cur.uid); T(rem===0?'Слово выучено! 🎉':`Ещё ${rem} раз отметить «Знаю»`); next(); }
  function cramNo(){ if(!cur) return; Store.cramReset(cur.uid); Store.cramSnooze(cur.uid); next(); }
  function consumeDeckCard(){ if(mode!=='cram') Store.deckDailyDec(deck); Store.logActivity(1); onChange(); }
  function markKnown(silent){ Store.set(cur.uid,{...(Store.get(cur.uid)||SRS.fresh()),s:'known',due:0}); consumeDeckCard(); if(!silent) Sound.play('known'); }

  function bindSwipe(el){
    if(!el) return; let x0=0,y0=0,dx=0,dy=0,drag=false; const TH=90;
    const left=el.querySelector('.sw-left'), right=el.querySelector('.sw-right');
    const pt=e=>({x:e.clientX,y:e.clientY});
    el.addEventListener('pointerdown',e=>{ const p=pt(e); x0=p.x; y0=p.y; dx=dy=0; drag=true; el.classList.add('swiping'); });
    el.addEventListener('pointermove',e=>{ if(!drag)return; const p=pt(e); dx=p.x-x0; dy=p.y-y0; if(Math.abs(dx)<Math.abs(dy))return;
      el.style.transform=`translateX(${dx}px) rotate(${dx/22}deg)`;
      if(right) right.style.opacity=Math.max(0,Math.min(1,dx/TH)); if(left) left.style.opacity=Math.max(0,Math.min(1,-dx/TH)); });
    const end=()=>{ if(!drag)return; drag=false; el.classList.remove('swiping'); if(left)left.style.opacity=0; if(right)right.style.opacity=0;
      if(dx>TH){ if(noKnow&&mode!=='cram') fly(1,'skip'); else fly(1,'known'); }
      else if(dx<-TH){ if(mode==='cram'){ el.style.transform=''; el.style.opacity=''; if(revealed) cramNo(); else reveal(); } else if(noKnow) fly(-1,'skip'); else fly(-1, revealed?'next':'left'); }
      else if(Math.abs(dx)<8&&Math.abs(dy)<8){ el.style.transform=''; if(!revealed) reveal(); }
      else el.style.transform=''; };
    el.addEventListener('pointerup',end); el.addEventListener('pointercancel',end); el.addEventListener('pointerleave',end);
    function fly(dir,act){ el.style.transform=`translateX(${dir*600}px) rotate(${dir*30}deg)`; el.style.opacity='0';
      setTimeout(()=>{
        if(act==='known'){ if(mode==='cram'){ cramKnow(); } else { markKnown(); next(); } }
        else if(act==='next'){ if(mode==='cram'){ q.push(cur); } else { Store.set(cur.uid, SRS.grade(Store.get(cur.uid), SRS.GRADE.HARD)); consumeDeckCard(); } next(); }
        else if(act==='skip'){ next(); }
        else { leftReveal(); el.style.transform=''; el.style.opacity='1'; }
      },170); }
  }
  function start(){ mode='normal'; rebuild(); next(); }
  // Сначала переход на экран (он вызовет start() в normal), затем включаем cram — иначе режим сбрасывался.
  function startCram(){ if(Store.settings().cramMode===false){ T('Режим «Зазубрить» выключен'); return; } if(window.App) App.go('study'); mode='cram'; rebuild(); next(); }
  return { start, startCram, setOnChange, setDeck, counters };
})();
