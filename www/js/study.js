/* ============================================================
   study.js — карточки. Обычный режим (кандзи/слова/грамматика)
   и режим «Зазубрить» (🔥). Оценки: Трудно/Легко/🔥/Знаю/Архив.
   ============================================================ */
const Study = (() => {
  const D = window.GENKI_DATA;
  const $ = id=>document.getElementById(id);
  let deck='kanji', mode='normal', q=[], cur=null, revealed=false, noKnow=false;
  let onChange=()=>{}; function setOnChange(fn){ onChange=fn; } function setDeck(d){ deck=d; }
  const esc=s=>(s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const furi=()=>Store.settings().studyFuri;
  function ruby(j,k){ return (furi()&&j&&/[一-鿿]/.test(j))?`<ruby>${esc(j)}<rt>${esc(k)}</rt></ruby>`:esc(j||k); }
  const T=(m)=>{ if(window.toast) toast(m); };

  const REND = {
    kanji:{ front:k=>`<div class="kanji">${esc(k.c)}</div>`, tag:k=>LU.lessonLabel(k.lib,k.l),
      back:k=>(k.ex||[]).map(i=>D.vocab[i]).filter(v=>v&&v.j&&v.j.includes(k.c)).slice(0,5).map(rowEx).join('') },
    words:{ front:w=>`<div class="word">${ruby(w.j,w.k)}</div>`, tag:w=>LU.lessonLabel(w.lib,w.l),
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
  const lim={kanji:()=>Store.settings().newKanji,words:()=>Store.settings().newWords,grammar:()=>Store.settings().newGrammar};
  const itemsFor={kanji:()=>D.kanji,words:()=>D.words,grammar:()=>D.grammar};
  function allItems(){ return D.kanji.concat(D.words,D.grammar); }
  function cramItems(){ const s=new Set(Store.cramList()); return allItems().filter(x=>s.has(x.uid)&&Store.cramReady(x.uid)); }

  function remaining(){ return Math.max(0, lim[deck]() - Store.newDailyCount(deck)); }
  function rebuild(){ q = mode==='cram' ? shuffle(cramItems()) : SRS.queue(itemsFor[deck](),Store,{newLimit:remaining()}).queue; }
  function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  // При опустошении сессионной колоды пересобираем из актуального состояния —
  // иначе «на сегодня всё» при ещё оставшихся (по счётчикам) карточках.
  function next(){ revealed=false; noKnow=false; cur=q.shift()||null; if(!cur && mode!=='cram'){ rebuild(); cur=q.shift()||null; } render(); }
  function counters(){ const st=$('studyTop'); if(st) st.style.display=mode==='cram'?'none':'';
    if(mode==='cram')return;
    // «Осталось» = карточки текущей сессии: любое взаимодействие листает (next) → −1.
    if($('leftLeft')) $('leftLeft').textContent=q.length+(cur?1:0); }
  function topbar(){
    if(mode==='cram') return `<div class="chips deck-switch"><span class="pill on">🔥 Зазубрить (${q.length+(cur?1:0)})</span>
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
    bindBar(); bindSwipe($('flash'));
  }
  function bindBar(){
    const sw=document.querySelector('.deck-switch'); if(!sw) return;
    sw.onclick=e=>{ if(e.target.closest('#cramExit')){ mode='normal'; deck='kanji'; start(); return; }
      const p=e.target.closest('[data-deck]'); if(!p||p.dataset.deck===deck)return; deck=p.dataset.deck; Sound.play('tap'); start(); };
  }
  function wasNew(){ return Store.status(cur.uid)==='new'; }
  function showBack(){ const f=$('flash'); if(f) f.classList.add('revealed'); const th=$('topHint'); if(th) th.style.display='none'; revealed=true; Sound.play('flip'); }

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
    $('controls').innerHTML=`
      <div class="grade" style="grid-template-columns:1fr 1fr 1fr">
        <button class="g-hard" data-g="1">Повторить завтра<small>≈1 день</small></button>
        <button class="g-easy" data-g="3">Повторить через неделю<small>≈7 дней</small></button>
        <button class="g-cram" id="cramBtn">🔥 Зазубрить</button>
      </div>
      <div class="grade" style="grid-template-columns:1fr 1fr;margin-top:8px">
        <button class="btn know-btn" id="knowBtn">✓ Знаю</button>
        <button class="btn" id="arcBtn">🗄 В архив</button>
      </div>
      <div class="hint hint-bottom">свайп → знаю · ← дальше</div>`;
    $('controls').querySelector('.grade').onclick=e=>{ const b=e.target.closest('[data-g]'); if(!b)return; const g=+b.dataset.g; const nw=wasNew();
      Store.set(cur.uid,SRS.grade(Store.get(cur.uid),g)); Store.logActivity(1); if(nw) countNew(); Sound.play('correct'); onChange(); next(); };
    $('cramBtn').onclick=()=>{ Store.setCram(cur.uid,true); const r=SRS.grade(Store.get(cur.uid),SRS.GRADE.HARD); Store.set(cur.uid,r); if(wasNew()) countNew(); Store.logActivity(1); Sound.play('add'); T('Добавлено в 🔥 Зазубрить'); onChange(); next(); };
    $('knowBtn').onclick=()=>{ markKnown(); next(); };
    $('arcBtn').onclick=()=>{ const nw=wasNew(); Store.setArchive(cur.uid,true); if(nw) countNew(); Store.logActivity(1); Sound.play('add'); T('Отложено в архив'); onChange(); next(); };
  }
  function leftReveal(){
    const nw=wasNew();
    Store.set(cur.uid, SRS.grade(Store.get(cur.uid), SRS.GRADE.HARD)); Store.logActivity(1); if(nw) countNew(); Sound.play('add');
    reveal();
    // Отмечено «не знаю»: дальше любой свайп просто листает, штампы убираем.
    noKnow=true; const f=$('flash'); if(f) f.querySelectorAll('.sw-badge').forEach(b=>{ b.style.display='none'; });
    const th=$('topHint'); if(th){ th.style.display='block'; th.textContent='Свайп в любую сторону — дальше'; }
  }
  // «Зазубрить»: «Знаю» — серия подряд (+1, пауза); «Не знаю» — сброс серии + пауза. Без счётчиков/тостов.
  function cramKnow(){ if(!cur) return; markKnown(true); const rem=Store.cramHit(cur.uid); if(rem>0) Store.cramSnooze(cur.uid); T(rem===0?'Слово выучено! 🎉':`Ещё ${rem} раз отметить «Знаю»`); next(); }
  function cramNo(){ if(!cur) return; Store.cramReset(cur.uid); Store.cramSnooze(cur.uid); next(); }
  function countNew(){ Store.newDailyInc(deck); }
  function markKnown(silent){ const nw=wasNew(); Store.set(cur.uid,{...(Store.get(cur.uid)||SRS.fresh()),s:'known',due:0}); Store.logActivity(1); if(nw) countNew(); if(!silent) Sound.play('known'); onChange(); }

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
        else if(act==='next'){ if(mode==='cram'){ q.push(cur); } else { const nw=wasNew(); Store.set(cur.uid, SRS.grade(Store.get(cur.uid), SRS.GRADE.HARD)); Store.logActivity(1); if(nw) countNew(); } next(); }
        else if(act==='skip'){ next(); }
        else { leftReveal(); el.style.transform=''; el.style.opacity='1'; }
      },170); }
  }
  function start(){ mode='normal'; rebuild(); next(); }
  // Сначала переход на экран (он вызовет start() в normal), затем включаем cram — иначе режим сбрасывался.
  function startCram(){ if(window.App) App.go('study'); mode='cram'; rebuild(); next(); }
  return { start, startCram, setOnChange, setDeck, counters };
})();
