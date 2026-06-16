/* ============================================================
   kanjilist.js — кандзи. Категории: статус/библиотека/урок.
   Тап — карточка с примерами. Долгое нажатие — отметить/снять «знаю».
   ============================================================ */
const KList = (() => {
  const D = window.GENKI_DATA;
  const $ = id=>document.getElementById(id);
  let statusFilter='all', libFilter='all', lessonFilter=0, onChange=()=>{};
  function setOnChange(fn){ onChange=fn; }
  const uid=k=>k.uid||('k'+k.id);
  function exFor(k){ return (k.ex||[]).map(i=>D.vocab[i]).filter(Boolean); }
  function statusOf(k){ const s=Store.status(uid(k)); return (s==='learning'||s==='review')?'learning':s; }
  function base(){ return D.kanji.filter(k=>Store.libOn(k.lib)); }
  function pass(k){
    if(libFilter!=='all' && k.lib!==libFilter) return false;
    if(lessonFilter && k.l!==lessonFilter) return false;
    if(statusFilter==='fav') return Store.favHas(uid(k));
    if(statusFilter!=='all' && statusOf(k)!==statusFilter) return false;
    return true;
  }
  function chips(wrap,arr,cur,attr,cb){ wrap.innerHTML=arr.map(([v,l])=>`<span class="pill${String(v)===String(cur)?' on':''}" data-${attr}="${v}">${l}</span>`).join(''); wrap.onclick=e=>{ const p=e.target.closest(`[data-${attr}]`); if(!p)return; cb(p.dataset[attr]); }; }
  function buildStatus(){ chips($('kStatus'),[['all','Все'],['new','Новые'],['learning','Учу'],['known','Знаю']],statusFilter,'st',v=>{ statusFilter=v; buildStatus(); render(); }); }
  function buildLibs(){ const libs=LU.activeLibs().filter(l=>base().some(k=>k.lib===l.id)); const arr=[['all','Все']].concat(libs.map(l=>[l.id,l.name])); chips($('kLibs'),arr,libFilter,'lib',v=>{ libFilter=v; lessonFilter=0; buildLibs(); buildLessons(); render(); }); }
  function buildLessons(){ const wrap=$('kFilters'); if(libFilter==='all'){ wrap.innerHTML=''; return; }
    const ls=[...new Set(base().filter(k=>k.lib===libFilter).map(k=>k.l))].sort((a,b)=>a-b);
    const arr=[[0,'Все уроки']].concat(ls.map(l=>[l,LU.lessonLabel(libFilter,l)]));
    chips(wrap,arr,lessonFilter,'less',v=>{ lessonFilter=+v; buildLessons(); render(); }); }
  function render(){
    buildStatus(); buildLibs(); buildLessons();
    const grid=$('kGrid'); const items=base().filter(pass);
    grid.innerHTML=items.map(k=>{ const st=Store.status(uid(k)); const cls=st==='known'?'known':(st==='learning'||st==='review')?'learning':'';
      return `<div class="kcell ${cls}" data-k="${k.id}">${k.c}</div>`; }).join('')||`<div class="empty" style="grid-column:1/-1"><div class="big">漢</div>Пусто</div>`;
    bindGrid(grid);
  }
  function bindGrid(grid){
    let timer=null, longed=false, target=null, sx=0, sy=0;
    const clear=()=>{ if(timer){ clearTimeout(timer); timer=null; } };
    grid.addEventListener('pointerdown',e=>{ const c=e.target.closest('[data-k]'); if(!c)return; target=c; longed=false; sx=e.clientX; sy=e.clientY;
      clear(); timer=setTimeout(()=>{ longed=true; timer=null; toggleKnown(+target.dataset.k); if(navigator.vibrate){try{navigator.vibrate(15);}catch(_){}}; },420); });
    grid.addEventListener('pointermove',e=>{ if(timer && (Math.abs(e.clientX-sx)>12||Math.abs(e.clientY-sy)>12)) clear(); });
    grid.addEventListener('pointerup',e=>{ clear(); if(target&&!longed){ const c=e.target.closest('[data-k]'); if(c&&c===target) openSheet(+target.dataset.k); } target=null; longed=false; });
    grid.addEventListener('pointercancel',()=>{ clear(); target=null; });
  }
  function toggleKnown(id){
    const k=D.kanji.find(x=>x.id===id)||D.kanji[id]; const u=uid(k);
    if(Store.status(u)==='known'){ Store.set(u,SRS.fresh()); } else { Store.set(u,{...(Store.get(u)||SRS.fresh()),s:'known',due:0}); Sound.play('known'); }
    render(); onChange();
  }
  function openSheet(id){
    const k=D.kanji.find(x=>x.id===id)||D.kanji[id]; const u=uid(k); const st=Store.status(u); const ex=exFor(k); const known=st==='known';
    $('sheet').innerHTML=`<div class="grip"></div><div class="big-kanji">${k.c}</div>
      <div class="sub">${LU.lessonLabel(k.lib,k.l)} · ${k.freq} слов · ${stLabel(st)} · 出典 Genki</div>
      ${ex.map(v=>`<div class="ex"><span class="w">${v.j||v.k}</span><span class="rd">${v.k}</span>
        <span class="mn">${LU.esc(v.r)}<br><span style="color:var(--muted2)">${LU.esc(v.e)}</span></span></div>`).join('')}
      <div class="actions">
        <button class="btn ${known?'':'primary'}" id="mKnow">${known?'↩︎ Вернуть в учёбу':'✓ Я знаю — отсеять'}</button>
        <button class="btn" id="mDict">🔍 В словарь</button>
        <button class="btn ghost" id="mClose" style="grid-column:1/-1">Закрыть</button></div>`;
    $('modal').classList.add('open'); $('mClose').onclick=closeSheet;
    $('mDict').onclick=()=>{ closeSheet(); App.go('dict'); const i=$('dictInput'); if(i) i.value=k.c; Dict.render(k.c); };
    $('mKnow').onclick=()=>{ if(known) Store.set(u,SRS.fresh()); else { Store.set(u,{...(Store.get(u)||SRS.fresh()),s:'known',due:0}); Sound.play('known'); } closeSheet(); render(); onChange(); };
  }
  function closeSheet(){ $('modal').classList.remove('open'); }
  function stLabel(s){ return {new:'новый',learning:'учу',review:'на повторении',known:'знаю'}[s]||s; }
  function init(){ render(); $('modal').addEventListener('click',e=>{ if(e.target.id==='modal') closeSheet(); }); }
  return { init, render, setOnChange, openSheet };
})();
