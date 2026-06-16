/* ============================================================
   grammar.js — грамматика. Фильтры статус/библиотека/урок.
   Свайп →знаю/←снять. Избранное (★). Тап — подробности.
   Короткий коммент опционален (настройка; телефон off / планшет on).
   ============================================================ */
const Gram = (() => {
  const D = window.GENKI_DATA;
  let statusFilter='all', libFilter='all', lessonFilter=-1;
  const $ = id=>document.getElementById(id);
  const norm = s=>(s||'').toLowerCase().trim();
  const uid = g=>g.uid||('g'+g.id);
  function showComment(){ const s=Store.settings().grammarComment; return s==null ? (window.innerWidth>=760) : !!s; }
  function statusOf(g){ const s=Store.status(uid(g)); return (s==='learning'||s==='review')?'learning':s; }
  function base(){ return D.grammar.filter(g=>Store.libOn(g.lib)); }
  function search(q){
    q=norm(q); let list=base();
    if(libFilter!=='all') list=list.filter(g=>g.lib===libFilter);
    if(lessonFilter>=0) list=list.filter(g=>g.l===lessonFilter);
    if(statusFilter==='fav') list=list.filter(g=>Store.favHas(uid(g)));
    else if(statusFilter!=='all') list=list.filter(g=>statusOf(g)===statusFilter);
    if(!q) return list;
    return list.filter(g=>g.t.includes(q)||norm(g.p).includes(q)||norm(g.m).includes(q)||norm(g.d||'').includes(q));
  }
  function render(q){
    if(q==null) q=$('gramInput').value;
    const res=search(q); const sc=showComment();
    $('gramMeta').textContent=`Грамматика: ${res.length} · нажми для подробностей`;
    const box=$('gramResults');
    if(!res.length){ box.innerHTML=`<div class="empty"><div class="big">📘</div>Ничего не найдено</div>`; return; }
    box.innerHTML=res.map(g=>{
      const id=uid(g); const known=Store.status(id)==='known'; const fav=Store.favHas(id);
      return `<div class="entry card${known?' known-entry':''}" data-uid="${id}" data-gid="${g.id}">
        <div class="jp" style="min-width:108px">${LU.esc(g.t)}</div>
        <div class="mean"><div class="ru ru-main" style="color:var(--accent)">${LU.esc(g.p)}</div>${sc?`<div class="en">${LU.esc(g.m)}</div>`:''}</div>
        <div class="lz"><span class="fav${fav?' on':''}" data-fav="${id}">${fav?'★':'☆'}</span><br>${LU.lessonLabel(g.lib,g.l)}</div>
      </div>`;
    }).join('');
  }
  function openDetail(gid){
    const g=D.grammar.find(x=>x.id===gid); if(!g) return; const id=uid(g); const known=Store.status(id)==='known';
    $('sheet').innerHTML=`<div class="grip"></div>
      <div style="font-family:var(--jp);font-size:34px;font-weight:700;text-align:center;margin:4px 0 2px">${LU.esc(g.t)}</div>
      <div style="text-align:center;color:var(--accent);font-size:16px;margin-bottom:10px">${LU.esc(g.p)}</div>
      <div style="color:var(--muted2);font-size:12px;text-align:center;margin-bottom:14px">${LU.lessonLabel(g.lib,g.l)} · 出典 Genki</div>
      <div style="font-size:15px;line-height:1.55">${LU.esc(g.d||g.m)}</div>
      <div class="actions" style="margin-top:18px">
        <button class="btn ${known?'':'primary'}" id="gKnow">${known?'↩︎ Вернуть в учёбу':'✓ Знаю'}</button>
        <button class="btn ghost" id="gClose">Закрыть</button></div>`;
    $('modal').classList.add('open');
    $('gClose').onclick=()=>$('modal').classList.remove('open');
    $('gKnow').onclick=()=>{ if(known) Store.set(id,SRS.fresh()); else { Store.set(id,{...(Store.get(id)||SRS.fresh()),s:'known',due:0}); Sound.play('known'); } $('modal').classList.remove('open'); render(); };
  }
  function chips(wrap,arr,cur,attr,cb){ wrap.innerHTML=arr.map(([v,l])=>`<span class="pill${String(v)===String(cur)?' on':''}" data-${attr}="${v}">${l}</span>`).join(''); wrap.onclick=e=>{ const p=e.target.closest(`[data-${attr}]`); if(!p)return; cb(p.dataset[attr]); }; }
  function buildStatus(){ chips($('gStatus'),[['all','Все'],['new','Новые'],['learning','Учу'],['known','Знаю'],['fav','★']],statusFilter,'st',v=>{ statusFilter=v; buildStatus(); render(); }); }
  function buildLibs(){ const arr=[['all','Все']].concat(LU.activeLibs().map(l=>[l.id,l.name])); chips($('gLibs'),arr,libFilter,'lib',v=>{ libFilter=v; lessonFilter=-1; buildLibs(); buildLessons(); render(); }); }
  function buildLessons(){ const wrap=$('gFilters'); if(libFilter==='all'){ wrap.innerHTML=''; return; }
    const ls=[...new Set(base().filter(g=>g.lib===libFilter).map(g=>g.l))].sort((a,b)=>a-b);
    const arr=[[-1,'Все уроки']].concat(ls.map(l=>[l,LU.lessonLabel(libFilter,l)]));
    chips(wrap,arr,lessonFilter,'less',v=>{ lessonFilter=+v; buildLessons(); render(); }); }
  function init(){
    buildStatus(); buildLibs(); buildLessons();
    $('gramInput').addEventListener('input',()=>render());
    const box=$('gramResults');
    box.addEventListener('click',e=>{ const f=e.target.closest('[data-fav]'); if(f){ e.stopPropagation(); Store.favToggle(f.dataset.fav); render(); return; } const en=e.target.closest('[data-gid]'); if(en) openDetail(+en.dataset.gid); });
    LU.attachSwipe(box, null, ()=>render());
    render('');
  }
  return { init, render };
})();
