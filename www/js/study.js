/* ============================================================
   study.js — карточки: КАНДЗИ / СЛОВА / ГРАММАТИКА.
   Свайп → знаю · ← перевод+«трудно» · тап — перевод+оценки.
   После показа перевода: свайп → знаю, ← дальше. Фуригана (тумблер).
   ============================================================ */
const Study = (() => {
  const D = window.GENKI_DATA;
  const $ = id=>document.getElementById(id);
  let deck='kanji', q=[], cur=null, revealed=false;
  let onChange=()=>{}; function setOnChange(fn){ onChange=fn; } function setDeck(d){ deck=d; }
  const esc=s=>(s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const furi=()=>Store.settings().studyFuri;
  function ruby(j,k){ return (furi()&&j&&/[一-鿿]/.test(j))?`<ruby>${esc(j)}<rt>${esc(k)}</rt></ruby>`:esc(j||k); }

  const decks = {
    kanji:{ items:()=>D.kanji, lim:()=>Store.settings().newKanji,
      front:k=>`<div class="kanji">${esc(k.c)}</div>`, tag:k=>LU.lessonLabel(k.lib,k.l),
      back:k=>(k.ex||[]).map(i=>D.vocab[i]).filter(Boolean).slice(0,5).map(rowEx).join('') },
    words:{ items:()=>D.words, lim:()=>Store.settings().newWords,
      front:w=>`<div class="word">${ruby(w.j,w.k)}</div>`, tag:w=>LU.lessonLabel(w.lib,w.l),
      back:w=>`${w.j?`<div class="ex"><span class="w">${esc(w.j)}</span><span class="rd">${esc(w.k)}</span></div>`:''}
        <div class="ex"><span class="w" style="min-width:auto">${esc(w.r)}</span></div>
        <div class="ex"><span class="w" style="min-width:auto;color:var(--muted)">${esc(w.e)}</span></div>` },
    grammar:{ items:()=>D.grammar, lim:()=>Store.settings().newGrammar,
      front:g=>`<div class="word" style="font-size:clamp(34px,9vw,56px)">${esc(g.t)}</div>`, tag:g=>'文 '+LU.lessonLabel(g.lib,g.l),
      back:g=>`<div class="ex"><span class="w" style="min-width:auto;color:var(--accent);font-size:18px">${esc(g.p)}</span></div>
        <div class="ex"><span class="w" style="min-width:auto;color:var(--muted);line-height:1.5">${esc(g.d||g.m)}</span></div>` },
  };
  function rowEx(v){ return `<div class="ex"><span class="w">${ruby(v.j,v.k)}</span><span class="rd">${esc(v.k)}</span>
    <span class="mn">${esc(v.r)}<br><span style="color:var(--muted2)">${esc(v.e)}</span></span></div>`; }
  function cfg(){ return decks[deck]; }
  function remaining(){ return Math.max(0, cfg().lim() - Store.newDailyCount(deck)); }
  function rebuild(){ q=SRS.queue(cfg().items(),Store,{newLimit:remaining()}).queue; }
  function next(){ revealed=false; cur=q.shift()||null; render(); }
  function counters(){ const {due,newCards}=SRS.queue(cfg().items(),Store,{newLimit:remaining()});
    $('dueLeft').textContent=due.length; $('newLeft').textContent=(newCards.length>999?'∞':newCards.length); }
  function deckBar(){ return `<div class="chips deck-switch">
    <span class="pill${deck==='kanji'?' on':''}" data-deck="kanji">漢 Кандзи</span>
    <span class="pill${deck==='words'?' on':''}" data-deck="words">あ Слова</span>
    <span class="pill${deck==='grammar'?' on':''}" data-deck="grammar">文 Грамматика</span></div>`; }

  function render(){
    counters(); const area=$('studyArea');
    if(!cur){ area.innerHTML=deckBar()+`<div class="card empty"><div class="big">🎉</div>
      <b>На сегодня всё!</b><div style="margin-top:8px">Карточек в этой колоде нет. Переключи колоду,
      измени лимиты или включи другие материалы в настройках.</div></div>`; bindDeck(); onChange(); return; }
    const c=cfg();
    area.innerHTML=deckBar()+`
      <div class="flash card" id="flash">
        <div class="sw-badge sw-left">ПЕРЕВОД<br><small>трудно</small></div>
        <div class="sw-badge sw-right">ЗНАЮ<br><small>скрыть</small></div>
        <span class="pill lesson-tag">${c.tag(cur)}</span><span class="freq-tag">出典</span>
        ${c.front(cur)}
        <div class="hint" id="topHint">Тап — перевод · ← в деку (трудно) · знаю →</div>
        <div class="back">${c.back(cur)}</div>
      </div>
      <div id="controls"></div>`;
    bindDeck(); bindSwipe($('flash'));
  }
  function bindDeck(){
    const sw=document.querySelector('.deck-switch'); if(!sw) return;
    sw.onclick=e=>{ const p=e.target.closest('[data-deck]'); if(!p||p.dataset.deck===deck)return; deck=p.dataset.deck; Sound.play('tap'); start(); };
  }
  function wasNew(){ return Store.status(cur.uid)==='new'; }
  function countNew(){ Store.newDailyInc(deck); }

  function showBack(){ const f=$('flash'); if(f) f.classList.add('revealed'); const th=$('topHint'); if(th) th.style.display='none'; revealed=true; Sound.play('flip'); }
  function tapReveal(){
    if(revealed) return; showBack();
    $('controls').innerHTML=`
      <div class="grade">
        <button class="g-again" data-g="0">Снова<small>1 мин</small></button>
        <button class="g-hard" data-g="1">Трудно<small>≈3 дн</small></button>
        <button class="g-good" data-g="2">Хорошо<small>↑</small></button>
        <button class="g-easy" data-g="3">Легко<small>↑↑</small></button>
      </div>
      <button class="btn know-btn" id="knowBtn">✓ Знаю — больше не показывать</button>
      <div class="hint hint-bottom">свайп → знаю · ← дальше</div>`;
    $('controls').querySelector('.grade').onclick=e=>{ const b=e.target.closest('[data-g]'); if(!b)return; const g=+b.dataset.g; const nw=wasNew();
      Store.set(cur.uid,SRS.grade(Store.get(cur.uid),g)); Store.logActivity(1); if(nw&&g!==SRS.GRADE.AGAIN) countNew(); Sound.play(g===0?'wrong':'correct');
      if(g===SRS.GRADE.AGAIN) q.push(cur); onChange(); next(); };
    $('knowBtn').onclick=()=>{ markKnown(); next(); };
  }
  function leftReveal(){
    const nw=wasNew();
    Store.set(cur.uid, SRS.grade(Store.get(cur.uid), SRS.GRADE.HARD)); Store.logActivity(1); if(nw) countNew(); Sound.play('add');
    showBack();
    $('controls').innerHTML=`<button class="btn primary" id="nextBtn" style="width:100%">Далее →</button>
      <div class="hint hint-bottom">свайп → знаю · ← дальше</div>`;
    $('nextBtn').onclick=next; onChange();
  }
  function markKnown(){ const nw=wasNew(); Store.set(cur.uid,{...(Store.get(cur.uid)||SRS.fresh()),s:'known',due:0}); Store.logActivity(1); if(nw) countNew(); Sound.play('known'); onChange(); }

  function bindSwipe(el){
    if(!el) return; let x0=0,y0=0,dx=0,dy=0,drag=false; const TH=90;
    const left=el.querySelector('.sw-left'), right=el.querySelector('.sw-right');
    const pt=e=>({x:e.clientX,y:e.clientY});
    el.addEventListener('pointerdown',e=>{ const p=pt(e); x0=p.x; y0=p.y; dx=dy=0; drag=true; el.classList.add('swiping'); });
    el.addEventListener('pointermove',e=>{ if(!drag)return; const p=pt(e); dx=p.x-x0; dy=p.y-y0; if(Math.abs(dx)<Math.abs(dy))return;
      el.style.transform=`translateX(${dx}px) rotate(${dx/22}deg)`;
      if(right) right.style.opacity=Math.max(0,Math.min(1,dx/TH)); if(left) left.style.opacity=Math.max(0,Math.min(1,-dx/TH)); });
    const end=()=>{ if(!drag)return; drag=false; el.classList.remove('swiping'); if(left)left.style.opacity=0; if(right)right.style.opacity=0;
      if(dx>TH) fly(1,'known');
      else if(dx<-TH) fly(-1, revealed?'next':'left');
      else if(Math.abs(dx)<8&&Math.abs(dy)<8){ el.style.transform=''; if(!revealed) tapReveal(); }
      else el.style.transform=''; };
    el.addEventListener('pointerup',end); el.addEventListener('pointercancel',end); el.addEventListener('pointerleave',end);
    function fly(dir,act){ el.style.transform=`translateX(${dir*600}px) rotate(${dir*30}deg)`; el.style.opacity='0';
      setTimeout(()=>{
        if(act==='known'){ markKnown(); next(); }
        else if(act==='next'){ next(); }
        else { leftReveal(); el.style.transform=''; el.style.opacity='1'; }
      },170); }
  }
  function start(){ rebuild(); next(); }
  return { start, setOnChange, setDeck, counters };
})();
